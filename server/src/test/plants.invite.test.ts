import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plantInvites } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';

type Role = 'admin' | 'authority' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;

const PASSWORD = 'secret123';

async function createUser(opts: { name: string; email: string; role?: Role }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'client',
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

const LEAD = {
  placeId: 'ChIJ_test_place_001',
  name: 'Sunrise RMC Plant',
  address: '12 Industrial Rd, Navi Mumbai',
  latitude: 19.033,
  longitude: 73.0297,
  contactNumber: '9820011001',
};

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE plant_invites, users RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

test('POST /plants/invite records a discovered-plant onboarding request', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });

  const res = await request(app)
    .post('/api/plants/invite')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send(LEAD);

  assert.equal(res.status, 201);
  assert.equal(res.body.placeId, LEAD.placeId);
  assert.equal(res.body.name, LEAD.name);
  assert.equal(res.body.requestCount, 1);
  assert.equal(res.body.status, 'pending');
  assert.equal(res.body.deduped, false);
  assert.equal(res.body.firstRequestedByName, 'Cust');
  assert.equal(res.body.lastRequestedByName, 'Cust');

  const rows = await db.select().from(plantInvites).where(eq(plantInvites.placeId, LEAD.placeId));
  assert.equal(rows.length, 1, 'one invite row should be stored');
  assert.equal(rows[0].contactNumber, LEAD.contactNumber);
});

test('POST /plants/invite de-duplicates repeat requests for the same placeId', async () => {
  const a = await createUser({ name: 'Alice', email: 'alice@test.com', role: 'client' });
  const b = await createUser({ name: 'Bob', email: 'bob@test.com', role: 'client' });

  await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(a)}`).send(LEAD);
  const res = await request(app)
    .post('/api/plants/invite')
    .set('Authorization', `Bearer ${tokenFor(b)}`)
    .send(LEAD);

  assert.equal(res.status, 201);
  assert.equal(res.body.requestCount, 2, 'second request bumps the count');
  assert.equal(res.body.deduped, true);
  assert.equal(res.body.firstRequestedByName, 'Alice', 'first requester is preserved');
  assert.equal(res.body.lastRequestedByName, 'Bob', 'latest requester is recorded');

  const rows = await db.select().from(plantInvites).where(eq(plantInvites.placeId, LEAD.placeId));
  assert.equal(rows.length, 1, 'still exactly one row for the placeId');
});

test('POST /plants/invite requires authentication', async () => {
  const res = await request(app).post('/api/plants/invite').send(LEAD);
  assert.equal(res.status, 401);
});

test('POST /plants/invite validates the body', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const res = await request(app)
    .post('/api/plants/invite')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ name: 'No place id' });
  assert.equal(res.status, 400);
});

test('GET /plants/invites lists requests for staff, pending first', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });

  await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
  await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...LEAD, placeId: 'ChIJ_test_place_002', name: 'Second Plant' });

  const res = await request(app).get('/api/plants/invites').set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  const names = (res.body as { name: string }[]).map(r => r.name);
  assert.ok(names.includes('Sunrise RMC Plant'));
  assert.ok(names.includes('Second Plant'));
});

test('GET /plants/invites is staff-only (client token rejected)', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const res = await request(app).get('/api/plants/invites').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(res.status, 403);
});

test('PATCH /plants/invites/:id lets staff dismiss / onboard a request', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const created = await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
  const id = created.body.id as number;

  const dismissed = await request(app)
    .patch(`/api/plants/invites/${id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ status: 'dismissed' });
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.body.status, 'dismissed');

  // A re-request for a dismissed invite returns it to the pending queue.
  const reReq = await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
  assert.equal(reReq.body.status, 'pending', 'a renewed request reopens a dismissed invite');
  assert.equal(reReq.body.requestCount, 2);
});

test('PATCH /plants/invites/:id rejects an invalid status', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const created = await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);

  const res = await request(app)
    .patch(`/api/plants/invites/${created.body.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ status: 'bogus' });
  assert.equal(res.status, 400);
});

test('PATCH /plants/invites/:id is 404 for an unknown invite', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .patch('/api/plants/invites/999999')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ status: 'dismissed' });
  assert.equal(res.status, 404);
});

test('an onboarded invite stays onboarded even if requested again', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const created = await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
  await request(app).patch(`/api/plants/invites/${created.body.id}`).set('Authorization', `Bearer ${tokenFor(admin)}`).send({ status: 'onboarded' });

  const reReq = await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
  assert.equal(reReq.body.status, 'onboarded', 'onboarded invites are not reopened by a new request');
});
