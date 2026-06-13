import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

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

async function createOrder(clientId: number, orderNo: string, status: 'pending' | 'in_progress') {
  const [row] = await db.insert(orders).values({
    orderNo, clientId, grade: 'M25', quantity: '10', status,
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
  await db.execute(
    sql`TRUNCATE TABLE orders, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

test('a client cancels their own pending order', async () => {
  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);
  const order = await createOrder(client.id, 'ORD-001', 'pending');

  const res = await request(app)
    .patch(`/api/me/orders/${order.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.id, order.id);
  assert.equal(res.body.status, 'cancelled');
});

test('a client cannot cancel another client\'s order (404)', async () => {
  const mine = await createClient('Acme Co', '1112223333');
  const other = await createClient('Other Co', '4445556666');
  const clientUser = await createUser('client', 'client@test.com', mine.id);
  const otherOrder = await createOrder(other.id, 'ORD-002', 'pending');

  const res = await request(app)
    .patch(`/api/me/orders/${otherOrder.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
    .send({});

  assert.equal(res.status, 404);
});

test('a non-pending order cannot be cancelled (409)', async () => {
  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);
  const order = await createOrder(client.id, 'ORD-003', 'in_progress');

  const res = await request(app)
    .patch(`/api/me/orders/${order.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
    .send({});

  assert.equal(res.status, 409);
});

test('an invalid order id is rejected with 400', async () => {
  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);

  const res = await request(app)
    .patch('/api/me/orders/abc/cancel')
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
    .send({});

  assert.equal(res.status, 400);
});

test('cancel is gated on pending status atomically (no clobber of in_progress)', async () => {
  const client = await createClient('Acme Co', '1112223333');
  const clientUser = await createUser('client', 'client@test.com', client.id);
  const order = await createOrder(client.id, 'ORD-005', 'in_progress');

  const res = await request(app)
    .patch(`/api/me/orders/${order.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
    .send({});

  assert.equal(res.status, 409);

  // The order must remain in_progress — never silently flipped to cancelled.
  const [after] = await db.select({ status: orders.status }).from(orders);
  assert.equal(after.status, 'in_progress');
});

test('a non-client role is forbidden (403)', async () => {
  const client = await createClient('Acme Co', '1112223333');
  const staff = await createUser('admin', 'admin@test.com');
  const order = await createOrder(client.id, 'ORD-004', 'pending');

  const res = await request(app)
    .patch(`/api/me/orders/${order.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(staff)}`)
    .send({});

  assert.equal(res.status, 403);
});
