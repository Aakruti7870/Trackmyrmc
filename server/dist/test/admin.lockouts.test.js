import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs, loginAttempts } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
async function createUser(opts) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'dispatcher',
        isActive: opts.isActive ?? true,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// Seed a login_attempts row directly. `lockedInMs` is the offset from now for
// `locked_until`: a positive value is an active lockout, a negative one is an
// already-expired lockout.
async function seedLockout(key, count, lockedInMs) {
    await db.insert(loginAttempts).values({
        key,
        count,
        lockedUntil: new Date(Date.now() + lockedInMs),
        updatedAt: new Date(),
    });
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------
test('GET /api/admin/lockouts rejects a non-admin with 403', async () => {
    const dispatcher = await createUser({ name: 'Dispatch', email: 'd@test.com', role: 'dispatcher' });
    const res = await request(app)
        .get('/api/admin/lockouts')
        .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
    assert.equal(res.status, 403);
});
test('GET /api/admin/lockouts rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/admin/lockouts');
    assert.equal(res.status, 401);
});
test('POST /api/admin/lockouts/clear rejects a non-admin with 403', async () => {
    const driver = await createUser({ name: 'Driver', email: 'driver@test.com', role: 'driver' });
    await seedLockout('login:victim@test.com', 5, 10 * 60 * 1000);
    const res = await request(app)
        .post('/api/admin/lockouts/clear')
        .set('Authorization', `Bearer ${tokenFor(driver)}`)
        .send({ key: 'login:victim@test.com' });
    assert.equal(res.status, 403);
    // The lockout must remain untouched after a forbidden attempt.
    const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, 'login:victim@test.com'));
    assert.ok(row, 'lockout row should still exist');
});
// ---------------------------------------------------------------------------
// GET /api/admin/lockouts
// ---------------------------------------------------------------------------
test('returns only active lockouts, sorted by remaining time (longest first), excluding expired', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    // Two active lockouts with different remaining times, plus one expired and one
    // never-locked (lockedUntil null via a count-only row).
    await seedLockout('login:short@test.com', 5, 2 * 60 * 1000); // ~2 min left
    await seedLockout('login:long@test.com', 6, 14 * 60 * 1000); // ~14 min left
    await seedLockout('login:expired@test.com', 5, -60 * 1000); // expired a minute ago
    await db.insert(loginAttempts).values({
        key: 'login:counting@test.com',
        count: 2,
        lockedUntil: null,
        updatedAt: new Date(),
    });
    const res = await request(app)
        .get('/api/admin/lockouts')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    // Longest remaining time first.
    assert.equal(res.body[0].key, 'login:long@test.com');
    assert.equal(res.body[1].key, 'login:short@test.com');
    // Each entry exposes the remaining time and is still in the future.
    assert.ok(res.body[0].retryAfterMs > res.body[1].retryAfterMs);
    assert.ok(res.body[1].retryAfterMs > 0);
    // Expired and never-locked keys are absent.
    const keys = res.body.map((l) => l.key);
    assert.ok(!keys.includes('login:expired@test.com'));
    assert.ok(!keys.includes('login:counting@test.com'));
});
test('returns an empty array when there are no active lockouts', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedLockout('login:expired@test.com', 5, -5 * 60 * 1000);
    const res = await request(app)
        .get('/api/admin/lockouts')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
});
// ---------------------------------------------------------------------------
// POST /api/admin/lockouts/clear
// ---------------------------------------------------------------------------
test('clears an active lockout, removes the row and writes a lockout_cleared audit entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedLockout('login:victim@test.com', 5, 10 * 60 * 1000);
    const res = await request(app)
        .post('/api/admin/lockouts/clear')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ key: 'login:victim@test.com' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    // The lockout row is gone.
    const remaining = await db.select().from(loginAttempts).where(eq(loginAttempts.key, 'login:victim@test.com'));
    assert.equal(remaining.length, 0);
    // An audit row is recorded with the admin as actor and the email derived from
    // the `login:` key prefix.
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'lockout_cleared'));
    assert.equal(logs.length, 1);
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].actorName, admin.name);
    assert.equal(logs[0].targetUserEmail, 'victim@test.com');
});
test('returns 404 for an unknown key and writes no audit entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
        .post('/api/admin/lockouts/clear')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ key: 'login:nobody@test.com' });
    assert.equal(res.status, 404);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'lockout_cleared'));
    assert.equal(logs.length, 0);
});
test('returns 404 once an expired lockout has been cleaned away (no remaining row)', async () => {
    // Once a lockout expires and its row is removed (e.g. by cleanup or a fresh
    // login resetting it), clearing that key behaves like clearing an unknown
    // key: there is nothing to remove, so the endpoint responds 404.
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
        .post('/api/admin/lockouts/clear')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ key: 'login:expired@test.com' });
    assert.equal(res.status, 404);
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'lockout_cleared'));
    assert.equal(logs.length, 0);
});
test('rejects a missing/blank key with 400', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const missing = await request(app)
        .post('/api/admin/lockouts/clear')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({});
    assert.equal(missing.status, 400);
    const blank = await request(app)
        .post('/api/admin/lockouts/clear')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ key: '' });
    assert.equal(blank.status, 400);
});
