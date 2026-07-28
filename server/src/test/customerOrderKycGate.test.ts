import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, plants, orders, plantCustomers, kycProfiles } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
let seq = 0;

async function createPlant() {
  seq += 1;
  const [row] = await db.insert(plants).values({
    plantCode: `KG-${String(seq).padStart(3, '0')}`,
    name: `KYC Gate Plant ${seq}`,
    latitude: '19.0000000',
    longitude: '72.0000000',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    verified: true,
    networkStatus: 'active',
    showOnNetwork: true,
    grades: ['M25', 'M30'],
  }).returning();
  return row;
}

async function createClient(plantId: number | null = null) {
  seq += 1;
  const [row] = await db.insert(clients).values({
    name: `Gate Client ${seq}`,
    contactPerson: `Contact ${seq}`,
    phone: `98${String(seq).padStart(8, '0')}`,
    plantId,
  }).returning();
  return row;
}

async function createUser(
  role: 'client' | 'admin',
  email: string,
  extra: Partial<typeof users.$inferInsert> = {},
) {
  const [row] = await db.insert(users).values({
    name: `${role} ${seq}`,
    email,
    passwordHash: 'not-used-by-these-tests',
    role,
    isActive: true,
    ...extra,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

function orderPayload(plantId: number) {
  return {
    plantId,
    grade: 'M25',
    quantity: '6',
    contactPerson: 'Site Contact',
    contactNumber: '9876543210',
    siteName: 'Gate Test Site',
    siteAddress: 'Panvel, Maharashtra',
    latitude: '19.0100000',
    longitude: '72.0100000',
    deliveryDate: '2026-08-01',
    deliveryTime: '10:30',
    paymentType: 'Cash',
  };
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${plantCustomers} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${orders} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${kycProfiles} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${users} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${clients} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${plants} RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

test('unverified customer cannot create an order or bypass the gate with request fields', async () => {
  const plant = await createPlant();
  const client = await createClient();
  const customer = await createUser('client', 'gate-unverified@test.com', { linkedClientId: client.id });

  const res = await request(app)
    .post('/api/me/orders')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...orderPayload(plant.id), kycVerified: true, canPlaceOrder: true });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'CUSTOMER_KYC_REQUIRED');
  assert.equal(res.body.nextAction, '/kyc');

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  assert.equal(count, 0);
  const [{ links }] = await db.select({ links: sql<number>`count(*)::int` }).from(plantCustomers);
  assert.equal(links, 0);
});

test('legacy verified Aadhaar KYC customer can create an order', async () => {
  const plant = await createPlant();
  const client = await createClient();
  const customer = await createUser('client', 'gate-ekyc@test.com', {
    linkedClientId: client.id,
    kycStatus: 'verified',
  });

  const res = await request(app)
    .post('/api/me/orders')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send(orderPayload(plant.id));

  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'pending_approval');
  assert.equal(res.body.plantId, plant.id);
});

test('approved enterprise KYC profile can create an order', async () => {
  const plant = await createPlant();
  const client = await createClient();
  const customer = await createUser('client', 'gate-profile@test.com', { linkedClientId: client.id });
  await db.insert(kycProfiles).values({
    entityType: 'customer',
    userId: customer.id,
    status: 'approved',
  });

  const res = await request(app)
    .post('/api/me/orders')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send(orderPayload(plant.id));

  assert.equal(res.status, 201);
});

test('pending, submitted and rejected KYC profiles do not authorize order creation', async () => {
  const plant = await createPlant();

  for (const status of ['pending', 'submitted', 'rejected'] as const) {
    const client = await createClient();
    const customer = await createUser('client', `gate-${status}@test.com`, { linkedClientId: client.id });
    await db.insert(kycProfiles).values({ entityType: 'customer', userId: customer.id, status });

    const res = await request(app)
      .post('/api/me/orders')
      .set('Authorization', `Bearer ${tokenFor(customer)}`)
      .send(orderPayload(plant.id));

    assert.equal(res.status, 403, `${status} must be blocked`);
    assert.equal(res.body.code, 'CUSTOMER_KYC_REQUIRED');
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  assert.equal(count, 0);
});

test('unverified customer cannot edit or resubmit an existing order', async () => {
  const plant = await createPlant();
  const client = await createClient(plant.id);
  const customer = await createUser('client', 'gate-edit@test.com', { linkedClientId: client.id });
  const [existing] = await db.insert(orders).values({
    orderNo: 'GATE-EDIT-1',
    clientId: client.id,
    plantId: plant.id,
    grade: 'M25',
    quantity: '6.00',
    status: 'rejected',
  }).returning();

  const res = await request(app)
    .put(`/api/me/orders/${existing.id}`)
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...orderPayload(plant.id), grade: 'M30', quantity: '8' });

  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'CUSTOMER_KYC_REQUIRED');

  const [unchanged] = await db.select().from(orders).where(eq(orders.id, existing.id));
  assert.equal(unchanged.grade, 'M25');
  assert.equal(unchanged.quantity, '6.00');
  assert.equal(unchanged.status, 'rejected');
});

test('unverified customer can still read and cancel existing orders', async () => {
  const plant = await createPlant();
  const client = await createClient(plant.id);
  const customer = await createUser('client', 'gate-history@test.com', { linkedClientId: client.id });
  const [existing] = await db.insert(orders).values({
    orderNo: 'GATE-HISTORY-1',
    clientId: client.id,
    plantId: plant.id,
    grade: 'M25',
    quantity: '5.00',
    status: 'pending_approval',
  }).returning();

  const auth = `Bearer ${tokenFor(customer)}`;
  const history = await request(app).get('/api/me/orders').set('Authorization', auth);
  assert.equal(history.status, 200);
  assert.equal(history.body.length, 1);

  const cancelled = await request(app)
    .patch(`/api/me/orders/${existing.id}/cancel`)
    .set('Authorization', auth)
    .send({ reason: 'Change of plans' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.status, 'cancelled');
});

test('staff-created order route remains outside the customer KYC gate', async () => {
  const plant = await createPlant();
  const client = await createClient(plant.id);
  const admin = await createUser('admin', 'gate-admin@test.com', { plantId: plant.id });

  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({
      clientId: client.id,
      grade: 'M25',
      quantity: '7',
      pumpRequired: false,
      deliveryDate: '2026-08-01',
      deliveryTime: '11:00',
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'approved');
});
