import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { addSSEClient, removeSSEClient, type SSEIdentity } from '../lib/sseEmitter.js';
import { sweepStaleLiveFixes, __resetLiveLocationsForTest } from '../routes/attendance.js';
import { plantAndPlatformStaffIds } from '../lib/push.js';
import type { Response } from 'express';

const REPORT_ROLES = ['admin', 'plant_owner', 'supervisor', 'authority'];

// A timestamp far enough past the default stale window that any streamed fix is
// treated as aged-out when the sweep runs — deterministic, no timers/env needed.
const STALE_NOW = Date.now() + 10 * 60 * 1000;

let app: Express;

// A minimal SSE client bound to a specific identity so we can assert tenant
// scoping of duty-location events.
function captureSSE(identity: SSEIdentity) {
  const raw: string[] = [];
  const mockRes = {
    writableEnded: false, destroyed: false, req: { httpVersionMajor: 2 },
    setHeader() {}, flushHeaders() {},
    write(payload: string) { raw.push(payload); return true; },
    end() { (mockRes as { writableEnded: boolean }).writableEnded = true; },
  };
  const id = addSSEClient(mockRes as unknown as Response, identity);
  return {
    events() {
      return raw.map((c) => /^event: (.+)$/m.exec(c)?.[1]).filter((e): e is string => Boolean(e));
    },
    // Parsed payloads for a given event name (in receive order).
    data(event: string): Record<string, unknown>[] {
      return raw
        .filter((c) => new RegExp(`^event: ${event}$`, 'm').test(c))
        .map((c) => JSON.parse(/^data: (.+)$/m.exec(c)?.[1] ?? '{}'));
    },
    close() { removeSSEClient(id); },
  };
}

async function createUser(name: string, email: string, role: string, plantId: number | null = null) {
  const passwordHash = await hashPassword('secret123');
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role: role as typeof users.$inferInsert['role'], isActive: true, plantId,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE attendance_records, driver_locations, plants, users, login_attempts, audit_logs RESTART IDENTITY CASCADE`,
  );
});

test('fleet_manager and quality_engineer can check in and appear on the live duty board', async () => {
  const admin = await createUser('Boss', 'boss@test.com', 'admin');
  const fleet = await createUser('Fiona Fleet', 'fiona@test.com', 'fleet_manager');
  const qe = await createUser('Quinn QE', 'quinn@test.com', 'quality_engineer');

  for (const u of [fleet, qe]) {
    const ci = await request(app).post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${tokenFor(u)}`).send({});
    assert.ok(ci.status === 200 || ci.status === 201, `${u.role} check-in succeeds`);
    assert.equal(ci.body.status, 'CHECKED_IN', 'check-in returns a derived CHECKED_IN status');
  }

  const res = await request(app).get('/api/attendance/live')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  const roles = res.body.drivers.map((d: { role: string }) => d.role);
  assert.ok(roles.includes('fleet_manager'), 'fleet manager is on the duty board');
  assert.ok(roles.includes('quality_engineer'), 'quality engineer is on the duty board');
});

test('check-in stores the coordinates and the live board reports presence + plant', async () => {
  const [plant] = await db.insert(plants).values({
    name: 'North Plant',
    city: 'Mumbai',
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: 'approved',
    isActive: true,
    subscriptionStatus: 'active',
  }).returning();
  const admin = await createUser('Boss', 'boss@test.com', 'admin', plant.id);
  const staff = await createUser('Sam Super', 'sam@test.com', 'supervisor', plant.id);

  const ci = await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staff)}`)
    .send({ lat: 12.9716, lng: 77.5946 });
  assert.ok(ci.status === 200 || ci.status === 201, 'check-in with coords succeeds');
  assert.equal(Number(ci.body.checkInLat), 12.9716, 'check-in latitude is stored');
  assert.equal(Number(ci.body.checkInLng), 77.5946, 'check-in longitude is stored');

  const res = await request(app).get('/api/attendance/live')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  const me = res.body.drivers.find((d: { userId: number }) => d.userId === staff.id);
  assert.ok(me, 'the supervisor appears on the duty board');
  assert.equal(me.plantName, 'North Plant', 'the board carries the plant name');
  // No live GPS fix streamed yet, so presence is gps_inactive until one arrives.
  assert.equal(me.presence, 'gps_inactive', 'presence is gps_inactive without a fresh fix');
});

test('a streamed fix flips presence to online on the live board', async () => {
  const admin = await createUser('Boss', 'boss@test.com', 'admin');
  const staff = await createUser('Dan Dispatch', 'dan@test.com', 'dispatcher');

  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staff)}`).send({});
  const loc = await request(app).post('/api/attendance/location')
    .set('Authorization', `Bearer ${tokenFor(staff)}`).send({ lat: 12.9, lng: 77.5 });
  assert.equal(loc.status, 200, 'a live fix is accepted while checked in');

  const res = await request(app).get('/api/attendance/live')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  const me = res.body.drivers.find((d: { userId: number }) => d.userId === staff.id);
  assert.ok(me, 'the dispatcher is on the duty board');
  assert.equal(me.presence, 'online', 'a fresh fix marks the member online');
  assert.ok(me.lastUpdatedAt, 'the last-updated timestamp is surfaced');
});

