import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import { rateLimitHits, responseCache } from '../db/schema.js';
import { cleanupExpiredRateLimits } from '../lib/rateLimit.js';
import { cleanupExpiredCache } from '../lib/places.js';

// The periodic background job purges expired rows regardless of traffic so a
// quiet instance can't let rate_limit_hits / response_cache grow unbounded.
// These tests pin that the cleanup deletes only past-due rows and leaves live
// ones intact.

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE rate_limit_hits`);
  await db.execute(sql`TRUNCATE TABLE response_cache`);
});

after(async () => {
  await pool.end();
});

test('cleanupExpiredRateLimits removes only windows whose reset time has passed', async () => {
  await db.insert(rateLimitHits).values([
    { key: 'discover:expired', count: 3, resetAt: new Date(Date.now() - 60_000) },
    { key: 'discover:live', count: 1, resetAt: new Date(Date.now() + 60_000) },
  ]);

  const deleted = await cleanupExpiredRateLimits();
  assert.equal(deleted, 1, 'one expired window was purged');

  const remaining = await db.select().from(rateLimitHits);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].key, 'discover:live', 'the live window survives');
});

test('cleanupExpiredCache removes only cache entries whose TTL has elapsed', async () => {
  await db.insert(responseCache).values([
    { key: 'places:expired', value: [], expiresAt: new Date(Date.now() - 60_000) },
    { key: 'places:live', value: [], expiresAt: new Date(Date.now() + 60_000) },
  ]);

  const deleted = await cleanupExpiredCache();
  assert.equal(deleted, 1, 'one expired cache entry was purged');

  const remaining = await db.select().from(responseCache);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].key, 'places:live', 'the live cache entry survives');
});

test('cleanup is idempotent and a no-op when nothing is expired', async () => {
  await db.insert(rateLimitHits).values({
    key: 'discover:live',
    count: 1,
    resetAt: new Date(Date.now() + 60_000),
  });
  await db.insert(responseCache).values({
    key: 'places:live',
    value: [],
    expiresAt: new Date(Date.now() + 60_000),
  });

  assert.equal(await cleanupExpiredRateLimits(), 0);
  assert.equal(await cleanupExpiredCache(), 0);
  assert.equal(await cleanupExpiredRateLimits(), 0);
  assert.equal(await cleanupExpiredCache(), 0);

  assert.equal((await db.select().from(rateLimitHits)).length, 1);
  assert.equal((await db.select().from(responseCache)).length, 1);
});
