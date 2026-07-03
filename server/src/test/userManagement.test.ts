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
  name: string; email: string; role?: string; plantId?: number | null;
  phone?: string | null; isActive?: boolean; deletedAt?: Date | null;
}) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: (opts.role ?? 'admin') as typeof users.$inferInsert.role,
    plantId: opts.plantId ?? null,
    phone: opts.phone ?? null,
    isActive: opts.isActive ?? true,
    deletedAt: opts.deletedAt ?? null,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createPlant(opts: { name: string; city?: string; isActive?: boolean; subscriptionStatus?: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' }) {
  const [row] = await db.insert(plants).values({
    name: opts.name,
    city: opts.city ?? 'Mumbai',
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: 'approved',
    isActive: opts.isActive ?? true,
    subscriptionStatus: opts.subscriptionStatus ?? 'active',
    locationVerified: true,
    verified: true,
    deliveryRadiusKm: 40,
    grades: ['M-20', 'M-25'],
    openTime: '06:00',
    closeTime: '21:00',
  }).returning();
  return row;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, plants RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Plant cards
// ---------------------------------------------------------------------------

test('GET /plants: authority sees every plant with counts and status', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p1 = await createPlant({ name: 'Alpha RMC', city: 'Pune' });
  const p2 = await createPlant({ name: 'Beta RMC', city: 'Thane', subscriptionStatus: 'suspended' });

  await createUser({ name: 'Owner A', email: 'oa@test.com', role: 'plant_owner', plantId: p1.id });
  await createUser({ name: 'Disp A', email: 'da@test.com', role: 'dispatcher', plantId: p1.id });
  await createUser({ name: 'Cust A', email: 'ca@test.com', role: 'client', plantId: p1.id });
  // Soft-deleted staff must not be counted.
  await createUser({ name: 'Gone', email: 'gone@test.com', role: 'admin', plantId: p1.id, deletedAt: new Date() });

  const res = await request(app).get('/api/user-management/plants')
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  type Card = { id: number; status: string; staffCount: number; customerCount: number; city: string };
  const byId = new Map<number, Card>((res.body as Card[]).map(p => [p.id, p]));
  assert.equal(byId.get(p1.id)!.staffCount, 2);
  assert.equal(byId.get(p1.id)!.customerCount, 1);
  assert.equal(byId.get(p1.id)!.status, 'active');
  assert.equal(byId.get(p1.id)!.city, 'Pune');
  assert.equal(byId.get(p2.id)!.status, 'suspended', 'suspended subscription reads as suspended');
});

test('GET /plants: plant_owner sees only their own plant', async () => {
  const p1 = await createPlant({ name: 'Alpha RMC' });
  const p2 = await createPlant({ name: 'Beta RMC' });
  const owner = await createUser({ name: 'Owner', email: 'own@test.com', role: 'plant_owner', plantId: p1.id });

  const res = await request(app).get('/api/user-management/plants')
    .set('Authorization', `Bearer ${tokenFor(owner)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].id, p1.id);
  assert.notEqual(res.body[0].id, p2.id);
});

test('a plant_owner with no plant binding is never treated as unrestricted', async () => {
  const p = await createPlant({ name: 'Alpha RMC' });
  await createUser({ name: 'Disp', email: 'disp@test.com', role: 'dispatcher', plantId: p.id });
  const target = await createUser({ name: 'Target', email: 'target@test.com', role: 'dispatcher', plantId: p.id });
  const unbound = await createUser({ name: 'Unbound', email: 'unbound@test.com', role: 'plant_owner', plantId: null });
  const auth = { Authorization: `Bearer ${tokenFor(unbound)}` };

  // Plant cards: an unbound owner manages nothing.
  const cards = await request(app).get('/api/user-management/plants').set(auth);
  assert.equal(cards.status, 200);
  assert.equal(cards.body.length, 0);

  // Every plant/user operation is refused outright — not treated as global scope.
  const list = await request(app).get(`/api/user-management/plants/${p.id}/users`).set(auth);
  assert.equal(list.status, 403);

  const create = await request(app).post(`/api/user-management/plants/${p.id}/users`).set(auth)
    .send({ name: 'X', email: 'x@test.com', role: 'dispatcher' });
  assert.equal(create.status, 403);

  const edit = await request(app).put(`/api/user-management/users/${target.id}`).set(auth).send({ name: 'Hacked' });
  assert.equal(edit.status, 403);

  const del = await request(app).delete(`/api/user-management/users/${target.id}`).set(auth);
  assert.equal(del.status, 403);
});

test('GET /plants: customers are rejected', async () => {
  const p = await createPlant({ name: 'Alpha RMC' });
  const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client', plantId: p.id });
  const res = await request(app).get('/api/user-management/plants')
    .set('Authorization', `Bearer ${tokenFor(cust)}`);
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// Per-plant user list + scope
// ---------------------------------------------------------------------------

test('GET /plants/:id/users lists live users; deleted=true lists the trash', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  await createUser({ name: 'Live', email: 'live@test.com', role: 'dispatcher', plantId: p.id, phone: '9820011001' });
  await createUser({ name: 'Dead', email: 'dead@test.com', role: 'driver', plantId: p.id, deletedAt: new Date() });

  const live = await request(app).get(`/api/user-management/plants/${p.id}/users`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(live.status, 200);
  assert.equal(live.body.length, 1);
  assert.equal(live.body[0].email, 'live@test.com');
  assert.equal(live.body[0].phone, '9820011001');

  const deleted = await request(app).get(`/api/user-management/plants/${p.id}/users?deleted=true`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.length, 1);
  assert.equal(deleted.body[0].email, 'dead@test.com');
});

test('plant-scoped admin cannot read another plant\u2019s users', async () => {
  const p1 = await createPlant({ name: 'Alpha RMC' });
  const p2 = await createPlant({ name: 'Beta RMC' });
  const admin1 = await createUser({ name: 'Admin1', email: 'a1@test.com', role: 'admin', plantId: p1.id });

  const res = await request(app).get(`/api/user-management/plants/${p2.id}/users`)
    .set('Authorization', `Bearer ${tokenFor(admin1)}`);
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

test('POST /plants/:id/users creates a plant-bound user with a new role', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });

  const res = await request(app).post(`/api/user-management/plants/${p.id}/users`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`)
    .send({ name: 'QE One', email: 'qe@test.com', role: 'quality_engineer', phone: '9820022002' });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, 'quality_engineer');
  assert.equal(res.body.plantId, p.id);

  const [row] = await db.select().from(users).where(eq(users.email, 'qe@test.com'));
  assert.equal(row.plantId, p.id);
  assert.equal(row.role, 'quality_engineer');
});

