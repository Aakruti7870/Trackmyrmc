import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, staffOtpCodes } from '../db/schema.js';
import { hashOtpCode } from '../lib/otp.js';
let app;
async function createPlant(status) {
    const [row] = await db.insert(plants).values({
        name: `Plant ${status}`,
        plantCode: `PLT-${status}`,
        latitude: '18.5',
        longitude: '73.8',
        subscriptionStatus: status,
    }).returning();
    return row;
}
// Provisioned, passwordless staff: they sign in with a one-time code, so the
// billing gate is exercised through /auth/staff/otp/verify rather than the
// password /login path.
async function createStaff(email, plantId) {
    const [row] = await db.insert(users).values({
        name: 'Staff', email, role: 'dispatcher', isActive: true, plantId,
    }).returning();
    return row;
}
async function seedCode(userId, code) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await db.insert(staffOtpCodes).values({
        userId, codeHash: hashOtpCode(code), channel: 'dev', expiresAt, attempts: 0,
    }).onConflictDoUpdate({
        target: staffOtpCodes.userId,
        set: { codeHash: hashOtpCode(code), expiresAt, attempts: 0 },
    });
}
function verify(email, code) {
    return request(app).post('/api/auth/staff/otp/verify').send({ email, code });
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, staff_otp_codes, users, plants, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
for (const status of ['trial', 'active', 'past_due']) {
    test(`a ${status} subscription allows login`, async () => {
        const plant = await createPlant(status);
        const u = await createStaff('a@test.com', plant.id);
        await seedCode(u.id, '123456');
        const res = await verify('a@test.com', '123456');
        assert.equal(res.status, 200);
        assert.ok(res.body.token);
    });
}
test('a suspended subscription blocks login with 403', async () => {
    const plant = await createPlant('suspended');
    const u = await createStaff('a@test.com', plant.id);
    await seedCode(u.id, '123456');
    const res = await verify('a@test.com', '123456');
    assert.equal(res.status, 403);
    assert.equal(res.body.subscriptionBlocked, true);
    assert.match(res.body.error, /suspended/i);
    assert.equal(res.body.token, undefined);
});
test('a cancelled subscription blocks login with 403', async () => {
    const plant = await createPlant('cancelled');
    const u = await createStaff('a@test.com', plant.id);
    await seedCode(u.id, '123456');
    const res = await verify('a@test.com', '123456');
    assert.equal(res.status, 403);
    assert.equal(res.body.subscriptionBlocked, true);
    assert.match(res.body.error, /cancelled/i);
});
test('platform staff (no plant) are never billing-gated', async () => {
    const u = await createStaff('platform@test.com', null);
    await seedCode(u.id, '123456');
    const res = await verify('platform@test.com', '123456');
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
});
test('a wrong code on a suspended plant returns a generic 401 (no billing leak)', async () => {
    const plant = await createPlant('suspended');
    const u = await createStaff('a@test.com', plant.id);
    await seedCode(u.id, '123456');
    const res = await verify('a@test.com', '000000');
    assert.equal(res.status, 401);
    assert.equal(res.body.subscriptionBlocked, undefined);
});
