import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
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

// A fully orderable marketplace partner unless overridden. The PUT guard rejects
// pinning anything that isn't approved + active + location-verified + verified.
async function createPlant(opts: {
  name: string; verified?: boolean; locationVerified?: boolean; isActive?: boolean;
  plantStatus?: 'pending' | 'approved' | 'rejected';
}) {
  const [row] = await db.insert(plants).values({
    name: opts.name,
    city: 'Pune',
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: opts.plantStatus ?? 'approved',
    isActive: opts.isActive ?? true,
    locationVerified: opts.locationVerified ?? true,
    verified: opts.verified ?? true,
    deliveryRadiusKm: 40,
    grades: ['M20', 'M25'],
    openTime: '06:00',
    closeTime: '21:00',
  }).returning();
  return row;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users, plants RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

test('GET /me/preferred-plant returns null when nothing is pinned', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });

  const res = await request(app)
    .get('/api/me/preferred-plant')
    .set('Authorization', `Bearer ${tokenFor(customer)}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { plantId: null });
});

test('PUT /me/preferred-plant pins an orderable plant and GET reflects it', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const plant = await createPlant({ name: 'Acme RMC' });
  const auth = `Bearer ${tokenFor(customer)}`;

  const put = await request(app)
    .put('/api/me/preferred-plant')
    .set('Authorization', auth)
    .send({ plantId: plant.id });
  assert.equal(put.status, 200);
  assert.deepEqual(put.body, { plantId: plant.id });

  const get = await request(app)
    .get('/api/me/preferred-plant')
    .set('Authorization', auth);
  assert.equal(get.status, 200);
  assert.deepEqual(get.body, { plantId: plant.id });
});

test('PUT /me/preferred-plant with null clears an existing pin', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const plant = await createPlant({ name: 'Acme RMC' });
  const auth = `Bearer ${tokenFor(customer)}`;

  await request(app).put('/api/me/preferred-plant').set('Authorization', auth).send({ plantId: plant.id });

  const cleared = await request(app)
    .put('/api/me/preferred-plant')
    .set('Authorization', auth)
    .send({ plantId: null });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body, { plantId: null });

  const get = await request(app).get('/api/me/preferred-plant').set('Authorization', auth);
  assert.deepEqual(get.body, { plantId: null });
});

test('PUT /me/preferred-plant rejects a non-orderable plant and leaves the pin untouched', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  // An onboarding lead (verified=false) is not a marketplace partner the customer
  // can order from, so it must not be pinnable as a default.
  const lead = await createPlant({ name: 'Onboarding Lead', verified: false });
  const auth = `Bearer ${tokenFor(customer)}`;

  const res = await request(app)
    .put('/api/me/preferred-plant')
    .set('Authorization', auth)
    .send({ plantId: lead.id });
  assert.equal(res.status, 400);

  const get = await request(app).get('/api/me/preferred-plant').set('Authorization', auth);
  assert.deepEqual(get.body, { plantId: null }, 'a rejected pin never changes the stored default');
});

test('PUT /me/preferred-plant rejects a malformed plantId', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const res = await request(app)
    .put('/api/me/preferred-plant')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ plantId: 'not-a-number' });
  assert.equal(res.status, 400);
});

test('preferred-plant endpoints are client-only', async () => {
  const staff = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const plant = await createPlant({ name: 'Acme RMC' });
  const auth = `Bearer ${tokenFor(staff)}`;

  const get = await request(app).get('/api/me/preferred-plant').set('Authorization', auth);
  assert.equal(get.status, 403);

  const put = await request(app)
    .put('/api/me/preferred-plant')
    .set('Authorization', auth)
    .send({ plantId: plant.id });
  assert.equal(put.status, 403);
});

test('preferred-plant endpoints require authentication', async () => {
  const get = await request(app).get('/api/me/preferred-plant');
  assert.equal(get.status, 401);
  const put = await request(app).put('/api/me/preferred-plant').send({ plantId: null });
  assert.equal(put.status, 401);
});