test('POST /plants/:id/users: plant admin cannot create a plant_owner, owner can create admin', async () => {
  const p = await createPlant({ name: 'Alpha RMC' });
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin', plantId: p.id });
  const owner = await createUser({ name: 'Owner', email: 'o@test.com', role: 'plant_owner', plantId: p.id });

  const deny = await request(app).post(`/api/user-management/plants/${p.id}/users`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ name: 'X', email: 'x@test.com', role: 'plant_owner' });
  assert.equal(deny.status, 403);

  const ok = await request(app).post(`/api/user-management/plants/${p.id}/users`)
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send({ name: 'New Admin', email: 'na@test.com', role: 'admin' });
  assert.equal(ok.status, 201);
});

test('POST /plants/:id/users enforces the per-plant role cap (fleet_manager = 1)', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  await createUser({ name: 'FM', email: 'fm@test.com', role: 'fleet_manager', plantId: p.id });

  const res = await request(app).post(`/api/user-management/plants/${p.id}/users`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`)
    .send({ name: 'FM2', email: 'fm2@test.com', role: 'fleet_manager' });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /maximum number/);
});

// ---------------------------------------------------------------------------
// Edit / suspend / resume
// ---------------------------------------------------------------------------

test('PUT /users/:id suspends with a reason and resume clears it', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  const staff = await createUser({ name: 'Disp', email: 'd@test.com', role: 'dispatcher', plantId: p.id });

  const sus = await request(app).put(`/api/user-management/users/${staff.id}`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`)
    .send({ isActive: false, suspensionReason: 'Payment overdue' });
  assert.equal(sus.status, 200);
  assert.equal(sus.body.isActive, false);
  assert.equal(sus.body.suspensionReason, 'Payment overdue');

  const back = await request(app).put(`/api/user-management/users/${staff.id}`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`)
    .send({ isActive: true });
  assert.equal(back.status, 200);
  assert.equal(back.body.isActive, true);
  assert.equal(back.body.suspensionReason, null);
});

test('PUT /users/:id: plant admin cannot edit users of another plant', async () => {
  const p1 = await createPlant({ name: 'Alpha RMC' });
  const p2 = await createPlant({ name: 'Beta RMC' });
  const admin1 = await createUser({ name: 'Admin1', email: 'a1@test.com', role: 'admin', plantId: p1.id });
  const other = await createUser({ name: 'Other', email: 'o2@test.com', role: 'dispatcher', plantId: p2.id });

  const res = await request(app).put(`/api/user-management/users/${other.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin1)}`)
    .send({ name: 'Hacked' });
  assert.equal(res.status, 403);
});

test('PUT /users/:id: you cannot suspend yourself', async () => {
  const p = await createPlant({ name: 'Alpha RMC' });
  const owner = await createUser({ name: 'Owner', email: 'o@test.com', role: 'plant_owner', plantId: p.id });

  const res = await request(app).put(`/api/user-management/users/${owner.id}`)
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send({ isActive: false });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Delete / restore
// ---------------------------------------------------------------------------

test('DELETE /users/:id soft-deletes; restore brings the account back', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  const staff = await createUser({ name: 'Op', email: 'op@test.com', role: 'plant_operator', plantId: p.id });

  const del = await request(app).delete(`/api/user-management/users/${staff.id}`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(del.status, 200);
  const [gone] = await db.select().from(users).where(eq(users.id, staff.id));
  assert.ok(gone.deletedAt, 'deletedAt must be set');

  const rest = await request(app).post(`/api/user-management/users/${staff.id}/restore`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(rest.status, 200);
  const [backRow] = await db.select().from(users).where(eq(users.id, staff.id));
  assert.equal(backRow.deletedAt, null);
});

test('restore refuses when the role cap is already full again', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  const oldFm = await createUser({ name: 'Old FM', email: 'ofm@test.com', role: 'fleet_manager', plantId: p.id, deletedAt: new Date() });
  await createUser({ name: 'New FM', email: 'nfm@test.com', role: 'fleet_manager', plantId: p.id });

  const res = await request(app).post(`/api/user-management/users/${oldFm.id}/restore`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(res.status, 409);
});

test('DELETE /users/:id: you cannot delete yourself', async () => {
  const p = await createPlant({ name: 'Alpha RMC' });
  const owner = await createUser({ name: 'Owner', email: 'o@test.com', role: 'plant_owner', plantId: p.id });

  const res = await request(app).delete(`/api/user-management/users/${owner.id}`)
    .set('Authorization', `Bearer ${tokenFor(owner)}`);
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Reset password & invitation link
// ---------------------------------------------------------------------------

test('reset-password and send-invite respond even without SMTP (emailSent=false + inviteUrl)', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  const staff = await createUser({ name: 'Disp', email: 'd@test.com', role: 'dispatcher', plantId: p.id });

  const reset = await request(app).post(`/api/user-management/users/${staff.id}/reset-password`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(reset.status, 200);
  assert.equal(typeof reset.body.emailSent, 'boolean');

  const invite = await request(app).post(`/api/user-management/users/${staff.id}/send-invite`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(invite.status, 200);
  assert.equal(typeof invite.body.emailSent, 'boolean');
  if (!invite.body.emailSent) {
    assert.match(invite.body.inviteUrl, /\/set-password\?token=/);
  }
});

test('authority accounts can never be managed through this console', async () => {
  const authority = await createUser({ name: 'Root', email: 'root@test.com', role: 'authority' });
  const p = await createPlant({ name: 'Alpha RMC' });
  // A (hypothetical) plant-bound authority row must still be untouchable.
  const boss = await createUser({ name: 'Boss', email: 'boss@test.com', role: 'authority', plantId: p.id });

  const res = await request(app).delete(`/api/user-management/users/${boss.id}`)
    .set('Authorization', `Bearer ${tokenFor(authority)}`);
  assert.equal(res.status, 403);
});
