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

async function createUser(opts: { name: string; email: string; role?: Role }) {
  const passwordHash = await hashPassword('secret123');
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'admin',
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createPlant(opts: {
  name: string; verified?: boolean; locationVerified?: boolean; isActive?: boolean;
  plantStatus?: 'pending' | 'approved' | 'rejected'; contactNumber?: string;
  latitude?: string; longitude?: string;
}) {
  const [row] = await db.insert(plants).values({
    name: opts.name,
    address: '12 Industrial Estate',
    city: 'Pune',
    contactNumber: opts.contactNumber ?? '9876543210',
    latitude: opts.latitude ?? '19.0330000',
    longitude: opts.longitude ?? '73.0297000',
    plantStatus: opts.plantStatus ?? 'approved',
    isActive: opts.isActive ?? true,
    locationVerified: opts.locationVerified ?? true,
    verified: opts.verified ?? true,
    deliveryRadiusKm: 40,
    grades: ['M20', 'M25'],
    openTime: '00:00',
    closeTime: '23:59',
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

test('GET /plants/map returns verified partners with popup fields', async () => {
  const staff = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await createPlant({ name: 'Acme RMC' });

  const res = await request(app)
    .get('/api/plants/map')
    .set('Authorization', `Bearer ${tokenFor(staff)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  const entry = res.body[0];
  assert.equal(entry.name, 'Acme RMC');
  assert.equal(entry.address, '12 Industrial Estate');
  assert.equal(entry.city, 'Pune');
  assert.equal(entry.contactNumber, '9876543210');
  assert.equal(typeof entry.latitude, 'number');
  assert.equal(typeof entry.longitude, 'number');
  assert.equal(entry.openNow, true, 'open 00:00–23:59 means open now');
  assert.deepEqual(entry.grades, ['M20', 'M25']);
  assert.ok(!('plantStatus' in entry), 'internal status flags are not exposed');
  assert.ok(!('verified' in entry), 'verification internals are not exposed');
});

test('GET /plants/map hides leads, hidden and unavailable plants', async () => {
  const staff = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await createPlant({ name: 'Verified Partner' });
  await createPlant({ name: 'Onboarding Lead', verified: false });
  await createPlant({ name: 'Unverified Pin', locationVerified: false });
  await createPlant({ name: 'Inactive Plant', isActive: false });
  await createPlant({ name: 'Pending Plant', plantStatus: 'pending' });

  const res = await request(app)
    .get('/api/plants/map')
    .set('Authorization', `Bearer ${tokenFor(staff)}`);

  assert.equal(res.status, 200);
  const names = (res.body as { name: string }[]).map(p => p.name);
  assert.deepEqual(names, ['Verified Partner']);
});

test('GET /plants/map requires authentication', async () => {
  await createPlant({ name: 'Acme RMC' });
  const res = await request(app).get('/api/plants/map');
  assert.equal(res.status, 401);
});
