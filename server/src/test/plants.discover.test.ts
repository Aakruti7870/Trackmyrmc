import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { plants } from '../db/schema.js';

let app: Express;
const KEY = 'GOOGLE_PLACES_API_KEY';
const prevKey = process.env[KEY];

// A fake Places "searchText" response with two plants: one ~1km away and one
// ~120km away, plus a third that collides with an onboarded partner plant.
function fakePlacesResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      places: [
        {
          id: 'near-1',
          displayName: { text: 'Near Concrete Co' },
          formattedAddress: '12 Near Rd',
          location: { latitude: 19.011, longitude: 73.0 },
          nationalPhoneNumber: '+91 11111 11111',
          currentOpeningHours: { openNow: true },
        },
        {
          id: 'far-1',
          displayName: { text: 'Far RMC Ltd' },
          formattedAddress: '99 Far Hwy',
          location: { latitude: 20.1, longitude: 73.0 }, // ~120km north
        },
        {
          id: 'dupe-1',
          displayName: { text: 'Partner Plant (duplicate)' },
          formattedAddress: 'same as onboarded',
          location: { latitude: 19.05, longitude: 73.05 },
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
  await db.execute(sql`TRUNCATE TABLE plants RESTART IDENTITY CASCADE`);
  // The discover cache + rate-limit stores live in Postgres and survive across
  // test FILES sharing a worker DB (plants.discover.shared-store.test.ts seeds
  // a response_cache row for the exact key this file's coords hash to).
  await db.execute(sql`TRUNCATE TABLE response_cache`);
  await db.execute(sql`TRUNCATE TABLE rate_limit_hits`);
  mock.reset();
});

after(async () => {
  if (prevKey === undefined) delete process.env[KEY];
  else process.env[KEY] = prevKey;
  mock.reset();
  await pool.end();
});

test('GET /plants/discover requires lat and lng', async () => {
  process.env[KEY] = 'test-key';
  const res = await request(app).get('/api/plants/discover');
  assert.equal(res.status, 400);
});

test('GET /plants/discover soft-fails with 503 when no API key is configured', async () => {
  delete process.env[KEY];
  const res = await request(app).get('/api/plants/discover?lat=19&lng=73');
  assert.equal(res.status, 503);
  assert.equal(res.body.configured, false);
});

test('GET /plants/discover returns leads within radius, marked as discovered', async () => {
  process.env[KEY] = 'test-key';
  mock.method(global, 'fetch', async () => fakePlacesResponse() as unknown as Response);

  // 40km radius near (19.01, 73.001) — vary coords so the in-module cache misses.
  const res = await request(app).get('/api/plants/discover?lat=19.01&lng=73.001&radius=40');
  assert.equal(res.status, 200);
  const ids = res.body.map((p: { placeId: string }) => p.placeId);
  assert.ok(ids.includes('near-1'), 'near plant is within radius');
  assert.ok(!ids.includes('far-1'), '~120km plant is excluded at 40km radius');
  const near = res.body.find((p: { placeId: string }) => p.placeId === 'near-1');
  assert.equal(near.source, 'discovered');
  assert.equal(near.openNow, true);
  assert.ok(typeof near.distanceKm === 'number');
});

test('GET /plants/discover drops leads that duplicate an onboarded partner plant', async () => {
  process.env[KEY] = 'test-key';
  await db.insert(plants).values({
    name: 'Onboarded Partner',
    latitude: '19.05',
    longitude: '73.05',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
  });
  mock.method(global, 'fetch', async () => fakePlacesResponse() as unknown as Response);

  // Distinct coords again to dodge the cache.
  const res = await request(app).get('/api/plants/discover?lat=19.02&lng=73.002&radius=250');
  assert.equal(res.status, 200);
  const ids = res.body.map((p: { placeId: string }) => p.placeId);
  assert.ok(!ids.includes('dupe-1'), 'a lead co-located with an onboarded plant is removed');
});
