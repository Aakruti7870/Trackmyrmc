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
const KYC_ENV = ['KYC_ENABLED', 'KYC_BASE_URL', 'KYC_API_KEY', 'KYC_API_SECRET', 'KYC_API_VERSION', 'KYC_PROVIDER'] as const;
const savedEnv: Record<string, string | undefined> = {};

async function createUser(opts: { name: string; email: string; role?: Role; plantId?: number | null }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'admin',
    plantId: opts.plantId ?? null,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => {
  app = buildTestApp();
  for (const k of KYC_ENV) { savedEnv[k] = process.env[k]; delete process.env[k]; }
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users, plants, app_settings RESTART IDENTITY CASCADE`);
});

async function createPlant() {
  const [row] = await db.insert(plants).values({
    name: 'Acme RMC', city: 'Pune', latitude: '19.0330000', longitude: '73.0297000',
    plantStatus: 'approved', isActive: true, locationVerified: true, verified: true,
    deliveryRadiusKm: 40, grades: ['M20'], openTime: '06:00', closeTime: '21:00',
  }).returning();
  return row;
}

after(async () => {
  for (const k of KYC_ENV) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await pool.end();
});

test('GET /admin/kyc-settings reports unconfigured for a platform admin', async () => {
  const admin = await createUser({ name: 'Platform', email: 'p@test.com', role: 'admin', plantId: null });
  const res = await request(app).get('/api/admin/kyc-settings').set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.configured, false);
  assert.equal(res.body.hasApiKey, false);
  assert.equal(res.body.provider, 'sandbox');
});

test('POST /admin/kyc-settings persists credentials and never echoes the secrets', async () => {
  const admin = await createUser({ name: 'Platform', email: 'p@test.com', role: 'admin', plantId: null });
  const auth = `Bearer ${tokenFor(admin)}`;

  const res = await request(app).post('/api/admin/kyc-settings').set('Authorization', auth).send({
    enabled: true, provider: 'sandbox', baseUrl: 'https://kyc.test', apiVersion: '2.0',
    apiKey: 'live-key', apiSecret: 'live-secret',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.configured, true);
  assert.equal(res.body.hasApiKey, true);
  assert.equal(res.body.hasApiSecret, true);
  // The response object must not carry the raw secret values anywhere.
  const serialized = JSON.stringify(res.body);
  assert.ok(!serialized.includes('live-key'));
  assert.ok(!serialized.includes('live-secret'));

  // A follow-up GET still reports configured, still without the secrets.
  const get = await request(app).get('/api/admin/kyc-settings').set('Authorization', auth);
  assert.equal(get.body.configured, true);
  assert.equal(get.body.baseUrl, 'https://kyc.test');
  assert.ok(!JSON.stringify(get.body).includes('live-secret'));
});

test('kyc-settings is platform-staff only — a plant-scoped admin is blocked', async () => {
  const plant = await createPlant();
  const plantAdmin = await createUser({ name: 'PlantAdmin', email: 'pa@test.com', role: 'admin', plantId: plant.id });
  const auth = `Bearer ${tokenFor(plantAdmin)}`;
  assert.equal((await request(app).get('/api/admin/kyc-settings').set('Authorization', auth)).status, 403);
  assert.equal(
    (await request(app).post('/api/admin/kyc-settings').set('Authorization', auth).send({ enabled: false })).status,
    403,
  );
});

test('kyc-settings requires a staff role', async () => {
  const client = await createUser({ name: 'Cust', email: 'c@test.com', role: 'client', plantId: null });
  const res = await request(app).get('/api/admin/kyc-settings').set('Authorization', `Bearer ${tokenFor(client)}`);
  assert.equal(res.status, 403);
});
