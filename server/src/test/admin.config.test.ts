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

type Role = 'admin' | 'authority' | 'dispatcher' | 'plant_operator' | 'client' | 'driver' | 'plant_owner';

let app: Express;
const PASSWORD = 'secret123';

async function createPlant(name: string) {
  const [row] = await db.insert(plants).values({
    name,
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: 'approved',
    isActive: true,
    verified: true,
    deliveryRadiusKm: 40,
    grades: ['M-20'],
  }).returning();
  return row;
}

async function createUser(opts: { name: string; email: string; role?: Role; plantId?: number | null }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: (opts.role ?? 'admin') as typeof users.$inferInsert['role'],
    plantId: opts.plantId ?? null,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, plants, app_settings RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

// ── Role-permission overrides ────────────────────────────────────────────────

test('role permissions default to empty overrides and persist a normalized save', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  const initial = await request(app)
    .get('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.overrides, {});
  assert.ok(Array.isArray(initial.body.roles));

  const saved = await request(app)
    .post('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`)
    .send({ overrides: { dispatcher: ['/orders', ' /reports ', 'not-a-path', '/orders'] } });
  assert.equal(saved.status, 200);
  // Trimmed, deduped, and non-paths dropped.
  assert.deepEqual(saved.body.overrides.dispatcher, ['/orders', '/reports']);

  // Persists across reads.
  const reread = await request(app)
    .get('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`);
  assert.deepEqual(reread.body.overrides.dispatcher, ['/orders', '/reports']);
});

test('saving empty overrides clears the setting (back to defaults)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  await request(app).post('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`)
    .send({ overrides: { client: ['/my-orders'] } });

  const cleared = await request(app).post('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`)
    .send({ overrides: {} });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.body.overrides, {});
});

test('the public config endpoint exposes overrides without auth', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  await request(app).post('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`)
    .send({ overrides: { driver: ['/my-trips'] } });

  const cfg = await request(app).get('/api/config');
  assert.equal(cfg.status, 200);
  assert.deepEqual(cfg.body.rolePermissionOverrides.driver, ['/my-trips']);
});

