import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders, challans, challanProofPhotos, plants, vehicles, batchRecords, fuelLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;

const PASSWORD = 'secret123';

let plantSeq = 0;
async function createPlant(overrides: Partial<typeof plants.$inferInsert> = {}) {
  plantSeq += 1;
  const [row] = await db.insert(plants).values({
    plantCode: `PLT-${String(plantSeq).padStart(3, '0')}`,
    name: `Plant ${plantSeq}`,
    legalName: `Plant ${plantSeq} Concrete Pvt Ltd`,
    gstNo: `27AAACA${String(plantSeq).padStart(4, '0')}B1Z5`,
    email: `plant${plantSeq}@test.com`,
    latitude: '19.0000000',
    longitude: '72.0000000',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    verified: true,
    networkStatus: 'active',
    grades: ['M25', 'M30'],
    ...overrides,
  }).returning();
  return row;
}

async function createUser(
  role: string, email: string,
  opts: { plantId?: number | null; linkedClientId?: number | null } = {},
) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name: `${role} user`, email, passwordHash, role: role as 'admin',
    isActive: true,
    plantId: opts.plantId ?? null,
    linkedClientId: opts.linkedClientId ?? null,
    kycStatus: role === 'client' ? 'verified' : undefined,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string; plantId?: number | null }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name, plantId: u.plantId ?? null });
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE plant_customers, challans, orders, clients, audit_logs, users, login_attempts, fuel_logs, batch_records, vehicles, plants RESTART IDENTITY CASCADE`,
  );
  plantSeq = 0;
});

after(async () => {
  await pool.end();
});

test('the same customer ordering at two plants gets two distinct per-plant client rows and codes', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'cust@test.com');
  const auth = `Bearer ${tokenFor(customer)}`;

  const resA = await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  assert.equal(resA.status, 201);

  const resB = await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ plantId: plantB.id, grade: 'M30', quantity: 8, deliveryDate: '2026-06-21' });
  assert.equal(resB.status, 201);

  // Distinct client rows, distinct plants.
  assert.notEqual(resA.body.clientId, resB.body.clientId);
  assert.equal(resA.body.plantId, plantA.id);
  assert.equal(resB.body.plantId, plantB.id);

  // Each per-plant client is named by its plant-namespaced customer code, never
  // the customer's real name, and the codes differ across plants.
  const rows = await db.select({ id: clients.id, plantId: clients.plantId, customerCode: clients.customerCode })
    .from(clients);
  assert.equal(rows.length, 2);
  const codeA = rows.find(r => r.plantId === plantA.id)!.customerCode;
  const codeB = rows.find(r => r.plantId === plantB.id)!.customerCode;
  assert.ok(codeA && codeB);
  assert.notEqual(codeA, codeB);
  assert.match(codeA!, new RegExp(`^${plantA.plantCode}-C\\d{4}$`));
  assert.match(codeB!, new RegExp(`^${plantB.plantCode}-C\\d{4}$`));
});

test('ordering twice at the same plant reuses the one per-plant client (no duplicate code)', async () => {
  const plantA = await createPlant();
  const customer = await createUser('client', 'repeat@test.com');
  const auth = `Bearer ${tokenFor(customer)}`;

  const r1 = await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  const r2 = await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ plantId: plantA.id, grade: 'M30', quantity: 4, deliveryDate: '2026-06-22' });

  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);
  assert.equal(r1.body.clientId, r2.body.clientId);

  const rows = await db.select({ id: clients.id }).from(clients);
  assert.equal(rows.length, 1);
});

test('a customer sees their orders aggregated across every plant', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'multi@test.com');
  const auth = `Bearer ${tokenFor(customer)}`;

  await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  await request(app).post('/api/me/orders').set('Authorization', auth)
    .send({ plantId: plantB.id, grade: 'M30', quantity: 8, deliveryDate: '2026-06-21' });

  const list = await request(app).get('/api/me/orders').set('Authorization', auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
  const plantIds = list.body.map((o: { plantId: number }) => o.plantId).sort();
  assert.deepEqual(plantIds, [plantA.id, plantB.id].sort());
  // Each order carries its issuing plant's name for the customer's cross-plant view.
  for (const o of list.body) {
    assert.ok(o.plantName, 'order should carry plantName');
  }
});

test('plant-scoped staff only list orders from their own plant', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'iso@test.com');
  const custAuth = `Bearer ${tokenFor(customer)}`;

  await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantB.id, grade: 'M30', quantity: 8, deliveryDate: '2026-06-21' });

  // The staff list does not expose plantId, but a plant only ever knows its own
  // customers by their plant-namespaced code, so the returned clientName proves
  // the row belongs to that plant's tenant.
  const staffA = await createUser('admin', 'staffA@test.com', { plantId: plantA.id });
  const listA = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(listA.status, 200);
  assert.equal(listA.body.length, 1);
  assert.match(listA.body[0].clientName, new RegExp(`^${plantA.plantCode}-C\\d{4}$`));

  const staffB = await createUser('admin', 'staffB@test.com', { plantId: plantB.id });
  const listB = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(listB.status, 200);
  assert.equal(listB.body.length, 1);
  assert.match(listB.body[0].clientName, new RegExp(`^${plantB.plantCode}-C\\d{4}$`));
});

test('plant-scoped staff cannot fetch another plant\'s order by id', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'iso2@test.com');
  const custAuth = `Bearer ${tokenFor(customer)}`;

  const order = await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  const orderId = order.body.id;

  const staffB = await createUser('admin', 'staffB2@test.com', { plantId: plantB.id });
  const res = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(res.status, 404);

  // The owning plant's staff can read it.
  const staffA = await createUser('admin', 'staffA2@test.com', { plantId: plantA.id });
  const ok = await request(app).get(`/api/orders/${orderId}`).set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.id, orderId);
});

test('a legacy global admin (null plantId) sees orders across all plants', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'iso3@test.com');
  const custAuth = `Bearer ${tokenFor(customer)}`;

  await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantB.id, grade: 'M30', quantity: 8, deliveryDate: '2026-06-21' });

  const globalAdmin = await createUser('admin', 'global@test.com', { plantId: null });
  const list = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
});

test('a challan carries the issuing plant\'s company identity in its detail', async () => {
  const plantA = await createPlant({ name: 'North Plant', legalName: 'North Concrete Pvt Ltd' });
  const [client] = await db.insert(clients).values({
    plantId: plantA.id, customerCode: `${plantA.plantCode}-C0001`, name: `${plantA.plantCode}-C0001`,
    contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  const [ch] = await db.insert(challans).values({
    challanNo: 'CHL-001', plantId: plantA.id, clientId: client.id,
    grade: 'M25', quantity: '10.00',
  }).returning();

  const staffA = await createUser('admin', 'staffIdentity@test.com', { plantId: plantA.id });
  const res = await request(app).get(`/api/challans/${ch.id}`).set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.plantName, 'North Plant');
  assert.equal(res.body.plantLegalName, 'North Concrete Pvt Ltd');
  assert.equal(res.body.plantCode, plantA.plantCode);
});

test('plant-scoped staff cannot read another plant\'s challan by id', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const [client] = await db.insert(clients).values({
    plantId: plantA.id, customerCode: `${plantA.plantCode}-C0001`, name: `${plantA.plantCode}-C0001`,
    contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  const [ch] = await db.insert(challans).values({
    challanNo: 'CHL-010', plantId: plantA.id, clientId: client.id,
    grade: 'M25', quantity: '10.00',
  }).returning();

  const staffB = await createUser('admin', 'staffBchallan@test.com', { plantId: plantB.id });
  const res = await request(app).get(`/api/challans/${ch.id}`).set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(res.status, 404);
});

test('plant-scoped staff cannot bind a challan to (or mutate) another plant\'s order', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'crossorder@test.com');
  const custAuth = `Bearer ${tokenFor(customer)}`;

  const orderRes = await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantA.id, grade: 'M25', quantity: 10, deliveryDate: '2026-06-20' });
  assert.equal(orderRes.status, 201);
  const foreignOrderId = orderRes.body.id;
  const statusBefore = orderRes.body.status;

  // plantB staff also has a client of their own to issue challans against.
  const [clientB] = await db.insert(clients).values({
    plantId: plantB.id, customerCode: `${plantB.plantCode}-C0001`, name: `${plantB.plantCode}-C0001`,
    contactPerson: 'Bob', phone: '4445556666',
  }).returning();

  const staffB = await createUser('admin', 'staffBcross@test.com', { plantId: plantB.id });
  const res = await request(app).post('/api/challans').set('Authorization', `Bearer ${tokenFor(staffB)}`)
    .send({ orderId: foreignOrderId, clientId: clientB.id, grade: 'M25', quantity: 5 });
  assert.equal(res.status, 404, 'attaching a foreign-plant order is rejected');

  // No challan was created and plant A\'s order status is untouched.
  const madeChallans = await db.select({ id: challans.id }).from(challans);
  assert.equal(madeChallans.length, 0, 'no cross-tenant challan is created');
  const [orderAfter] = await db.select({ status: orders.status }).from(orders);
  assert.equal(orderAfter.status, statusBefore, 'the foreign order status is not mutated');
});

test('deleting another plant\'s challan by id neither removes the row nor its proof photos', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const [client] = await db.insert(clients).values({
    plantId: plantA.id, customerCode: `${plantA.plantCode}-C0001`, name: `${plantA.plantCode}-C0001`,
    contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  const [ch] = await db.insert(challans).values({
    challanNo: 'CHL-020', plantId: plantA.id, clientId: client.id,
    grade: 'M25', quantity: '10.00',
  }).returning();
  await db.insert(challanProofPhotos).values({ challanId: ch.id, photo: '/objects/proof-a.jpg' });

  const staffB = await createUser('admin', 'staffBdelete@test.com', { plantId: plantB.id });
  const res = await request(app).delete(`/api/challans/${ch.id}`).set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, false, 'the scoped delete reports nothing was removed');

  // The challan and its proof-photo rows survive the cross-tenant delete attempt.
  const remaining = await db.select({ id: challans.id }).from(challans);
  assert.equal(remaining.length, 1, 'the foreign plant\'s challan is preserved');
  const photos = await db.select({ id: challanProofPhotos.id }).from(challanProofPhotos);
  assert.equal(photos.length, 1, 'the foreign plant\'s proof photos are preserved');

  // The owning plant\'s staff can delete it for real.
  const staffA = await createUser('admin', 'staffAdelete@test.com', { plantId: plantA.id });
  const ok = await request(app).delete(`/api/challans/${ch.id}`).set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ok, true);
  const gone = await db.select({ id: challans.id }).from(challans);
  assert.equal(gone.length, 0);
});

test('a customer cannot reach the staff orders surface', async () => {
  await createPlant();
  const customer = await createUser('client', 'noorders@test.com');
  const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(res.status, 403, 'the staff /api/orders surface is closed to customers');
});

test('plant-scoped staff only see their own plant\'s clients and cannot read a foreign one', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const [clientA] = await db.insert(clients).values({
    plantId: plantA.id, customerCode: `${plantA.plantCode}-C0001`, name: `${plantA.plantCode}-C0001`,
    contactPerson: 'A', phone: '1112223333',
  }).returning();
  const [clientB] = await db.insert(clients).values({
    plantId: plantB.id, customerCode: `${plantB.plantCode}-C0001`, name: `${plantB.plantCode}-C0001`,
    contactPerson: 'B', phone: '4445556666',
  }).returning();

  const staffA = await createUser('admin', 'clientscopeA@test.com', { plantId: plantA.id });
  const authA = `Bearer ${tokenFor(staffA)}`;

  const list = await request(app).get('/api/clients').set('Authorization', authA);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1, 'the list is scoped to the actor\'s plant');
  assert.equal(list.body[0].id, clientA.id);

  // Every per-client surface refuses a foreign id with a 404 (never reveals it).
  for (const path of [`/api/clients/${clientB.id}`, `/api/clients/${clientB.id}/ledger`, `/api/clients/${clientB.id}/sites`]) {
    const res = await request(app).get(path).set('Authorization', authA);
    assert.equal(res.status, 404, `${path} is denied cross-tenant`);
  }
});

test('a customer cannot reach the staff clients surface', async () => {
  await createPlant();
  const customer = await createUser('client', 'noclients@test.com');
  const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(res.status, 403, 'the staff /api/clients surface is closed to customers');
});

test('a customer cannot reach the staff challan surface (they have /api/me/challans)', async () => {
  const plant = await createPlant();
  const [client] = await db.insert(clients).values({
    plantId: plant.id, customerCode: `${plant.plantCode}-C0001`, name: `${plant.plantCode}-C0001`,
    contactPerson: 'A', phone: '1112223333',
  }).returning();
  const [challan] = await db.insert(challans).values({
    challanNo: 'CH-9001', clientId: client.id, plantId: plant.id, grade: 'M25',
    quantity: '5', status: 'dispatched', dispatchTime: new Date(),
  }).returning();

  // A customer has a null plantId, so the staff surface would NOT isolate them —
  // it must therefore be closed to them entirely (both list and detail), foreign
  // or own id alike.
  const customer = await createUser('client', 'nochallans@test.com');
  const auth = `Bearer ${tokenFor(customer)}`;
  const list = await request(app).get('/api/challans').set('Authorization', auth);
  assert.equal(list.status, 403, 'the staff /api/challans list is closed to customers');
  const detail = await request(app).get(`/api/challans/${challan.id}`).set('Authorization', auth);
  assert.equal(detail.status, 403, 'the staff /api/challans/:id detail is closed to customers');

  // The /left-site mutation must deny the role BEFORE touching the DB, so a
  // customer cannot distinguish an existing foreign challan from a missing id.
  const existing = await request(app).post(`/api/challans/${challan.id}/left-site`).set('Authorization', auth).send({});
  const missing = await request(app).post('/api/challans/99999999/left-site').set('Authorization', auth).send({});
  assert.equal(existing.status, 403, 'left-site is forbidden to customers');
  assert.equal(missing.status, existing.status, 'left-site gives no existence oracle (same status for real vs missing id)');
});

test('plant-scoped staff cannot create an order or challan against another plant\'s client', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const [clientA] = await db.insert(clients).values({
    plantId: plantA.id, customerCode: `${plantA.plantCode}-C0001`, name: `${plantA.plantCode}-C0001`,
    contactPerson: 'A', phone: '1112223333',
  }).returning();

  const staffB = await createUser('admin', 'foreignbind@test.com', { plantId: plantB.id });
  const authB = `Bearer ${tokenFor(staffB)}`;

  const order = await request(app).post('/api/orders').set('Authorization', authB)
    .send({ clientId: clientA.id, grade: 'M25', quantity: 5, deliveryDate: '2026-06-20' });
  assert.equal(order.status, 404, 'binding an order to a foreign client is rejected');

  const challan = await request(app).post('/api/challans').set('Authorization', authB)
    .send({ clientId: clientA.id, grade: 'M25', quantity: 5 });
  assert.equal(challan.status, 404, 'issuing a challan to a foreign client is rejected');

  assert.equal((await db.select({ id: orders.id }).from(orders)).length, 0, 'no cross-tenant order is created');
  assert.equal((await db.select({ id: challans.id }).from(challans)).length, 0, 'no cross-tenant challan is created');
});

// Helper: seed one delivered challan for a plant's lone customer so the report
// and KPI aggregates have a non-zero figure to (not) leak across tenants.
async function seedChallan(plantId: number, plantCode: string, qty: number) {
  const [client] = await db.insert(clients).values({
    plantId, customerCode: `${plantCode}-C0001`, name: `${plantCode}-C0001`,
    contactPerson: 'C', phone: '9990001111',
  }).returning();
  await db.insert(challans).values({
    plantId, clientId: client.id, challanNo: `${plantCode}-CH1`,
    grade: 'M25', quantity: String(qty), deliveredQuantity: String(qty), status: 'delivered',
  });
  return client;
}

test('plant-scoped staff reports aggregate only their own plant (no cross-tenant figures)', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  await seedChallan(plantA.id, plantA.plantCode!, 10);
  await seedChallan(plantB.id, plantB.plantCode!, 99);

  const staffA = await createUser('admin', 'repA@test.com', { plantId: plantA.id });
  const authA = `Bearer ${tokenFor(staffA)}`;

  const clientWise = await request(app).get('/api/reports/client-wise').set('Authorization', authA);
  assert.equal(clientWise.status, 200);
  assert.equal(clientWise.body.length, 1, 'only this plant\'s client appears');
  assert.match(clientWise.body[0].clientName, new RegExp(`^${plantA.plantCode}-C\\d{4}$`));
  assert.equal(Number(clientWise.body[0].totalQty), 10);

  const gradeWise = await request(app).get('/api/reports/grade-wise').set('Authorization', authA);
  assert.equal(gradeWise.status, 200);
  const totalQty = gradeWise.body.reduce((s: number, r: { totalQty: number }) => s + Number(r.totalQty), 0);
  assert.equal(totalQty, 10, 'grade totals exclude the other plant\'s 99');

  const dispatch = await request(app).get('/api/reports/dispatch').set('Authorization', authA);
  assert.equal(dispatch.status, 200);
  const dispatchQty = dispatch.body.reduce((s: number, r: { totalQty: number }) => s + Number(r.totalQty), 0);
  assert.equal(dispatchQty, 10, 'dispatch totals exclude the other plant');
});

test('a customer cannot reach the staff reports surface', async () => {
  const plant = await createPlant();
  await seedChallan(plant.id, plant.plantCode!, 10);
  const customer = await createUser('client', 'repcust@test.com');
  const auth = `Bearer ${tokenFor(customer)}`;

  for (const path of ['/api/reports/client-wise', '/api/reports/grade-wise', '/api/reports/dispatch', '/api/reports/export', '/api/reports/production', '/api/reports/trip-timing']) {
    const res = await request(app).get(path).set('Authorization', auth);
    assert.equal(res.status, 403, `${path} is forbidden for a customer`);
  }
  // The plant-agnostic variance-tolerance config stays readable by any user.
  const variance = await request(app).get('/api/reports/variance-tolerance').set('Authorization', auth);
  assert.equal(variance.status, 200);
});

test('dashboard KPIs are plant-scoped and closed to customers', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  await seedChallan(plantA.id, plantA.plantCode!, 10);
  await seedChallan(plantB.id, plantB.plantCode!, 99);

  const staffA = await createUser('admin', 'kpiA@test.com', { plantId: plantA.id });
  const kpis = await request(app).get('/api/dashboard/kpis').set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(kpis.status, 200);
  assert.equal(Number(kpis.body.todayDispatch), 10, 'dispatch KPI excludes the other plant');
  assert.equal(Number(kpis.body.totalClients), 1, 'client count excludes the other plant');

  const customer = await createUser('client', 'kpicust@test.com');
  const denied = await request(app).get('/api/dashboard/kpis').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(denied.status, 403, 'a customer cannot read plant KPIs');
});

test('demand forecast is plant-scoped: plant A staff cannot see plant B\'s booked demand', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const customer = await createUser('client', 'fccust@test.com');
  const custAuth = `Bearer ${tokenFor(customer)}`;

  // Only plant B has a booked order on the target day.
  const target = '2026-07-15';
  await request(app).post('/api/me/orders').set('Authorization', custAuth)
    .send({ plantId: plantB.id, grade: 'M25', quantity: 40, deliveryDate: target });

  // Plant A staff forecast for that day must not reflect plant B's 40 m³.
  const staffA = await createUser('admin', 'fcA@test.com', { plantId: plantA.id });
  const fcA = await request(app).get(`/api/reports/forecast?date=${target}`)
    .set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(fcA.status, 200);
  assert.equal(Number(fcA.body.totalBooked), 0, 'plant A sees none of plant B\'s booked demand');

  // Plant B staff (and a legacy null-plant admin) do see it.
  const staffB = await createUser('admin', 'fcB@test.com', { plantId: plantB.id });
  const fcB = await request(app).get(`/api/reports/forecast?date=${target}`)
    .set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(fcB.status, 200);
  assert.equal(Number(fcB.body.totalBooked), 40, 'plant B sees its own booked demand');

  const globalAdmin = await createUser('admin', 'fcglobal@test.com', { plantId: null });
  const fcG = await request(app).get(`/api/reports/forecast?date=${target}`)
    .set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(fcG.status, 200);
  assert.equal(Number(fcG.body.totalBooked), 40, 'a legacy global admin still sees all plants');
});

test('fuel reconciliation is plant-scoped: a plant only sees its own vehicles\' KM', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();

  // Each plant owns its own vehicle now; the reconciliation table only iterates
  // the actor's own fleet, so a foreign plant's truck never appears.
  const [vehicleA] = await db.insert(vehicles).values({
    plantId: plantA.id, vehicleNo: 'FR-A-1', capacity: '6.00', mileageKmpl: '4.00',
  }).returning();
  const [vehicleB] = await db.insert(vehicles).values({
    plantId: plantB.id, vehicleNo: 'FR-B-1', capacity: '6.00', mileageKmpl: '4.00',
  }).returning();

  const seedTrip = async (plantId: number, plantCode: string, vehicleId: number, km: number) => {
    const [client] = await db.insert(clients).values({
      plantId, customerCode: `${plantCode}-C0001`, name: `${plantCode}-C0001`,
      contactPerson: 'C', phone: '9990001111',
    }).returning();
    await db.insert(challans).values({
      plantId, clientId: client.id, vehicleId, challanNo: `${plantCode}-FR1`,
      grade: 'M25', quantity: '10', status: 'delivered',
      odometerStart: 0, odometerEnd: km,
    });
  };
  await seedTrip(plantA.id, plantA.plantCode!, vehicleA.id, 100);
  await seedTrip(plantB.id, plantB.plantCode!, vehicleB.id, 500);

  const kmFor = (body: { rows: { vehicleId: number; km: number }[] }, vid: number) =>
    Number(body.rows.find(r => r.vehicleId === vid)?.km ?? 0);
  const hasVehicle = (body: { rows: { vehicleId: number }[] }, vid: number) =>
    body.rows.some(r => r.vehicleId === vid);

  const staffA = await createUser('admin', 'frA@test.com', { plantId: plantA.id });
  const frA = await request(app).get('/api/reports/fuel-reconciliation')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(frA.status, 200);
  assert.equal(kmFor(frA.body, vehicleA.id), 100, 'plant A sees its own vehicle\'s KM');
  assert.equal(hasVehicle(frA.body, vehicleB.id), false, 'plant A never sees plant B\'s vehicle');

  const staffB = await createUser('admin', 'frB@test.com', { plantId: plantB.id });
  const frB = await request(app).get('/api/reports/fuel-reconciliation')
    .set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(frB.status, 200);
  assert.equal(kmFor(frB.body, vehicleB.id), 500, 'plant B sees its own vehicle\'s KM');
  assert.equal(hasVehicle(frB.body, vehicleA.id), false, 'plant B never sees plant A\'s vehicle');

  const globalAdmin = await createUser('admin', 'frglobal@test.com', { plantId: null });
  const frG = await request(app).get('/api/reports/fuel-reconciliation')
    .set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(frG.status, 200);
  assert.equal(kmFor(frG.body, vehicleA.id), 100, 'a legacy global admin sees plant A\'s vehicle');
  assert.equal(kmFor(frG.body, vehicleB.id), 500, 'a legacy global admin sees plant B\'s vehicle');

  // The CSV export path must enforce the same scoping.
  const csvA = await request(app).get('/api/reports/export?report=fuel-reconciliation')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(csvA.status, 200);
  assert.match(csvA.text, /FR-A-1",100,/, 'plant A CSV reflects its own vehicle\'s KM');
  assert.doesNotMatch(csvA.text, /FR-B-1/, 'plant A CSV never shows plant B\'s vehicle');

  const csvB = await request(app).get('/api/reports/export?report=fuel-reconciliation')
    .set('Authorization', `Bearer ${tokenFor(staffB)}`);
  assert.equal(csvB.status, 200);
  assert.match(csvB.text, /FR-B-1",500,/, 'plant B CSV reflects its own vehicle\'s KM');
  assert.doesNotMatch(csvB.text, /FR-A-1/, 'plant B CSV never shows plant A\'s vehicle');
});

// ----- FLEET (vehicles) isolation -----

async function createVehicle(plantId: number | null, vehicleNo: string) {
  const [row] = await db.insert(vehicles).values({
    plantId, vehicleNo, capacity: '6.00',
  }).returning();
  return row;
}

test('plant-scoped staff only list their own plant\'s vehicles (fleet)', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const vA = await createVehicle(plantA.id, 'A-TRUCK-1');
  await createVehicle(plantB.id, 'B-TRUCK-1');

  const staffA = await createUser('admin', 'fleetA@test.com', { plantId: plantA.id });
  const list = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1, 'the fleet list is scoped to the actor\'s plant');
  assert.equal(list.body[0].id, vA.id);
  assert.equal(list.body[0].vehicleNo, 'A-TRUCK-1');
});

test('plant-scoped staff cannot read, edit or delete another plant\'s vehicle', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const vB = await createVehicle(plantB.id, 'B-TRUCK-9');

  const staffA = await createUser('admin', 'fleetcrossA@test.com', { plantId: plantA.id });
  const authA = `Bearer ${tokenFor(staffA)}`;

  const detail = await request(app).get(`/api/vehicles/${vB.id}`).set('Authorization', authA);
  assert.equal(detail.status, 404, 'a foreign vehicle detail is denied');

  const edit = await request(app).put(`/api/vehicles/${vB.id}`).set('Authorization', authA)
    .send({ vehicleNo: 'HACKED', capacity: '8.00', status: 'active' });
  assert.equal(edit.status, 404, 'a foreign vehicle cannot be edited');

  const del = await request(app).delete(`/api/vehicles/${vB.id}`).set('Authorization', authA);
  assert.equal(del.status, 200);
  assert.equal(del.body.ok, false, 'the scoped delete reports nothing was removed');

  const [survivor] = await db.select({ vehicleNo: vehicles.vehicleNo }).from(vehicles);
  assert.equal(survivor.vehicleNo, 'B-TRUCK-9', 'the foreign vehicle survives untouched');
});

test('creating a vehicle stamps the creating staff\'s plant', async () => {
  const plantA = await createPlant();
  const staffA = await createUser('admin', 'fleetcreate@test.com', { plantId: plantA.id });
  const res = await request(app).post('/api/vehicles').set('Authorization', `Bearer ${tokenFor(staffA)}`)
    .send({ vehicleNo: 'NEW-1', capacity: '7.00' });
  assert.equal(res.status, 201);
  const [row] = await db.select({ plantId: vehicles.plantId }).from(vehicles);
  assert.equal(row.plantId, plantA.id, 'the new vehicle is private to the creating plant');
});

test('a customer gets a redacted fleet read and cannot write to it', async () => {
  const plantA = await createPlant();
  await createVehicle(plantA.id, 'CUST-VIEW-1');
  const customer = await createUser('client', 'nofleet@test.com');
  const auth = `Bearer ${tokenFor(customer)}`;

  // Clients keep the long-standing redacted read access (diesel baselines hidden)
  // — covered in detail by diesel-leak.test.ts — but the write surface is closed.
  const list = await request(app).get('/api/vehicles').set('Authorization', auth);
  assert.equal(list.status, 200);
  assert.equal('mileageKmpl' in (list.body[0] ?? {}), false, 'diesel baselines are hidden from customers');

  const write = await request(app).post('/api/vehicles').set('Authorization', auth)
    .send({ vehicleNo: 'X-1', capacity: '6.00' });
  assert.equal(write.status, 403, 'the fleet write surface is closed to customers');
});

test('a legacy global admin (null plantId) sees every plant\'s vehicles', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  await createVehicle(plantA.id, 'GA-1');
  await createVehicle(plantB.id, 'GB-1');
  const globalAdmin = await createUser('admin', 'fleetglobal@test.com', { plantId: null });
  const list = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
});

test('fuel logs are plant-scoped to the vehicle\'s owning plant', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const vA = await createVehicle(plantA.id, 'FUEL-A-1');
  const vB = await createVehicle(plantB.id, 'FUEL-B-1');
  await db.insert(fuelLogs).values({ vehicleId: vA.id, litres: '50', filledAt: new Date() });
  const [logB] = await db.insert(fuelLogs).values({ vehicleId: vB.id, litres: '80', filledAt: new Date() }).returning();

  const staffA = await createUser('admin', 'fuelA@test.com', { plantId: plantA.id });
  const authA = `Bearer ${tokenFor(staffA)}`;

  const list = await request(app).get('/api/fuel').set('Authorization', authA);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1, 'fuel list shows only the actor plant\'s vehicle logs');
  assert.equal(list.body[0].vehicleNo, 'FUEL-A-1');

  const detail = await request(app).get(`/api/fuel/${logB.id}`).set('Authorization', authA);
  assert.equal(detail.status, 404, 'a foreign fuel-log detail is denied');

  const create = await request(app).post('/api/fuel').set('Authorization', authA)
    .send({ vehicleId: vB.id, litres: 10 });
  assert.equal(create.status, 400, 'cannot log fuel against another plant\'s vehicle');
});

// ----- PRODUCTION (batch records) isolation -----

async function createBatch(plantId: number | null, batchNo: string, qty: number) {
  const [row] = await db.insert(batchRecords).values({
    plantId, batchNo, grade: 'M25', quantity: String(qty),
  }).returning();
  return row;
}

test('plant-scoped staff only list their own plant\'s batch records (production)', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const bA = await createBatch(plantA.id, 'A-BTH-1', 10);
  await createBatch(plantB.id, 'B-BTH-1', 99);

  const staffA = await createUser('admin', 'prodA@test.com', { plantId: plantA.id });
  const authA = `Bearer ${tokenFor(staffA)}`;
  const list = await request(app).get('/api/batches').set('Authorization', authA);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1, 'the production list is scoped to the actor\'s plant');
  assert.equal(list.body[0].id, bA.id);

  const summary = await request(app).get('/api/batches/summary').set('Authorization', authA);
  assert.equal(summary.status, 200);
  assert.equal(Number(summary.body.totalQty), 10, 'the summary excludes the other plant\'s 99');
});

test('plant-scoped staff cannot read, edit or delete another plant\'s batch record', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const bB = await createBatch(plantB.id, 'B-BTH-9', 50);

  const staffA = await createUser('admin', 'prodcrossA@test.com', { plantId: plantA.id });
  const authA = `Bearer ${tokenFor(staffA)}`;

  const detail = await request(app).get(`/api/batches/${bB.id}`).set('Authorization', authA);
  assert.equal(detail.status, 404, 'a foreign batch detail is denied');

  const edit = await request(app).put(`/api/batches/${bB.id}`).set('Authorization', authA)
    .send({ grade: 'M40', quantity: '1' });
  assert.equal(edit.status, 404, 'a foreign batch cannot be edited');

  const del = await request(app).delete(`/api/batches/${bB.id}`).set('Authorization', authA);
  assert.equal(del.status, 200);
  assert.equal(del.body.ok, false, 'the scoped delete reports nothing was removed');

  const [survivor] = await db.select({ batchNo: batchRecords.batchNo, quantity: batchRecords.quantity }).from(batchRecords);
  assert.equal(survivor.batchNo, 'B-BTH-9');
  assert.equal(Number(survivor.quantity), 50, 'the foreign batch is unmodified');
});

test('creating a batch stamps the creating staff\'s plant', async () => {
  const plantA = await createPlant();
  const operator = await createUser('plant_operator', 'prodcreate@test.com', { plantId: plantA.id });
  const res = await request(app).post('/api/batches').set('Authorization', `Bearer ${tokenFor(operator)}`)
    .send({ grade: 'M25', quantity: '12' });
  assert.equal(res.status, 201);
  assert.equal(res.body.plantId, plantA.id, 'the new batch is private to the creating plant');
});

test('a customer cannot reach the staff production surface', async () => {
  await createPlant();
  const customer = await createUser('client', 'noprod@test.com');
  const res = await request(app).get('/api/batches').set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(res.status, 403, 'the staff /api/batches surface is closed to customers');
});

test('a legacy global admin (null plantId) sees every plant\'s batch records', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  await createBatch(plantA.id, 'GA-BTH-1', 10);
  await createBatch(plantB.id, 'GB-BTH-1', 20);
  const globalAdmin = await createUser('admin', 'prodglobal@test.com', { plantId: null });
  const list = await request(app).get('/api/batches').set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 2);
});

test('dashboard fleet & production KPIs are plant-scoped', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  await createVehicle(plantA.id, 'KA-1');
  await createVehicle(plantB.id, 'KB-1');
  await createVehicle(plantB.id, 'KB-2');
  await createBatch(plantA.id, 'KA-BTH-1', 10);
  await createBatch(plantB.id, 'KB-BTH-1', 99);

  const staffA = await createUser('admin', 'kpifleetA@test.com', { plantId: plantA.id });
  const kpis = await request(app).get('/api/dashboard/kpis').set('Authorization', `Bearer ${tokenFor(staffA)}`);
  assert.equal(kpis.status, 200);
  assert.equal(Number(kpis.body.totalVehicles), 1, 'the fleet KPI counts only the actor\'s plant');
  assert.equal(Number(kpis.body.todayProduction), 10, 'the production KPI excludes the other plant');
});
