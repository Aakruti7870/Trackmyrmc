import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders, plants, vehicles } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { claimSend, listRecentSends } from '../lib/automations.js';

let app: Express;

async function createUser(role: string, email: string, plantId?: number | null) {
  const passwordHash = await hashPassword('secret123');
  const [user] = await db.insert(users).values({
    name: `${role} user`, email, passwordHash, role: role as 'admin',
    isActive: true, plantId: plantId ?? null,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createPlant(name: string) {
  const [p] = await db.insert(plants).values({
    name, latitude: '12.9716000', longitude: '77.5946000', verified: true,
  }).returning();
  return p;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      orders, clients, vehicles, plants, audit_logs, users, login_attempts
    RESTART IDENTITY CASCADE
  `);
});

after(async () => {
  await pool.end();
});

test('GET /api/automations/:name/sends requires auth and rejects clients', async () => {
  const anon = await request(app).get('/api/automations/orderReminders/sends');
  assert.equal(anon.status, 401);

  const client = await createUser('client', 'client@test.com');
  const res = await request(app).get('/api/automations/orderReminders/sends')
    .set('Authorization', `Bearer ${tokenFor(client)}`);
  assert.equal(res.status, 403);
});

test('an unknown automation name is a 404', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app).get('/api/automations/notAThing/sends')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 404);
});

test('the feed resolves human labels for orders, vehicles and clients', async () => {
  const plant = await createPlant('Plant A');
  const [client] = await db.insert(clients).values({
    name: 'Acme Constructions', contactPerson: 'A', phone: '+911111111111', plantId: plant.id,
  }).returning();
  const [order] = await db.insert(orders).values({
    orderNo: 'ORD-77', clientId: client.id, plantId: plant.id,
    grade: 'M25', quantity: '10', deliveryDate: '2026-07-03', status: 'pending',
  }).returning();
  const [vehicle] = await db.insert(vehicles).values({
    vehicleNo: 'KA01AB1234', capacity: '7', plantId: plant.id,
  }).returning();

  assert.ok(await claimSend('orderReminders', 'order', order.id, 'd:2026-07-03', plant.id));
  assert.ok(await claimSend('fuelAnomaly', 'vehicle', vehicle.id, 'p7-1', plant.id, '23%'));
  assert.ok(await claimSend('winBack', 'client', client.id, 'p30-1', plant.id));

  const admin = await createUser('admin', 'admin@test.com');
  const auth = { Authorization: `Bearer ${tokenFor(admin)}` };

  const reminders = await request(app).get('/api/automations/orderReminders/sends').set(auth);
  assert.equal(reminders.status, 200);
  assert.equal(reminders.body.items.length, 1);
  assert.equal(reminders.body.items[0].targetLabel, 'ORD-77');
  assert.equal(reminders.body.items[0].targetType, 'order');

  const fuel = await request(app).get('/api/automations/fuelAnomaly/sends').set(auth);
  assert.equal(fuel.body.items[0].targetLabel, 'KA01AB1234');
  assert.equal(fuel.body.items[0].detail, '23%');

  const winBack = await request(app).get('/api/automations/winBack/sends').set(auth);
  assert.equal(winBack.body.items[0].targetLabel, 'Acme Constructions');
});

test('a purged target still appears in the feed, just without a label', async () => {
  // Simulate cleanup's user purge: the ledger row outlives the user row.
  assert.ok(await claimSend('cleanup', 'user', 99999, 'purge'));
  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app).get('/api/automations/cleanup/sends')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].targetType, 'user');
  assert.equal(res.body.items[0].targetId, 99999);
  assert.equal(res.body.items[0].targetLabel, null);
});

test('a plant-scoped admin sees only their own plant\'s rows; platform staff see all', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const [clientA] = await db.insert(clients).values({
    name: 'Client A', contactPerson: 'A', phone: '+911111111111', plantId: plantA.id,
  }).returning();
  const [clientB] = await db.insert(clients).values({
    name: 'Client B', contactPerson: 'B', phone: '+912222222222', plantId: plantB.id,
  }).returning();
  assert.ok(await claimSend('winBack', 'client', clientA.id, 'p30-1', plantA.id));
  assert.ok(await claimSend('winBack', 'client', clientB.id, 'p30-1', plantB.id));
  // A platform-wide row (no plant), like cleanup writes.
  assert.ok(await claimSend('winBack', 'client', 424242, 'p30-1'));

  const plantAdmin = await createUser('admin', 'plant-admin@test.com', plantA.id);
  const scoped = await request(app).get('/api/automations/winBack/sends')
    .set('Authorization', `Bearer ${tokenFor(plantAdmin)}`);
  assert.equal(scoped.status, 200);
  assert.equal(scoped.body.items.length, 1);
  assert.equal(scoped.body.items[0].targetLabel, 'Client A');
  assert.ok(scoped.body.items.every((i: { plantId: number | null }) => i.plantId === plantA.id));

  const globalAdmin = await createUser('authority', 'authority@test.com', null);
  const all = await request(app).get('/api/automations/winBack/sends')
    .set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(all.body.items.length, 3);
});

test('the feed is newest-first and the limit is clamped', async () => {
  const plant = await createPlant('Plant A');
  for (let i = 1; i <= 5; i++) {
    assert.ok(await claimSend('idleVehicle', 'vehicle', i, `p7-${i}`, plant.id));
  }
  const items = await listRecentSends('idleVehicle', null, 3);
  assert.equal(items.length, 3);
  // Same-timestamp rows fall back to id DESC — newest claim first.
  assert.deepEqual(items.map(i => i.targetId), [5, 4, 3]);

  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app).get('/api/automations/idleVehicle/sends?limit=2')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.body.items.length, 2);
});
