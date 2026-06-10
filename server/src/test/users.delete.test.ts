import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs, clients, drivers } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;

const PASSWORD = 'secret123';

async function createUser(opts: {
  name: string;
  email: string;
  role?: Role;
  password?: string;
  isActive?: boolean;
  deletedAt?: Date | null;
}) {
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

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function loginToken(email: string, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { status: res.status, body: res.body, token: res.body?.token as string | undefined };
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  // Isolate each test: the last-admin guard depends on the global admin count.
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
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
  assert.ok(
    before.body.some((u: { id: number }) => u.id === target.id),
    'target should appear in GET /users before deletion',
  );

  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);
  assert.deepEqual(del.body, { ok: true, userId: target.id });

  const after = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
  assert.equal(after.status, 200);
  assert.ok(
    !after.body.some((u: { id: number }) => u.id === target.id),
    'target should be hidden from GET /users after deletion',
  );

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

test('deleted listing: a soft-deleted user appears under ?deleted=true with its deletedAt', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  // The default (active-only) listing hides it...
  const active = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
  assert.ok(
    !active.body.some((u: { id: number }) => u.id === target.id),
    'a soft-deleted user must not appear in the default listing',
  );

  // ...but the deleted-only listing surfaces it, with a populated deletedAt.
  const deleted = await request(app)
    .get('/api/users?deleted=true').set('Authorization', `Bearer ${token}`);
  assert.equal(deleted.status, 200);
  const found = deleted.body.find((u: { id: number }) => u.id === target.id);
  assert.ok(found, 'a soft-deleted user appears under ?deleted=true');
  assert.ok(found.deletedAt, 'the deleted listing exposes a deletedAt timestamp');
  assert.equal(found.isActive, false, 'the deleted listing reports the user as inactive');
});

test('email collision: recreating a soft-deleted email returns the email_soft_deleted code', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Gone Person', email: 'reuse@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  // Trying to create a brand-new account with the same email is blocked with a
  // dedicated code so the UI can offer to restore the deleted account instead.
  const recreate = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New Person', email: 'reuse@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(recreate.status, 409);
  assert.equal(recreate.body.code, 'email_soft_deleted');
  assert.equal(recreate.body.deletedUserId, target.id, 'the response points at the deleted account');
  assert.equal(recreate.body.deletedUserName, 'Gone Person');
  assert.match(recreate.body.error, /previously deleted/i);

  // No duplicate row was created — the deleted account is still the only one.
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, 'reuse@test.com'));
  assert.equal(rows.length, 1, 'recreating must not insert a second row for the email');
});

test('email collision: an active (not deleted) email returns the plain in-use error, not the restore code', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await createUser({ name: 'Active Person', email: 'active@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Another', email: 'active@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, undefined, 'an in-use active email has no restore code');
  assert.match(res.body.error, /already in use/i);
});

test('email reuse: once restored, the email is taken again and recreating it conflicts', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Cycle Person', email: 'cycle@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  await request(app).delete(`/api/users/${target.id}`).set('Authorization', `Bearer ${token}`);
  await request(app).post(`/api/users/${target.id}/restore`).set('Authorization', `Bearer ${token}`);

  // After restore the account is active again, so the email is once more an
  // ordinary in-use collision (not a soft-deleted one).
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New Cycle', email: 'cycle@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, undefined, 'a restored (active) email is a plain in-use conflict');
  assert.match(res.body.error, /already in use/i);
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
  assert.ok(list.body.some((u: { id: number }) => u.id === target.id), 'reactivated user is listed');
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
  assert.ok(
    !list.body.some((u: { id: number }) => u.id === target.id),
    'a still-deleted user must not reappear in GET /users',
  );
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
  assert.ok(
    deletedList.body.some((u: { id: number }) => u.id === target.id),
    'deleted user appears under ?deleted=true',
  );

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
  assert.ok(list.body.some((u: { id: number }) => u.id === target.id), 'restored user is listed again');
  const login = await loginToken(target.email);
  assert.equal(login.status, 200, 'restored user can log in again');
  assert.ok(login.token, 'a token is issued after restore');
});

