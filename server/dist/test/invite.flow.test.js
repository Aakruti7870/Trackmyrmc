import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, passwordSetupTokens } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { createInviteToken } from '../lib/inviteToken.js';
let app;
const ADMIN_PASSWORD = 'secret123';
async function createAdmin() {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const [row] = await db.insert(users).values({
        name: 'Admin', email: 'admin@test.com', passwordHash, role: 'admin',
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function createPlant() {
    const [row] = await db.insert(plants).values({
        name: 'Verified Plant',
        latitude: '19.0330000',
        longitude: '73.0297000',
        plantStatus: 'approved',
        isActive: true,
        locationVerified: true,
        verified: true,
        deliveryRadiusKm: 40,
        grades: ['M-20', 'M-25'],
        openTime: '06:00',
        closeTime: '21:00',
    }).returning();
    return row;
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, password_setup_tokens, users, plants RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('POST /plants/:id/owner without a password issues an invite (no usable login yet)', async () => {
    const admin = await createAdmin();
    const plant = await createPlant();
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Plant Owner', email: 'owner@test.com' });
    assert.equal(res.status, 201);
    assert.equal(res.body.invited, true);
    // SMTP is unconfigured under test, so the link is returned for out-of-band delivery.
    assert.equal(res.body.emailSent, false);
    assert.ok(typeof res.body.inviteUrl === 'string' && res.body.inviteUrl.includes('/set-password?token='));
    // A pending token row exists for the new user.
    const [created] = await db.select().from(users).where(eq(users.email, 'owner@test.com'));
    const tokens = await db.select().from(passwordSetupTokens).where(eq(passwordSetupTokens.userId, created.id));
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].usedAt, null);
    // The seeded random password must not be guessable / must not equal a known value.
    const login = await request(app).post('/api/auth/login').send({ email: 'owner@test.com', password: '' });
    assert.equal(login.status, 400);
});
test('GET /auth/invite/:token reveals whose account it is', async () => {
    const admin = await createAdmin();
    const plant = await createPlant();
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Plant Owner', email: 'owner@test.com', role: 'dispatcher' });
    const token = new URL(res.body.inviteUrl).searchParams.get('token');
    const peek = await request(app).get(`/api/auth/invite/${token}`);
    assert.equal(peek.status, 200);
    assert.equal(peek.body.email, 'owner@test.com');
    assert.equal(peek.body.name, 'Plant Owner');
    assert.equal(peek.body.role, 'dispatcher');
});
test('POST /auth/set-password consumes the token, sets the password, and logs the owner in', async () => {
    const admin = await createAdmin();
    const plant = await createPlant();
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Plant Owner', email: 'owner@test.com' });
    const token = new URL(res.body.inviteUrl).searchParams.get('token');
    const set = await request(app).post('/api/auth/set-password').send({ token, password: 'chosenpass1' });
    assert.equal(set.status, 200);
    assert.ok(set.body.token, 'returns a session token for auto-login');
    assert.equal(set.body.user.email, 'owner@test.com');
    // Staff/owner accounts are passwordless: the password set during onboarding
    // only powers the one-time auto-login above. A later password /login is now
    // refused and steered to the one-time-code door.
    const login = await request(app).post('/api/auth/login').send({ email: 'owner@test.com', password: 'chosenpass1' });
    assert.equal(login.status, 403);
    assert.equal(login.body.useOtp, true);
    // The token is now consumed.
    const [created] = await db.select().from(users).where(eq(users.email, 'owner@test.com'));
    const [tok] = await db.select().from(passwordSetupTokens).where(eq(passwordSetupTokens.userId, created.id));
    assert.ok(tok.usedAt, 'token should be marked used');
});
test('an invite token is single-use', async () => {
    const admin = await createAdmin();
    const user = await db.insert(users).values({
        name: 'Owner', email: 'owner@test.com', passwordHash: await hashPassword('x'.repeat(20)), role: 'admin',
    }).returning().then(r => r[0]);
    const { token } = await createInviteToken(user.id);
    const first = await request(app).post('/api/auth/set-password').send({ token, password: 'firstpass1' });
    assert.equal(first.status, 200);
    const second = await request(app).post('/api/auth/set-password').send({ token, password: 'secondpass1' });
    assert.equal(second.status, 400);
    assert.equal(second.body.reason, 'used');
});
test('an invalid token is rejected by peek and redeem', async () => {
    const peek = await request(app).get('/api/auth/invite/not-a-real-token');
    assert.equal(peek.status, 400);
    assert.equal(peek.body.reason, 'invalid');
    const set = await request(app).post('/api/auth/set-password').send({ token: 'not-a-real-token', password: 'whatever1' });
    assert.equal(set.status, 400);
    assert.equal(set.body.reason, 'invalid');
});
test('an expired token is rejected', async () => {
    const user = await db.insert(users).values({
        name: 'Owner', email: 'owner@test.com', passwordHash: await hashPassword('x'.repeat(20)), role: 'admin',
    }).returning().then(r => r[0]);
    const { token } = await createInviteToken(user.id, -1000); // already expired
    const peek = await request(app).get(`/api/auth/invite/${token}`);
    assert.equal(peek.status, 400);
    assert.equal(peek.body.reason, 'expired');
    const set = await request(app).post('/api/auth/set-password').send({ token, password: 'whatever1' });
    assert.equal(set.status, 400);
    assert.equal(set.body.reason, 'expired');
});
test('re-issuing an invite invalidates the previous one', async () => {
    const user = await db.insert(users).values({
        name: 'Owner', email: 'owner@test.com', passwordHash: await hashPassword('x'.repeat(20)), role: 'admin',
    }).returning().then(r => r[0]);
    const { token: first } = await createInviteToken(user.id);
    const { token: second } = await createInviteToken(user.id);
    const peekFirst = await request(app).get(`/api/auth/invite/${first}`);
    assert.equal(peekFirst.status, 400, 'the superseded link must stop working');
    const peekSecond = await request(app).get(`/api/auth/invite/${second}`);
    assert.equal(peekSecond.status, 200);
});
test('the typed-password provisioning path stores a password but staff still sign in passwordless', async () => {
    const admin = await createAdmin();
    const plant = await createPlant();
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Plant Owner', email: 'owner@test.com', password: 'typedpass1' });
    assert.equal(res.status, 201);
    assert.notEqual(res.body.invited, true);
    // Even with a correct stored password, a staff/owner account is refused the
    // password door and steered to the one-time-code login.
    const login = await request(app).post('/api/auth/login').send({ email: 'owner@test.com', password: 'typedpass1' });
    assert.equal(login.status, 403);
    assert.equal(login.body.useOtp, true);
    // No invite token is created for the typed-password path.
    const [created] = await db.select().from(users).where(eq(users.email, 'owner@test.com'));
    const tokens = await db.select().from(passwordSetupTokens).where(eq(passwordSetupTokens.userId, created.id));
    assert.equal(tokens.length, 0);
});
