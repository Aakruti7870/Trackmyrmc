import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, sites, orders } from '../db/schema.js';
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

async function createSite(clientId: number, name = 'Tower A') {
  const [row] = await db.insert(sites).values({ clientId, name }).returning();
  return row;
}

let orderSeq = 0;
async function createOrder(opts: {
  clientId: number;
  siteId?: number | null;
  grade?: string;
  quantity?: string;
  pumpRequired?: boolean;
  deliveryDate?: string | null;
  deliveryTime?: string | null;
  notes?: string | null;
}) {
  orderSeq += 1;
  const [row] = await db.insert(orders).values({
    orderNo: `ORD-P${String(orderSeq).padStart(3, '0')}`,
    clientId: opts.clientId,
    siteId: opts.siteId ?? null,
    grade: opts.grade ?? 'M25',
    quantity: opts.quantity ?? '10.00',
    pumpRequired: opts.pumpRequired ?? false,
    deliveryDate: opts.deliveryDate ?? '2026-06-12',
    deliveryTime: opts.deliveryTime ?? '09:00:00',
    notes: opts.notes ?? null,
  }).returning();
  return row;
}

async function readOrder(id: number) {
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE orders, sites, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

// A partial edit that only touches a couple of fields (e.g. a status change)
// must not erase the order's other saved details. The PUT handler relies on
// Drizzle skipping `undefined` columns, so for every optional field, omitting
// it from the request body has to leave the stored value intact.
test('a minimal status-only edit preserves every other saved field', async () => {
  const client = await createClient();
  const site = await createSite(client.id);
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({
    clientId: client.id,
    siteId: site.id,
    grade: 'M30',
    quantity: '12.00',
    pumpRequired: true,
    deliveryDate: '2026-07-01',
    deliveryTime: '14:30:00',
    notes: 'Pour before noon',
  });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ status: 'in_progress' });

  assert.equal(res.status, 200);

  const row = await readOrder(order.id);
  assert.equal(row.status, 'in_progress', 'the sent status is applied');
  assert.equal(row.clientId, client.id, 'clientId is preserved');
  assert.equal(row.siteId, site.id, 'siteId is preserved');
  assert.equal(row.grade, 'M30', 'grade is preserved');
  assert.equal(row.quantity, '12.00', 'quantity is preserved');
  assert.equal(row.pumpRequired, true, 'pumpRequired is preserved');
  assert.equal(row.deliveryDate, '2026-07-01', 'deliveryDate is preserved');
  assert.equal(row.deliveryTime, '14:30:00', 'deliveryTime is preserved');
  assert.equal(row.notes, 'Pour before noon', 'notes are preserved');
});

// Regression guard: previously `siteId: siteId ? +siteId : null` coerced an
// omitted siteId to null, silently clearing the saved site on any partial save.
test('omitting siteId keeps the saved site (no silent clear)', async () => {
  const client = await createClient();
  const site = await createSite(client.id);
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, siteId: site.id });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M35', quantity: '15' });

  assert.equal(res.status, 200);
  assert.equal(res.body.siteId, site.id, 'response keeps the existing siteId');

  const row = await readOrder(order.id);
  assert.equal(row.siteId, site.id, 'the saved site survives a partial edit');
  assert.equal(row.grade, 'M35', 'the rest of the update still applies');
});

// Clearing the optional site is still possible when explicitly intended.
for (const cleared of [null, 0, ''] as const) {
  test(`sending an explicit falsy siteId (${JSON.stringify(cleared)}) clears the site`, async () => {
    const client = await createClient();
    const site = await createSite(client.id);
    const actor = await createUser('admin', 'admin@test.com');
    const order = await createOrder({ clientId: client.id, siteId: site.id });

    const res = await request(app)
      .put(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${tokenFor(actor)}`)
      .send({ grade: 'M25', quantity: '10', siteId: cleared });

    assert.equal(res.status, 200);
    assert.equal(res.body.siteId, null, 'an explicit falsy siteId clears the site on purpose');

    const row = await readOrder(order.id);
    assert.equal(row.siteId, null, 'the cleared site is persisted as null');
  });
}

// Setting siteId to a new value works as expected.
test('sending a new siteId moves the order to that site', async () => {
  const client = await createClient();
  const siteA = await createSite(client.id, 'Tower A');
  const siteB = await createSite(client.id, 'Tower B');
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, siteId: siteA.id });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10', siteId: siteB.id });

  assert.equal(res.status, 200);
  assert.equal(res.body.siteId, siteB.id, 'the order moves to the new site');

  const row = await readOrder(order.id);
  assert.equal(row.siteId, siteB.id, 'the new site is persisted');
});

// clientId is required (notNull); omitting or sending a falsy value leaves the
// saved client untouched rather than attempting an illegal clear.
test('omitting or clearing clientId preserves the saved client', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id });

  const omitted = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10' });
  assert.equal(omitted.status, 200);
  assert.equal((await readOrder(order.id)).clientId, client.id, 'omitting clientId keeps it');

  const falsy = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10', clientId: 0 });
  assert.equal(falsy.status, 200);
  assert.equal((await readOrder(order.id)).clientId, client.id, 'a falsy clientId is ignored');
});

// pumpRequired is gated on an explicit `undefined` check, so omitting it keeps
// the saved flag while sending a falsy value toggles it off on purpose.
test('omitting pumpRequired keeps the flag; sending false toggles it off', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, pumpRequired: true });

  const omitted = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10' });
  assert.equal(omitted.status, 200);
  assert.equal((await readOrder(order.id)).pumpRequired, true, 'omitting pumpRequired keeps it on');

  const toggled = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M25', quantity: '10', pumpRequired: false });
  assert.equal(toggled.status, 200);
  assert.equal((await readOrder(order.id)).pumpRequired, false, 'an explicit false toggles it off');
});

// quantity is only written when provided (quantity?.toString()), so omitting it
// leaves the saved quantity intact.
test('omitting quantity leaves the saved quantity untouched', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const order = await createOrder({ clientId: client.id, quantity: '12.00' });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ grade: 'M40' });

  assert.equal(res.status, 200);
  const row = await readOrder(order.id);
  assert.equal(row.quantity, '12.00', 'quantity is preserved when omitted');
  assert.equal(row.grade, 'M40', 'grade still updates');
});
