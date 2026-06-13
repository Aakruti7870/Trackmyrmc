import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import type { Express, Response } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';

let app: Express;

const PASSWORD = 'secret123';

async function createDriverUser(name: string, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
  }).returning();
  return { user, driver };
}

async function createAdmin() {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: 'Owner', email: 'owner@test.com', passwordHash, role: 'admin', isActive: true,
  }).returning();
  return row;
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

let challanSeq = 0;
async function createChallan(opts: {
  driverId: number | null;
  clientId: number;
  siteArrivalTime?: Date | null;
  siteReleaseTime?: Date | null;
}) {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-LS${String(challanSeq).padStart(4, '0')}`,
    clientId: opts.clientId,
    driverId: opts.driverId,
    grade: 'M25',
    quantity: '6.00',
    status: 'dispatched',
    dispatchTime: new Date(),
    siteArrivalTime: opts.siteArrivalTime ?? null,
    siteReleaseTime: opts.siteReleaseTime ?? null,
  }).returning();
  return row;
}

function captureSSE() {
  const raw: string[] = [];
  const mockRes = {
    writableEnded: false, destroyed: false, req: { httpVersionMajor: 2 },
    setHeader() {}, flushHeaders() {},
    write(payload: string) { raw.push(payload); return true; },
    end() { (mockRes as { writableEnded: boolean }).writableEnded = true; },
  };
  const id = addSSEClient(mockRes as unknown as Response);
  return {
    events() {
      return raw.map(c => /^event: (.+)$/m.exec(c)?.[1]).filter((e): e is string => Boolean(e));
    },
    close() { removeSSEClient(id); },
  };
}

before(() => { app = buildTestApp(); challanSeq = 0; });

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

let sse: ReturnType<typeof captureSSE> | null = null;
afterEach(() => { if (sse) { sse.close(); sse = null; } });

after(async () => { await pool.end(); });

test('driver marks left-site, stamping release and emitting challan.updated', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, siteArrivalTime: new Date(Date.now() - 60 * 60000) });
  sse = captureSSE();

  const res = await request(app)
    .post(`/api/challans/${challan.id}/left-site`)
    .set('Authorization', `Bearer ${tokenFor(user)}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.siteReleaseTime, 'release time is stamped');

  const [row] = await db.select({ siteReleaseTime: challans.siteReleaseTime })
    .from(challans).where(eq(challans.id, challan.id));
  assert.ok(row.siteReleaseTime instanceof Date, 'release persisted');
  assert.ok(sse.events().includes('challan.updated'), 'emits challan.updated');
});

test('left-site is rejected with 409 when arrival was never recorded', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, siteArrivalTime: null });

  const res = await request(app)
    .post(`/api/challans/${challan.id}/left-site`)
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 409);
});

test('left-site is idempotent: a second call keeps the original release time', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const release = new Date(Date.now() - 10 * 60000);
  const challan = await createChallan({
    driverId: driver.id, clientId: client.id,
    siteArrivalTime: new Date(Date.now() - 60 * 60000), siteReleaseTime: release,
  });

  const res = await request(app)
    .post(`/api/challans/${challan.id}/left-site`)
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.equal(new Date(res.body.siteReleaseTime).getTime(), release.getTime(), 'original release preserved');
});

test('a driver cannot mark left-site on a challan they are not assigned to', async () => {
  const client = await createClient();
  const { driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const { user: other } = await createDriverUser('Other Driver', 'other@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, siteArrivalTime: new Date() });

  const res = await request(app)
    .post(`/api/challans/${challan.id}/left-site`)
    .set('Authorization', `Bearer ${tokenFor(other)}`);
  assert.equal(res.status, 403);
});

test('admin can correct trip timestamps via PUT, and an invalid date is rejected', async () => {
  const client = await createClient();
  const admin = await createAdmin();
  const challan = await createChallan({ driverId: null, clientId: client.id });

  const arrival = new Date('2026-05-10T09:00:00Z').toISOString();
  const release = new Date('2026-05-10T10:30:00Z').toISOString();
  const ok = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ siteArrivalTime: arrival, siteReleaseTime: release });
  assert.equal(ok.status, 200);
  assert.equal(new Date(ok.body.siteArrivalTime).toISOString(), arrival);
  assert.equal(new Date(ok.body.siteReleaseTime).toISOString(), release);

  const cleared = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ siteReleaseTime: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.siteReleaseTime, null, 'null clears the timestamp');

  const bad = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ siteArrivalTime: 'not-a-date' });
  assert.equal(bad.status, 400, 'invalid date rejected');
});
