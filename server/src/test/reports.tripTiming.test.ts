import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { IDLE_KEYS } from '../lib/idle.js';
import { setSetting } from '../lib/settings.js';

let app: Express;

const PASSWORD = 'secret123';

async function createAdmin() {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: 'Owner', email: 'owner@test.com', passwordHash,
    role: 'admin', isActive: true,
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

const day = new Date('2026-05-10T08:00:00Z');
function at(minutes: number): Date {
  return new Date(day.getTime() + minutes * 60000);
}

let challanSeq = 0;
async function createChallan(opts: {
  clientId: number;
  dispatchTime?: Date | null;
  siteArrivalTime?: Date | null;
  siteReleaseTime?: Date | null;
}) {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-TT${String(challanSeq).padStart(4, '0')}`,
    clientId: opts.clientId,
    grade: 'M25',
    quantity: '6.00',
    status: 'delivered',
    dispatchTime: opts.dispatchTime ?? null,
    siteArrivalTime: opts.siteArrivalTime ?? null,
    siteReleaseTime: opts.siteReleaseTime ?? null,
    createdAt: day,
  }).returning();
  return row;
}

before(() => {
  app = buildTestApp();
  challanSeq = 0;
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, clients, audit_logs, users, login_attempts, app_settings RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

test('trip-timing requires auth', async () => {
  const res = await request(app).get('/api/reports/trip-timing');
  assert.equal(res.status, 401);
});

test('trip-timing aggregates travel, site, and billable idle with the default free window', async () => {
  const admin = await createAdmin();
  const acme = await createClient();

  // Trip A: 30 min travel, 105 min at site -> 60 billable idle (free 45).
  await createChallan({ clientId: acme.id, dispatchTime: at(0), siteArrivalTime: at(30), siteReleaseTime: at(135) });
  // Trip B: 50 min travel, 40 min at site -> 0 billable idle (under free).
  await createChallan({ clientId: acme.id, dispatchTime: at(0), siteArrivalTime: at(50), siteReleaseTime: at(90) });

  const res = await request(app)
    .get('/api/reports/trip-timing')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.freeMin, 45);
  assert.equal(res.body.ratePerHour, null);
  assert.equal(res.body.rows.length, 1);

  const row = res.body.rows[0];
  assert.equal(Number(row.tripsWithTravel), 2);
  assert.equal(Number(row.tripsWithSite), 2);
  assert.equal(Number(row.avgTravelMin), 40, '(30 + 50) / 2');
  assert.equal(Number(row.avgSiteMin), 72.5, '(105 + 40) / 2');
  assert.equal(Number(row.totalBillableIdleMin), 60, 'only trip A is over the free window');
  assert.equal(Number(row.idleTrips), 1);
  assert.equal(Number(row.totalIdleCharge), 0, 'no rate means no charge');
});

test('trip-timing applies the configured idle rate and free window', async () => {
  const admin = await createAdmin();
  const acme = await createClient();
  await setSetting(IDLE_KEYS.freeMin, '30');
  await setSetting(IDLE_KEYS.ratePerHour, '600');

  // 90 min at site, free 30 -> 60 billable -> 1 hour @ 600 = 600.
  await createChallan({ clientId: acme.id, dispatchTime: at(0), siteArrivalTime: at(20), siteReleaseTime: at(110) });

  const res = await request(app)
    .get('/api/reports/trip-timing')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.freeMin, 30);
  assert.equal(Number(res.body.ratePerHour), 600);

  const row = res.body.rows[0];
  assert.equal(Number(row.totalBillableIdleMin), 60);
  assert.equal(Number(row.totalIdleCharge), 600);
});

test('trip-timing ignores out-of-order timestamps', async () => {
  const admin = await createAdmin();
  const acme = await createClient();
  // Release before arrival — must not count toward site/idle aggregates.
  await createChallan({ clientId: acme.id, dispatchTime: at(0), siteArrivalTime: at(60), siteReleaseTime: at(20) });

  const res = await request(app)
    .get('/api/reports/trip-timing')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  const row = res.body.rows[0];
  assert.equal(Number(row.tripsWithSite), 0, 'the bad interval is excluded');
  assert.equal(Number(row.totalBillableIdleMin), 0);
});

test('dispatch CSV export carries the trip-timing columns', async () => {
  const admin = await createAdmin();
  const acme = await createClient();
  await setSetting(IDLE_KEYS.ratePerHour, '600');
  const ch = await createChallan({ clientId: acme.id, dispatchTime: at(0), siteArrivalTime: at(30), siteReleaseTime: at(135) });

  const res = await request(app)
    .get('/api/reports/export?report=dispatch')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);

  const lines = res.text.trim().split('\n');
  const cols = lines[0].split(',');
  assert.ok(cols.includes('Travel (min)'), 'header has Travel column');
  assert.ok(cols.includes('Billable Idle (min)'), 'header has Billable Idle column');
  assert.ok(cols.includes('Idle Charge'), 'header has Idle Charge column');

  const dataRow = lines.find(l => l.includes(ch.challanNo))!.split(',');
  assert.equal(dataRow[cols.indexOf('Travel (min)')], '30');
  assert.equal(dataRow[cols.indexOf('Time at Site (min)')], '105');
  assert.equal(dataRow[cols.indexOf('Billable Idle (min)')], '60');
  assert.equal(dataRow[cols.indexOf('Idle Charge')], '600', '60 billable min @ ₹600/hr');
});
