import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { setSetting } from '../lib/settings.js';
import { IDLE_KEYS, DEFAULT_IDLE_FREE_MIN } from '../lib/idle.js';

let app: Express;

const PASSWORD = 'secret123';

async function createClient(name: string, phone: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Jane', phone,
  }).returning();
  return row;
}

async function createUser(role: string, email: string, linkedClientId?: number) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name: `${role} user`, email, passwordHash, role: role as 'admin',
    isActive: true, linkedClientId: linkedClientId ?? null,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE app_settings, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

test('a logged-in client gets the configured free window and rate', async () => {
  await setSetting(IDLE_KEYS.freeMin, '30');
  await setSetting(IDLE_KEYS.ratePerHour, '600');

  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);

  const res = await request(app)
    .get('/api/me/idle-config')
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { freeMin: 30, ratePerHour: 600 });
});

test('an unconfigured client falls back to the default free window and no rate', async () => {
  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);

  const res = await request(app)
    .get('/api/me/idle-config')
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.freeMin, DEFAULT_IDLE_FREE_MIN);
  assert.equal(res.body.ratePerHour, null);
});

test('the response never leaks the admin-only editable defaults', async () => {
  await setSetting(IDLE_KEYS.freeMin, '30');

  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);

  const res = await request(app)
    .get('/api/me/idle-config')
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`);

  assert.equal(res.status, 200);
  assert.equal('defaults' in res.body, false, 'client config must not carry the staff-only defaults');
  assert.deepEqual(Object.keys(res.body).sort(), ['freeMin', 'ratePerHour']);
});

test('a non-client role is forbidden (403)', async () => {
  const staff = await createUser('admin', 'admin@test.com');

  const res = await request(app)
    .get('/api/me/idle-config')
    .set('Authorization', `Bearer ${tokenFor(staff)}`);

  assert.equal(res.status, 403);
});

test('a driver role is also forbidden (403)', async () => {
  const driver = await createUser('driver', 'driver@test.com');

  const res = await request(app)
    .get('/api/me/idle-config')
    .set('Authorization', `Bearer ${tokenFor(driver)}`);

  assert.equal(res.status, 403);
});

test('an unauthenticated request is rejected (401)', async () => {
  const res = await request(app).get('/api/me/idle-config');
  assert.equal(res.status, 401);
});
