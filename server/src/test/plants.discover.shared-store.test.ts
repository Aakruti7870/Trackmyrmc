import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { plants, rateLimitHits, responseCache } from '../db/schema.js';

// These tests pin the behaviour that makes /plants/discover safe under
// horizontal scaling: both the rate-limit counter and the Places response cache
// live in Postgres (shared across instances), not in per-process memory.

let app: Express;
const KEY = 'GOOGLE_PLACES_API_KEY';
const prevKey = process.env[KEY];

function fakePlacesResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      places: [
        {
          id: 'shared-1',
          displayName: { text: 'Shared Concrete Co' },
          formattedAddress: '1 Shared Rd',
          location: { latitude: 19.011, longitude: 73.0 },
          nationalPhoneNumber: '+91 22222 22222',
          currentOpeningHours: { openNow: true },
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
  await db.execute(sql`TRUNCATE TABLE rate_limit_hits`);
  await db.execute(sql`TRUNCATE TABLE response_cache`);
  // Prevent an onboarded plant left behind by an earlier suite (running in the
  // same shared DB) from being treated as a near-duplicate of a discovered lead.
  await db.execute(sql`TRUNCATE TABLE ${plants} RESTART IDENTITY CASCADE`);
  mock.reset();
});

after(async () => {
  if (prevKey === undefined) delete process.env[KEY];
  else process.env[KEY] = prevKey;
  mock.reset();
  await pool.end();
});

test('discover rate-limit counter is persisted to the shared DB table', async () => {
  process.env[KEY] = 'test-key';
  mock.method(global, 'fetch', async () => fakePlacesResponse() as unknown as Response);

  const res = await request(app).get('/api/plants/discover?lat=19.31&lng=73.31&radius=40');
  assert.equal(res.status, 200);

  // The counter lives in Postgres (not process memory), which is what lets the
  // limit hold across multiple server instances.
  const rows = await db.select().from(rateLimitHits);
  assert.equal(rows.length, 1, 'a shared counter row was written');
  assert.ok(rows[0].key.startsWith('discover:'), 'the limiter namespace is applied');
  assert.ok(rows[0].count >= 1);
  assert.ok(rows[0].resetAt.getTime() > Date.now(), 'window has a future reset time');
});

test('discover returns 429 once the shared window is exhausted', async () => {
  process.env[KEY] = 'test-key';
  mock.method(global, 'fetch', async () => fakePlacesResponse() as unknown as Response);

  // One real request so the limiter writes a row under whatever IP key supertest
  // actually presents (we can't predict the socket address).
  const ok = await request(app).get('/api/plants/discover?lat=19.31&lng=73.31&radius=40');
  assert.equal(ok.status, 200);

  // Simulate other instances having already used up the shared window by bumping
  // the persisted counter to the ceiling. A per-process limiter would not see
  // this; the shared store must, and reject the next request.
  await db
    .update(rateLimitHits)
    .set({ count: 20, resetAt: new Date(Date.now() + 60_000) });

  const res = await request(app).get('/api/plants/discover?lat=19.32&lng=73.32&radius=40');
  assert.equal(res.status, 429);
  assert.ok(res.headers['retry-after'], 'a Retry-After header is set');
});

test('identical nearby queries reuse one upstream call via the shared cache', async () => {
  process.env[KEY] = 'test-key';
  let fetchCalls = 0;
  mock.method(global, 'fetch', async () => {
    fetchCalls += 1;
    return fakePlacesResponse() as unknown as Response;
  });

  const url = '/api/plants/discover?lat=19.33&lng=73.33&radius=40';
  const first = await request(app).get(url);
  const second = await request(app).get(url);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(fetchCalls, 1, 'the second identical query is served from the shared cache');

  const cached = await db.select().from(responseCache);
  assert.equal(cached.length, 1, 'the upstream response was persisted to the shared cache');
  assert.ok(cached[0].expiresAt.getTime() > Date.now(), 'cache entry has a future expiry');
});

test('an expired shared cache entry triggers a fresh upstream call', async () => {
  process.env[KEY] = 'test-key';
  let fetchCalls = 0;
  mock.method(global, 'fetch', async () => {
    fetchCalls += 1;
    return fakePlacesResponse() as unknown as Response;
  });

  // Seed an already-expired entry for the exact cache key the route will build.
  // Coords sit right on the fake place so the result survives the radius filter.
  await db.insert(responseCache).values({
    key: 'places:19.01,73.00,40',
    value: [],
    expiresAt: new Date(Date.now() - 1000),
  });

  const res = await request(app).get('/api/plants/discover?lat=19.01&lng=73.0&radius=40');
  assert.equal(res.status, 200);
  assert.equal(fetchCalls, 1, 'an expired entry is ignored and the upstream is re-queried');
  assert.ok(res.body.some((p: { placeId: string }) => p.placeId === 'shared-1'));
});
