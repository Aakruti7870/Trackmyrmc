import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express, Response } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, orders, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient, type SSEIdentity } from '../lib/sseEmitter.js';

// End-to-end coverage of per-recipient SSE scoping THROUGH the real HTTP routes.
// The emitter's filter is unit-tested in sse.test.ts; here we drive the actual
// order/challan routes and assert that each registered connection only receives
// the events its identity should — catching a regression where a route drops or
// mis-supplies the audience argument to emitSSEEvent.

let app: Express;

const PASSWORD = 'secret123';

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createClient(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  return row;
}

async function createDriver(name: string) {
  const [row] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  return row;
}

async function createUser(opts: {
  role: string; email: string; name?: string;
  linkedClientId?: number | null; linkedDriverId?: number | null;
}) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name: opts.name ?? `${opts.role} user`,
    email: opts.email,
    passwordHash,
    role: opts.role as 'admin',
    isActive: true,
    linkedClientId: opts.linkedClientId ?? null,
    linkedDriverId: opts.linkedDriverId ?? null,
  }).returning();
  return user;
}

let orderSeq = 0;
async function createOrder(clientId: number, status: 'pending' | 'in_progress' = 'pending') {
  orderSeq += 1;
  const [row] = await db.insert(orders).values({
    orderNo: `ORD-R${String(orderSeq).padStart(3, '0')}`,
    clientId,
    grade: 'M25',
    quantity: '10.00',
    status,
  }).returning();
  return row;
}

// Registers a fake identity-bearing SSE connection against the real emitter and
// records the event names it actually receives.
function captureSSE(identity?: SSEIdentity) {
  const raw: string[] = [];
  const mockRes = {
    writableEnded: false,
    destroyed: false,
    req: { httpVersionMajor: 2 },
    setHeader() {},
    flushHeaders() {},
    write(payload: string) { raw.push(payload); return true; },
    end() { (mockRes as { writableEnded: boolean }).writableEnded = true; },
  };
  const id = addSSEClient(mockRes as unknown as Response, identity);
  return {
    id,
    events() {
      return raw
        .map((chunk) => /^event: (.+)$/m.exec(chunk)?.[1])
        .filter((e): e is string => Boolean(e));
    },
    clear() { raw.length = 0; },
    close() { removeSSEClient(id); },
  };
}

// A panel of identity-bearing connections plus convenience accessors. Each test
// drives a route and asserts which of these receive a given event.
type Panel = {
  ownClient: ReturnType<typeof captureSSE>;
  otherClient: ReturnType<typeof captureSSE>;
  assignedDriver: ReturnType<typeof captureSSE>;
  unassignedDriver: ReturnType<typeof captureSSE>;
  admin: ReturnType<typeof captureSSE>;
  all: ReturnType<typeof captureSSE>[];
};