test('restore: POST /:id/restore is blocked with a 409 when the linked client is already taken, and succeeds after the conflict is unlinked', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const client = await createClient('Acme Concrete');
  const token = tokenFor(admin);

  // An active account already holds the client link.
  const holder = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Active Holder', email: 'holder@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
  assert.equal(holder.status, 201);

  // A soft-deleted account pointing at the same client.
  const conflicted = await createUser({
    name: 'Conflicted', email: 'conflict@test.com', role: 'client',
    isActive: false, deletedAt: new Date(),
  });
  await db.update(users).set({ linkedClientId: client.id }).where(eq(users.id, conflicted.id));

  // Retrying the restore while the conflict stands returns the same clear reason.
  const blocked = await request(app)
    .post(`/api/users/${conflicted.id}/restore`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(blocked.status, 409, 'restore is blocked while the link is taken');
  assert.match(blocked.body.error, /already linked/i);

  // The account is still soft-deleted and no restore audit entry was written.
  const [stillGone] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, conflicted.id));
  assert.ok(stillGone.deletedAt instanceof Date, 'a blocked restore leaves the account deleted');
  const blockedLogs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, conflicted.id)));
  assert.equal(blockedLogs.length, 0, 'a blocked restore writes no restore audit entry');

  // Admin unlinks the active holder, then the retry succeeds and the account drops out of the trash.
  await request(app)
    .put(`/api/users/${holder.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ linkedClientId: null });

  const ok = await request(app)
    .post(`/api/users/${conflicted.id}/restore`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(ok.status, 200, 'restore succeeds once the conflict is resolved');
  assert.equal(ok.body.deletedAt, null, 'the account is restored');

  const okLogs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, conflicted.id)));
  assert.equal(okLogs.length, 1, 'exactly one user.restored entry is written on success');
});

test('restore: POST /:id/restore with clearLink restores past a taken link by clearing it, and notes the clear in the audit log', async () => {
  const admin = await createUser({ name: 'Admin Clear', email: 'admin-clear@test.com', role: 'admin' });
  const client = await createClient('Beta Concrete');
  const token = tokenFor(admin);

  // An active account already holds the client link.
  const holder = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Active Holder 2', email: 'holder2@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
  assert.equal(holder.status, 201);

  // A soft-deleted account pointing at the same client.
  const conflicted = await createUser({
    name: 'Conflicted 2', email: 'conflict2@test.com', role: 'client',
    isActive: false, deletedAt: new Date(),
  });
  await db.update(users).set({ linkedClientId: client.id }).where(eq(users.id, conflicted.id));

  // Restoring with clearLink succeeds without touching the active holder.
  const ok = await request(app)
    .post(`/api/users/${conflicted.id}/restore`)
    .set('Authorization', `Bearer ${token}`)
    .send({ clearLink: true });
  assert.equal(ok.status, 200, 'restore-without-link succeeds despite the taken link');
  assert.equal(ok.body.deletedAt, null, 'the account is restored');
  assert.equal(ok.body.linkedClientId, null, 'the conflicting link is cleared on the restored account');

  const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive, linkedClientId: users.linkedClientId })
    .from(users).where(eq(users.id, conflicted.id));
  assert.equal(row.deletedAt, null);
  assert.equal(row.isActive, true);
  assert.equal(row.linkedClientId, null, 'the link is cleared in the database');

  // The active holder keeps its link untouched.
  const [holderRow] = await db.select({ linkedClientId: users.linkedClientId })
    .from(users).where(eq(users.id, holder.body.id));
  assert.equal(holderRow.linkedClientId, client.id, 'the active holder still owns the link');

  // The restore is audited and the detail records that the link was cleared.
  const logs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, conflicted.id)));
  assert.equal(logs.length, 1, 'exactly one user.restored entry is written');
  assert.match(logs[0].detail ?? '', /cleared/i, 'the audit detail notes the link was cleared');
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

test('permanent: DELETE /:id/permanent purges a soft-deleted user, frees the email, and writes user.purged', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Purge Me', email: 'purge@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  // Soft-delete first — only soft-deleted accounts can be purged.
  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  const purge = await request(app)
    .delete(`/api/users/${target.id}/permanent`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(purge.status, 200);
  assert.deepEqual(purge.body, { ok: true, userId: target.id });

  // The row is gone entirely.
  const rows = await db.select().from(users).where(eq(users.id, target.id));
  assert.equal(rows.length, 0, 'the user row must be physically removed');

  // The audit entry survives with the preserved email label; the FK is nulled.
  const logs = await db.select().from(auditLogs)
    .where(eq(auditLogs.action, 'user.purged'));
  assert.equal(logs.length, 1, 'exactly one user.purged audit entry should exist');
  assert.equal(logs[0].actorId, admin.id);
  assert.equal(logs[0].targetUserId, null, 'targetUserId is nulled after the row is removed');
  assert.equal(logs[0].targetUserEmail, target.email, 'the email label is preserved');

  // The freed email can now be reused for a brand-new account.
  const recreate = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fresh Start', email: 'purge@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(recreate.status, 201, 'the purged email is free to reuse');
});

test('permanent: returns 404 for a non-deleted user, an already-purged id, and a missing id', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const active = await createUser({ name: 'Active', email: 'active@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  // An account that was never soft-deleted cannot be purged.
  const notDeleted = await request(app)
    .delete(`/api/users/${active.id}/permanent`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(notDeleted.status, 404);
  assert.match(notDeleted.body.error, /not found/i);
  const stillThere = await db.select().from(users).where(eq(users.id, active.id));
  assert.equal(stillThere.length, 1, 'a non-deleted user must not be purged');

  // A missing id is also a 404.
  const missing = await request(app)
    .delete('/api/users/999999/permanent')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(missing.status, 404);
});

test('permanent guard: cannot purge the last admin when no other admin record remains', async () => {
  // The only admin in the system, soft-deleted. Purging it would leave no admin
  // record at all (active or restorable), so the guard must block it.
  const actor = await createUser({
    name: 'Ghost Admin', email: 'ghost@test.com', role: 'admin',
    isActive: true, deletedAt: new Date(),
  });
  const token = tokenFor(actor);

  const res = await request(app)
    .delete(`/api/users/${actor.id}/permanent`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /last admin/i);

  const rows = await db.select().from(users).where(eq(users.id, actor.id));
  assert.equal(rows.length, 1, 'the last admin must not be purged');
});

test('permanent: a soft-deleted admin can be purged when another admin remains', async () => {
  const admin = await createUser({ name: 'Live Admin', email: 'live@test.com', role: 'admin' });
  const target = await createUser({ name: 'Spare Admin', email: 'spare@test.com', role: 'admin' });
  const token = tokenFor(admin);

  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  const purge = await request(app)
    .delete(`/api/users/${target.id}/permanent`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(purge.status, 200, 'purging a non-last admin is allowed');

  const rows = await db.select().from(users).where(eq(users.id, target.id));
  assert.equal(rows.length, 0, 'the spare admin row is removed');
});

async function createClient(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Contact', phone: '0000000000',
  }).returning();
  return row;
}

async function createDriver(name: string) {
  const [row] = await db.insert(drivers).values({
    name, phone: '0000000000',
  }).returning();
  return row;
}

test('soft-deleted email: POST /users returns 409 email_soft_deleted with the deleted user id and name', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Deleted Person', email: 'reuse@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  // Soft-delete the account that owns the email.
  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  // Re-creating with the same email is blocked and points the admin at a restore.
  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Brand New', email: 'reuse@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'email_soft_deleted');
  assert.equal(res.body.deletedUserId, target.id);
  assert.equal(res.body.deletedUserName, target.name);
  assert.match(res.body.error, /previously deleted/i);

  // No duplicate account was created for that email.
  const rows = await db.select().from(users).where(eq(users.email, 'reuse@test.com'));
  assert.equal(rows.length, 1, 'no duplicate account should be created');
  assert.equal(rows[0].id, target.id, 'the only row is still the soft-deleted original');
});

test('soft-deleted email: a fresh, unused email still creates normally (no false positive)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  // A soft-deleted user with a DIFFERENT email must not block an unrelated email.
  const deleted = await createUser({ name: 'Old User', email: 'old@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);
  const del = await request(app)
    .delete(`/api/users/${deleted.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Fresh User', email: 'fresh@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(res.status, 201, 'a brand-new email creates without a soft-deleted conflict');
  assert.equal(res.body.email, 'fresh@test.com');
  assert.ok(!('code' in res.body), 'no email_soft_deleted code on a clean create');

  const rows = await db.select().from(users).where(eq(users.email, 'fresh@test.com'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deletedAt, null, 'the new account is active, not deleted');
});

test('soft-deleted email: the create-then-restore round trip leaves one active account with a clean audit trail', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Round Trip', email: 'rt@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  const del = await request(app)
    .delete(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);

  // The admin tries to create, is told to restore, then restores the surfaced id.
  const conflict = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Round Trip Again', email: 'rt@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'email_soft_deleted');

  const restore = await request(app)
    .post(`/api/users/${conflict.body.deletedUserId}/restore`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(restore.status, 200);
  assert.equal(restore.body.deletedAt, null);

  // Exactly one account exists for that email and it is active again.
  const rows = await db.select().from(users).where(eq(users.email, 'rt@test.com'));
  assert.equal(rows.length, 1, 'the round trip never duplicates the account');
  assert.equal(rows[0].id, target.id);
  assert.equal(rows[0].isActive, true);
  assert.equal(rows[0].deletedAt, null);

  // The audit trail shows the delete then the restore, and no spurious user.created.
  const created = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, target.id)));
  assert.equal(created.length, 0, 'the blocked create must not write a user.created entry');
  const deletedLogs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.deleted'), eq(auditLogs.targetUserId, target.id)));
  assert.equal(deletedLogs.length, 1);
  const restoredLogs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, target.id)));
  assert.equal(restoredLogs.length, 1);

  // The restored account can log in again.
  const login = await loginToken(target.email);
  assert.equal(login.status, 200, 'the restored account works');
});

