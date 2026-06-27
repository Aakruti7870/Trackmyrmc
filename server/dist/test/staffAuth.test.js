import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, staffOtpCodes } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { hashOtpCode } from '../lib/otp.js';
let app;
const PASSWORD = 'secret123';
// A permanent platform Super Owner — always on the AUTHORITY allow-list, so it
// is recognized as a Super Admin regardless of the AUTHORITY_EMAILS env var.
const SUPER_ADMIN_EMAIL = 'krushnabade54@gmail.com';
// Snapshot of the delivery-channel env vars. The workspace has real SMTP_* and
// WHATSAPP_META_* values; we clear them so the staff OTP code path is fully
// deterministic (no real email/WhatsApp sends), and restore them in after().
const DELIVERY_ENV_KEYS = [
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    'WHATSAPP_META_PHONE_NUMBER_ID', 'WHATSAPP_META_ACCESS_TOKEN',
];
const savedEnv = {};
async function createStaff(opts) {
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash: opts.withPassword ? await hashPassword(PASSWORD) : null,
        role: (opts.role ?? 'dispatcher'),
        isActive: opts.isActive ?? true,
        phone: opts.phone ?? null,
    }).returning();
    return row;
}
// Seed a known, live login code straight into the store so verify/2FA paths can
// be exercised without depending on a delivery channel.
async function seedCode(userId, code) {
    await db.insert(staffOtpCodes).values({
        userId,
        codeHash: hashOtpCode(code),
        channel: 'dev',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
    }).onConflictDoUpdate({
        target: staffOtpCodes.userId,
        set: { codeHash: hashOtpCode(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0 },
    });
}
before(() => {
    for (const k of DELIVERY_ENV_KEYS) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
    }
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, staff_otp_codes, users, login_attempts, rate_limit_hits, app_settings RESTART IDENTITY CASCADE`);
});
after(async () => {
    for (const k of DELIVERY_ENV_KEYS) {
        if (savedEnv[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = savedEnv[k];
    }
    await pool.end();
});
// ---- login-method probe ----------------------------------------------------
test('login-method returns "password" only for a recognized Super Admin', async () => {
    await createStaff({ name: 'Boss', email: SUPER_ADMIN_EMAIL, role: 'authority', withPassword: true });
    const res = await request(app).post('/api/auth/staff/login-method').send({ email: SUPER_ADMIN_EMAIL });
    assert.equal(res.status, 200);
    assert.equal(res.body.method, 'password');
});
test('login-method returns "otp" for ordinary staff', async () => {
    await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher' });
    const res = await request(app).post('/api/auth/staff/login-method').send({ email: 'disp@plant.com' });
    assert.equal(res.status, 200);
    assert.equal(res.body.method, 'otp');
});
test('login-method returns "otp" for an unknown email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/staff/login-method').send({ email: 'nobody@nowhere.com' });
    assert.equal(res.status, 200);
    assert.equal(res.body.method, 'otp');
});
test('login-method requires an email', async () => {
    const res = await request(app).post('/api/auth/staff/login-method').send({});
    assert.equal(res.status, 400);
});
// ---- staff OTP send: provisioned-only --------------------------------------
test('staff/otp/send returns a generic success for an unknown email and creates no code', async () => {
    const res = await request(app).post('/api/auth/staff/otp/send').send({ email: 'ghost@nowhere.com' });
    assert.equal(res.status, 200);
    assert.equal(res.body.sent, true);
    const rows = await db.select().from(staffOtpCodes);
    assert.equal(rows.length, 0, 'no account, no code');
});
test('staff/otp/send never resolves a customer account', async () => {
    await createStaff({ name: 'Cust', email: 'cust@otp.local', role: 'client' });
    const res = await request(app).post('/api/auth/staff/otp/send').send({ email: 'cust@otp.local' });
    assert.equal(res.status, 200);
    const rows = await db.select().from(staffOtpCodes);
    assert.equal(rows.length, 0, 'customers use the phone door, not this one');
});
test('staff/otp/send never resolves a suspended staff account', async () => {
    await createStaff({ name: 'Gone', email: 'gone@plant.com', role: 'dispatcher', isActive: false });
    const res = await request(app).post('/api/auth/staff/otp/send').send({ email: 'gone@plant.com' });
    assert.equal(res.status, 200);
    const rows = await db.select().from(staffOtpCodes);
    assert.equal(rows.length, 0, 'inactive accounts cannot receive a code');
});
test('staff/otp/send surfaces a delivery failure as 502 and clears the pending code', async () => {
    // Real staff account, but with no delivery channel configured the email send
    // fails — the route must report 502 and leave no live code behind.
    await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher' });
    const res = await request(app).post('/api/auth/staff/otp/send').send({ email: 'disp@plant.com' });
    assert.equal(res.status, 502);
    const rows = await db.select().from(staffOtpCodes);
    assert.equal(rows.length, 0, 'undeliverable code is not left live');
});
// ---- staff OTP verify ------------------------------------------------------
test('staff/otp/verify issues a single-session token, bumps the session, and consumes the code', async () => {
    const u = await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher' });
    await seedCode(u.id, '123456');
    const res = await request(app).post('/api/auth/staff/otp/verify').send({ email: 'disp@plant.com', code: '123456' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'JWT issued');
    assert.equal(res.body.user.role, 'dispatcher');
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    assert.equal(after.sessionVersion, 1, 'session version bumped on login');
    const remaining = await db.select().from(staffOtpCodes).where(eq(staffOtpCodes.userId, u.id));
    assert.equal(remaining.length, 0, 'code consumed on success');
    // The issued token is accepted by a requireAuth route.
    const ok = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${res.body.token}`);
    assert.equal(ok.status, 200);
});
test('staff/otp/verify rejects a wrong code and counts the attempt', async () => {
    const u = await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher' });
    await seedCode(u.id, '123456');
    const res = await request(app).post('/api/auth/staff/otp/verify').send({ email: 'disp@plant.com', code: '000000' });
    assert.equal(res.status, 401);
    const [row] = await db.select().from(staffOtpCodes).where(eq(staffOtpCodes.userId, u.id));
    assert.equal(row.attempts, 1, 'failed attempt recorded');
});
test('staff/otp/verify refuses an unknown email without leaking it', async () => {
    const res = await request(app).post('/api/auth/staff/otp/verify').send({ email: 'ghost@nowhere.com', code: '123456' });
    assert.equal(res.status, 401);
});
// ---- single active session -------------------------------------------------
test('a superseded session token is rejected (single active session)', async () => {
    const u = await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher' });
    await seedCode(u.id, '123456');
    const first = await request(app).post('/api/auth/staff/otp/verify').send({ email: 'disp@plant.com', code: '123456' });
    assert.equal(first.status, 200);
    const firstToken = first.body.token;
    // A second login elsewhere bumps the session version, invalidating the first.
    await seedCode(u.id, '654321');
    const second = await request(app).post('/api/auth/staff/otp/verify').send({ email: 'disp@plant.com', code: '654321' });
    assert.equal(second.status, 200);
    const stale = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${firstToken}`);
    assert.equal(stale.status, 401, 'the older session is no longer valid');
    const fresh = await request(app).post('/api/auth/refresh').set('Authorization', `Bearer ${second.body.token}`);
    assert.equal(fresh.status, 200, 'the newest session still works');
});
// ---- accountant role -------------------------------------------------------
test('an accountant is a provisionable, code-login staff role', async () => {
    const u = await createStaff({ name: 'Acc', email: 'acc@plant.com', role: 'accountant' });
    const method = await request(app).post('/api/auth/staff/login-method').send({ email: 'acc@plant.com' });
    assert.equal(method.body.method, 'otp');
    await seedCode(u.id, '424242');
    const res = await request(app).post('/api/auth/staff/otp/verify').send({ email: 'acc@plant.com', code: '424242' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'accountant');
});
// ---- Super Admin 2FA (password + OTP) --------------------------------------
test('a passwordless staff account is refused the password door (useOtp)', async () => {
    await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher', withPassword: true });
    const res = await request(app).post('/api/auth/login').send({ email: 'disp@plant.com', password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.useOtp, true);
});
test('Super Admin login is two-factor: password first, then a code', async () => {
    const u = await createStaff({ name: 'Boss', email: SUPER_ADMIN_EMAIL, role: 'authority', withPassword: true });
    // Wrong password is rejected before any code is sent.
    const bad = await request(app).post('/api/auth/login').send({ email: SUPER_ADMIN_EMAIL, password: 'nope' });
    assert.equal(bad.status, 401);
    // Correct password does NOT issue a token — it asks for the second factor.
    // (No delivery channel is configured, so the send fails with 502; we then
    // seed a known code and complete the 2FA via /superadmin/verify.)
    const first = await request(app).post('/api/auth/login').send({ email: SUPER_ADMIN_EMAIL, password: PASSWORD });
    assert.equal(first.body.token, undefined, 'no token on the first factor alone');
    await seedCode(u.id, '999999');
    const res = await request(app).post('/api/auth/superadmin/verify').send({ email: SUPER_ADMIN_EMAIL, code: '999999' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'token issued after the second factor');
    assert.equal(res.body.user.role, 'authority');
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    assert.equal(after.sessionVersion, 1, 'session version bumped on final success');
});
test('superadmin/verify refuses a non-superadmin even with a valid code', async () => {
    const u = await createStaff({ name: 'Disp', email: 'disp@plant.com', role: 'dispatcher' });
    await seedCode(u.id, '123456');
    const res = await request(app).post('/api/auth/superadmin/verify').send({ email: 'disp@plant.com', code: '123456' });
    assert.equal(res.status, 401);
});
