import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, sites, drivers, vehicles, challans } from '../db/schema.js';
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

async function createDriver(name: string) {
  const [row] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  return row;
}

async function createVehicle(vehicleNo: string) {
  const [row] = await db.insert(vehicles).values({ vehicleNo, capacity: '6.00' }).returning();
  return row;
}

let challanSeq = 0;
async function createChallan(opts: {
  clientId: number;
  siteId?: number | null;
  driverId?: number | null;
  vehicleId?: number | null;
  status?: 'pending' | 'dispatched' | 'delivered' | 'cancelled';
  grade?: string;
  quantity?: string;
  deliveredQuantity?: string | null;
  pumpRequired?: boolean;
  notes?: string | null;
}) {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-E${String(challanSeq).padStart(4, '0')}`,
    clientId: opts.clientId,
    siteId: opts.siteId ?? null,
    driverId: opts.driverId ?? null,
    vehicleId: opts.vehicleId ?? null,
    grade: opts.grade ?? 'M25',
    quantity: opts.quantity ?? '6.00',
    deliveredQuantity: opts.deliveredQuantity ?? null,
    pumpRequired: opts.pumpRequired ?? false,
    status: opts.status ?? 'dispatched',
    notes: opts.notes ?? null,
    dispatchTime: new Date(),
  }).returning();
  return row;
}

async function readChallan(id: number) {
  const [row] = await db.select().from(challans).where(eq(challans.id, id));
  return row;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, sites, drivers, vehicles, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

// A partial edit that only touches one field (e.g. a status change) must not
// erase the challan's other saved details. The write-role branch of PUT /:id
// only assigns columns it explicitly receives (each guarded by `!== undefined`),
// relying on Drizzle skipping omitted columns, so a minimal edit has to leave
// every other stored value intact.
test('a minimal status-only edit preserves every other saved field', async () => {
  const client = await createClient();
  const site = await createSite(client.id);
  const driver = await createDriver('Assigned Driver');
  const vehicle = await createVehicle('GJ-01-AB-1234');
  const actor = await createUser('admin', 'admin@test.com');
  const challan = await createChallan({
    clientId: client.id,
    siteId: site.id,
    driverId: driver.id,
    vehicleId: vehicle.id,
    grade: 'M30',
    quantity: '12.00',
    deliveredQuantity: '11.50',
    pumpRequired: true,
    status: 'dispatched',
    notes: 'Pour before noon',
  });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ status: 'delivered' });

  assert.equal(res.status, 200);

  const row = await readChallan(challan.id);
  assert.equal(row.status, 'delivered', 'the sent status is applied');
  assert.equal(row.clientId, client.id, 'clientId is preserved');
  assert.equal(row.siteId, site.id, 'siteId is preserved');
  assert.equal(row.driverId, driver.id, 'driverId is preserved');
  assert.equal(row.vehicleId, vehicle.id, 'vehicleId is preserved');
  assert.equal(row.grade, 'M30', 'grade is preserved');
  assert.equal(row.quantity, '12.00', 'quantity is preserved');
  assert.equal(row.deliveredQuantity, '11.50', 'deliveredQuantity is preserved');
  assert.equal(row.pumpRequired, true, 'pumpRequired is preserved');
  assert.equal(row.notes, 'Pour before noon', 'notes are preserved');
});

// Regression guard for the optional vehicle/driver links: omitting them from a
// partial save must keep the existing assignment, not coerce it to null.
for (const field of ['vehicleId', 'driverId'] as const) {
  test(`omitting ${field} keeps the saved assignment (no silent clear)`, async () => {
    const client = await createClient();
    const driver = await createDriver('Assigned Driver');
    const vehicle = await createVehicle('GJ-01-AB-1234');
    const actor = await createUser('admin', 'admin@test.com');
    const challan = await createChallan({
      clientId: client.id, driverId: driver.id, vehicleId: vehicle.id,
    });

    const res = await request(app)
      .put(`/api/challans/${challan.id}`)
      .set('Authorization', `Bearer ${tokenFor(actor)}`)
      .send({ status: 'delivered' });

    assert.equal(res.status, 200);
    const row = await readChallan(challan.id);
    assert.equal(row.vehicleId, vehicle.id, 'vehicle assignment survives a partial edit');
    assert.equal(row.driverId, driver.id, 'driver assignment survives a partial edit');
  });
}

// Clearing an optional link is still possible when explicitly intended: an
// explicit falsy value (null / 0 / '') is treated as "unassign".
for (const cleared of [null, 0, ''] as const) {
  test(`sending an explicit falsy vehicleId (${JSON.stringify(cleared)}) clears the vehicle`, async () => {
    const client = await createClient();
    const vehicle = await createVehicle('GJ-01-AB-1234');
    const actor = await createUser('admin', 'admin@test.com');
    const challan = await createChallan({ clientId: client.id, vehicleId: vehicle.id });

    const res = await request(app)
      .put(`/api/challans/${challan.id}`)
      .set('Authorization', `Bearer ${tokenFor(actor)}`)
      .send({ vehicleId: cleared });

    assert.equal(res.status, 200);
    assert.equal(res.body.vehicleId, null, 'an explicit falsy vehicleId unassigns the vehicle');
    assert.equal((await readChallan(challan.id)).vehicleId, null, 'the cleared vehicle is persisted as null');
  });

  test(`sending an explicit falsy driverId (${JSON.stringify(cleared)}) clears the driver`, async () => {
    const client = await createClient();
    const driver = await createDriver('Assigned Driver');
    const actor = await createUser('admin', 'admin@test.com');
    const challan = await createChallan({ clientId: client.id, driverId: driver.id });

    const res = await request(app)
      .put(`/api/challans/${challan.id}`)
      .set('Authorization', `Bearer ${tokenFor(actor)}`)
      .send({ driverId: cleared });

    assert.equal(res.status, 200);
    assert.equal(res.body.driverId, null, 'an explicit falsy driverId unassigns the driver');
    assert.equal((await readChallan(challan.id)).driverId, null, 'the cleared driver is persisted as null');
  });
}

// Setting a link to a new value reassigns it.
test('sending new vehicleId/driverId reassigns the challan', async () => {
  const client = await createClient();
  const driverA = await createDriver('Driver A');
  const driverB = await createDriver('Driver B');
  const vehicleA = await createVehicle('GJ-01-AA-1111');
  const vehicleB = await createVehicle('GJ-01-BB-2222');
  const actor = await createUser('admin', 'admin@test.com');
  const challan = await createChallan({
    clientId: client.id, driverId: driverA.id, vehicleId: vehicleA.id,
  });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ vehicleId: vehicleB.id, driverId: driverB.id });

  assert.equal(res.status, 200);
  const row = await readChallan(challan.id);
  assert.equal(row.vehicleId, vehicleB.id, 'the new vehicle is persisted');
  assert.equal(row.driverId, driverB.id, 'the new driver is persisted');
});

// siteId is intentionally NOT editable through this handler — it is not read
// from the request body — so it is always preserved across an edit. Even an
// explicit falsy siteId in the payload is a no-op and cannot wipe the saved
// site. (This is the safe-by-omission counterpart to the orders handler, which
// does allow an explicit siteId clear.)
test('siteId is never touched by a challan edit (omitted or sent falsy)', async () => {
  const client = await createClient();
  const site = await createSite(client.id);
  const actor = await createUser('admin', 'admin@test.com');
  const challan = await createChallan({ clientId: client.id, siteId: site.id });

  const omitted = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ status: 'delivered' });
  assert.equal(omitted.status, 200);
  assert.equal((await readChallan(challan.id)).siteId, site.id, 'omitting siteId keeps the saved site');

  const falsy = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ status: 'delivered', siteId: null });
  assert.equal(falsy.status, 200);
  assert.equal(
    (await readChallan(challan.id)).siteId,
    site.id,
    'an explicit falsy siteId is ignored — the saved site is not wiped',
  );
});

// deliveredQuantity is gated on an explicit `undefined` check, so omitting it
// keeps the recorded figure while an explicit null/'' clears it on purpose.
test('omitting deliveredQuantity keeps it; an explicit null clears it', async () => {
  const client = await createClient();
  const actor = await createUser('admin', 'admin@test.com');
  const challan = await createChallan({ clientId: client.id, deliveredQuantity: '5.00' });

  const omitted = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ status: 'delivered' });
  assert.equal(omitted.status, 200);
  assert.equal(
    (await readChallan(challan.id)).deliveredQuantity,
    '5.00',
    'omitting deliveredQuantity leaves the recorded figure intact',
  );

  const cleared = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(actor)}`)
    .send({ deliveredQuantity: null });
  assert.equal(cleared.status, 200);
  assert.equal(
    (await readChallan(challan.id)).deliveredQuantity,
    null,
    'an explicit null deliveredQuantity clears it on purpose',
  );
});
