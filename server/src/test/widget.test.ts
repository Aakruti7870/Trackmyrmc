/**
 * Widget API — role-guard and basic-response tests.
 *
 * Covers:
 *   - 401 on all three endpoints when no token is sent
 *   - 403 when the wrong role calls an endpoint
 *   - { hasOrder: false }      when a client has no active order
 *   - { hasAssignment: false } when a driver has no active challan
 *   - numeric summary fields   when a plant-scoped staff user calls /plant
 */

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import {
  users, clients, drivers, challans, orders, plants,
} from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
let seq = 0;
function uid() { return String(++seq).padStart(4, '0'); }

// ── Fixture helpers ──────────────────────────────────────────────────────────

async function createPlant() {
  const s = uid();
  const [p] = await db.insert(plants).values({
    plantCode: `WGT-${s}`,
    name: `Widget Plant ${s}`,
    latitude: '19.0760000',
    longitude: '72.8777000',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    verified: true,
    networkStatus: 'active',
    showOnNetwork: true,
    grades: ['M25'],
  }).returning();
  return p;
}

/** Creates a client row + linked client-role user. */
async function createClientUser(email: string) {
  const s = uid();
  const passwordHash = await hashPassword('pass');
  const [client] = await db.insert(clients).values({
    name: `WgtClient ${s}`, contactPerson: 'C',
    phone: `9${s.padStart(9, '0')}`,
  }).returning();
  const [user] = await db.insert(users).values({
    name: 'Widget Client', email, passwordHash,
    role: 'client', isActive: true, linkedClientId: client.id,
  }).returning();
  return { user, client };
}

/** Creates a driver row + linked driver-role user. */
async function createDriverUser(email: string) {
  const s = uid();
  const passwordHash = await hashPassword('pass');
  const [driver] = await db.insert(drivers).values({
    name: `WgtDriver ${s}`, phone: '0000000000',
  }).returning();
  const [user] = await db.insert(users).values({
    name: 'Widget Driver', email, passwordHash,
    role: 'driver', isActive: true, linkedDriverId: driver.id,
  }).returning();
  return { user, driver };
}

/** Creates a plant-scoped admin user. */
async function createStaffUser(email: string, plantId: number) {
  const passwordHash = await hashPassword('pass');
  const [user] = await db.insert(users).values({
    name: 'Widget Admin', email, passwordHash,
    role: 'admin', isActive: true, plantId,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  // Truncate in dependency order (challans → orders/users/clients/drivers/plants)
  await db.execute(sql`TRUNCATE TABLE ${challans} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${orders}   RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${users}    RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${clients}  RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${drivers}  RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${plants}   RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

// ── 401 — no token ───────────────────────────────────────────────────────────

test('unauthenticated requests to all widget endpoints return 401', async () => {
  const paths = ['/api/widget/customer', '/api/widget/driver', '/api/widget/plant'];
  for (const path of paths) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, `expected 401 on ${path}, got ${res.status}`);
  }
});

// ── 403 — wrong role ─────────────────────────────────────────────────────────

test('driver calling /widget/customer returns 403', async () => {
  const { user } = await createDriverUser('drv-vs-customer@wgt.test');
  const res = await request(app)
    .get('/api/widget/customer')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 403);
});

test('client calling /widget/driver returns 403', async () => {
  const { user } = await createClientUser('cli-vs-driver@wgt.test');
  const res = await request(app)
    .get('/api/widget/driver')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 403);
});

test('client calling /widget/plant returns 403', async () => {
  const { user } = await createClientUser('cli-vs-plant@wgt.test');
  const res = await request(app)
    .get('/api/widget/plant')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 403);
});

test('driver calling /widget/plant returns 403', async () => {
  const { user } = await createDriverUser('drv-vs-plant@wgt.test');
  const res = await request(app)
    .get('/api/widget/plant')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 403);
});

// ── /customer — happy path ───────────────────────────────────────────────────

test('/widget/customer returns { hasOrder: false } when client has no active order', async () => {
  const { user } = await createClientUser('cli-no-order@wgt.test');
  const res = await request(app)
    .get('/api/widget/customer')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.hasOrder, false);
  assert.ok(typeof res.body.updatedAt === 'string', 'updatedAt should be present');
});

test('/widget/customer returns order details when client has an active order', async () => {
  const { user, client } = await createClientUser('cli-with-order@wgt.test');
  const s = uid();
  await db.insert(orders).values({
    orderNo: `ORD-WGT-${s}`,
    clientId: client.id,
    grade: 'M30',
    quantity: '8.00',
    status: 'approved',
  });

  const res = await request(app)
    .get('/api/widget/customer')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.hasOrder, true);
  assert.equal(res.body.grade, 'M30');
  assert.ok(res.body.orderNo, 'orderNo should be present');
  assert.ok(typeof res.body.status === 'string');
  assert.ok(typeof res.body.updatedAt === 'string');
});

// ── /driver — happy path ─────────────────────────────────────────────────────

test('/widget/driver returns { hasAssignment: false } when driver has no active challan', async () => {
  const { user } = await createDriverUser('drv-no-challan@wgt.test');
  const res = await request(app)
    .get('/api/widget/driver')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.hasAssignment, false);
  assert.ok(typeof res.body.updatedAt === 'string', 'updatedAt should be present');
});

test('/widget/driver returns trip details when driver has an active challan', async () => {
  const { user, driver } = await createDriverUser('drv-with-challan@wgt.test');
  const [client] = await db.insert(clients).values({
    name: `WgtCo ${uid()}`, contactPerson: 'X', phone: `8${uid().padStart(9, '0')}`,
  }).returning();
  const s = uid();
  await db.insert(challans).values({
    challanNo: `CH-WGT-${s}`,
    clientId: client.id,
    driverId: driver.id,
    grade: 'M25',
    quantity: '6.00',
    status: 'pending',
  });

  const res = await request(app)
    .get('/api/widget/driver')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.hasAssignment, true);
  assert.ok(res.body.challanNo, 'challanNo should be present');
  assert.equal(res.body.tripStatus, 'ASSIGNED');
  assert.ok(typeof res.body.updatedAt === 'string');
});

// ── /plant — happy path ──────────────────────────────────────────────────────

test('/widget/plant returns numeric summary for plant-scoped staff', async () => {
  const plant = await createPlant();
  const staff = await createStaffUser('staff-plant@wgt.test', plant.id);

  const res = await request(app)
    .get('/api/widget/plant')
    .set('Authorization', `Bearer ${tokenFor(staff)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.plantName, plant.name);
  // All summary fields present and of expected type
  assert.ok('todayM3' in res.body, 'todayM3 missing');
  assert.ok('pendingOrders' in res.body, 'pendingOrders missing');
  assert.ok('tmOnRoute' in res.body, 'tmOnRoute missing');
  assert.ok('activeDispatches' in res.body, 'activeDispatches missing');
  assert.ok('plantStatus' in res.body, 'plantStatus missing');
  assert.ok(typeof res.body.updatedAt === 'string', 'updatedAt missing');
  // Zero-state values are strings (as the route formats them)
  assert.equal(res.body.pendingOrders, '0');
  assert.equal(res.body.tmOnRoute, '0');
  assert.equal(res.body.activeDispatches, '0');
});