test('purge-all: empties the trash, leaves active accounts, and writes a user.purged entry per removal', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const keepActive = await createUser({ name: 'Active', email: 'active@test.com', role: 'dispatcher' });
  const a = await createUser({ name: 'Gone A', email: 'a@test.com', role: 'dispatcher', deletedAt: new Date() });
  const b = await createUser({ name: 'Gone B', email: 'b@test.com', role: 'client', deletedAt: new Date() });
  const c = await createUser({ name: 'Gone C', email: 'c@test.com', role: 'driver', deletedAt: new Date() });
  const token = tokenFor(admin);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 3, 'all three soft-deleted accounts are purged');
  assert.equal(res.body.skipped, 0, 'nothing is skipped');

  // All three deleted rows are physically gone.
  for (const id of [a.id, b.id, c.id]) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    assert.equal(rows.length, 0, `deleted user ${id} is removed`);
  }
  // The active admin and active dispatcher are untouched.
  const survivors = await db.select({ id: users.id }).from(users);
  const ids = survivors.map(r => r.id).sort();
  assert.deepEqual(ids, [admin.id, keepActive.id].sort(), 'only the active accounts remain');

  // One user.purged audit entry per removal, with preserved email labels.
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.purged'));
  assert.equal(logs.length, 3, 'one user.purged entry per purged account');
  const emails = logs.map(l => l.targetUserEmail).sort();
  assert.deepEqual(emails, ['a@test.com', 'b@test.com', 'c@test.com']);
  assert.ok(logs.every(l => l.actorId === admin.id), 'every entry records the acting admin');
});

