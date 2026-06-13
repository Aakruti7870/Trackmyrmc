import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, sites } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
const PASSWORD = 'secret123';

async function createClient(name = 'Acme Co', phone = '1112223333') {
  const [row] = await db.insert(clients).values({ name, contactPerson: 'Jane', phone }).returning();
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

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE recurring_orders, orders, sites, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => { await pool.end(); });

test('a client with no saved sites gets an empty list', async () => {
  const client = await createClient();
  const user = await createUser('client', 'a@test.com', client.id);
  const res = await request(app).get('/api/me/sites').set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('a client creates a site and sees it listed', async () => {
  const client = await createClient();
  const user = await createUser('client', 'b@test.com', client.id);
  const auth = `Bearer ${tokenFor(user)}`;

  const created = await request(app).post('/api/me/sites').set('Authorization', auth)
    .send({ name: '  Tower B  ', address: '12 Main', city: 'Pune' });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Tower B');
  assert.equal(created.body.city, 'Pune');
  assert.equal(created.body.clientId, client.id);

  const list = await request(app).get('/api/me/sites').set('Authorization', auth);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].name, 'Tower B');
});

test('creating a site without a name is rejected', async () => {
  const client = await createClient();
  const user = await createUser('client', 'c@test.com', client.id);
  const res = await request(app).post('/api/me/sites').set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ name: '   ' });
  assert.equal(res.status, 400);
});

test('an order can reference an owned site but not a foreign one', async () => {
  const mine = await createClient('Mine', '1110000000');
  const other = await createClient('Other', '2220000000');
  const user = await createUser('client', 'd@test.com', mine.id);
  const auth = `Bearer ${tokenFor(user)}`;

  const [ownSite] = await db.insert(sites).values({ clientId: mine.id, name: 'My Site' }).returning();
  const [foreignSite] = await db.insert(sites).values({ clientId: other.id, name: 'Their Site' }).returning();

  const ok = await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ grade: 'M25', quantity: 10, siteId: ownSite.id });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.siteId, ownSite.id);

  const bad = await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ grade: 'M25', quantity: 10, siteId: foreignSite.id });
  assert.equal(bad.status, 400);
});

test('sites are scoped per client', async () => {
  const mine = await createClient('Mine', '1110000001');
  const other = await createClient('Other', '2220000001');
  const me = await createUser('client', 'e@test.com', mine.id);
  await db.insert(sites).values({ clientId: other.id, name: 'Hidden' });

  const list = await request(app).get('/api/me/sites').set('Authorization', `Bearer ${tokenFor(me)}`);
  assert.deepEqual(list.body, []);
});

test('a client creates a site with map coordinates', async () => {
  const client = await createClient('Geo Co', '3330000000');
  const user = await createUser('client', 'geo@test.com', client.id);
  const res = await request(app).post('/api/me/sites').set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ name: 'Pinned Site', latitude: 18.5204, longitude: 73.8567 });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.latitude), 18.5204);
  assert.equal(Number(res.body.longitude), 73.8567);
});

test('a client updates a saved site pin via PATCH', async () => {
  const client = await createClient('Patch Co', '3330000001');
  const user = await createUser('client', 'patch@test.com', client.id);
  const auth = `Bearer ${tokenFor(user)}`;
  const [site] = await db.insert(sites).values({ clientId: client.id, name: 'Old Name' }).returning();

  const res = await request(app).patch(`/api/me/sites/${site.id}`).set('Authorization', auth)
    .send({ name: 'New Name', latitude: 19.07, longitude: 72.88 });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'New Name');
  assert.equal(Number(res.body.latitude), 19.07);
  assert.equal(Number(res.body.longitude), 72.88);
});

test('PATCH can clear a site pin with null coordinates', async () => {
  const client = await createClient('Clear Co', '3330000002');
  const user = await createUser('client', 'clear@test.com', client.id);
  const auth = `Bearer ${tokenFor(user)}`;
  const [site] = await db.insert(sites).values({
    clientId: client.id, name: 'Pinned', latitude: '1.0', longitude: '2.0',
  }).returning();

  const res = await request(app).patch(`/api/me/sites/${site.id}`).set('Authorization', auth)
    .send({ latitude: null, longitude: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.latitude, null);
  assert.equal(res.body.longitude, null);
});

test('a client cannot PATCH another client\'s site', async () => {
  const mine = await createClient('Mine2', '3330000003');
  const other = await createClient('Other2', '3330000004');
  const me = await createUser('client', 'me2@test.com', mine.id);
  const [foreign] = await db.insert(sites).values({ clientId: other.id, name: 'Theirs' }).returning();

  const res = await request(app).patch(`/api/me/sites/${foreign.id}`).set('Authorization', `Bearer ${tokenFor(me)}`)
    .send({ name: 'Hijacked' });
  assert.equal(res.status, 404);
});

test('PATCH with an empty body is rejected', async () => {
  const client = await createClient('Empty Co', '3330000005');
  const user = await createUser('client', 'empty@test.com', client.id);
  const [site] = await db.insert(sites).values({ clientId: client.id, name: 'Site' }).returning();
  const res = await request(app).patch(`/api/me/sites/${site.id}`).set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({});
  assert.equal(res.status, 400);
});
