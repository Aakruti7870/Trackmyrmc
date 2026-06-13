import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, sites, recurringOrders } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
const PASSWORD = 'secret123';

async function createClient(name: string, phone: string) {
  const [row] = await db.insert(clients).values({ name, contactPerson: 'C', phone }).returning();
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

async function createTemplate(clientId: number, opts: { active?: boolean; siteId?: number } = {}) {
  const [row] = await db.insert(recurringOrders).values({
    clientId, siteId: opts.siteId ?? null, grade: 'M25', quantity: '10.00',
    pumpRequired: false, frequency: 'weekly', anchor: 1,
    nextRunDate: '2026-06-15', active: opts.active ?? true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE recurring_orders, orders, sites, clients, users RESTART IDENTITY CASCADE`,
  );
});

after(async () => { await pool.end(); });

test('admin lists recurring templates across all clients with names', async () => {
  const c1 = await createClient('Alpha', '1110000000');
  const c2 = await createClient('Beta', '2220000000');
  const [site] = await db.insert(sites).values({ clientId: c1.id, name: 'Site A' }).returning();
  await createTemplate(c1.id, { siteId: site.id });
  await createTemplate(c2.id);
  const admin = await createUser('admin', 'admin@test.com');

  const res = await request(app).get('/api/recurring').set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  const names = res.body.map((r: { clientName: string }) => r.clientName).sort();
  assert.deepEqual(names, ['Alpha', 'Beta']);
  const withSite = res.body.find((r: { siteName: string | null }) => r.siteName === 'Site A');
  assert.ok(withSite);
});

test('admin can pause and resume a template', async () => {
  const c1 = await createClient('Alpha', '1110000001');
  const t = await createTemplate(c1.id, { active: true });
  const admin = await createUser('admin', 'admin2@test.com');
  const auth = `Bearer ${tokenFor(admin)}`;

  const paused = await request(app).patch(`/api/recurring/${t.id}`).set('Authorization', auth).send({ active: false });
  assert.equal(paused.status, 200);
  assert.equal(paused.body.active, false);

  const resumed = await request(app).patch(`/api/recurring/${t.id}`).set('Authorization', auth).send({ active: true });
  assert.equal(resumed.body.active, true);
});

test('admin can delete a template', async () => {
  const c1 = await createClient('Alpha', '1110000002');
  const t = await createTemplate(c1.id);
  const admin = await createUser('admin', 'admin3@test.com');
  const auth = `Bearer ${tokenFor(admin)}`;

  const del = await request(app).delete(`/api/recurring/${t.id}`).set('Authorization', auth);
  assert.equal(del.status, 204);

  const list = await request(app).get('/api/recurring').set('Authorization', auth);
  assert.equal(list.body.length, 0);
});

test('a dispatcher can read but not pause or delete', async () => {
  const c1 = await createClient('Alpha', '1110000003');
  const t = await createTemplate(c1.id);
  const dispatcher = await createUser('dispatcher', 'disp@test.com');
  const auth = `Bearer ${tokenFor(dispatcher)}`;

  const list = await request(app).get('/api/recurring').set('Authorization', auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const patch = await request(app).patch(`/api/recurring/${t.id}`).set('Authorization', auth).send({ active: false });
  assert.equal(patch.status, 403);
  const del = await request(app).delete(`/api/recurring/${t.id}`).set('Authorization', auth);
  assert.equal(del.status, 403);
});

test('a client cannot access the admin recurring router', async () => {
  const c1 = await createClient('Alpha', '1110000004');
  const user = await createUser('client', 'cli@test.com', c1.id);
  const res = await request(app).get('/api/recurring').set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 403);
});