test('the live duty board is readable by staff roles and denied to customers', async () => {
  const [plant] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();

  // Every on-duty staff role that the map is surfaced to can read /live.
  for (const role of ['dispatcher', 'plant_operator', 'fleet_manager', 'quality_engineer', 'supervisor']) {
    const staff = await createUser(`${role} u`, `${role}@test.com`, role, plant.id);
    const res = await request(app).get('/api/attendance/live')
      .set('Authorization', `Bearer ${tokenFor(staff)}`);
    assert.equal(res.status, 200, `${role} may read the duty board`);
    assert.ok(Array.isArray(res.body.drivers), `${role} gets the on-duty list`);
  }

  // Customers are never allowed to see where staff are.
  const customer = await createUser('Cara Client', 'cara@test.com', 'client', null);
  const denied = await request(app).get('/api/attendance/live')
    .set('Authorization', `Bearer ${tokenFor(customer)}`);
  assert.equal(denied.status, 403, 'customers are denied the duty board');
});

test('a plant A user\'s live fix is not delivered to plant B staff (SSE tenant isolation)', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const [plantB] = await db.insert(plants).values({
    name: 'Plant B', city: 'Pune', latitude: '18.5', longitude: '73.8',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const staffA = await createUser('Amy A', 'amy@test.com', 'dispatcher', plantA.id);

  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({});

  const sameplant = captureSSE({ role: 'dispatcher', plantId: plantA.id });
  const otherplant = captureSSE({ role: 'dispatcher', plantId: plantB.id });
  const platform = captureSSE({ role: 'admin', plantId: null });
  try {
    const loc = await request(app).post('/api/attendance/location')
      .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({ lat: 12.9, lng: 77.5 });
    assert.equal(loc.status, 200);

    assert.ok(sameplant.events().includes('driver.location'), 'same-plant staff receive the fix');
    assert.ok(!otherplant.events().includes('driver.location'), 'other-plant staff never receive the fix');
    assert.ok(platform.events().includes('driver.location'), 'platform staff see every plant');
  } finally {
    sameplant.close(); otherplant.close(); platform.close();
  }
});

test('a null-plant platform user\'s live fix reaches platform staff only, not plant-bound staff', async () => {
  const [plantB] = await db.insert(plants).values({
    name: 'Plant B', city: 'Pune', latitude: '18.5', longitude: '73.8',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const boss = await createUser('Ava Authority', 'ava@test.com', 'authority', null);

  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(boss)}`).send({});

  const plantBound = captureSSE({ role: 'dispatcher', plantId: plantB.id });
  const platform = captureSSE({ role: 'admin', plantId: null });
  try {
    const loc = await request(app).post('/api/attendance/location')
      .set('Authorization', `Bearer ${tokenFor(boss)}`).send({ lat: 12.9, lng: 77.5 });
    assert.equal(loc.status, 200);

    assert.ok(!plantBound.events().includes('driver.location'), 'plant-bound staff never see a platform user\'s fix');
    assert.ok(platform.events().includes('driver.location'), 'platform staff see the platform user\'s fix');
  } finally {
    plantBound.close(); platform.close();
  }
});

test('check-out driver.offline is scoped to the same plant (parity with driver.location)', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const [plantB] = await db.insert(plants).values({
    name: 'Plant B', city: 'Pune', latitude: '18.5', longitude: '73.8',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const staffA = await createUser('Amy A', 'amy@test.com', 'dispatcher', plantA.id);

  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({});

  const sameplant = captureSSE({ role: 'dispatcher', plantId: plantA.id });
  const otherplant = captureSSE({ role: 'dispatcher', plantId: plantB.id });
  try {
    const out = await request(app).post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({});
    assert.equal(out.status, 200);

    assert.ok(sameplant.events().includes('driver.offline'), 'same-plant staff learn the user went offline');
    assert.ok(!otherplant.events().includes('driver.offline'), 'other-plant staff never receive the offline event');
  } finally {
    sameplant.close(); otherplant.close();
  }
});

test('a stale on-duty GPS fix alerts same-plant + platform supervisors, not other plants or non-supervisory coworkers', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const [plantB] = await db.insert(plants).values({
    name: 'Plant B', city: 'Pune', latitude: '18.5', longitude: '73.8',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const staffA = await createUser('Amy A', 'amy@test.com', 'dispatcher', plantA.id);

  __resetLiveLocationsForTest();
  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({});
  await request(app).post('/api/attendance/location')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({ lat: 12.9, lng: 77.5 });

  const sameSup = captureSSE({ role: 'supervisor', plantId: plantA.id });
  const platformSup = captureSSE({ role: 'admin', plantId: null });
  const otherSup = captureSSE({ role: 'supervisor', plantId: plantB.id });
  const sameCoworker = captureSSE({ role: 'dispatcher', plantId: plantA.id });
  try {
    await sweepStaleLiveFixes(STALE_NOW);

    assert.ok(sameSup.events().includes('duty.stale'), 'same-plant supervisor is alerted the staffer went dark');
    assert.ok(platformSup.events().includes('duty.stale'), 'platform supervisor is alerted too');
    assert.ok(!otherSup.events().includes('duty.stale'), 'a different plant\'s supervisor is never alerted');
    assert.ok(!sameCoworker.events().includes('duty.stale'), 'non-supervisory coworkers get the marker removal, not the alert');
    // The existing silent marker-removal still fans out to every on-duty viewer.
    assert.ok(sameCoworker.events().includes('driver.offline'), 'the map still drops the marker for coworkers');
  } finally {
    sameSup.close(); platformSup.close(); otherSup.close(); sameCoworker.close();
  }
});

test('a null-plant platform staffer going dark alerts platform supervisors only', async () => {
  const [plantB] = await db.insert(plants).values({
    name: 'Plant B', city: 'Pune', latitude: '18.5', longitude: '73.8',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const boss = await createUser('Ava Authority', 'ava@test.com', 'authority', null);

  __resetLiveLocationsForTest();
  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(boss)}`).send({});
  await request(app).post('/api/attendance/location')
    .set('Authorization', `Bearer ${tokenFor(boss)}`).send({ lat: 12.9, lng: 77.5 });

  const platformSup = captureSSE({ role: 'admin', plantId: null });
  const plantSup = captureSSE({ role: 'supervisor', plantId: plantB.id });
  try {
    await sweepStaleLiveFixes(STALE_NOW);

    assert.ok(platformSup.events().includes('duty.stale'), 'platform supervisor is alerted');
    assert.ok(!plantSup.events().includes('duty.stale'), 'a plant-bound supervisor never sees a platform staffer\'s alert');
  } finally {
    platformSup.close(); plantSup.close();
  }
});

test('several staffers going dark in one sweep raise a single grouped alert, not one per person', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const staff1 = await createUser('Amy A', 'amy@test.com', 'dispatcher', plantA.id);
  const staff2 = await createUser('Ben B', 'ben@test.com', 'plant_operator', plantA.id);
  const staff3 = await createUser('Cal C', 'cal@test.com', 'dispatcher', plantA.id);

  __resetLiveLocationsForTest();
  for (const s of [staff1, staff2, staff3]) {
    await request(app).post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${tokenFor(s)}`).send({});
    await request(app).post('/api/attendance/location')
      .set('Authorization', `Bearer ${tokenFor(s)}`).send({ lat: 12.9, lng: 77.5 });
  }

  const sup = captureSSE({ role: 'supervisor', plantId: plantA.id });
  try {
    await sweepStaleLiveFixes(STALE_NOW);

    const alerts = sup.data('duty.stale');
    assert.equal(alerts.length, 1, 'three simultaneous drop-offs collapse into one supervisor alert');
    assert.equal(alerts[0].count, 3, 'the grouped alert carries the number of staffers who went dark');
    // Per-user marker removal is NOT batched — the map still drops each marker.
    assert.equal(sup.events().filter((e) => e === 'driver.offline').length, 3, 'each marker is still removed individually');
  } finally {
    sup.close();
  }
});

test('a single drop-off still names the individual staffer (no spurious grouping)', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const staff = await createUser('Amy A', 'amy@test.com', 'dispatcher', plantA.id);

  __resetLiveLocationsForTest();
  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staff)}`).send({});
  await request(app).post('/api/attendance/location')
    .set('Authorization', `Bearer ${tokenFor(staff)}`).send({ lat: 12.9, lng: 77.5 });

  const sup = captureSSE({ role: 'supervisor', plantId: plantA.id });
  try {
    await sweepStaleLiveFixes(STALE_NOW);

    const alerts = sup.data('duty.stale');
    assert.equal(alerts.length, 1, 'the lone staffer is alerted');
    assert.equal(alerts[0].count, undefined, 'a single drop-off is not a grouped alert');
    assert.equal(alerts[0].name, 'Amy A', 'the individual staffer is named');
  } finally {
    sup.close();
  }
});