let panel: Panel | null = null;
function openPanel(ids: { ownClientId: number; otherClientId: number; assignedDriverId: number; unassignedDriverId: number }): Panel {
  const ownClient = captureSSE({ role: 'client', clientId: ids.ownClientId });
  const otherClient = captureSSE({ role: 'client', clientId: ids.otherClientId });
  const assignedDriver = captureSSE({ role: 'driver', driverId: ids.assignedDriverId });
  const unassignedDriver = captureSSE({ role: 'driver', driverId: ids.unassignedDriverId });
  const admin = captureSSE({ role: 'admin' });
  panel = { ownClient, otherClient, assignedDriver, unassignedDriver, admin,
    all: [ownClient, otherClient, assignedDriver, unassignedDriver, admin] };
  return panel;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, orders, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

afterEach(() => {
  if (panel) { for (const c of panel.all) c.close(); panel = null; }
});

after(async () => {
  await pool.end();
});

test('PUT /api/orders/:id (status change) toasts only the owning client and staff', async () => {
  const ownClient = await createClient('Acme Co');
  const otherClient = await createClient('Globex');
  const assignedDriver = await createDriver('Assigned Driver');
  const unassignedDriver = await createDriver('Unassigned Driver');
  const admin = await createUser({ role: 'admin', email: 'admin@test.com' });
  const order = await createOrder(ownClient.id, 'pending');

  const p = openPanel({
    ownClientId: ownClient.id,
    otherClientId: otherClient.id,
    assignedDriverId: assignedDriver.id,
    unassignedDriverId: unassignedDriver.id,
  });

  const res = await request(app)
    .put(`/api/orders/${order.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ status: 'in_progress', grade: 'M25', quantity: '10' });

  assert.equal(res.status, 200);

  assert.ok(p.ownClient.events().includes('order.updated'), 'the owning client receives order.updated');
  assert.ok(p.admin.events().includes('order.updated'), 'staff receive order.updated');
  assert.ok(!p.otherClient.events().includes('order.updated'), "another company's client must NOT receive it");
  assert.ok(!p.assignedDriver.events().includes('order.updated'), 'a driver must NOT receive client order toasts');
  assert.ok(!p.unassignedDriver.events().includes('order.updated'), 'an unassigned driver must NOT receive it');
});

test('POST /api/challans toasts the owning client, the assigned driver and staff only', async () => {
  const ownClient = await createClient('Acme Co');
  const otherClient = await createClient('Globex');
  const assignedDriver = await createDriver('Assigned Driver');
  const unassignedDriver = await createDriver('Unassigned Driver');
  const dispatcher = await createUser({ role: 'dispatcher', email: 'dispatch@test.com' });

  const p = openPanel({
    ownClientId: ownClient.id,
    otherClientId: otherClient.id,
    assignedDriverId: assignedDriver.id,
    unassignedDriverId: unassignedDriver.id,
  });

  const res = await request(app)
    .post('/api/challans')
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`)
    .send({ clientId: ownClient.id, driverId: assignedDriver.id, grade: 'M25', quantity: '6' });

  assert.equal(res.status, 201);

  assert.ok(p.ownClient.events().includes('challan.created'), 'the owning client receives challan.created');
  assert.ok(p.assignedDriver.events().includes('challan.created'), 'the assigned driver receives challan.created');
  assert.ok(p.admin.events().includes('challan.created'), 'staff receive challan.created');
  assert.ok(!p.otherClient.events().includes('challan.created'), "another company's client must NOT receive it");
  assert.ok(!p.unassignedDriver.events().includes('challan.created'), 'an unassigned driver must NOT receive it');
});

test('POST /api/challans for an order also fires order.updated scoped to that order\'s client', async () => {
  const ownClient = await createClient('Acme Co');
  const otherClient = await createClient('Globex');
  const assignedDriver = await createDriver('Assigned Driver');
  const unassignedDriver = await createDriver('Unassigned Driver');
  const dispatcher = await createUser({ role: 'dispatcher', email: 'dispatch@test.com' });
  const order = await createOrder(ownClient.id, 'pending');

  const p = openPanel({
    ownClientId: ownClient.id,
    otherClientId: otherClient.id,
    assignedDriverId: assignedDriver.id,
    unassignedDriverId: unassignedDriver.id,
  });

  const res = await request(app)
    .post('/api/challans')
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`)
    .send({ orderId: order.id, clientId: ownClient.id, driverId: assignedDriver.id, grade: 'M25', quantity: '6' });

  assert.equal(res.status, 201);

  // The owning client sees the order move to in_progress; the wrong company never does.
  assert.ok(p.ownClient.events().includes('order.updated'), 'the owning client receives the order.updated');
  assert.ok(p.admin.events().includes('order.updated'), 'staff receive the order.updated');
  assert.ok(!p.otherClient.events().includes('order.updated'), "another company's client must NOT receive order.updated");
  assert.ok(!p.unassignedDriver.events().includes('order.updated'), 'an unassigned driver must NOT receive order.updated');
});

test('PUT /api/challans/:id (dispatcher edit) toasts the owning client, assigned driver and staff only', async () => {
  const ownClient = await createClient('Acme Co');
  const otherClient = await createClient('Globex');
  const assignedDriver = await createDriver('Assigned Driver');
  const unassignedDriver = await createDriver('Unassigned Driver');
  const dispatcher = await createUser({ role: 'dispatcher', email: 'dispatch@test.com' });

  const [challan] = await db.insert(challans).values({
    challanNo: 'CH-R001', clientId: ownClient.id, driverId: assignedDriver.id,
    grade: 'M25', quantity: '6.00', status: 'pending', dispatchTime: new Date(),
  }).returning();

  const p = openPanel({
    ownClientId: ownClient.id,
    otherClientId: otherClient.id,
    assignedDriverId: assignedDriver.id,
    unassignedDriverId: unassignedDriver.id,
  });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`)
    .send({ status: 'dispatched', notes: 'On the way' });

  assert.equal(res.status, 200);

  assert.ok(p.ownClient.events().includes('challan.updated'), 'the owning client receives challan.updated');
  assert.ok(p.assignedDriver.events().includes('challan.updated'), 'the assigned driver receives challan.updated');
  assert.ok(p.admin.events().includes('challan.updated'), 'staff receive challan.updated');
  assert.ok(!p.otherClient.events().includes('challan.updated'), "another company's client must NOT receive it");
  assert.ok(!p.unassignedDriver.events().includes('challan.updated'), 'an unassigned driver must NOT receive it');
});

test('PUT /api/challans/:id (driver delivery) toasts the owning client, the delivering driver and staff only', async () => {
  const ownClient = await createClient('Acme Co');
  const otherClient = await createClient('Globex');
  const assignedDriver = await createDriver('Dave Driver');
  const unassignedDriver = await createDriver('Other Driver');
  // The driver branch matches a drivers row by the user's name, so they align.
  const driverUser = await createUser({
    role: 'driver', email: 'dave@test.com', name: 'Dave Driver',
    linkedDriverId: assignedDriver.id,
  });

  const [challan] = await db.insert(challans).values({
    challanNo: 'CH-R002', clientId: ownClient.id, driverId: assignedDriver.id,
    grade: 'M25', quantity: '6.00', status: 'dispatched', dispatchTime: new Date(),
  }).returning();

  const p = openPanel({
    ownClientId: ownClient.id,
    otherClientId: otherClient.id,
    assignedDriverId: assignedDriver.id,
    unassignedDriverId: unassignedDriver.id,
  });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(driverUser)}`)
    .send({ status: 'delivered' });

  assert.equal(res.status, 200);

  assert.ok(p.ownClient.events().includes('challan.updated'), 'the owning client receives the delivery toast');
  assert.ok(p.assignedDriver.events().includes('challan.updated'), 'the delivering driver receives the toast');
  assert.ok(p.admin.events().includes('challan.updated'), 'staff receive the delivery toast');
  assert.ok(!p.otherClient.events().includes('challan.updated'), "another company's client must NOT receive it");
  assert.ok(!p.unassignedDriver.events().includes('challan.updated'), 'an unassigned driver must NOT receive it');
});
