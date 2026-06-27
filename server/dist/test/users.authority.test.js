import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
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
// channels so that send falls back to the deterministic dev path (no real
// email/WhatsApp), and restore them afterwards.
const DELIVERY_ENV_KEYS = [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'WHATSAPP_META_PHONE_NUMBER_ID', 'WHATSAPP_META_ACCESS_TOKEN',
];
const savedDeliveryEnv = {};
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
test('login passes the password factor for an allow-listed AUTHORITY account and asks for the second factor', async () => {
    setAllowList('boss@aakruti.com');
    await createUser('authority', 'boss@aakruti.com');
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'boss@aakruti.com', password: PASSWORD });
    // Super Admin login is two-factor: a correct password no longer issues a token
    // directly — it clears the allow-list gate and requests a one-time code, which
    // is completed at /auth/superadmin/verify (covered in staffAuth.test.ts).
    assert.equal(res.status, 200);
    assert.equal(res.body.otpRequired, true, 'the second factor is required');
    assert.equal(res.body.token, undefined, 'no token until the code is verified');
});
