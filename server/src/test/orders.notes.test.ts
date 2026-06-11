import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;

const PASSWORD = 'secret123';

async function createUser(role: string, email: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await db.insert(users).values({
    name: `${role} user`, email, passwordHash, role: role as 'admin', isActive: true,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createClient() {
  const [row] = await db.insert(clients).values({
    name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  return row;
}

let orderSeq = 0;
async function createOrder(opts: { clientId: number; notes?: string | null }) {
  orderSeq += 1;
  const [row] = await db.insert(orders).values({
    orderNo: `ORD-T${String(orderSeq).padStart(3, '0')}`,
    clientId: opts.clientId,
    grade: 'M25',
    quantity: '10.00',
    deliveryDate: '2026-06-12',
    notes: opts.notes ?? null,
  }).returning();
  return row;
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

test('editing an order with a real note overwrites the existing note', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, notes: 'Pour before noon' });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10', notes: 'Pour after lunch' });

  assert.equal(res.status, 200);
  assert.equal(res.body.notes, 'Pour after lunch', 'a real note edit overwrites the old note');

  const [row] = await db.select({ notes: orders.notes })
    .from(orders).where(eq(orders.id, order.id));
  assert.equal(row.notes, 'Pour after lunch', 'overwritten note is persisted');
});

for (const blank of ['', '   ', '\t\n']) {
  test(`editing an order with a blank note (${JSON.stringify(blank)}) keeps the existing note`, async () => {
    const client = await createClient();
    const actor = await createUser('admin', 'admin@test.com');
    const order = await createOrder({ clientId: client.id, notes: 'Pour before noon' });

    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenFor(actor)}`)
      .send({ grade: 'M30', quantity: '12', notes: blank });

    assert.equal(res.status, 200);
    assert.equal(res.body.grade, 'M30', 'the rest of the update still applies');
    assert.equal(
      res.body.notes,
      'Pour before noon',
      'a blank/whitespace note edit does not wipe the existing order note',
    );

    const [row] = await db.select({ notes: orders.notes })
      .from(orders).where(eq(orders.id, order.id));
    assert.equal(row.notes, 'Pour before noon', 'the existing note survives in the database');
  });
}

test('editing an order can explicitly clear the note with null', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, notes: 'Pour before noon' });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10', notes: null });

  assert.equal(res.status, 200);
  assert.equal(res.body.notes, null, 'an explicit null clears the note (intentional, not blank)');

  const [row] = await db.select({ notes: orders.notes })
    .from(orders).where(eq(orders.id, order.id));
  assert.equal(row.notes, null, 'the cleared note is persisted as null');
});

test('editing an order without a notes field leaves the existing note untouched', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, notes: 'Pour before noon' });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10', status: 'in_progress' });

  assert.equal(res.status, 200);
  assert.equal(res.body.notes, 'Pour before noon', 'omitting notes leaves the existing note intact');

  const [row] = await db.select({ notes: orders.notes })
    .from(orders).where(eq(orders.id, order.id));
  assert.equal(row.notes, 'Pour before noon', 'the untouched note survives in the database');
});
