// Staff two-factor (one-time code) exemptions — the Super Owner can switch 2FA
// OFF per staff role so those roles sign in with email + password alone.
//
// Covers:
//  - default (no setting): staff password login still refused with useOtp
//  - exempted role + password: /login issues a staff token directly
//  - non-exempted role: still refused even while another role is exempt
//  - exempted role WITHOUT a password: opaque 401 (no hash — no way in)
//  - billing gate still applies on the password path
//  - /staff/login-method: 'password' only for exempted role WITH a hash
//  - /admin/staff-password-login: platform-staff-only GET/POST, validation,
//    plant-scoped admin 403
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, appSettings } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { STAFF_PASSWORD_LOGIN_KEY } from '../lib/staffPasswordLogin.js';
let app;
const PASSWORD = 'secret123';
async function createPlant(opts = {}) {
    const [row] = await db.insert(plants).values({
        name: opts.name ?? 'Test Plant',
        plantCode: `TP${Math.floor(Math.random() * 100000)}`,
        latitude: '18.5204',
        longitude: '73.8567',
        subscriptionStatus: (opts.subscriptionStatus ?? 'active'),
    }).returning();
    return row;
}
async function createUser(opts) {
    const [row] = await db.insert(users).values({
        name: opts.email.split('@')[0],
        email: opts.email,
        passwordHash: opts.withPassword ? await hashPassword(PASSWORD) : null,
        role: (opts.role ?? 'dispatcher'),
        isActive: opts.isActive ?? true,
        plantId: opts.plantId ?? null,
    }).returning();
    return row;
}
async function setExemptRoles(csv) {
    await db.insert(appSettings)
        .values({ key: STAFF_PASSWORD_LOGIN_KEY, value: csv, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: csv, updatedAt: new Date() } });
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, staff_otp_codes, users, plants, login_attempts, rate_limit_hits, app_settings RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
// ---------------------------------------------------------------------------
// /api/auth/login — password door
// ---------------------------------------------------------------------------
test('default (no setting): staff password login is refused with useOtp', async () => {
    await createUser({ email: 'd1@x.com', role: 'dispatcher', withPassword: true });
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'd1@x.com', password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.useOtp, true);
});
test('exempted role with a password signs in and gets a staff token', async () => {
    const plant = await createPlant();
    const u = await createUser({ email: 'd2@x.com', role: 'dispatcher', withPassword: true, plantId: plant.id });
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'd2@x.com', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'dispatcher');
    assert.equal(res.body.user.plantId, plant.id);
    // The issued token must be usable (session version matches).
    const me = await request(app).get('/api/auth/me')
        .set('Authorization', `Bearer ${res.body.token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.id, u.id);
});
test('wrong password on an exempted role stays a 401', async () => {
    await createUser({ email: 'd3@x.com', role: 'dispatcher', withPassword: true });
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'd3@x.com', password: 'not-the-password' });
    assert.equal(res.status, 401);
});
test('non-exempted role is still refused while another role is exempt', async () => {
    await createUser({ email: 'op@x.com', role: 'plant_operator', withPassword: true });
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'op@x.com', password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.useOtp, true);
});
test('exempted role WITHOUT a password gets the opaque 401', async () => {
    await createUser({ email: 'nopw@x.com', role: 'dispatcher', withPassword: false });
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'nopw@x.com', password: PASSWORD });
    assert.equal(res.status, 401);
});
test('billing gate still blocks the password path for a suspended plant', async () => {
    const plant = await createPlant({ subscriptionStatus: 'suspended' });
    await createUser({ email: 'gated@x.com', role: 'dispatcher', withPassword: true, plantId: plant.id });
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'gated@x.com', password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.subscriptionBlocked, true);
});
// ---------------------------------------------------------------------------
// /api/auth/staff/login-method
// ---------------------------------------------------------------------------
test('login-method: otp by default, password once the role is exempt (hash present)', async () => {
    await createUser({ email: 'm1@x.com', role: 'dispatcher', withPassword: true });
    let res = await request(app).post('/api/auth/staff/login-method').send({ email: 'm1@x.com' });
    assert.equal(res.body.method, 'otp');
    await setExemptRoles('dispatcher');
    res = await request(app).post('/api/auth/staff/login-method').send({ email: 'm1@x.com' });
    assert.equal(res.body.method, 'password');
});
test('login-method: exempted role without a hash stays on the otp door', async () => {
    await createUser({ email: 'm2@x.com', role: 'dispatcher', withPassword: false });
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/staff/login-method').send({ email: 'm2@x.com' });
    assert.equal(res.body.method, 'otp');
});
test('login-method: unknown email answers otp (no enumeration)', async () => {
    await setExemptRoles('dispatcher');
    const res = await request(app).post('/api/auth/staff/login-method').send({ email: 'ghost@x.com' });
    assert.equal(res.body.method, 'otp');
});
// ---------------------------------------------------------------------------
// /api/admin/staff-password-login — settings routes
// ---------------------------------------------------------------------------
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
test('platform admin can read and update the exemption list', async () => {
    const admin = await createUser({ email: 'padmin@x.com', role: 'admin', withPassword: true, plantId: null });
    const token = tokenFor(admin);
    let res = await request(app).get('/api/admin/staff-password-login')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.roles, []);
    assert.ok(Array.isArray(res.body.availableRoles));
    res = await request(app).post('/api/admin/staff-password-login')
        .set('Authorization', `Bearer ${token}`)
        .send({ roles: ['dispatcher', 'accountant'] });
    assert.equal(res.status, 200);
    assert.deepEqual([...res.body.roles].sort(), ['accountant', 'dispatcher']);
    // Clearing restores 2FA for everyone.
    res = await request(app).post('/api/admin/staff-password-login')
        .set('Authorization', `Bearer ${token}`)
        .send({ roles: [] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.roles, []);
});
test('plant-scoped admin cannot touch the setting (403)', async () => {
    const plant = await createPlant();
    const admin = await createUser({ email: 'tadmin@x.com', role: 'admin', withPassword: true, plantId: plant.id });
    const token = tokenFor(admin);
    const get = await request(app).get('/api/admin/staff-password-login')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(get.status, 403);
    const post = await request(app).post('/api/admin/staff-password-login')
        .set('Authorization', `Bearer ${token}`)
        .send({ roles: ['dispatcher'] });
    assert.equal(post.status, 403);
});
test('invalid roles are rejected with 400 (authority/client can never be exempt)', async () => {
    const admin = await createUser({ email: 'vadmin@x.com', role: 'admin', withPassword: true, plantId: null });
    const token = tokenFor(admin);
    for (const bad of [['authority'], ['client'], ['nonsense']]) {
        const res = await request(app).post('/api/admin/staff-password-login')
            .set('Authorization', `Bearer ${token}`)
            .send({ roles: bad });
        assert.equal(res.status, 400, `expected 400 for ${bad[0]}`);
    }
});
test('saving via the API takes effect on the login door end-to-end', async () => {
    const admin = await createUser({ email: 'eadmin@x.com', role: 'admin', withPassword: true, plantId: null });
    await createUser({ email: 'staff@x.com', role: 'supervisor', withPassword: true });
    await request(app).post('/api/admin/staff-password-login')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ roles: ['supervisor'] });
    const res = await request(app).post('/api/auth/login')
        .send({ email: 'staff@x.com', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
});
