import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { and, eq, sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let emailBehavior = 'success';
let welcomeCalls = [];
// Replace the whole email module so nothing here touches real SMTP. The only
// export this suite exercises is sendWelcomeEmail; the rest are inert stubs so
// the other routes registered by buildTestApp (admin.ts) still link, but they
// are never invoked by these tests.
mock.module('../lib/email.js', {
    namedExports: {
        sendWelcomeEmail: async (email, name, role) => {
            welcomeCalls.push({ email, name, role });
            if (emailBehavior === 'throw') {
                throw new Error('SMTP EAUTH (stubbed failure)');
            }
            return true;
        },
        sendPasswordResetNotification: async () => false,
        sendDeliveryNotificationEmail: async () => true,
        sendOrderPlacedEmail: async () => true,
        sendOwnerInviteEmail: async () => true,
        sendPlantInviteNotification: async () => true,
        sendWhatsAppFailureAlertEmail: async () => true,
        sendTestEmail: async () => ({ ok: false }),
        getSmtpSettings: async () => ({ host: null, port: null, user: null, from: null, configured: false }),
        verifySmtpConnection: async () => ({ ok: false }),
        getSmtpConfig: async () => ({ host: null, port: null, user: null, pass: null, from: null }),
        SMTP_KEYS: { host: 'smtp_host', port: 'smtp_port', user: 'smtp_user', pass: 'smtp_pass', from: 'smtp_from' },
    },
});
// Import the app only AFTER the mock is registered so the users route binds to
// the stubbed sender rather than the real one.
const { buildTestApp } = await import('./app.js');
let app;
const PASSWORD = 'secret123';
async function createUser(opts) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'dispatcher',
        isActive: true,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
    emailBehavior = 'success';
    welcomeCalls = [];
});
after(async () => {
    await pool.end();
});
test('success path: a successful welcome email sets emailSent=true on the response and audit entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Hire', email: 'newhire@test.com', password: PASSWORD, role: 'dispatcher' });
    assert.equal(res.status, 201);
    assert.equal(res.body.emailSent, true, 'the create response reports the email was sent');
    assert.equal(res.body.email, 'newhire@test.com');
    // The sender was actually invoked with the new account's details.
    assert.equal(welcomeCalls.length, 1, 'the welcome email sender is called exactly once');
    assert.deepEqual(welcomeCalls[0], {
        email: 'newhire@test.com',
        name: 'New Hire',
        role: 'dispatcher',
    });
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserEmail, 'newhire@test.com')));
    assert.equal(logs.length, 1, 'exactly one user.created audit entry should exist');
    assert.equal(logs[0].emailSent, true, 'the audit entry records emailSent=true on success');
    assert.equal(logs[0].actorId, admin.id);
});
test('graceful degradation: a thrown email error still creates the account (201) with emailSent=false', async () => {
    emailBehavior = 'throw';
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Unlucky Hire', email: 'unlucky@test.com', password: PASSWORD, role: 'client' });
    // The account is created despite the email failure.
    assert.equal(res.status, 201, 'a failed welcome email must not block account creation');
    assert.equal(res.body.emailSent, false, 'the create response reports the email was not sent');
    assert.equal(res.body.email, 'unlucky@test.com');
    // The account row really exists.
    const [row] = await db.select({ id: users.id, email: users.email })
        .from(users).where(eq(users.email, 'unlucky@test.com'));
    assert.ok(row, 'the new user row was persisted even though the email failed');
    // The sender was attempted.
    assert.equal(welcomeCalls.length, 1, 'the welcome email sender was attempted once');
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserEmail, 'unlucky@test.com')));
    assert.equal(logs.length, 1, 'exactly one user.created audit entry should exist');
    assert.equal(logs[0].emailSent, false, 'the audit entry records emailSent=false when the email throws');
    assert.equal(logs[0].targetUserId, row.id, 'the audit entry points at the created user');
});
