import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users, plantInvites } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';
// Record every call the route makes to the plant-request mailer without
// touching real SMTP. The other exports are inert stubs so the routes mounted
// by buildTestApp still link.
let inviteCalls = [];
mock.module('../lib/email.js', {
    namedExports: {
        sendPlantInviteNotification: async (emails, details) => {
            inviteCalls.push({ emails, plantName: details.plantName });
            return true;
        },
        sendWelcomeEmail: async () => true,
        sendOwnerInviteEmail: async () => true,
        sendPasswordResetEmail: async () => true,
        sendPasswordResetNotification: async () => false,
        sendDeliveryNotificationEmail: async () => true,
        sendOrderPlacedEmail: async () => true,
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
        role: opts.role ?? 'client',
        isActive: true,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// Registers a fake identity-bearing SSE connection and records the event names
// it actually receives, mirroring the helper used by sse.routes.test.ts.
function captureSSE(identity) {
    const raw = [];
    const mockRes = {
        writableEnded: false,
        destroyed: false,
        req: { httpVersionMajor: 2 },
        setHeader() { },
        flushHeaders() { },
        write(payload) { raw.push(payload); return true; },
        end() { mockRes.writableEnded = true; },
    };
    const id = addSSEClient(mockRes, identity);
    return {
        id,
        events() {
            return raw
                .map((chunk) => /^event: (.+)$/m.exec(chunk)?.[1])
                .filter((e) => Boolean(e));
        },
        close() { removeSSEClient(id); },
    };
}
const LEAD = {
    placeId: 'ChIJ_notify_001',
    name: 'Sunrise RMC Plant',
    address: '12 Industrial Rd, Navi Mumbai',
    latitude: 19.033,
    longitude: 73.0297,
    contactNumber: '9820011001',
};
// The notification is fire-and-forget after the response, so give the
// microtask/IO a brief window to settle before asserting on the mailer.
function flush(ms = 50) {
    return new Promise((r) => setTimeout(r, ms));
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE plant_invites, users, app_settings RESTART IDENTITY CASCADE`);
    inviteCalls = [];
});
after(async () => {
    await pool.end();
});
test('a NEW invite emails admins+authority and toasts them over SSE (not staff/clients)', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const authority = await createUser({ name: 'Boss', email: 'boss@test.com', role: 'authority' });
    await createUser({ name: 'Dispatch', email: 'dispatch@test.com', role: 'dispatcher' });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const adminSSE = captureSSE({ role: 'admin' });
    const authoritySSE = captureSSE({ role: 'authority' });
    const dispatcherSSE = captureSSE({ role: 'dispatcher' });
    const clientSSE = captureSSE({ role: 'client', clientId: 1 });
    try {
        const res = await request(app)
            .post('/api/plants/invite')
            .set('Authorization', `Bearer ${tokenFor(customer)}`)
            .send(LEAD);
        assert.equal(res.status, 201);
        assert.equal(res.body.deduped, false);
        // The toast + email both fire after the response (fire-and-forget), so wait.
        await flush();
        // SSE: only admin + authority receive the alert.
        assert.ok(adminSSE.events().includes('plant.invite'), 'admin receives plant.invite');
        assert.ok(authoritySSE.events().includes('plant.invite'), 'authority receives plant.invite');
        assert.ok(!dispatcherSSE.events().includes('plant.invite'), 'a dispatcher must NOT receive it');
        assert.ok(!clientSSE.events().includes('plant.invite'), 'a client must NOT receive it');
        // Email: sent once to exactly the admin + authority mailboxes.
        assert.equal(inviteCalls.length, 1, 'the mailer is invoked exactly once');
        assert.equal(inviteCalls[0].plantName, LEAD.name);
        assert.deepEqual([...inviteCalls[0].emails].sort(), [admin.email, authority.email].sort(), 'only admin + authority mailboxes are notified');
    }
    finally {
        adminSSE.close();
        authoritySSE.close();
        dispatcherSSE.close();
        clientSSE.close();
    }
});
test('a repeat (deduped) request does NOT notify again', async () => {
    await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const adminSSE = captureSSE({ role: 'admin' });
    try {
        await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
        await flush();
        assert.equal(inviteCalls.length, 1, 'first request notifies');
        const res = await request(app)
            .post('/api/plants/invite')
            .set('Authorization', `Bearer ${tokenFor(customer)}`)
            .send(LEAD);
        assert.equal(res.body.deduped, true);
        await flush();
        assert.equal(inviteCalls.length, 1, 'a deduped repeat must NOT send another email');
        const inviteEvents = adminSSE.events().filter((e) => e === 'plant.invite');
        assert.equal(inviteEvents.length, 1, 'a deduped repeat must NOT emit another SSE toast');
    }
    finally {
        adminSSE.close();
    }
});
test('a new request with no admins in the system sends no email and does not error', async () => {
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const res = await request(app)
        .post('/api/plants/invite')
        .set('Authorization', `Bearer ${tokenFor(customer)}`)
        .send(LEAD);
    assert.equal(res.status, 201);
    await flush();
    assert.equal(inviteCalls.length, 0, 'no admins => the mailer is never called');
    const rows = await db.select().from(plantInvites);
    assert.equal(rows.length, 1, 'the invite is still recorded');
});
test('disabling the email setting suppresses the mailer but still toasts admins', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    // Admin turns the email notification off via the settings endpoint.
    const save = await request(app)
        .post('/api/admin/plant-invite-notify')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ emailEnabled: false });
    assert.equal(save.status, 200);
    assert.equal(save.body.emailEnabled, false);
    const adminSSE = captureSSE({ role: 'admin' });
    try {
        const res = await request(app)
            .post('/api/plants/invite')
            .set('Authorization', `Bearer ${tokenFor(customer)}`)
            .send(LEAD);
        assert.equal(res.status, 201);
        await flush();
        assert.equal(inviteCalls.length, 0, 'email disabled => the mailer is never called');
        assert.ok(adminSSE.events().includes('plant.invite'), 'the in-app toast still fires regardless');
    }
    finally {
        adminSSE.close();
    }
});
test('extra recipients are emailed on top of the role-based audience', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    // Default roles = admin + authority. Adding an extra mailbox should AUGMENT
    // (not replace) that audience.
    const save = await request(app)
        .post('/api/admin/plant-invite-notify')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ recipients: 'onboarding@team.com' });
    assert.equal(save.status, 200);
    assert.deepEqual(save.body.recipients, ['onboarding@team.com']);
    assert.deepEqual(save.body.roles, ['admin', 'authority']);
    const res = await request(app)
        .post('/api/plants/invite')
        .set('Authorization', `Bearer ${tokenFor(customer)}`)
        .send(LEAD);
    assert.equal(res.status, 201);
    await flush();
    assert.equal(inviteCalls.length, 1, 'the mailer is invoked once');
    assert.deepEqual([...inviteCalls[0].emails].sort(), ['admin@test.com', 'onboarding@team.com'].sort(), 'the admin row AND the extra mailbox are both notified');
});
test('clearing the roles routes the email to only the explicit recipients', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const save = await request(app)
        .post('/api/admin/plant-invite-notify')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ roles: [], recipients: 'shared@team.com' });
    assert.equal(save.status, 200);
    assert.deepEqual(save.body.roles, []);
    const res = await request(app)
        .post('/api/plants/invite')
        .set('Authorization', `Bearer ${tokenFor(customer)}`)
        .send(LEAD);
    assert.equal(res.status, 201);
    await flush();
    assert.equal(inviteCalls.length, 1, 'the mailer is invoked once');
    assert.deepEqual([...inviteCalls[0].emails], ['shared@team.com'], 'with no roles selected only the explicit mailbox is notified — NOT the admin row');
});
test('a chosen role resolves to its active members for both the toast and the email', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const dispatcher = await createUser({ name: 'Dispatch', email: 'dispatch@test.com', role: 'dispatcher' });
    await createUser({ name: 'Idle Dispatch', email: 'idle@test.com', role: 'dispatcher' });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    // Deactivate one dispatcher so we prove only ACTIVE members are resolved.
    await db.execute(sql `UPDATE users SET is_active = false WHERE email = 'idle@test.com'`);
    const save = await request(app)
        .post('/api/admin/plant-invite-notify')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ roles: ['dispatcher'] });
    assert.equal(save.status, 200);
    assert.deepEqual(save.body.roles, ['dispatcher']);
    const adminSSE = captureSSE({ role: 'admin' });
    const dispatcherSSE = captureSSE({ role: 'dispatcher' });
    try {
        const res = await request(app)
            .post('/api/plants/invite')
            .set('Authorization', `Bearer ${tokenFor(customer)}`)
            .send(LEAD);
        assert.equal(res.status, 201);
        await flush();
        // SSE toast follows the chosen role: dispatchers in, admins out.
        assert.ok(dispatcherSSE.events().includes('plant.invite'), 'a dispatcher receives the toast');
        assert.ok(!adminSSE.events().includes('plant.invite'), 'an admin no longer receives the toast');
        // Email goes to the active dispatcher only.
        assert.equal(inviteCalls.length, 1, 'the mailer is invoked once');
        assert.deepEqual([...inviteCalls[0].emails], [dispatcher.email], 'only the active dispatcher is notified (the deactivated one is skipped)');
    }
    finally {
        adminSSE.close();
        dispatcherSSE.close();
    }
});
test('an invalid recipient email is rejected with a 400 and persists nothing', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const save = await request(app)
        .post('/api/admin/plant-invite-notify')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ recipients: 'not-an-email' });
    assert.equal(save.status, 400);
    const cfg = await request(app)
        .get('/api/admin/plant-invite-notify')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.deepEqual(cfg.body.recipients, [], 'the bad value was not persisted');
});