test('the stale-GPS push audience matches the SSE audience (same plant + platform, never other plants)', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const [plantB] = await db.insert(plants).values({
    name: 'Plant B', city: 'Pune', latitude: '18.5', longitude: '73.8',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const supA = await createUser('Sup A', 'supa@test.com', 'supervisor', plantA.id);
  const supB = await createUser('Sup B', 'supb@test.com', 'supervisor', plantB.id);
  const platformSup = await createUser('Platform Admin', 'plat@test.com', 'admin', null);
  const coworkerA = await createUser('Cara Coworker', 'cara@test.com', 'dispatcher', plantA.id);

  // A plant-bound staffer's push reaches their plant's supervisors AND platform
  // supervisors — never another plant's, never a non-supervisory coworker.
  const forPlantA = await plantAndPlatformStaffIds(plantA.id, REPORT_ROLES);
  assert.ok(forPlantA.includes(supA.id), 'same-plant supervisor is pushed');
  assert.ok(forPlantA.includes(platformSup.id), 'platform supervisor is pushed (off-app parity with the toast)');
  assert.ok(!forPlantA.includes(supB.id), 'a different plant\'s supervisor is never pushed');
  assert.ok(!forPlantA.includes(coworkerA.id), 'a non-supervisory coworker is never pushed');
  // No duplicate: each qualifying supervisor appears exactly once.
  assert.equal(new Set(forPlantA).size, forPlantA.length, 'a supervisor is never targeted twice');

  // A null-plant platform staffer's push reaches platform supervisors only.
  const forPlatform = await plantAndPlatformStaffIds(null, REPORT_ROLES);
  assert.ok(forPlatform.includes(platformSup.id), 'platform supervisor is pushed');
  assert.ok(!forPlatform.includes(supA.id), 'a plant-bound supervisor never gets a platform staffer\'s push');
  assert.ok(!forPlatform.includes(supB.id), 'a plant-bound supervisor never gets a platform staffer\'s push');
});

test('a normal check-out never raises a gone-dark alert (only the silent offline event)', async () => {
  const [plantA] = await db.insert(plants).values({
    name: 'Plant A', city: 'Mumbai', latitude: '19.0', longitude: '73.0',
    plantStatus: 'approved', isActive: true, subscriptionStatus: 'active',
  }).returning();
  const staffA = await createUser('Amy A', 'amy@test.com', 'dispatcher', plantA.id);

  __resetLiveLocationsForTest();
  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({});
  await request(app).post('/api/attendance/location')
    .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({ lat: 12.9, lng: 77.5 });

  const sup = captureSSE({ role: 'supervisor', plantId: plantA.id });
  try {
    const out = await request(app).post('/api/attendance/check-out')
      .set('Authorization', `Bearer ${tokenFor(staffA)}`).send({});
    assert.equal(out.status, 200);

    assert.ok(sup.events().includes('driver.offline'), 'check-out still drops the marker');
    assert.ok(!sup.events().includes('duty.stale'), 'check-out is not a gone-dark event, so no alert');
  } finally {
    sup.close();
  }
});

test('check-out records coordinates and returns a CHECKED_OUT status with hours', async () => {
  const staff = await createUser('Otto Operator', 'otto@test.com', 'plant_operator');

  await request(app).post('/api/attendance/check-in')
    .set('Authorization', `Bearer ${tokenFor(staff)}`).send({ lat: 10, lng: 20 });
  const co = await request(app).post('/api/attendance/check-out')
    .set('Authorization', `Bearer ${tokenFor(staff)}`).send({ lat: 11, lng: 21 });
  assert.equal(co.status, 200, 'check-out succeeds');
  assert.equal(co.body.status, 'CHECKED_OUT', 'check-out returns a derived CHECKED_OUT status');
  assert.equal(Number(co.body.checkOutLat), 11, 'check-out latitude is stored');
  assert.equal(typeof co.body.totalHours, 'number', 'total hours are computed on check-out');
});