test('purge-all: with no deleted accounts, returns zero counts and writes nothing', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await createUser({ name: 'Active', email: 'active@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { purged: 0, skipped: 0, skippedAdmins: [] });

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.purged'));
  assert.equal(logs.length, 0, 'no audit entries when the trash is empty');
});

test('purge-all guard: a soft-deleted admin is purged when an active admin remains', async () => {
  const admin = await createUser({ name: 'Live Admin', email: 'live@test.com', role: 'admin' });
  const goneAdmin = await createUser({ name: 'Gone Admin', email: 'gone@test.com', role: 'admin', deletedAt: new Date() });
  const goneUser = await createUser({ name: 'Gone User', email: 'user@test.com', role: 'dispatcher', deletedAt: new Date() });
  const token = tokenFor(admin);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 2, 'both deleted accounts purge — the active admin keeps the system safe');
  assert.equal(res.body.skipped, 0);

  for (const id of [goneAdmin.id, goneUser.id]) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    assert.equal(rows.length, 0, `account ${id} is removed`);
  }
});

test('purge-all guard: the last admin in the trash is skipped to keep one admin alive', async () => {
  // Actor is itself a soft-deleted admin (excluded from /auth/login but valid for
  // requireAuth) and is the ONLY admin. Bulk purge must keep one admin: the actor
  // (lowest id) is purged-eligible but the guard stops the final admin removal.
  const actor = await createUser({
    name: 'Ghost Admin', email: 'ghost@test.com', role: 'admin',
    isActive: true, deletedAt: new Date(),
  });
  const goneUser = await createUser({ name: 'Gone User', email: 'user@test.com', role: 'dispatcher', deletedAt: new Date() });
  const token = tokenFor(actor);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 1, 'only the non-admin is purged');
  assert.equal(res.body.skipped, 1, 'the sole admin is skipped');
  assert.equal(res.body.skippedAdmins[0].email, 'ghost@test.com');

  // The non-admin is gone; the sole admin survives.
  const goneRows = await db.select().from(users).where(eq(users.id, goneUser.id));
  assert.equal(goneRows.length, 0, 'the deleted non-admin is removed');
  const adminRows = await db.select().from(users).where(eq(users.id, actor.id));
  assert.equal(adminRows.length, 1, 'the last admin record is preserved');
});

