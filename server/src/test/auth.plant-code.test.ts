import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';

let app: Express;
const PASSWORD = 'secret123';

async function createPlant(code: string | null) {
  const [row] = await db.insert(plants).values({
    name: `Plant ${code ?? 'none'}`,
    plantCode: code,
    latitude: '18.5',
    longitude: '73.8',
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

test('omitting the Plant ID logs in as before', async () => {
  const plant = await createPlant('RMC-001');
  await createStaff('a@test.com', plant.id);
  const res = await login({ email: 'a@test.com', password: PASSWORD });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('a matching Plant ID is accepted (case-insensitive)', async () => {
  const plant = await createPlant('RMC-001');
  await createStaff('a@test.com', plant.id);
  const res = await login({ email: 'a@test.com', password: PASSWORD, plantCode: 'rmc-001' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('a wrong Plant ID is rejected with 403 even with the correct password', async () => {
  const plant = await createPlant('RMC-001');
  await createStaff('a@test.com', plant.id);
  const res = await login({ email: 'a@test.com', password: PASSWORD, plantCode: 'RMC-999' });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /Plant ID/i);
  assert.equal(res.body.token, undefined);
});

test('supplying a Plant ID when the account has no plant is rejected', async () => {
  await createStaff('a@test.com', null);
  const res = await login({ email: 'a@test.com', password: PASSWORD, plantCode: 'RMC-001' });
  assert.equal(res.status, 403);
  assert.match(res.body.error, /Plant ID/i);
});

test('a blank Plant ID string is treated as omitted', async () => {
  await createStaff('a@test.com', null);
  const res = await login({ email: 'a@test.com', password: PASSWORD, plantCode: '   ' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});
