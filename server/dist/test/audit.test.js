import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
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
async function seedAudit(rows) {
    await db.insert(auditLogs).values(rows.map(r => ({
        actorId: r.actorId ?? null,
        actorName: r.actorName ?? null,
        action: r.action,
        targetUserId: r.targetUserId ?? null,
        targetUserEmail: r.targetUserEmail ?? null,
        detail: r.detail ?? null,
        emailSent: r.emailSent ?? null,
        ...(r.createdAt ? { createdAt: r.createdAt } : {}),
    })));
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
test('requires an admin: a dispatcher gets 403', async () => {
    const dispatcher = await createUser({ name: 'Dispatch', email: 'd@test.com', role: 'dispatcher' });
    const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
    assert.equal(res.status, 403);
});
test('returns the full trail across target types, newest first', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedAudit([
        { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com', emailSent: true, createdAt: new Date('2026-01-01T10:00:00Z') },
        { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'b@x.com', emailSent: false, createdAt: new Date('2026-01-03T10:00:00Z') },
        { actorId: admin.id, actorName: admin.name, action: 'role_change', targetUserEmail: 'c@x.com', detail: 'driver → admin', createdAt: new Date('2026-01-02T10:00:00Z') },
    ]);
    const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 3);
    // newest first
    assert.equal(res.body[0].action, 'password_reset');
    assert.equal(res.body[1].action, 'role_change');
    assert.equal(res.body[2].action, 'user.created');
});
test('filters by action type', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedAudit([
        { action: 'user.created', targetUserEmail: 'a@x.com' },
        { action: 'password_reset', targetUserEmail: 'b@x.com' },
        { action: 'password_reset', targetUserEmail: 'c@x.com' },
    ]);
    const res = await request(app)
        .get('/api/audit-logs?action=password_reset')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every((r) => r.action === 'password_reset'));
});
test('filters by multiple actions (comma-separated)', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedAudit([
        { action: 'user.created', targetUserEmail: 'a@x.com' },
        { action: 'user.deleted', targetUserEmail: 'b@x.com' },
        { action: 'password_reset', targetUserEmail: 'c@x.com' },
    ]);
    const res = await request(app)
        .get('/api/audit-logs?action=user.created,user.deleted')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.ok(res.body.every((r) => r.action !== 'password_reset'));
});
test('filters by actor', async () => {
    const admin = await createUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const other = await createUser({ name: 'Admin Two', email: 'admin2@test.com', role: 'admin' });
    await seedAudit([
        { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
        { actorId: other.id, actorName: other.name, action: 'user.created', targetUserEmail: 'b@x.com' },
    ]);
    const res = await request(app)
        .get(`/api/audit-logs?actorId=${admin.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].actorId, admin.id);
});
test('filters by date range (inclusive of whole end day)', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedAudit([
        { action: 'user.created', targetUserEmail: 'old@x.com', createdAt: new Date('2026-01-01T10:00:00Z') },
        { action: 'user.created', targetUserEmail: 'mid@x.com', createdAt: new Date('2026-02-15T18:00:00Z') },
        { action: 'user.created', targetUserEmail: 'new@x.com', createdAt: new Date('2026-03-30T10:00:00Z') },
    ]);
    const res = await request(app)
        .get('/api/audit-logs?from=2026-02-01&to=2026-02-28')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].targetUserEmail, 'mid@x.com');
});
test('free-text search matches actor, target email and detail', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedAudit([
        { actorName: 'Alice', action: 'user.created', targetUserEmail: 'find@example.com' },
        { actorName: 'Bob', action: 'role_change', targetUserEmail: 'other@x.com', detail: 'driver → admin' },
        { actorName: 'Carol', action: 'user.created', targetUserEmail: 'nope@x.com' },
    ]);
    const byEmail = await request(app)
        .get('/api/audit-logs?q=find@example')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(byEmail.body.length, 1);
    assert.equal(byEmail.body[0].targetUserEmail, 'find@example.com');
    const byDetail = await request(app)
        .get('/api/audit-logs?q=driver')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(byDetail.body.length, 1);
    assert.equal(byDetail.body[0].actorName, 'Bob');
    const byActor = await request(app)
        .get('/api/audit-logs?q=carol')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(byActor.body.length, 1);
    assert.equal(byActor.body[0].actorName, 'Carol');
});
test('combines filters with AND', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    await seedAudit([
        { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'a@x.com', createdAt: new Date('2026-02-10T10:00:00Z') },
        { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'b@x.com', createdAt: new Date('2026-02-10T10:00:00Z') },
        { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'c@x.com', createdAt: new Date('2026-05-10T10:00:00Z') },
    ]);
    const res = await request(app)
        .get('/api/audit-logs?action=password_reset&from=2026-02-01&to=2026-02-28')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].targetUserEmail, 'a@x.com');
});
test('facets returns distinct actions and actors', async () => {
    const admin = await createUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
    const other = await createUser({ name: 'Admin Two', email: 'admin2@test.com', role: 'admin' });
    await seedAudit([
        { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
        { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'b@x.com' },
        { actorId: other.id, actorName: other.name, action: 'password_reset', targetUserEmail: 'c@x.com' },
        { actorId: null, actorName: null, action: 'lockout_cleared', targetUserEmail: 'd@x.com' },
    ]);
    const res = await request(app)
        .get('/api/audit-logs/facets')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.deepEqual([...res.body.actions].sort(), ['lockout_cleared', 'password_reset', 'user.created']);
    assert.equal(res.body.actors.length, 2);
    const ids = res.body.actors.map((a) => a.id).sort((x, y) => x - y);
    assert.deepEqual(ids, [admin.id, other.id].sort((x, y) => x - y));
});
test('invalid actorId returns 400', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
        .get('/api/audit-logs?actorId=abc')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 400);
});