test('purge-all guard: among several deleted admins and no active admin, exactly one is kept', async () => {
  const actor = await createUser({
    name: 'Ghost Admin', email: 'ghost@test.com', role: 'admin',
    isActive: true, deletedAt: new Date(),
  });
  const spareAdmin = await createUser({ name: 'Spare Admin', email: 'spare@test.com', role: 'admin', deletedAt: new Date() });
  const token = tokenFor(actor);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 1, 'one of the two deleted admins is purged');
  assert.equal(res.body.skipped, 1, 'the other is skipped to keep an admin');

  // Exactly one admin row remains; iteration order purges the lower id first,
  // so the higher-id admin is the one kept.
  const remaining = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
  assert.equal(remaining.length, 1, 'exactly one admin record survives the bulk purge');
  assert.equal(remaining[0].id, spareAdmin.id, 'the later admin is kept once the guard trips');
});

test('purge-all selective: only the listed soft-deleted accounts are purged', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const a = await createUser({ name: 'Gone A', email: 'a@test.com', role: 'dispatcher', deletedAt: new Date() });
  const b = await createUser({ name: 'Gone B', email: 'b@test.com', role: 'client', deletedAt: new Date() });
  const keep = await createUser({ name: 'Keep', email: 'keep@test.com', role: 'driver', deletedAt: new Date() });
  const token = tokenFor(admin);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`)
    .send({ ids: [a.id, b.id] });
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 2, 'only the two selected accounts are purged');
  assert.equal(res.body.skipped, 0);

  for (const id of [a.id, b.id]) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    assert.equal(rows.length, 0, `selected user ${id} is removed`);
  }
  const keepRows = await db.select().from(users).where(eq(users.id, keep.id));
  assert.equal(keepRows.length, 1, 'the unselected deleted account stays in the trash');

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.purged'));
  assert.equal(logs.length, 2, 'one user.purged entry per selected removal');
});

test('purge-all selective: ignores ids that are not soft-deleted', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const active = await createUser({ name: 'Active', email: 'active@test.com', role: 'dispatcher' });
  const gone = await createUser({ name: 'Gone', email: 'gone@test.com', role: 'client', deletedAt: new Date() });
  const token = tokenFor(admin);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`)
    .send({ ids: [active.id, gone.id, 999999] });
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 1, 'only the soft-deleted id in the list is purged');

  const activeRows = await db.select().from(users).where(eq(users.id, active.id));
  assert.equal(activeRows.length, 1, 'the active account is never purged');
  const goneRows = await db.select().from(users).where(eq(users.id, gone.id));
  assert.equal(goneRows.length, 0, 'the soft-deleted account is purged');
});

test('purge-all selective: the last-admin guard still applies to a selection', async () => {
  const actor = await createUser({
    name: 'Ghost Admin', email: 'ghost@test.com', role: 'admin',
    isActive: true, deletedAt: new Date(),
  });
  const goneUser = await createUser({ name: 'Gone User', email: 'user@test.com', role: 'dispatcher', deletedAt: new Date() });
  const token = tokenFor(actor);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`)
    .send({ ids: [actor.id, goneUser.id] });
  assert.equal(res.status, 200);
  assert.equal(res.body.purged, 1, 'only the non-admin in the selection is purged');
  assert.equal(res.body.skipped, 1, 'the sole admin is skipped even when explicitly selected');
  assert.equal(res.body.skippedAdmins[0].email, 'ghost@test.com');

  const adminRows = await db.select().from(users).where(eq(users.id, actor.id));
  assert.equal(adminRows.length, 1, 'the last admin record is preserved');
});

test('purge-all selective: an empty ids array is rejected', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`)
    .send({ ids: [] });
  assert.equal(res.status, 400, 'an empty selection is a bad request');
});

