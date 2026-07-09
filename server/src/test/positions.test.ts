import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express, Response } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans, plants, vehicleAlerts } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import {
  addSSEClient,
  removeSSEClient,
  getSSEClientCount,
  type SSEIdentity,
} from '../lib/sseEmitter.js';

let app: Express;

const PASSWORD = 'secret123';

// A driver-role user is authorized for POST /api/positions only when it has a
// linkedDriverId (the route reads req.user.linkedDriverId and 403s without it),
// and the challan it reports on must reference that same drivers.id.
async function createDriverUser(name: string, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
  }).returning();
  return { user, driver };
}

async function createClient(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Contact', phone: '1112223333',
  }).returning();
  return row;
}

let challanSeq = 0;
async function createChallan(opts: { driverId: number; clientId: number; plantId?: number | null }) {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-P${String(challanSeq).padStart(4, '0')}`,
    clientId: opts.clientId,
    driverId: opts.driverId,
    plantId: opts.plantId ?? null,
    grade: 'M25',
    quantity: '6.00',
    status: 'dispatched',
    dispatchTime: new Date(),
  }).returning();
  return row;
}

let plantSeq = 0;
const runSuffix = `${process.pid}${Date.now() % 100000}`;
async function createPlant(name: string) {
  plantSeq += 1;
  // plants.name is globally unique and this suite may run against a shared
  // dev database, so both the name and code carry a per-run suffix.
  const [row] = await db.insert(plants).values({
    name: `${name} ${runSuffix}-${plantSeq}`,
    plantCode: `POSTP-${runSuffix}-${plantSeq}`,
    latitude: '19.0000000',
    longitude: '72.8000000',
  }).returning();
  return row;
}

async function createStaffUser(name: string, email: string, role: 'admin' | 'dispatcher', plantId: number | null) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role, isActive: true, plantId,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// A fake SSE connection registered against the real emitter with a given
// identity, so we can observe exactly which roles a live position reaches when
// it is emitted by the positions route (not by the test directly).
function captureSSE(identity: SSEIdentity) {
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
    close() { removeSSEClient(id); },
  };
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
  assert.equal(getSSEClientCount(), 0, 'no SSE clients should be registered between tests');
});

const openStreams: Array<{ close: () => void }> = [];
afterEach(() => {
  for (const s of openStreams) s.close();
  openStreams.length = 0;
  assert.equal(getSSEClientCount(), 0, 'all SSE clients should be cleaned up between tests');
});

after(async () => {
  await pool.end();
});

test('a driver GPS fix reaches only the owning client, the assigned driver, and staff', async () => {
  const ownClient = await createClient('Acme Co');
  const otherClient = await createClient('Rival Co');
  const { user: driverUser, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const { driver: otherDriver } = await createDriverUser('Olga Other', 'olga@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: ownClient.id });

  // Listeners for every audience class that the route's scoping must separate.
  const owningClientSse = captureSSE({ role: 'client', clientId: ownClient.id });
  const otherClientSse = captureSSE({ role: 'client', clientId: otherClient.id });
  const assignedDriverSse = captureSSE({ role: 'driver', driverId: driver.id });
  const otherDriverSse = captureSSE({ role: 'driver', driverId: otherDriver.id });
  const adminSse = captureSSE({ role: 'admin' });
  const dispatcherSse = captureSSE({ role: 'dispatcher' });
  const operatorSse = captureSSE({ role: 'plant_operator' });
  openStreams.push(
    owningClientSse, otherClientSse, assignedDriverSse, otherDriverSse,
    adminSse, dispatcherSse, operatorSse,
  );

  // The driver POSTs a real GPS fix through the route. No site coordinates are
  // set on the challan, so no geofence auto-delivery occurs — only the live
  // vehicle.position event is emitted, scoped to this challan's client/driver.
  const res = await request(app)
    .post('/api/positions')
    .set('Authorization', `Bearer ${tokenFor(driverUser)}`)
    .send({ challanId: challan.id, lat: 19.07, lng: 72.87, accuracy: 10 });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.delivered, false, 'no geofence delivery without site coordinates');

  // The owning client and the assigned driver each see exactly one position.
  assert.ok(
    owningClientSse.events().includes('vehicle.position'),
    'the owning client receives the live truck position',
  );
  assert.ok(
    assignedDriverSse.events().includes('vehicle.position'),
    'the assigned driver receives the live truck position',
  );

  // A different company and an unassigned driver must never see it.
  assert.ok(
    !otherClientSse.events().includes('vehicle.position'),
    "another company's client must NOT see the live truck position",
  );
  assert.ok(
    !otherDriverSse.events().includes('vehicle.position'),
    'an unassigned driver must NOT see the live truck position',
  );

  // Every staff role still receives it for the control-room map.
  for (const [name, observer] of [
    ['admin', adminSse], ['dispatcher', dispatcherSse], ['operator', operatorSse],
  ] as const) {
    assert.ok(
      observer.events().includes('vehicle.position'),
      `${name} must receive every truck position for the live map`,
    );
  }
});

test('plant-bound staff only see their own plant on the live map (REST + SSE); platform staff see all', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const client = await createClient('Acme Co');
  const { user: driverAUser, driver: driverA } = await createDriverUser('Dave A', 'dave.a@test.com');
  const { user: driverBUser, driver: driverB } = await createDriverUser('Bob B', 'bob.b@test.com');
  const challanA = await createChallan({ driverId: driverA.id, clientId: client.id, plantId: plantA.id });
  const challanB = await createChallan({ driverId: driverB.id, clientId: client.id, plantId: plantB.id });

  const plantAAdmin = await createStaffUser('A Admin', 'a.admin@test.com', 'admin', plantA.id);
  const platformAdmin = await createStaffUser('P Admin', 'p.admin@test.com', 'admin', null);

  // SSE listeners: a plant-A-bound admin and a platform (null-plant) admin.
  const plantAAdminSse = captureSSE({ role: 'admin', plantId: plantA.id });
  const platformAdminSse = captureSSE({ role: 'admin', plantId: null });
  openStreams.push(plantAAdminSse, platformAdminSse);

  // Both drivers report a fix through the real route.
  for (const [u, ch] of [[driverAUser, challanA], [driverBUser, challanB]] as const) {
    const res = await request(app)
      .post('/api/positions')
      .set('Authorization', `Bearer ${tokenFor(u)}`)
      .send({ challanId: ch.id, lat: 19.07, lng: 72.87, accuracy: 10 });
    assert.equal(res.status, 200);
  }

  // SSE: the plant-A admin got exactly one position (their own plant's truck),
  // the platform admin got both.
  assert.equal(
    plantAAdminSse.events().filter(e => e === 'vehicle.position').length, 1,
    "a plant-bound admin must only receive their own plant's truck positions",
  );
  assert.equal(
    platformAdminSse.events().filter(e => e === 'vehicle.position').length, 2,
    'a platform admin must receive every truck position',
  );

  // REST: GET /api/positions applies the same tenant scoping.
  const scoped = await request(app)
    .get('/api/positions')
    .set('Authorization', `Bearer ${tokenFor(plantAAdmin)}`);
  assert.equal(scoped.status, 200);
  assert.deepEqual(
    scoped.body.map((p: { challanId: number }) => p.challanId), [challanA.id],
    "the live-map list for a plant-bound admin must only contain their own plant's trucks",
  );

  const global = await request(app)
    .get('/api/positions')
    .set('Authorization', `Bearer ${tokenFor(platformAdmin)}`);
  assert.equal(global.status, 200);
  assert.equal(global.body.length, 2, 'a platform admin sees the whole network on the live map');

  // Theft/deviation alerts: the feed, the ack action and the freshness board
  // must all carry the same plant boundary.
  const [alertA] = await db.insert(vehicleAlerts).values({
    challanId: challanA.id, driverId: driverA.id, type: 'unscheduled_stop', detail: 'A stop',
  }).returning();
  const [alertB] = await db.insert(vehicleAlerts).values({
    challanId: challanB.id, driverId: driverB.id, type: 'route_deviation', detail: 'B deviation',
  }).returning();

  const alertsScoped = await request(app)
    .get('/api/positions/alerts')
    .set('Authorization', `Bearer ${tokenFor(plantAAdmin)}`);
  assert.equal(alertsScoped.status, 200);
  assert.deepEqual(
    alertsScoped.body.map((a: { id: number }) => a.id), [alertA.id],
    "the alert feed for a plant-bound admin must only contain their own plant's alerts",
  );

  const alertsGlobal = await request(app)
    .get('/api/positions/alerts')
    .set('Authorization', `Bearer ${tokenFor(platformAdmin)}`);
  assert.equal(alertsGlobal.status, 200);
  assert.equal(alertsGlobal.body.length, 2, 'a platform admin sees every plant\'s alerts');

  // Acknowledging another plant's alert must look like a missing row (404),
  // and must leave the alert untouched.
  const crossAck = await request(app)
    .post(`/api/positions/alerts/${alertB.id}/ack`)
    .set('Authorization', `Bearer ${tokenFor(plantAAdmin)}`);
  assert.equal(crossAck.status, 404, "a plant-bound admin cannot acknowledge another plant's alert");
  const ownAck = await request(app)
    .post(`/api/positions/alerts/${alertA.id}/ack`)
    .set('Authorization', `Bearer ${tokenFor(plantAAdmin)}`);
  assert.equal(ownAck.status, 200, 'a plant-bound admin can acknowledge their own plant\'s alert');

  // Freshness board: same boundary.
  const freshScoped = await request(app)
    .get('/api/positions/freshness')
    .set('Authorization', `Bearer ${tokenFor(plantAAdmin)}`);
  assert.equal(freshScoped.status, 200);
  assert.deepEqual(
    freshScoped.body.loads.map((l: { challanId: number }) => l.challanId), [challanA.id],
    "the freshness board for a plant-bound admin must only list their own plant's loads",
  );
  const freshGlobal = await request(app)
    .get('/api/positions/freshness')
    .set('Authorization', `Bearer ${tokenFor(platformAdmin)}`);
  assert.equal(freshGlobal.status, 200);
  assert.equal(freshGlobal.body.loads.length, 2, 'a platform admin sees every plant\'s loads');
});

test('a driver reporting a challan not assigned to them is rejected and emits nothing', async () => {
  const ownClient = await createClient('Acme Co');
  const { user: driverUser } = await createDriverUser('Dave Driver', 'dave@test.com');
  const { driver: otherDriver } = await createDriverUser('Olga Other', 'olga@test.com');
  // The challan belongs to a different driver, so Dave must not be able to
  // report a position for it, and no listener should receive anything.
  const challan = await createChallan({ driverId: otherDriver.id, clientId: ownClient.id });

  const clientSse = captureSSE({ role: 'client', clientId: ownClient.id });
  const adminSse = captureSSE({ role: 'admin' });
  openStreams.push(clientSse, adminSse);

  const res = await request(app)
    .post('/api/positions')
    .set('Authorization', `Bearer ${tokenFor(driverUser)}`)
    .send({ challanId: challan.id, lat: 19.07, lng: 72.87, accuracy: 10 });

  assert.equal(res.status, 403);
  assert.match(res.body.error, /not assigned/i);
  assert.ok(
    !clientSse.events().includes('vehicle.position'),
    'no position is emitted for a rejected report',
  );
  assert.ok(
    !adminSse.events().includes('vehicle.position'),
    'staff also receive nothing for a rejected report',
  );
});
