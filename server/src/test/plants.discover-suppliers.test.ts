import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
const KEY = 'GOOGLE_PLACES_API_KEY';
const prevKey = process.env[KEY];
const FALLBACK_KEY = 'GOOGLE_MAPS_API_KEY';
const prevFallbackKey = process.env[FALLBACK_KEY];
delete process.env[FALLBACK_KEY];

async function createUser(role: string, email: string) {
  const [u] = await db.insert(users).values({
    name: `${role} user`, email, role: role as 'admin', isActive: true,
  }).returning();
  return u;
}
function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// A fake Places "searchText" response. The same payload is returned for every
// category query; dedupe-by-placeId collapses them into one supplier carrying
// all matched categories.
function fakePlacesResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      places: [
        {
          id: 'sup-near',
          displayName: { text: 'Near Ready-Mix Co' },
          formattedAddress: '12 Near Rd',
          location: { latitude: 19.011, longitude: 73.0 },
          nationalPhoneNumber: '+91 11111 11111',
          currentOpeningHours: { openNow: true },
        },
        {
          id: 'sup-far',
          displayName: { text: 'Far Cement Depot' },
          formattedAddress: '99 Far Hwy',
          location: { latitude: 20.1, longitude: 73.0 }, // ~120km north
        },
      ],
    }),
    text: async () => '',
  };
}

before(async () => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE plants RESTART IDENTITY CASCADE`);
  mock.reset();
});

after(async () => {
  if (prevKey === undefined) delete process.env[KEY];
  else process.env[KEY] = prevKey;
  if (prevFallbackKey === undefined) delete process.env[FALLBACK_KEY];
  else process.env[FALLBACK_KEY] = prevFallbackKey;
  mock.reset();
  await pool.end();
});

test('GET /plants/discover-suppliers rejects anonymous requests with 401', async () => {
  const res = await request(app).get('/api/plants/discover-suppliers?lat=19&lng=73');
  assert.equal(res.status, 401);
});

test('GET /plants/discover-suppliers forbids non-authority roles with 403', async () => {
  const admin = await createUser('admin', 'admin@example.com');
  const res = await request(app)
    .get('/api/plants/discover-suppliers?lat=19&lng=73')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 403);
});

test('GET /plants/discover-suppliers requires lat and lng for authority', async () => {
  process.env[KEY] = 'test-key';
  const su = await createUser('authority', 'boss@example.com');
  const res = await request(app)
    .get('/api/plants/discover-suppliers')
    .set('Authorization', `Bearer ${tokenFor(su)}`);
  assert.equal(res.status, 400);
});

test('GET /plants/discover-suppliers soft-fails with 503 when no API key is configured', async () => {
  delete process.env[KEY];
  const su = await createUser('authority', 'boss@example.com');
  const res = await request(app)
    .get('/api/plants/discover-suppliers?lat=19&lng=73')
    .set('Authorization', `Bearer ${tokenFor(su)}`);
  assert.equal(res.status, 503);
  assert.equal(res.body.configured, false);
});

test('GET /plants/discover-suppliers returns suppliers with categories + distance', async () => {
  process.env[KEY] = 'test-key';
  mock.method(global, 'fetch', async () => fakePlacesResponse() as unknown as Response);
  const su = await createUser('authority', 'boss@example.com');

  // Distinct coords so the in-module cache misses between tests.
  const res = await request(app)
    .get('/api/plants/discover-suppliers?lat=19.01&lng=73.001&radius=40')
    .set('Authorization', `Bearer ${tokenFor(su)}`);
  assert.equal(res.status, 200);
  const ids = res.body.map((s: { placeId: string }) => s.placeId);
  assert.ok(ids.includes('sup-near'), 'near supplier is within radius');
  assert.ok(!ids.includes('sup-far'), '~120km supplier is excluded at 40km radius');
  const near = res.body.find((s: { placeId: string }) => s.placeId === 'sup-near');
  assert.ok(Array.isArray(near.categories) && near.categories.length > 0, 'carries category keys');
  assert.equal(typeof near.distanceKm, 'number');
  assert.equal(near.openNow, true);
});

test('GET /plants/discover-suppliers drops suppliers co-located with an onboarded plant', async () => {
  process.env[KEY] = 'test-key';
  await db.insert(plants).values({
    name: 'Onboarded Partner',
    latitude: '19.011',
    longitude: '73.0',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
  });
  mock.method(global, 'fetch', async () => fakePlacesResponse() as unknown as Response);
  const su = await createUser('authority', 'boss@example.com');

  const res = await request(app)
    .get('/api/plants/discover-suppliers?lat=19.02&lng=73.002&radius=250')
    .set('Authorization', `Bearer ${tokenFor(su)}`);
  assert.equal(res.status, 200);
  const ids = res.body.map((s: { placeId: string }) => s.placeId);
  assert.ok(!ids.includes('sup-near'), 'supplier co-located with an onboarded plant is removed');
});
