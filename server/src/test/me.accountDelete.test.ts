import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq, desc } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';

type Role = 'admin' | 'authority' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;
const PASSWORD = 'secret123';

async function createUser(opts: { name: string; email: string; role?: Role }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'client',
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users, audit_logs RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

test('DELETE /me/account requires auth', async () => {
  const res = await request(app).delete('/api/me/account');
  assert.equal(res.status, 401);
});

test('customer can self-delete: soft-deleted, audit-logged, token dies', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const token = tokenFor(customer);

  const res = await request(app)
    .delete('/api/me/account')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const [row] = await db.select().from(users).where(eq(users.id, customer.id));
  assert.ok(row.deletedAt, 'deletedAt set (soft delete, not hard delete)');
  assert.equal(row.isActive, false, 'account deactivated');

  const [log] = await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(1);
  assert.equal(log.action, 'user.self_deleted');
  assert.equal(log.actorId, customer.id);
  assert.equal(log.targetUserId, customer.id);

  // The old token must no longer authenticate anywhere.
  const after = await request(app)
    .delete('/api/me/account')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(after.status, 401);
});

test('driver and dispatcher roles can also self-delete', async () => {
  for (const role of ['driver', 'dispatcher'] as const) {
    const u = await createUser({ name: role, email: `${role}@test.com`, role });
    const res = await request(app)
      .delete('/api/me/account')
      .set('Authorization', `Bearer ${tokenFor(u)}`);
    assert.equal(res.status, 200, `${role} should be able to self-delete`);
  }
});

test('authority (Super Admin) cannot self-delete', async () => {
  const boss = await createUser({ name: 'Boss', email: 'boss@test.com', role: 'authority' });

  const res = await request(app)
    .delete('/api/me/account')
    .set('Authorization', `Bearer ${tokenFor(boss)}`);
  assert.equal(res.status, 403);

  const [row] = await db.select().from(users).where(eq(users.id, boss.id));
  assert.equal(row.deletedAt, null, 'authority account untouched');
});

test('last remaining active admin cannot self-delete (lockout guard)', async () => {
  const admin = await createUser({ name: 'OnlyAdmin', email: 'admin@test.com', role: 'admin' });

  const res = await request(app)
    .delete('/api/me/account')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /last remaining admin/i);

  const [row] = await db.select().from(users).where(eq(users.id, admin.id));
  assert.equal(row.deletedAt, null, 'last admin account untouched');
});

test('admin cannot self-delete when the only other admin is suspended', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const suspended = await createUser({ name: 'Suspended', email: 'susp@test.com', role: 'admin' });
  await db.update(users).set({ isActive: false }).where(eq(users.id, suspended.id));

  const res = await request(app)
    .delete('/api/me/account')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400, 'suspended admins must not satisfy the lockout guard');

  const [row] = await db.select().from(users).where(eq(users.id, admin.id));
  assert.equal(row.deletedAt, null, 'admin account untouched');
});

test('an admin can self-delete when another active admin exists', async () => {
  const admin1 = await createUser({ name: 'Admin1', email: 'a1@test.com', role: 'admin' });
  await createUser({ name: 'Admin2', email: 'a2@test.com', role: 'admin' });

  const res = await request(app)
    .delete('/api/me/account')
    .set('Authorization', `Bearer ${tokenFor(admin1)}`);
  assert.equal(res.status, 200);

  const [row] = await db.select().from(users).where(eq(users.id, admin1.id));
  assert.ok(row.deletedAt, 'admin1 soft-deleted');
});
