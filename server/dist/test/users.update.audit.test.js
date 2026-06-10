import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_FROM'];
const savedEnv = {};
async function createUser(opts) {
    const passwordHash = await bcrypt.hash(opts.password ?? PASSWORD, 10);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'dispatcher',
        linkedClientId: opts.linkedClientId ?? null,
        linkedDriverId: opts.linkedDriverId ?? null,
    }).returning();
    return row;
}
async function createClient(name) {
    const [row] = await db.insert(clients).values({
        name,
        contactPerson: 'Contact',
        phone: '0000000000',
    }).returning();
    return row;
}
async function createDriver(name) {
    const [row] = await db.insert(drivers).values({
        name,
        phone: '0000000000',
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// Make SMTP appear configured so email.ts proceeds to nodemailer.createTransport,
// which the tests then mock to simulate the send succeeding or failing.
function enableSmtp() {
    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_USER = 'mailer@test.local';
    process.env.SMTP_PASS = 'super-secret';
}
// Make SMTP appear unconfigured so email.ts short-circuits ("skipped") and never
// touches nodemailer at all.
function disableSmtp() {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
}
// Replaces nodemailer.createTransport with a fake transporter whose sendMail
// either resolves (sent) or rejects (failed). Returns the sendMail mock so tests
// can assert whether/how it was called.
function mockTransport(behavior) {
    const sendMail = mock.fn(async () => {
        if (behavior === 'reject') {
            throw new Error('simulated SMTP failure');
        }
        return { messageId: 'test-message-id' };
    });
    mock.method(nodemailer, 'createTransport', () => ({ sendMail }));
    return sendMail;
}
async function auditEntries(action, targetUserId) {
    return db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, action), eq(auditLogs.targetUserId, targetUserId)));
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    for (const k of SMTP_KEYS)
        savedEnv[k] = process.env[k];
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, login_attempts, clients, drivers RESTART IDENTITY CASCADE`);
});
afterEach(() => {
    mock.restoreAll();
    for (const k of SMTP_KEYS) {
        if (savedEnv[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = savedEnv[k];
    }
});
after(async () => {
    await pool.end();
});
test('name_change: editing the name writes a name_change entry with "old → new"', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Old Name', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' });
    assert.equal(res.status, 200);
    const logs = await auditEntries('name_change', target.id);
    assert.equal(logs.length, 1, 'exactly one name_change entry');
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].actorName, admin.name);
    assert.equal(logs[0].targetUserEmail, 'target@test.com');
    assert.equal(logs[0].detail, 'Old Name → New Name');
});
test('role_change: changing the role writes a role_change entry with "old → new"', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'plant_operator' });
    assert.equal(res.status, 200);
    const logs = await auditEntries('role_change', target.id);
    assert.equal(logs.length, 1, 'exactly one role_change entry');
    assert.equal(logs[0].detail, 'dispatcher → plant_operator');
});
test('account_deactivated: setting isActive=false writes an account_deactivated entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });
    assert.equal(res.status, 200);
    const logs = await auditEntries('account_deactivated', target.id);
    assert.equal(logs.length, 1, 'exactly one account_deactivated entry');
    assert.equal(logs[0].detail, 'Account deactivated');
    // And no spurious account_activated entry is written.
    const activated = await auditEntries('account_activated', target.id);
    assert.equal(activated.length, 0, 'no account_activated entry for a deactivation');
});
test('client_link_change: linking a client writes a client_link_change entry naming the client', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const client = await createClient('Acme Builders');
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'client' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ linkedClientId: client.id });
    assert.equal(res.status, 200);
    const logs = await auditEntries('client_link_change', target.id);
    assert.equal(logs.length, 1, 'exactly one client_link_change entry');
    assert.equal(logs[0].detail, `none → Acme Builders (#${client.id})`);
});
test('driver_link_change: linking a driver writes a driver_link_change entry naming the driver', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const driver = await createDriver('Ravi Kumar');
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'driver' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ linkedDriverId: driver.id });
    assert.equal(res.status, 200);
    const logs = await auditEntries('driver_link_change', target.id);
    assert.equal(logs.length, 1, 'exactly one driver_link_change entry');
    assert.equal(logs[0].detail, `none → Ravi Kumar (#${driver.id})`);
});
test('multiple fields changed at once each get their own audit entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Old Name', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name', role: 'plant_operator', isActive: false });
    assert.equal(res.status, 200);
    assert.equal((await auditEntries('name_change', target.id)).length, 1);
    assert.equal((await auditEntries('role_change', target.id)).length, 1);
    assert.equal((await auditEntries('account_deactivated', target.id)).length, 1);
});
test('password_reset SENT: an admin password reset writes password_reset with emailSent=true', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    enableSmtp();
    const sendMail = mockTransport('resolve');
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'newpass123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.emailSent, true, 'response reports the reset email as sent');
    assert.equal(sendMail.mock.callCount(), 1, 'the transporter sent one message');
    const logs = await auditEntries('password_reset', target.id);
    assert.equal(logs.length, 1, 'exactly one password_reset entry');
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].targetUserEmail, 'target@test.com');
    assert.equal(logs[0].emailSent, true, 'audit entry records emailSent=true');
});
test('password_reset FAILED: a failed reset email still writes password_reset with emailSent=false', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    enableSmtp();
    const sendMail = mockTransport('reject');
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'newpass123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.emailSent, false, 'response reports the reset email as not sent');
    assert.equal(sendMail.mock.callCount(), 1, 'sendMail was attempted (and threw)');
    const logs = await auditEntries('password_reset', target.id);
    assert.equal(logs.length, 1, 'a password_reset entry is written even when the email fails');
    assert.equal(logs[0].emailSent, false, 'audit entry records emailSent=false on failure');
});
test('password_reset SKIPPED: with SMTP unconfigured the entry records emailSent=false and never calls nodemailer', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    disableSmtp();
    const createTransportSpy = mock.method(nodemailer, 'createTransport');
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'newpass123' });
    assert.equal(res.status, 200);
    assert.equal(res.body.emailSent, false, 'response reports the reset email as not sent when skipped');
    assert.equal(createTransportSpy.mock.callCount(), 0, 'no transporter is created when SMTP is unconfigured');
    const logs = await auditEntries('password_reset', target.id);
    assert.equal(logs.length, 1, 'a password_reset entry is written even when the email is skipped');
    assert.equal(logs[0].emailSent, false, 'audit entry records emailSent=false when skipped');
});
test('no audit entry is written when fields are submitted unchanged', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Same Name', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Same Name', role: 'dispatcher', isActive: true });
    assert.equal(res.status, 200);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetUserId, target.id));
    assert.equal(logs.length, 0, 'no audit entries when nothing actually changed');
});