test('a client cannot read or write role permissions', async () => {
  const client = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const token = tokenFor(client);
  const read = await request(app).get('/api/admin/role-permissions').set('Authorization', `Bearer ${token}`);
  assert.equal(read.status, 403);
  const write = await request(app).post('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`).send({ overrides: { client: ['/'] } });
  assert.equal(write.status, 403);
});

test('a plant-scoped admin cannot read or write platform role permissions', async () => {
  const plant = await createPlant('Alpha Plant');
  const admin = await createUser({ name: 'PlantAdmin', email: 'pa@test.com', role: 'admin', plantId: plant.id });
  const token = tokenFor(admin);
  const read = await request(app).get('/api/admin/role-permissions').set('Authorization', `Bearer ${token}`);
  assert.equal(read.status, 403);
  const write = await request(app).post('/api/admin/role-permissions')
    .set('Authorization', `Bearer ${token}`).send({ overrides: { dispatcher: ['/orders'] } });
  assert.equal(write.status, 403);
});

// ── App version ──────────────────────────────────────────────────────────────

test('app version defaults to empty, saves, and surfaces through /config', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  const initial = await request(app).get('/api/admin/app-version').set('Authorization', `Bearer ${token}`);
  assert.equal(initial.status, 200);
  assert.equal(initial.body.version, '');

  const saved = await request(app).post('/api/admin/app-version')
    .set('Authorization', `Bearer ${token}`).send({ version: '2.4.0' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.version, '2.4.0');

  const cfg = await request(app).get('/api/config');
  assert.equal(cfg.body.appVersion, '2.4.0');

  // Empty string clears it.
  const cleared = await request(app).post('/api/admin/app-version')
    .set('Authorization', `Bearer ${token}`).send({ version: '' });
  assert.equal(cleared.body.version, '');
});

test('a plant-scoped admin cannot read or write the app version', async () => {
  const plant = await createPlant('Beta Plant');
  const admin = await createUser({ name: 'PlantAdmin', email: 'pa2@test.com', role: 'admin', plantId: plant.id });
  const token = tokenFor(admin);
  const read = await request(app).get('/api/admin/app-version').set('Authorization', `Bearer ${token}`);
  assert.equal(read.status, 403);
  const write = await request(app).post('/api/admin/app-version')
    .set('Authorization', `Bearer ${token}`).send({ version: '9.9.9' });
  assert.equal(write.status, 403);
});

// ── Social links ─────────────────────────────────────────────────────────────

test('social links default to the baked-in values, save, and surface through /config', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);

  const initial = await request(app).get('/api/admin/social-links').set('Authorization', `Bearer ${token}`);
  assert.equal(initial.status, 200);
  assert.ok(initial.body.links.youtube.startsWith('https://youtube.com/'));
  assert.equal(initial.body.links.playStore, '');

  const saved = await request(app).post('/api/admin/social-links')
    .set('Authorization', `Bearer ${token}`)
    .send({ youtube: 'https://youtube.com/@newchannel', playStore: 'https://play.google.com/store/apps/details?id=com.trackmyrmc' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.links.youtube, 'https://youtube.com/@newchannel');
  assert.equal(saved.body.links.playStore, 'https://play.google.com/store/apps/details?id=com.trackmyrmc');
  // Untouched platforms keep their existing values.
  assert.ok(saved.body.links.instagram.includes('instagram.com'));

  // Publicly served bootstrap config carries the saved links unauthenticated.
  const cfg = await request(app).get('/api/config');
  assert.equal(cfg.status, 200);
  assert.equal(cfg.body.socialLinks.youtube, 'https://youtube.com/@newchannel');
  assert.equal(cfg.body.socialLinks.playStore, 'https://play.google.com/store/apps/details?id=com.trackmyrmc');

  // Empty string clears a link back to '' (frontend shows "coming soon").
  const cleared = await request(app).post('/api/admin/social-links')
    .set('Authorization', `Bearer ${token}`).send({ playStore: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.links.playStore, '');
});

test('social links reject non-http(s) values', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  const bad = await request(app).post('/api/admin/social-links')
    .set('Authorization', `Bearer ${token}`)
    .send({ youtube: 'javascript:alert(1)' });
  assert.equal(bad.status, 400);
});

test('a plant-scoped admin and a client cannot read or write social links', async () => {
  const plant = await createPlant('Gamma Plant');
  const plantAdmin = await createUser({ name: 'PlantAdmin', email: 'pa3@test.com', role: 'admin', plantId: plant.id });
  const client = await createUser({ name: 'Cust', email: 'cust2@test.com', role: 'client' });
  for (const u of [plantAdmin, client]) {
    const token = tokenFor(u);
    const read = await request(app).get('/api/admin/social-links').set('Authorization', `Bearer ${token}`);
    assert.equal(read.status, 403);
    const write = await request(app).post('/api/admin/social-links')
      .set('Authorization', `Bearer ${token}`).send({ youtube: 'https://youtube.com/@evil' });
    assert.equal(write.status, 403);
  }
});

// ── Database export ──────────────────────────────────────────────────────────

test('authority can export the database and password hashes are stripped', async () => {
  const authority = await createUser({ name: 'Boss', email: 'boss@test.com', role: 'authority' });
  const token = tokenFor(authority);

  const res = await request(app).get('/api/admin/export').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.tables));
  assert.equal(typeof res.body.totalRows, 'number');
  const usersTable = res.body.tables.find((t: { name: string }) => t.name === 'users');
  assert.ok(usersTable, 'users table present in export');
  assert.ok(usersTable.rows.length >= 1);
  for (const row of usersTable.rows) {
    assert.equal('passwordHash' in row, false, 'passwordHash must be stripped');
  }
});

test('a plant-scoped admin cannot export the database', async () => {
  const [plant] = await db.insert(plants).values({
    name: 'Alpha Plant',
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: 'approved',
    isActive: true,
    verified: true,
    deliveryRadiusKm: 40,
    grades: ['M-20'],
  }).returning();
  const admin = await createUser({ name: 'PlantAdmin', email: 'pa@test.com', role: 'admin', plantId: plant.id });
  const token = tokenFor(admin);
  const res = await request(app).get('/api/admin/export').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
});
