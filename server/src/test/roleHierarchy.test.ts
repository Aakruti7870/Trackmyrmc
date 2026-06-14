import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
const PASSWORD = 'secret123';

async function createUser(opts: {
  name: string; email: string; role?: typeof users.$inferInsert['role']; plantId?: number | null;
  isActive?: boolean; suspensionReason?: string | null;
}) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'admin',
    plantId: opts.plantId ?? null,
    isActive: opts.isActive ?? true,
    suspensionReason: opts.suspensionReason ?? null,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createPlant(name: string) {
  const [row] = await db.insert(plants).values({
    name,
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    verified: true,
    deliveryRadiusKm: 40,
    grades: ['M-20'],
    openTime: '06:00',
    closeTime: '21:00',
  }).returning();
  return row;
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, plants RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

// ---- Hierarchy: who may provision whom on a plant ----

test('plant-scoped admin may provision an operational role on its own plant', async () => {
  const plant = await createPlant('Alpha');
  const admin = await createUser({ name: 'PlantAdmin', email: 'padmin@test.com', role: 'admin', plantId: plant.id });

  const res = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'Sup', email: 'sup@test.com', password: 'ownerpass1', role: 'supervisor' });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, 'supervisor');
  assert.equal(res.body.plantId, plant.id);

  const [created] = await db.select().from(users).where(eq(users.email, 'sup@test.com'));
  assert.equal(created.createdBy, admin.id, 'createdBy is stamped with the actor');
});

test('plant-scoped admin may NOT provision a peer admin (hierarchy)', async () => {
  const plant = await createPlant('Alpha');
  const admin = await createUser({ name: 'PlantAdmin', email: 'padmin@test.com', role: 'admin', plantId: plant.id });

  const res = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'Two', email: 'admin2@test.com', password: 'ownerpass1', role: 'admin' });
  assert.equal(res.status, 403);
});

test('plant-scoped admin may NOT provision logins for a different plant', async () => {
  const plant = await createPlant('Alpha');
  const other = await createPlant('Beta');
  const admin = await createUser({ name: 'PlantAdmin', email: 'padmin@test.com', role: 'admin', plantId: plant.id });

  const res = await request(app)
    .post(`/api/plants/${other.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'X', email: 'x@test.com', password: 'ownerpass1', role: 'dispatcher' });
  assert.equal(res.status, 403);
});

test('plant_owner may provision an admin on its own plant', async () => {
  const plant = await createPlant('Alpha');
  const owner = await createUser({ name: 'Owner', email: 'owner@test.com', role: 'plant_owner', plantId: plant.id });

  const res = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send({ name: 'Adm', email: 'adm@test.com', password: 'ownerpass1', role: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, 'admin');
});

test('platform authority may seed any plant role for any plant', async () => {
  const plant = await createPlant('Alpha');
  const authority = await createUser({ name: 'Super', email: 'krushnabade54@gmail.com', role: 'authority' });

  const res = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`)
    .send({ name: 'PO', email: 'po@test.com', password: 'ownerpass1', role: 'plant_owner' });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, 'plant_owner');
});

// ---- Per-plant role limits ----

test('per-plant role limit is enforced (dispatcher cap = 1)', async () => {
  const plant = await createPlant('Alpha');
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });

  const first = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'D1', email: 'd1@test.com', password: 'ownerpass1', role: 'dispatcher' });
  assert.equal(first.status, 201);

  const second = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'D2', email: 'd2@test.com', password: 'ownerpass1', role: 'dispatcher' });
  assert.equal(second.status, 409);
  assert.match(second.body.error, /maximum/i);
});

test('soft-deleted accounts do not count against the per-plant limit', async () => {
  const plant = await createPlant('Alpha');
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  // A previously-deleted dispatcher should not block a fresh one.
  await db.insert(users).values({
    name: 'Gone', email: 'gone@test.com', passwordHash: await hashPassword(PASSWORD),
    role: 'dispatcher', plantId: plant.id, deletedAt: new Date(),
  });

  const res = await request(app)
    .post(`/api/plants/${plant.id}/owner`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'D', email: 'd@test.com', password: 'ownerpass1', role: 'dispatcher' });
  assert.equal(res.status, 201);
});

// ---- Suspension login + reason ----

test('login is refused for a suspended account with its reason surfaced', async () => {
  await createUser({
    name: 'Susp', email: 'susp@test.com', role: 'dispatcher',
    isActive: false, suspensionReason: 'Policy violation',
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'susp@test.com', password: PASSWORD });
  assert.equal(res.status, 403);
  assert.equal(res.body.suspended, true);
  assert.match(res.body.error, /Policy violation/);
});

