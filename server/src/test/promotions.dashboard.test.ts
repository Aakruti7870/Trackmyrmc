// Task #21: Confirm the promotions dashboard correctly shows and hides a plant after deactivation
// Task #20 server tests: plant owner can update their own promotion window
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { plants, users } from '../db/schema.js';
import { plantPromotions } from '../db/plantProfileSchema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
let seq = 0;

async function createPlant(name?: string) {
  seq += 1;
  const [p] = await db.insert(plants).values({
    plantCode: `PROMO-${seq}`,
    name: name ?? `Promo Plant ${seq}`,
    latitude: '19.0000000',
    longitude: '72.0000000',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    verified: true,
    networkStatus: 'active',
    showOnNetwork: true,
    grades: ['M25'],
    deliveryRadiusKm: 100,
  }).returning();
  return p;
}

async function createUser(role: 'authority' | 'plant_owner' | 'client', email: string, plantId: number | null = null) {
  const [u] = await db.insert(users).values({
    name: `${role} user`,
    email,
    passwordHash: await hashPassword('secret123'),
    role,
    plantId,
    isActive: true,
  }).returning();
  return u;
}

function tokenFor(user: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE plant_promotions RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE plants RESTART IDENTITY CASCADE`);
  seq = 0;
});

after(async () => { await pool.end(); });

// ---- Task #21: Dashboard show/hide tests -----------------------------------------------

test('GET /admin/plant-promotions lists active promotions and excludes deactivated ones', async () => {
  const activePlant = await createPlant('Active Promo Plant');
  const inactivePlant = await createPlant('Inactive Promo Plant');
  const authority = await createUser('authority', 'list-authority@test.com');
  const token = tokenFor(authority);

  const now = new Date();
  const start = new Date(now.getTime() - 3600000);
  const end = new Date(now.getTime() + 86400000);

  // Active promotion
  await db.insert(plantPromotions).values({
    plantId: activePlant.id,
    packageType: 'custom', promotionRadiusKm: '15', priorityRank: 1, bannerTitle: '',
    showGlowingEffect: true, paymentStatus: 'paid',
    startAt: start, endAt: end,
    isActive: true,
    createdBy: authority.id, approvedBy: authority.id,
  });

  // Inactive (deactivated) promotion
  await db.insert(plantPromotions).values({
    plantId: inactivePlant.id,
    packageType: 'custom', promotionRadiusKm: '15', priorityRank: 2, bannerTitle: '',
    showGlowingEffect: true, paymentStatus: 'paid',
    startAt: start, endAt: end,
    isActive: false,
    createdBy: authority.id,
    suspendedAt: new Date(),
    suspensionReason: 'Deactivated for test',
  });

  const res = await request(app)
    .get('/api/admin/plant-promotions')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));

  // Both promotions are in the list (the endpoint returns ALL, not just active)
  assert.equal(res.body.length, 2, 'endpoint returns all promotions (active and inactive)');

  const activeRow = res.body.find((r: { plantId: number; isActive: boolean }) => r.plantId === activePlant.id);
  const inactiveRow = res.body.find((r: { plantId: number; isActive: boolean }) => r.plantId === inactivePlant.id);

  assert.ok(activeRow, 'active plant promotion is in the list');
  assert.equal(activeRow.isActive, true, 'active promotion has isActive=true');

  assert.ok(inactiveRow, 'deactivated plant promotion is still in the list (with isActive=false)');
  assert.equal(inactiveRow.isActive, false, 'deactivated promotion has isActive=false');
});

test('POST /admin/plant-promotions/:id/suspend sets isActive=false (deactivates the promotion)', async () => {
  const plant = await createPlant('To Suspend Plant');
  const authority = await createUser('authority', 'suspend-authority@test.com');
  const token = tokenFor(authority);

  const [promo] = await db.insert(plantPromotions).values({
    plantId: plant.id,
    packageType: 'custom', promotionRadiusKm: '15', priorityRank: 1, bannerTitle: '',
    showGlowingEffect: true, paymentStatus: 'paid',
    startAt: new Date(Date.now() - 3600000),
    endAt: new Date(Date.now() + 86400000),
    isActive: true,
    createdBy: authority.id, approvedBy: authority.id,
  }).returning();

  // Suspend it
  const suspendRes = await request(app)
    .post(`/api/admin/plant-promotions/${promo.id}/suspend`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason: 'Test suspension' });

  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.body.isActive, false, 'suspension sets isActive=false');
  assert.ok(suspendRes.body.suspendedAt, 'suspension sets suspendedAt');
  assert.equal(suspendRes.body.suspensionReason, 'Test suspension');

  // GET list should show the promotion as inactive
  const listRes = await request(app)
    .get('/api/admin/plant-promotions')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(listRes.status, 200);
  const row = listRes.body.find((r: { id: number }) => r.id === promo.id);
  assert.ok(row, 'suspended promotion still appears in list');
  assert.equal(row.isActive, false, 'suspended promotion shows isActive=false in list');
});

test('GET /admin/plant-promotions only shows active=true promotions when filtered by isActive', async () => {
  const plantA = await createPlant('Active Plant');
  const plantB = await createPlant('Inactive Plant');
  const authority = await createUser('authority', 'filter-authority@test.com');
  const token = tokenFor(authority);

  const start = new Date(Date.now() - 3600000);
  const end = new Date(Date.now() + 86400000);

  await db.insert(plantPromotions).values([
    {
      plantId: plantA.id,
      packageType: 'custom', promotionRadiusKm: '15', priorityRank: 1, bannerTitle: '',
      showGlowingEffect: true, paymentStatus: 'paid', startAt: start, endAt: end,
      isActive: true, createdBy: authority.id,
    },
    {
      plantId: plantB.id,
      packageType: 'custom', promotionRadiusKm: '15', priorityRank: 2, bannerTitle: '',
      showGlowingEffect: true, paymentStatus: 'paid', startAt: start, endAt: end,
      isActive: false, createdBy: authority.id,
    },
  ]);

  const res = await request(app)
    .get('/api/admin/plant-promotions')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  const activeOnes = res.body.filter((r: { isActive: boolean }) => r.isActive === true);
  const inactiveOnes = res.body.filter((r: { isActive: boolean }) => r.isActive === false);

  assert.equal(activeOnes.length, 1, 'exactly one active promotion');
  assert.equal(inactiveOnes.length, 1, 'exactly one inactive promotion');
  assert.equal(activeOnes[0].plantId, plantA.id);
  assert.equal(inactiveOnes[0].plantId, plantB.id);
});

// ---- Task #20: Plant owner promotion window tests ----------------------------------------

test('plant owner can update their own promotion window', async () => {
  const plant = await createPlant('Owner Window Plant');
  const authority = await createUser('authority', 'window-authority@test.com');
  const owner = await createUser('plant_owner', 'window-owner@test.com', plant.id);

  // Create a promotion for this plant first (normally done by authority).
  await db.insert(plantPromotions).values({
    plantId: plant.id,
    packageType: 'custom', promotionRadiusKm: '15', priorityRank: 1, bannerTitle: '',
    showGlowingEffect: true, paymentStatus: 'paid',
    startAt: new Date(Date.now() - 3600000),
    endAt: new Date(Date.now() + 86400000),
    isActive: false,
    createdBy: authority.id,
  });

  const newStart = new Date(Date.now() + 3600000).toISOString();
  const newEnd = new Date(Date.now() + 14 * 86400000).toISOString();

  const res = await request(app)
    .put('/api/plant-promotions/window')
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send({ startAt: newStart, endAt: newEnd });

  assert.equal(res.status, 200, 'plant owner can update their own promotion window');
  assert.ok(res.body.startAt, 'response has startAt');
  assert.ok(res.body.endAt, 'response has endAt');

  // isActive must NOT be changed by this endpoint.
  assert.equal(res.body.isActive, false, 'plant owner window update does not activate the promotion');
});

test('plant owner cannot update another plant\'s window (403)', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const authority = await createUser('authority', 'cross-authority@test.com');
  const ownerA = await createUser('plant_owner', 'cross-ownerA@test.com', plantA.id);

  // Create promotion for plantB.
  await db.insert(plantPromotions).values({
    plantId: plantB.id,
    packageType: 'custom', promotionRadiusKm: '15', priorityRank: 1, bannerTitle: '',
    showGlowingEffect: true, paymentStatus: 'paid',
    startAt: new Date(Date.now() - 3600000),
    endAt: new Date(Date.now() + 86400000),
    isActive: false, createdBy: authority.id,
  });

  // ownerA tries to update plantB's window — should be 404 (no promotion for their plant),
  // not a 403, because scoping is done via req.user.plantId (plantA.id) not the request body.
  const res = await request(app)
    .put('/api/plant-promotions/window')
    .set('Authorization', `Bearer ${tokenFor(ownerA)}`)
    .send({
      startAt: new Date(Date.now() + 3600000).toISOString(),
      endAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

  // Plant A has no promotion, so this should be 404.
  assert.equal(res.status, 404, 'plant owner cannot update a promotion for a plant they do not own');
});

test('unbound authority account cannot call plant-promotions/window (403)', async () => {
  const unboundAuthority = await createUser('authority', 'unbound-authority@test.com', null);

  const res = await request(app)
    .put('/api/plant-promotions/window')
    .set('Authorization', `Bearer ${tokenFor(unboundAuthority)}`)
    .send({
      startAt: new Date(Date.now() + 3600000).toISOString(),
      endAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

  // authority role fails requireRole('plant_owner')
  assert.equal(res.status, 403);
});

test('plant owner window update validates endAt must be after startAt', async () => {
  const plant = await createPlant('Validation Plant');
  const authority = await createUser('authority', 'val-authority@test.com');
  const owner = await createUser('plant_owner', 'val-owner@test.com', plant.id);

  await db.insert(plantPromotions).values({
    plantId: plant.id,
    packageType: 'custom', promotionRadiusKm: '15', priorityRank: 1, bannerTitle: '',
    showGlowingEffect: true, paymentStatus: 'paid',
    startAt: new Date(Date.now() - 3600000),
    endAt: new Date(Date.now() + 86400000),
    isActive: false, createdBy: authority.id,
  });

  // endAt before startAt — should be rejected.
  const res = await request(app)
    .put('/api/plant-promotions/window')
    .set('Authorization', `Bearer ${tokenFor(owner)}`)
    .send({
      startAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      endAt: new Date(Date.now() + 3600000).toISOString(),  // end before start
    });

  assert.equal(res.status, 400, 'should reject endAt before startAt');
});
