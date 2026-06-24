import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql, eq } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import type { SubscriptionStatus } from '../lib/subscription.js';

let app: Express;
const PASSWORD = 'secret123';

async function createPlant(status: SubscriptionStatus) {
  const [row] = await db.insert(plants).values({
    name: `Plant ${status}`,
    plantCode: `PLT-${status}`,
    latitude: '18.5',
    longitude: '73.8',
    subscriptionStatus: status,
  }).returning();
  return row;
}

async function createStaff(email: string, plantId: number | null) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: 'Staff', email, passwordHash, role: 'dispatcher', isActive: true, plantId,
  }).returning();
  return row;
}

function login(body: Record<string, unknown>) {
  return request(app).post('/api/auth/login').send(body);
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, plants, login_attempts RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

for (const status of ['trial', 'active', 'past_due'] as const) {
  test(`a ${status} subscription allows login`, async () => {
    const plant = await createPlant(status);
    await createStaff('a@test.com', plant.id);
    const res = await login({ email: 'a@test.com', password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });
}

test('a suspended subscription blocks login with 403', async () => {
  const plant = await createPlant('suspended');
  await createStaff('a@test.com', plant.id);
  const res = await login({ email: 'a@test.com', password: PASSWORD });
  assert.equal(res.status, 403);
  assert.equal(res.body.subscriptionBlocked, true);
  assert.match(res.body.error, /suspended/i);
  assert.equal(res.body.token, undefined);
});

test('a cancelled subscription blocks login with 403', async () => {
  const plant = await createPlant('cancelled');
  await createStaff('a@test.com', plant.id);
  const res = await login({ email: 'a@test.com', password: PASSWORD });
  assert.equal(res.status, 403);
  assert.equal(res.body.subscriptionBlocked, true);
  assert.match(res.body.error, /cancelled/i);
});

test('platform staff (no plant) are never billing-gated', async () => {
  await createStaff('platform@test.com', null);
  const res = await login({ email: 'platform@test.com', password: PASSWORD });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('a wrong password on a suspended plant still returns generic 401 (no billing leak)', async () => {
  const plant = await createPlant('suspended');
  await createStaff('a@test.com', plant.id);
  const res = await login({ email: 'a@test.com', password: 'wrongpass' });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /invalid credentials/i);
  assert.equal(res.body.subscriptionBlocked, undefined);
});
