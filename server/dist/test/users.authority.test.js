import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, staffOtpCodes } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { hashOtpCode } from '../lib/otp.js';
import { PERMANENT_AUTHORITY_EMAILS } from '../lib/authority.js';
let app;
const PASSWORD = 'secret123';
// AUTHORITY is gated entirely by the AUTHORITY_EMAILS env var (read live by the
// authority helper on every call), so each test sets it explicitly. We snapshot
// the original value and restore it afterwards so the suite leaves no residue.
const ORIGINAL_AUTHORITY_EMAILS = process.env.AUTHORITY_EMAILS;
function setAllowList(value) {
    process.env.AUTHORITY_EMAILS = value;
}
// The workspace has real SMTP_* / WHATSAPP_META_* values; an allow-listed
// AUTHORITY now triggers a real second-factor send on /login. Clear the delivery
// channels so the suite can never open a real network connection. Note the Super
// Admin path has NO dev-code fallback (unlike ordinary staff): with no channel
// configured the send fails with 502, so the positive test below seeds a known
// code and completes the 2FA via /superadmin/verify, mirroring staffAuth.test.ts.
const DELIVERY_ENV_KEYS = [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'WHATSAPP_META_PHONE_NUMBER_ID', 'WHATSAPP_META_ACCESS_TOKEN',
];
const savedDeliveryEnv = {};
async function seedCode(userId, code) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(staffOtpCodes).values({
        userId, codeHash: hashOtpCode(code), channel: 'dev', expiresAt, attempts: 0,
    }).onConflictDoUpdate({
        target: staffOtpCodes.userId,
        set: { codeHash: hashOtpCode(code), expiresAt, attempts: 0 },
    });
}
async function createUser(role, email) {
    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role, isActive: true,
    }).returning();
    return user;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => {
    for (const k of DELIVERY_ENV_KEYS) {
        savedDeliveryEnv[k] = process.env[k];
        delete process.env[k];
    }
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE challans, drivers, vehicles, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
afterEach(() => {
    delete process.env.AUTHORITY_EMAILS;
});
after(async () => {
    if (ORIGINAL_AUTHORITY_EMAILS === undefined)
        delete process.env.AUTHORITY_EMAILS;
    else
        process.env.AUTHORITY_EMAILS = ORIGINAL_AUTHORITY_EMAILS;
    for (const k of DELIVERY_ENV_KEYS) {
        if (savedDeliveryEnv[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = savedDeliveryEnv[k];
    }
    await pool.end();
});
test('GET /users/authority-emails returns the env allow-list, normalised (trimmed + lowercased)', async () => {
    setAllowList('  Boss@Aakruti.com , VIP@aakruti.com ');
    const admin = await createUser('admin', 'admin@test.com');
    const res = await request(app)
        .get('/api/users/authority-emails')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.emails, [
        ...PERMANENT_AUTHORITY_EMAILS,
        'boss@aakruti.com',
        'vip@aakruti.com',
    ]);
});
test('GET /users/authority-emails requires authentication', async () => {
    setAllowList('boss@aakruti.com');
    const res = await request(app).get('/api/users/authority-emails');
    assert.equal(res.status, 401);
});
test('creating a user as AUTHORITY is rejected when the email is not allow-listed', async () => {
    setAllowList('boss@aakruti.com');
    const admin = await createUser('admin', 'admin@test.com');
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Imposter', email: 'imposter@evil.com', password: PASSWORD, role: 'authority' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /allow-list/i);
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, 'imposter@evil.com'));
    assert.equal(rows.length, 0, 'no AUTHORITY account is created for a non-allow-listed email');
});
test('creating a user as AUTHORITY succeeds when the email is allow-listed', async () => {
    setAllowList('boss@aakruti.com');
    const admin = await createUser('admin', 'admin@test.com');
    const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'The Boss', email: 'boss@aakruti.com', password: PASSWORD, role: 'authority' });
    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'authority');
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.email, 'boss@aakruti.com'));
    assert.equal(row.role, 'authority', 'the AUTHORITY role is persisted');
});
test('promoting an existing user to AUTHORITY is rejected when their email is not allow-listed', async () => {
    setAllowList('boss@aakruti.com');
    const admin = await createUser('admin', 'admin@test.com');
    const target = await createUser('dispatcher', 'dispatch@test.com');
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ role: 'authority' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /allow-list/i);
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, target.id));
    assert.equal(row.role, 'dispatcher', 'the role is unchanged after a forbidden promotion');
});
test('promoting an existing user to AUTHORITY succeeds when their email is allow-listed', async () => {
    setAllowList('boss@aakruti.com');
    const admin = await createUser('admin', 'admin@test.com');
    const target = await createUser('dispatcher', 'boss@aakruti.com');
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ role: 'authority' });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'authority');
    const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, target.id));
    assert.equal(row.role, 'authority', 'the promotion is persisted');
});
test('legacy login is refused for an AUTHORITY account whose email fell off the allow-list', async () => {
    setAllowList('boss@aakruti.com');
    await createUser('authority', 'ghost@aakruti.com');
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@aakruti.com', password: PASSWORD });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /allow-list/i);
});
test('an allow-listed AUTHORITY clears the allow-list gate and logs in via the second factor', async () => {
    setAllowList('boss@aakruti.com');
    const boss = await createUser('authority', 'boss@aakruti.com');
    // Super Admin login is two-factor. A correct password passes the password +
    // allow-list gates (it is NOT the 403 /allow-list/ rejection a non-listed
    // authority gets) and proceeds to the second factor. With no delivery channel
    // configured the send fails with 502 — but crucially it never issues a token.
    const first = await request(app)
        .post('/api/auth/login')
        .send({ email: 'boss@aakruti.com', password: PASSWORD });
    assert.equal(first.status, 502, 'past the allow-list gate, into the (undeliverable) 2FA send');
    assert.equal(first.body.token, undefined, 'no token on the first factor alone');
    // Seeding a known code and completing the second factor issues the token.
    await seedCode(boss.id, '424242');
    const res = await request(app)
        .post('/api/auth/superadmin/verify')
        .send({ email: 'boss@aakruti.com', code: '424242' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'a JWT is issued after the second factor');
    assert.equal(res.body.user.role, 'authority');
});