test('purge-all: rejected for a non-admin caller (requireRole admin)', async () => {
  await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const dispatcher = await createUser({ name: 'Dispatch', email: 'dispatch@test.com', role: 'dispatcher' });
  await createUser({ name: 'Gone', email: 'gone@test.com', role: 'dispatcher', deletedAt: new Date() });
  const token = tokenFor(dispatcher);

  const res = await request(app)
    .delete('/api/users/purge-all')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403, 'a non-admin cannot empty the trash');

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.purged'));
  assert.equal(logs.length, 0, 'no purge happened');
});

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

test('restore-all: with no body restores every soft-deleted account and writes one user.restored each', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const keepActive = await createUser({ name: 'Active', email: 'active@test.com', role: 'dispatcher' });
  const a = await createUser({ name: 'Gone A', email: 'a@test.com', role: 'dispatcher', isActive: false, deletedAt: new Date() });
  const b = await createUser({ name: 'Gone B', email: 'b@test.com', role: 'client', isActive: false, deletedAt: new Date() });
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/users/restore-all')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.restored, 2, 'both deleted accounts are restored');
  assert.equal(res.body.skipped, 0, 'nothing skipped');

  for (const id of [a.id, b.id]) {
    const [row] = await db.select({ isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users).where(eq(users.id, id));
    assert.equal(row.deletedAt, null, `account ${id} is no longer deleted`);
    assert.equal(row.isActive, true, `account ${id} is reactivated`);
  }

  // The previously-active dispatcher is untouched (not double-restored).
  const [stillActive] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, keepActive.id));
  assert.equal(stillActive.isActive, true);

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.restored'));
  assert.equal(logs.length, 2, 'one user.restored entry per restored account');
  const emails = logs.map(l => l.targetUserEmail).sort();
  assert.deepEqual(emails, ['a@test.com', 'b@test.com']);
  assert.ok(logs.every(l => l.actorId === admin.id), 'every entry records the acting admin');
});

test('restore-all: with an ids list restores only that subset', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const a = await createUser({ name: 'Gone A', email: 'a@test.com', role: 'dispatcher', isActive: false, deletedAt: new Date() });
  const b = await createUser({ name: 'Gone B', email: 'b@test.com', role: 'client', isActive: false, deletedAt: new Date() });
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/users/restore-all')
    .set('Authorization', `Bearer ${token}`)
    .send({ ids: [a.id] });
  assert.equal(res.status, 200);
  assert.equal(res.body.restored, 1, 'only the selected account is restored');

  const [restored] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, a.id));
  assert.equal(restored.deletedAt, null, 'the selected account is restored');
  const [untouched] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, b.id));
  assert.ok(untouched.deletedAt instanceof Date, 'the unselected account stays deleted');
});

test('restore-all: a link conflict is skipped with a reason while the rest still restore', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const client = await createClient('Acme Concrete');
  const token = tokenFor(admin);

  // An active user already holds the client link.
  const activeHolder = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Active Holder', email: 'holder@test.com', password: PASSWORD, role: 'client', linkedClientId: client.id });
  assert.equal(activeHolder.status, 201);

  // A soft-deleted account that also points at the same client — its restore must
  // be skipped because the link is taken. A clean deleted account restores fine.
  const conflicted = await createUser({
    name: 'Conflicted', email: 'conflict@test.com', role: 'client',
    isActive: false, deletedAt: new Date(),
  });
  await db.update(users).set({ linkedClientId: client.id }).where(eq(users.id, conflicted.id));
  const clean = await createUser({
    name: 'Clean', email: 'clean@test.com', role: 'dispatcher',
    isActive: false, deletedAt: new Date(),
  });

  const res = await request(app)
    .post('/api/users/restore-all')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.restored, 1, 'only the clean account restores');
  assert.equal(res.body.skipped, 1, 'the conflicting account is skipped');
  assert.equal(res.body.skippedDetails.length, 1);
  assert.equal(res.body.skippedDetails[0].id, conflicted.id);
  assert.match(res.body.skippedDetails[0].reason, /already linked/i);

  // The conflicted account is still soft-deleted; the clean one is restored.
  const [stillGone] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, conflicted.id));
  assert.ok(stillGone.deletedAt instanceof Date, 'the conflicting account stays deleted');
  const [back] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, clean.id));
  assert.equal(back.deletedAt, null, 'the clean account is restored');

  // No user.restored entry was written for the skipped account.
  const skippedLogs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, conflicted.id)));
  assert.equal(skippedLogs.length, 0, 'a skipped account writes no restore audit entry');
});

