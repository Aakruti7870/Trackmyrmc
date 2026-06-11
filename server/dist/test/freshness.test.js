import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { computeFreshness, DEFAULT_WORKING_LIFE_MIN, DEFAULT_WARN_MIN, DEFAULT_AVG_SPEED_KMH, } from '../lib/freshness.js';
const CFG = {
    workingLifeMin: DEFAULT_WORKING_LIFE_MIN,
    warnMin: DEFAULT_WARN_MIN,
    avgSpeedKmh: DEFAULT_AVG_SPEED_KMH,
};
const NOW = new Date('2025-06-09T12:00:00Z');
const minsAgo = (m) => new Date(NOW.getTime() - m * 60000);
test('a fresh load far from expiry is classified fresh', () => {
    const r = computeFreshness({ dispatchTime: minsAgo(10), config: CFG, now: NOW });
    assert.equal(r.level, 'fresh');
    assert.equal(r.remainingMin, 110);
    assert.ok(r.pourByIso);
});
test('a load inside the warn window is critical', () => {
    const r = computeFreshness({ dispatchTime: minsAgo(100), config: CFG, now: NOW });
    // 120 - 100 = 20 min left, below the 30-min warn threshold.
    assert.equal(r.remainingMin, 20);
    assert.equal(r.level, 'critical');
});
test('a load past its working life is expired', () => {
    const r = computeFreshness({ dispatchTime: minsAgo(130), config: CFG, now: NOW });
    assert.ok(r.remainingMin !== null && r.remainingMin < 0);
    assert.equal(r.level, 'expired');
});
test('a long ETA flips a healthy load to critical (will not make it)', () => {
    // 60 min of life left, but the truck is 30 km out at 25 km/h ≈ 72 min away.
    const r = computeFreshness({
        dispatchTime: minsAgo(60), config: CFG, now: NOW,
        distanceM: 30000, speed: null,
    });
    assert.equal(r.willMakeIt, false);
    assert.equal(r.level, 'critical');
});
test('live GPS speed is preferred over the configured average for ETA', () => {
    const r = computeFreshness({
        dispatchTime: minsAgo(10), config: CFG, now: NOW,
        distanceM: 6000, speed: 20, // 20 m/s → 300 s = 5 min
    });
    assert.equal(r.etaMin, 5);
    assert.equal(r.willMakeIt, true);
});
test('a null dispatch time yields a null countdown', () => {
    const r = computeFreshness({ dispatchTime: null, config: CFG, now: NOW });
    assert.equal(r.remainingMin, null);
    assert.equal(r.pourByIso, null);
    assert.equal(r.level, 'fresh');
});
// ---- endpoint access control ----
let app;
const PASSWORD = 'secret123';
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE challans, clients, users RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
async function makeUser(role, email, linkedClientId) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [u] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role, isActive: true,
        linkedClientId: linkedClientId ?? null,
    }).returning();
    return u;
}
function bearer(u) {
    return `Bearer ${signToken({ id: u.id, email: u.email, role: u.role, name: u.name })}`;
}
test('staff can read the freshness feed; clients cannot', async () => {
    const admin = await makeUser('admin', 'admin@test.com');
    const res = await request(app).get('/api/positions/freshness').set('Authorization', bearer(admin));
    assert.equal(res.status, 200);
    assert.ok(res.body.config);
    assert.ok(Array.isArray(res.body.loads));
    const [client] = await db.insert(clients).values({ name: 'C', contactPerson: 'C', phone: '1230000000' }).returning();
    const clientUser = await makeUser('client', 'c@test.com', client.id);
    const denied = await request(app).get('/api/positions/freshness').set('Authorization', bearer(clientUser));
    assert.equal(denied.status, 403);
});
test('admins can read and persist freshness settings', async () => {
    const admin = await makeUser('admin', 'admin2@test.com');
    const get = await request(app).get('/api/admin/freshness-settings').set('Authorization', bearer(admin));
    assert.equal(get.status, 200);
    assert.ok(get.body.defaults);
    const put = await request(app).post('/api/admin/freshness-settings')
        .set('Authorization', bearer(admin))
        .send({ workingLifeMin: 90, warnMin: 20, avgSpeedKmh: 30 });
    assert.equal(put.status, 200);
    assert.equal(put.body.workingLifeMin, 90);
    assert.equal(put.body.warnMin, 20);
    assert.equal(put.body.avgSpeedKmh, 30);
});
