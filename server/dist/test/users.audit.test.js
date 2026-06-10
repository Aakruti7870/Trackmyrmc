import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
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
// can assert whether/ how it was called.
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
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    for (const k of SMTP_KEYS)
        savedEnv[k] = process.env[k];
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
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
test('user.created: welcome email SENT writes an audit entry with emailSent=true', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    enableSmtp();
    const sendMail = mockTransport('resolve');
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New User', email: 'new@test.com', password: PASSWORD, role: 'dispatcher' });
    assert.equal(res.status, 201);
    assert.equal(res.body.emailSent, true, 'response reports the welcome email as sent');
    assert.equal(sendMail.mock.callCount(), 1, 'the transporter actually sent one message');
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, res.body.id)));
    assert.equal(logs.length, 1, 'exactly one user.created audit entry should exist');
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].actorName, admin.name);
    assert.equal(logs[0].targetUserEmail, 'new@test.com');
    assert.equal(logs[0].emailSent, true, 'audit entry records emailSent=true');
});
test('user.created: welcome email FAILED writes an audit entry with emailSent=false', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    enableSmtp();
    const sendMail = mockTransport('reject');
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New User', email: 'new@test.com', password: PASSWORD, role: 'dispatcher' });
    // The user is still created even though the email failed.
    assert.equal(res.status, 201);
    assert.equal(res.body.emailSent, false, 'response reports the welcome email as not sent');
    assert.equal(sendMail.mock.callCount(), 1, 'sendMail was attempted (and threw)');
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, res.body.id)));
    assert.equal(logs.length, 1, 'a user.created audit entry is written even when the email fails');
    assert.equal(logs[0].emailSent, false, 'audit entry records emailSent=false on failure');
});
test('user.created: welcome email SKIPPED (SMTP not configured) writes emailSent=false and never calls nodemailer', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    disableSmtp();
    const createTransportSpy = mock.method(nodemailer, 'createTransport');
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New User', email: 'new@test.com', password: PASSWORD, role: 'dispatcher' });
    assert.equal(res.status, 201);
    assert.equal(res.body.emailSent, false, 'response reports the welcome email as not sent when skipped');
    assert.equal(createTransportSpy.mock.callCount(), 0, 'no transporter is created when SMTP is unconfigured');
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, res.body.id)));
    assert.equal(logs.length, 1, 'a user.created audit entry is written even when the email is skipped');
    assert.equal(logs[0].emailSent, false, 'audit entry records emailSent=false when skipped');
});
test('GET /api/users/audit-log returns recorded entries for an admin', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    disableSmtp();
    const created = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Audited User', email: 'audited@test.com', password: PASSWORD, role: 'dispatcher' });
    assert.equal(created.status, 201);
    const res = await request(app)
        .get('/api/users/audit-log')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body), 'audit-log returns an array');
    const entry = res.body.find((e) => e.action === 'user.created' && e.targetUserId === created.body.id);
    assert.ok(entry, 'the user.created entry is returned from GET /audit-log');
    assert.equal(entry.actorId, admin.id);
    assert.equal(entry.actorName, admin.name);
    assert.equal(entry.targetUserEmail, 'audited@test.com');
    assert.equal(entry.emailSent, false);
});
test('GET /api/users/audit-log?userId filters to one target user', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    disableSmtp();
    const a = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`)
        .send({ name: 'User A', email: 'a@test.com', password: PASSWORD, role: 'dispatcher' });
    const b = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`)
        .send({ name: 'User B', email: 'b@test.com', password: PASSWORD, role: 'dispatcher' });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    const res = await request(app)
        .get(`/api/users/audit-log?userId=${a.body.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1, 'at least one entry for the filtered user');
    assert.ok(res.body.every((e) => e.targetUserId === a.body.id), 'every returned entry belongs to the filtered user');
});
test('GET /api/users/audit-log is forbidden for non-admins', async () => {
    await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const dispatcher = await createUser({ name: 'Dispatcher', email: 'disp@test.com', role: 'dispatcher' });
    const token = tokenFor(dispatcher);
    const res = await request(app)
        .get('/api/users/audit-log')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403);
});
