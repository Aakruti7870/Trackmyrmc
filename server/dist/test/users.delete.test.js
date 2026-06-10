import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs, clients, drivers } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
async function createUser(opts) {
    const passwordHash = await bcrypt.hash(opts.password ?? PASSWORD, 10);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'dispatcher',
        isActive: opts.isActive ?? true,
        deletedAt: opts.deletedAt ?? null,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function loginToken(email, password = PASSWORD) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return { status: res.status, body: res.body, token: res.body?.token };
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    // Isolate each test: the last-admin guard depends on the global admin count.
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('soft-delete succeeds: writes an audit entry and hides the user from GET /users', async () => {
    const admin = await createUser({ name: 'Admin One', email: 'admin1@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target User', email: 'target@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const before = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    assert.equal(before.status, 200);
    assert.ok(before.body.some((u) => u.id === target.id), 'target should appear in GET /users before deletion');
    const del = await request(app)
        .delete(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    assert.deepEqual(del.body, { ok: true, userId: target.id });
    const after = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    assert.equal(after.status, 200);
    assert.ok(!after.body.some((u) => u.id === target.id), 'target should be hidden from GET /users after deletion');
    const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive })
        .from(users).where(eq(users.id, target.id));
    assert.ok(row.deletedAt instanceof Date, 'deletedAt should be set');
    assert.equal(row.isActive, false, 'isActive should be false after soft-delete');
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.deleted'), eq(auditLogs.targetUserId, target.id)));
    assert.equal(logs.length, 1, 'exactly one user.deleted audit entry should exist');
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].targetUserEmail, target.email);
});
test('guard: an admin cannot delete their own account', async () => {
    const admin = await createUser({ name: 'Admin Self', email: 'self@test.com', role: 'admin' });
    // A second admin exists so the block is specifically the self-delete guard,
    // not the last-admin guard.
    await createUser({ name: 'Admin Two', email: 'admin2@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const res = await request(app)
        .delete(`/api/users/${admin.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /cannot delete your own account/i);
    const [row] = await db.select({ deletedAt: users.deletedAt })
        .from(users).where(eq(users.id, admin.id));
    assert.equal(row.deletedAt, null, 'self-delete should not soft-delete the account');
});
test('guard: cannot delete the last remaining admin', async () => {
    // The route checks self-delete before the last-admin guard, so to reach the
    // guard the actor must be an admin that is NOT counted among active admins.
    // We do that with an actor whose deletedAt is set (excluded from the count)
    // but whose isActive is still true (so requireAuth accepts it). A token is
    // signed directly because /auth/login rejects soft-deleted accounts.
    const actor = await createUser({
        name: 'Ghost Admin', email: 'ghost@test.com', role: 'admin',
        isActive: true, deletedAt: new Date(),
    });
    const soleAdmin = await createUser({ name: 'Sole Admin', email: 'sole@test.com', role: 'admin' });
    const token = tokenFor(actor);
    const res = await request(app)
        .delete(`/api/users/${soleAdmin.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 400);
    assert.match(res.body.error, /last remaining admin/i);
    const [row] = await db.select({ deletedAt: users.deletedAt })
        .from(users).where(eq(users.id, soleAdmin.id));
    assert.equal(row.deletedAt, null, 'the last admin must not be soft-deleted');
});
test('guard: deleting an already-deleted user returns 404', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Target', email: 'gone@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const first = await request(app)
        .delete(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(first.status, 200);
    const second = await request(app)
        .delete(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(second.status, 404);
    assert.match(second.body.error, /not found/i);
    // A non-existent id is also a 404.
    const missing = await request(app)
        .delete('/api/users/999999')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(missing.status, 404);
});
test('a soft-deleted user can no longer authenticate via /auth/login', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const user = await createUser({ name: 'Login User', email: 'login@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const okLogin = await loginToken(user.email);
    assert.equal(okLogin.status, 200, 'user can log in before deletion');
    assert.ok(okLogin.token, 'a token is issued before deletion');
    const del = await request(app)
        .delete(`/api/users/${user.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    const blocked = await loginToken(user.email);
    assert.equal(blocked.status, 401, 'soft-deleted user cannot log in');
    assert.match(blocked.body.error, /invalid credentials/i);
});
test('reactivate: PUT isActive=true on a deactivated (not deleted) user writes account_activated', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    // A user that was merely deactivated (isActive=false) but never soft-deleted.
    const target = await createUser({
        name: 'Dormant User', email: 'dormant@test.com', role: 'dispatcher', isActive: false,
    });
    const token = tokenFor(admin);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.isActive, true, 'response reflects the reactivated state');
    assert.equal(res.body.deletedAt, null, 'a never-deleted user stays not-deleted');
    const [row] = await db.select({ isActive: users.isActive, deletedAt: users.deletedAt })
        .from(users).where(eq(users.id, target.id));
    assert.equal(row.isActive, true);
    assert.equal(row.deletedAt, null);
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'account_activated'), eq(auditLogs.targetUserId, target.id)));
    assert.equal(logs.length, 1, 'exactly one account_activated audit entry should exist');
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].targetUserEmail, target.email);
    assert.match(String(logs[0].detail), /reactivated/i);
    // The reactivated (and never-deleted) user appears in the active list and can log in.
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    assert.ok(list.body.some((u) => u.id === target.id), 'reactivated user is listed');
    const login = await loginToken(target.email);
    assert.equal(login.status, 200, 'reactivated user can log in');
});
test('gap: PUT isActive=true does NOT un-soft-delete a deleted user', async () => {
    // Documents intended behavior: the update route only toggles isActive; it does
    // not clear deletedAt. A soft-deleted account therefore stays hidden and locked
    // out even after PUT isActive=true — the dedicated restore route is required.
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Deleted User', email: 'gone@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const del = await request(app)
        .delete(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true });
    assert.equal(res.status, 200);
    assert.ok(res.body.deletedAt, 'deletedAt remains set after PUT isActive=true');
    const [row] = await db.select({ isActive: users.isActive, deletedAt: users.deletedAt })
        .from(users).where(eq(users.id, target.id));
    assert.equal(row.isActive, true, 'isActive was toggled on');
    assert.ok(row.deletedAt instanceof Date, 'but the account is still soft-deleted');
    // Still hidden from the default (non-deleted) listing and still cannot log in.
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    assert.ok(!list.body.some((u) => u.id === target.id), 'a still-deleted user must not reappear in GET /users');
    const login = await loginToken(target.email);
    assert.equal(login.status, 401, 'a still-deleted user cannot log in even when isActive=true');
});
test('restore: POST /:id/restore un-deletes the user, relists them, and writes user.restored', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Restore Me', email: 'restore@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const del = await request(app)
        .delete(`/api/users/${target.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    // Before restore the user shows up only under the deleted-only listing.
    const deletedList = await request(app)
        .get('/api/users?deleted=true').set('Authorization', `Bearer ${token}`);
    assert.ok(deletedList.body.some((u) => u.id === target.id), 'deleted user appears under ?deleted=true');
    const res = await request(app)
        .post(`/api/users/${target.id}/restore`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.isActive, true);
    assert.equal(res.body.deletedAt, null, 'restore clears deletedAt');
    const [row] = await db.select({ isActive: users.isActive, deletedAt: users.deletedAt })
        .from(users).where(eq(users.id, target.id));
    assert.equal(row.isActive, true);
    assert.equal(row.deletedAt, null);
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, target.id)));
    assert.equal(logs.length, 1, 'exactly one user.restored audit entry should exist');
    assert.equal(logs[0].actorId, admin.id);
    assert.equal(logs[0].targetUserEmail, target.email);
    // After restore the user is back in the active listing and can log in again.
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    assert.ok(list.body.some((u) => u.id === target.id), 'restored user is listed again');
    const login = await loginToken(target.email);
    assert.equal(login.status, 200, 'restored user can log in again');
    assert.ok(login.token, 'a token is issued after restore');
});
test('unlock: POST /:id/unlock writes a lockout_cleared audit entry naming the acting admin and target', async () => {
    const admin = await createUser({ name: 'Admin Unlock', email: 'unlock-admin@test.com', role: 'admin' });
    const target = await createUser({ name: 'Locked User', email: 'locked@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    const res = await request(app)
        .post(`/api/users/${target.id}/unlock`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, userId: target.id });
    const logs = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'lockout_cleared'), eq(auditLogs.targetUserId, target.id)));
    assert.equal(logs.length, 1, 'exactly one lockout_cleared audit entry should exist');
    assert.equal(logs[0].actorId, admin.id, 'audit entry records the acting admin');
    assert.equal(logs[0].actorName, admin.name);
    assert.equal(logs[0].targetUserEmail, target.email, 'audit entry records the target user');
    assert.ok(logs[0].createdAt instanceof Date, 'audit entry records a timestamp');
});
test('unlock: returns 404 for a non-existent user and writes no audit entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const res = await request(app)
        .post('/api/users/999999/unlock')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 404);
    const logs = await db.select().from(auditLogs)
        .where(eq(auditLogs.action, 'lockout_cleared'));
    assert.equal(logs.length, 0, 'no audit entry should be written when the unlock target does not exist');
});
test('restore: returns 404 for a non-deleted user and a non-existent id', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const active = await createUser({ name: 'Active User', email: 'active@test.com', role: 'dispatcher' });
    const token = tokenFor(admin);
    // An account that was never soft-deleted cannot be restored.
    const notDeleted = await request(app)
        .post(`/api/users/${active.id}/restore`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(notDeleted.status, 404);
    assert.match(notDeleted.body.error, /not found/i);
    const missing = await request(app)
        .post('/api/users/999999/restore')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(missing.status, 404);
});
async function createClient(name) {
    const [row] = await db.insert(clients).values({
        name, contactPerson: 'Contact', phone: '0000000000',
    }).returning();
    return row;
}
async function createDriver(name) {
    const [row] = await db.insert(drivers).values({
        name, phone: '0000000000',
    }).returning();
    return row;
}
test('link guard: POST /users rejects a client already linked to another active user', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const client = await createClient('Acme Concrete');
    const token = tokenFor(admin);
    // First account links the client — succeeds.
    const first = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Client One', email: 'c1@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
    assert.equal(first.status, 201);
    // Second account links the same client — rejected with 409.
    const second = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Client Two', email: 'c2@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
    assert.equal(second.status, 409);
    assert.match(second.body.error, /already linked/i);
    assert.match(second.body.error, /Client One/);
    // The second account was not created.
    const rows = await db.select().from(users).where(eq(users.email, 'c2@test.com'));
    assert.equal(rows.length, 0, 'the conflicting account must not be created');
});
test('link guard: POST /users rejects a driver already linked to another active user', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const driver = await createDriver('Ravi Kumar');
    const token = tokenFor(admin);
    const first = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Driver One', email: 'd1@test.com', password: PASSWORD, role: 'driver', linkedDriverId: driver.id });
    assert.equal(first.status, 201);
    const second = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Driver Two', email: 'd2@test.com', password: PASSWORD, role: 'driver', linkedDriverId: driver.id });
    assert.equal(second.status, 409);
    assert.match(second.body.error, /already linked/i);
    assert.match(second.body.error, /Driver One/);
});
test('link guard: a client freed by soft-deleting its user can be linked to a new account', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const client = await createClient('Acme Concrete');
    const token = tokenFor(admin);
    const first = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Client One', email: 'c1@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
    assert.equal(first.status, 201);
    // Soft-delete the holder; the link no longer blocks a new account.
    const del = await request(app)
        .delete(`/api/users/${first.body.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    const second = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Client Two', email: 'c2@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
    assert.equal(second.status, 201, 'a link held only by a deleted user is free to reuse');
});
test('link guard: PUT /users rejects linking a client already held by another active user', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const client = await createClient('Acme Concrete');
    const token = tokenFor(admin);
    const holder = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Holder', email: 'holder@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
    assert.equal(holder.status, 201);
    const other = await createUser({ name: 'Other', email: 'other@test.com', role: 'client' });
    const res = await request(app)
        .put(`/api/users/${other.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ linkedClientId: client.id });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already linked/i);
    const [row] = await db.select({ linkedClientId: users.linkedClientId })
        .from(users).where(eq(users.id, other.id));
    assert.equal(row.linkedClientId, null, 'the conflicting link must not be saved');
});
test('link guard: PUT /users lets a user keep its own existing link (no false self-conflict)', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const client = await createClient('Acme Concrete');
    const token = tokenFor(admin);
    const holder = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Holder', email: 'holder@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
    assert.equal(holder.status, 201);
    // Re-saving the same user with the same link (e.g. a name edit) must succeed.
    const res = await request(app)
        .put(`/api/users/${holder.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Holder Renamed', linkedClientId: client.id });
    assert.equal(res.status, 200);
    assert.equal(res.body.linkedClientId, client.id);
    assert.equal(res.body.name, 'Holder Renamed');
});