test('login with a wrong password on a suspended account still returns 401 (not the suspended message)', async () => {
  await createUser({
    name: 'Susp', email: 'susp@test.com', role: 'dispatcher',
    isActive: false, suspensionReason: 'Policy violation',
  });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'susp@test.com', password: 'wrong-password' });
  assert.equal(res.status, 401);
});

// ---- Users console: suspension capture + plant_owner gate ----

test('PUT /users/:id records suspendedBy + reason on suspend and clears on reactivate', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher' });

  const suspend = await request(app)
    .put(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ isActive: false, suspensionReason: 'Late reports' });
  assert.equal(suspend.status, 200);

  const [afterSuspend] = await db.select().from(users).where(eq(users.id, target.id));
  assert.equal(afterSuspend.isActive, false);
  assert.equal(afterSuspend.suspensionReason, 'Late reports');
  assert.equal(afterSuspend.suspendedBy, admin.id);

  const reactivate = await request(app)
    .put(`/api/users/${target.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ isActive: true });
  assert.equal(reactivate.status, 200);

  const [afterReactivate] = await db.select().from(users).where(eq(users.id, target.id));
  assert.equal(afterReactivate.isActive, true);
  assert.equal(afterReactivate.suspensionReason, null);
  assert.equal(afterReactivate.suspendedBy, null);
});

test('plant-scoped admin is denied the global user console (no cross-tenant administration)', async () => {
  const plant = await createPlant('Alpha');
  const scopedAdmin = await createUser({ name: 'ScopedAdmin', email: 'scoped@test.com', role: 'admin', plantId: plant.id });
  const token = tokenFor(scopedAdmin);

  const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 403);

  const create = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'X', email: 'x@test.com', password: 'ownerpass1', role: 'dispatcher' });
  assert.equal(create.status, 403);
});

test('legacy global admin (no plant binding) retains full user-console access', async () => {
  const admin = await createUser({ name: 'GlobalAdmin', email: 'global@test.com', role: 'admin' });
  const list = await request(app).get('/api/users').set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(list.status, 200);
});

test('plant-scoped admin is denied global plant administration (no cross-tenant plant access)', async () => {
  const plant = await createPlant('Alpha');
  const scopedAdmin = await createUser({ name: 'ScopedAdmin', email: 'scoped@test.com', role: 'admin', plantId: plant.id });
  const token = tokenFor(scopedAdmin);

  const list = await request(app).get('/api/plants').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 403);

  const create = await request(app)
    .post('/api/plants')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Rogue', latitude: '19.0', longitude: '73.0' });
  assert.equal(create.status, 403);

  const del = await request(app).delete(`/api/plants/${plant.id}`).set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 403);
});

test('platform staff (authority + legacy global admin) keep global plant administration', async () => {
  const authority = await createUser({ name: 'Super', email: 'krushnabade54@gmail.com', role: 'authority' });
  const authList = await request(app).get('/api/plants').set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(authList.status, 200);

  const globalAdmin = await createUser({ name: 'GlobalAdmin', email: 'global@test.com', role: 'admin' });
  const adminList = await request(app).get('/api/plants').set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(adminList.status, 200);
});

test('per-plant role limit holds under concurrent provisioning (no double-count race)', async () => {
  const plant = await createPlant('Alpha');
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  // Fire two dispatcher provisions (cap = 1) simultaneously. Exactly one must
  // win; the row lock in the handler must force the other to see the insert.
  const [a, b] = await Promise.all([
    request(app).post(`/api/plants/${plant.id}/owner`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'D1', email: 'd1@test.com', password: 'ownerpass1', role: 'dispatcher' }),
    request(app).post(`/api/plants/${plant.id}/owner`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'D2', email: 'd2@test.com', password: 'ownerpass1', role: 'dispatcher' }),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [201, 409], 'exactly one provision succeeds, the other is capped');

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(users).where(eq(users.role, 'dispatcher'));
  assert.equal(count, 1, 'only one dispatcher persisted despite the race');
});

test('POST /users gates plant_owner creation to authority only', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });

  const denied = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'PO', email: 'po@test.com', password: 'ownerpass1', role: 'plant_owner' });
  assert.equal(denied.status, 403);

  const authority = await createUser({ name: 'Super', email: 'support@goldetech.com', role: 'authority' });
  const allowed = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${tokenFor(authority)}`)
    .send({ name: 'PO', email: 'po@test.com', password: 'ownerpass1', role: 'plant_owner' });
  assert.equal(allowed.status, 201);
  assert.equal(allowed.body.role, 'plant_owner');
});