test('restore-all: a row that trips the DB link constraint (23505) is skipped, the rest still restore', async (t) => {
  // findLinkConflict already pre-checks each row, but a race (or a write that
  // slips in between the check and the update) could still trip the partial
  // unique index and raise a raw Postgres 23505. The per-row update must catch
  // that and record the row in skippedDetails rather than aborting the batch
  // with a 500. We simulate the race by making the first per-row update throw a
  // 23505 while the remaining rows update normally.
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  const racer = await createUser({
    name: 'Racer', email: 'racer@test.com', role: 'client',
    isActive: false, deletedAt: new Date(),
  });
  const cleanA = await createUser({
    name: 'Clean A', email: 'clean-a@test.com', role: 'dispatcher',
    isActive: false, deletedAt: new Date(),
  });
  const cleanB = await createUser({
    name: 'Clean B', email: 'clean-b@test.com', role: 'plant_operator',
    isActive: false, deletedAt: new Date(),
  });

  // Rows are restored in ascending-id order, so `racer` (created first) is the
  // first per-row update. Make only that update reject with a fake 23505 on the
  // client-link index; every other update delegates to the real driver.
  const originalUpdate = db.update.bind(db);
  let updateCalls = 0;
  t.mock.method(db, 'update', (table: Parameters<typeof originalUpdate>[0]) => {
    updateCalls += 1;
    if (updateCalls === 1) {
      return {
        set() { return this; },
        where() {
          return Promise.reject(Object.assign(new Error('duplicate key value'), {
            code: '23505',
            constraint: 'users_linked_client_unique',
          }));
        },
      } as unknown as ReturnType<typeof originalUpdate>;
    }
    return originalUpdate(table);
  });

  const res = await request(app)
    .post('/api/users/restore-all')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(res.status, 200, 'the batch still succeeds — one bad row does not 500 it');
  assert.equal(res.body.restored, 2, 'the two clean accounts restore');
  assert.equal(res.body.skipped, 1, 'the row that hit the DB constraint is skipped');
  assert.equal(res.body.skippedDetails.length, 1);
  assert.equal(res.body.skippedDetails[0].id, racer.id);
  assert.match(res.body.skippedDetails[0].reason, /already linked/i,
    'the skip carries the same friendly link-conflict reason');

  // The racer stays soft-deleted; both clean accounts are restored.
  const [stillGone] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, racer.id));
  assert.ok(stillGone.deletedAt instanceof Date, 'the constraint-tripping account stays deleted');
  for (const id of [cleanA.id, cleanB.id]) {
    const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive })
      .from(users).where(eq(users.id, id));
    assert.equal(row.deletedAt, null, `clean account ${id} is restored`);
    assert.equal(row.isActive, true, `clean account ${id} is reactivated`);
  }

  // No user.restored entry was written for the skipped account; one each for the rest.
  const skippedLogs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, racer.id)));
  assert.equal(skippedLogs.length, 0, 'a constraint-skipped account writes no restore audit entry');
  const restoredLogs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.restored'));
  assert.equal(restoredLogs.length, 2, 'one user.restored entry per actually-restored account');
});

test('restore-all: with an empty trash returns zero counts and writes nothing', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await createUser({ name: 'Active', email: 'active@test.com', role: 'dispatcher' });
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/users/restore-all')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { restored: 0, skipped: 0, skippedDetails: [] });

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.restored'));
  assert.equal(logs.length, 0, 'no audit entries when the trash is empty');
});

test('restore-all: rejected for a non-admin caller (requireRole admin)', async () => {
  await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const dispatcher = await createUser({ name: 'Dispatch', email: 'dispatch@test.com', role: 'dispatcher' });
  await createUser({ name: 'Gone', email: 'gone@test.com', role: 'dispatcher', isActive: false, deletedAt: new Date() });
  const token = tokenFor(dispatcher);

  const res = await request(app)
    .post('/api/users/restore-all')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(res.status, 403, 'a non-admin cannot bulk-restore');

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'user.restored'));
  assert.equal(logs.length, 0, 'no restore happened');
});

