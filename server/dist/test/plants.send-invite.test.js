import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
// Stub the email module at its boundary so the invite never touches real SMTP
// (workspace SMTP secrets are live). Only sendOwnerInviteEmail is exercised;
// the rest are inert stubs so the routes registered by buildTestApp still link.
let ownerInviteCalls = [];
let inviteEmailResult = true;
mock.module('../lib/email.js', {
    namedExports: {
        sendWelcomeEmail: async () => true,
        sendPasswordResetEmail: async () => true,
        sendLoginCodeEmail: async () => true,
        sendPasswordResetNotification: async () => false,
        sendDeliveryNotificationEmail: async () => true,
        sendOrderPlacedEmail: async () => true,
        sendBatchLoggedEmail: async () => true,
        sendOwnerInviteEmail: async (email, name) => {
            ownerInviteCalls.push({ email, name });
            return inviteEmailResult;
        },
        sendPlantInviteNotification: async () => true,
        sendWhatsAppFailureAlertEmail: async () => true,
        sendTestEmail: async () => ({ ok: false }),
        getSmtpSettings: async () => ({ host: null, port: null, user: null, from: null, configured: false }),
        verifySmtpConnection: async () => ({ ok: false }),
        getSmtpConfig: async () => ({ host: null, port: null, user: null, pass: null, from: null }),
        SMTP_KEYS: { host: 'smtp_host', port: 'smtp_port', user: 'smtp_user', pass: 'smtp_pass', from: 'smtp_from' },
    },
});
const { buildTestApp } = await import('./app.js');
let app;
const PASSWORD = 'secret123';
async function createUser(opts) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'admin',
        plantId: opts.plantId ?? null,
        isActive: true,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function createPlant(opts) {
    const [row] = await db.insert(plants).values({
        name: opts.name,
        latitude: '19.0330000',
        longitude: '73.0297000',
        networkStatus: opts.networkStatus ?? 'pending',
        showOnNetwork: opts.showOnNetwork ?? true,
    }).returning();
    return row;
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    ownerInviteCalls = [];
    inviteEmailResult = true;
    await db.execute(sql `TRUNCATE TABLE plants, users RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('platform admin send-invite provisions an owner and moves the plant pending→invited', async () => {
    const admin = await createUser({ name: 'Root', email: 'root@test.com', role: 'admin', plantId: null });
    const plant = await createPlant({ name: 'Sunrise RMC', networkStatus: 'pending' });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Owner Om', email: 'owner@sunrise.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.invited, true);
    assert.ok(typeof res.body.inviteUrl === 'string' && res.body.inviteUrl.includes('/set-password?token='), 'always returns a usable invite link');
    assert.equal(res.body.emailSent, true);
    assert.equal(res.body.networkStatus, 'invited');
    assert.deepEqual(ownerInviteCalls, [{ email: 'owner@sunrise.com', name: 'Owner Om' }]);
    const [row] = await db.select().from(plants).where(eq(plants.id, plant.id));
    assert.equal(row.networkStatus, 'invited');
    assert.equal(row.inviteStatus, 'invited');
    assert.equal(row.ownerName, 'Owner Om');
    assert.ok(row.inviteSentAt, 'inviteSentAt is stamped');
    const [owner] = await db.select().from(users).where(eq(users.email, 'owner@sunrise.com'));
    assert.equal(owner.role, 'admin');
    assert.equal(owner.plantId, plant.id, 'owner is provisioned as a plant-scoped admin');
});
test('send-invite still returns an invite link when the email fails to send', async () => {
    const admin = await createUser({ name: 'Root', email: 'root@test.com', role: 'admin', plantId: null });
    const plant = await createPlant({ name: 'No SMTP RMC', networkStatus: 'pending' });
    inviteEmailResult = false;
    const res = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Owner', email: 'owner2@test.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.emailSent, false);
    assert.ok(res.body.inviteUrl.includes('/set-password?token='), 'link is always available for copy/WhatsApp');
});
test('send-invite never downgrades a plant already past the invited stage', async () => {
    const admin = await createUser({ name: 'Root', email: 'root@test.com', role: 'admin', plantId: null });
    const plant = await createPlant({ name: 'Active RMC', networkStatus: 'active' });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Owner', email: 'owner3@test.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.networkStatus, 'active', 'a live plant stays active');
    const [row] = await db.select().from(plants).where(eq(plants.id, plant.id));
    assert.equal(row.networkStatus, 'active');
    assert.equal(row.inviteStatus, 'invited', 'invite is still recorded');
});
test('send-invite rejects an email already tied to a different plant', async () => {
    const admin = await createUser({ name: 'Root', email: 'root@test.com', role: 'admin', plantId: null });
    const plantA = await createPlant({ name: 'Plant A' });
    const plantB = await createPlant({ name: 'Plant B' });
    await createUser({ name: 'A Owner', email: 'shared@test.com', role: 'admin', plantId: plantA.id });
    const res = await request(app)
        .post(`/api/plants/${plantB.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'A Owner', email: 'shared@test.com' });
    assert.equal(res.status, 409);
});
test('send-invite validates the body', async () => {
    const admin = await createUser({ name: 'Root', email: 'root@test.com', role: 'admin', plantId: null });
    const plant = await createPlant({ name: 'Plant' });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'No email' });
    assert.equal(res.status, 400);
});
test('send-invite is 404 for an unknown plant', async () => {
    const admin = await createUser({ name: 'Root', email: 'root@test.com', role: 'admin', plantId: null });
    const res = await request(app)
        .post('/api/plants/999999/send-invite')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Owner', email: 'ghost@test.com' });
    assert.equal(res.status, 404);
});
test('send-invite is blocked for plant-scoped admins and clients', async () => {
    const plant = await createPlant({ name: 'Plant' });
    const scopedAdmin = await createUser({ name: 'Scoped', email: 'scoped@test.com', role: 'admin', plantId: plant.id });
    const client = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client', plantId: null });
    const scopedRes = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(scopedAdmin)}`)
        .send({ name: 'Owner', email: 'x@test.com' });
    assert.equal(scopedRes.status, 403, 'plant-scoped admin cannot invite (platform-staff only)');
    const clientRes = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .set('Authorization', `Bearer ${tokenFor(client)}`)
        .send({ name: 'Owner', email: 'y@test.com' });
    assert.equal(clientRes.status, 403);
    const anonRes = await request(app)
        .post(`/api/plants/${plant.id}/send-invite`)
        .send({ name: 'Owner', email: 'z@test.com' });
    assert.equal(anonRes.status, 401);
});