// Authorization gating for the destructive single-account routes
// (DELETE /users/:id and POST /users/:id/restore). The whole router is mounted
// behind `requireAuth, requireRole('admin')`, so an unauthenticated request must
// be rejected with 401 and an authenticated non-admin with 403 — and in every
// case the protected account must stay exactly as it was.

const NON_ADMIN_ROLES: Role[] = ['dispatcher', 'plant_operator', 'client', 'driver'];

test('authz: DELETE /users/:id returns 401 with no token and leaves the account untouched', async () => {
  // A live (not deleted) target. requireAuth runs before the route, so no token
  // means a 401 and the soft-delete must never happen.
  const target = await createUser({ name: 'Protected', email: 'protected@test.com', role: 'dispatcher' });

  const res = await request(app).delete(`/api/users/${target.id}`);
  assert.equal(res.status, 401, 'an unauthenticated delete is rejected');

  const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive })
    .from(users).where(eq(users.id, target.id));
  assert.equal(row.deletedAt, null, 'an unauthenticated delete must not soft-delete the account');
  assert.equal(row.isActive, true, 'the account stays active');

  const logs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.deleted'), eq(auditLogs.targetUserId, target.id)));
  assert.equal(logs.length, 0, 'no delete audit entry is written');
});

test('authz: DELETE /users/:id returns 403 for every authenticated non-admin role and leaves the account untouched', async () => {
  for (const role of NON_ADMIN_ROLES) {
    await db.execute(sql`TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);

    const actor = await createUser({ name: `Actor ${role}`, email: `actor-${role}@test.com`, role });
    const target = await createUser({ name: 'Protected', email: 'protected@test.com', role: 'dispatcher' });
    const token = tokenFor(actor);

    const res = await request(app)
      .delete(`/api/users/${target.id}`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403, `a ${role} must not be able to delete an account`);

    const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive })
      .from(users).where(eq(users.id, target.id));
    assert.equal(row.deletedAt, null, `a ${role} delete must not soft-delete the account`);
    assert.equal(row.isActive, true, `the account stays active after a ${role} delete attempt`);

    const logs = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'user.deleted'), eq(auditLogs.targetUserId, target.id)));
    assert.equal(logs.length, 0, `a ${role} delete attempt writes no audit entry`);
  }
});

test('authz: POST /users/:id/restore returns 401 with no token and leaves the deleted account deleted', async () => {
  // A soft-deleted target. Without a token the restore must be rejected and the
  // account must stay deleted (deletedAt not cleared).
  const target = await createUser({
    name: 'Gone', email: 'gone@test.com', role: 'dispatcher',
    isActive: false, deletedAt: new Date(),
  });

  const res = await request(app).post(`/api/users/${target.id}/restore`);
  assert.equal(res.status, 401, 'an unauthenticated restore is rejected');

  const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive })
    .from(users).where(eq(users.id, target.id));
  assert.ok(row.deletedAt instanceof Date, 'an unauthenticated restore must not clear deletedAt');
  assert.equal(row.isActive, false, 'the account stays inactive');

  const logs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, target.id)));
  assert.equal(logs.length, 0, 'no restore audit entry is written');
});

test('authz: POST /users/:id/restore returns 403 for every authenticated non-admin role and leaves the deleted account deleted', async () => {
  for (const role of NON_ADMIN_ROLES) {
    await db.execute(sql`TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);

    const actor = await createUser({ name: `Actor ${role}`, email: `actor-${role}@test.com`, role });
    const target = await createUser({
      name: 'Gone', email: 'gone@test.com', role: 'dispatcher',
      isActive: false, deletedAt: new Date(),
    });
    const token = tokenFor(actor);

    const res = await request(app)
      .post(`/api/users/${target.id}/restore`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 403, `a ${role} must not be able to restore an account`);

    const [row] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive })
      .from(users).where(eq(users.id, target.id));
    assert.ok(row.deletedAt instanceof Date, `a ${role} restore must not clear deletedAt`);
    assert.equal(row.isActive, false, `the account stays inactive after a ${role} restore attempt`);

    const logs = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'user.restored'), eq(auditLogs.targetUserId, target.id)));
    assert.equal(logs.length, 0, `a ${role} restore attempt writes no audit entry`);
  }
});
