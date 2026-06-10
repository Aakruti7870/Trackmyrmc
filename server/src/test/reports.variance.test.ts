import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;

const PASSWORD = 'secret123';

async function createUser() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [row] = await db.insert(users).values({
    name: 'Reporter', email: 'reporter@test.com', passwordHash,
    role: 'admin', isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createClient(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  return row;
}

let challanSeq = 0;
async function createChallan(opts: {
  clientId: number;
  grade?: string;
  quantity: string;
  deliveredQuantity?: string | null;
  status?: 'pending' | 'dispatched' | 'delivered' | 'cancelled';
  createdAt?: Date;
}) {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-R${String(challanSeq).padStart(4, '0')}`,
    clientId: opts.clientId,
    grade: opts.grade ?? 'M25',
    quantity: opts.quantity,
    deliveredQuantity: opts.deliveredQuantity ?? null,
    status: opts.status ?? 'delivered',
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  }).returning();
  return row;
}

before(() => {
  app = buildTestApp();
  challanSeq = 0;
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

test('reports require auth: no token gets 401', async () => {
  const res = await request(app).get('/api/reports/client-wise');
  assert.equal(res.status, 401);
});

test('client-wise variance counts only challans with a recorded delivered qty', async () => {
  const admin = await createUser();
  const acme = await createClient('Acme Co');
  const globex = await createClient('Globex');

  // Acme: one over-delivered (12 vs 10), one still in-flight (no delivered qty).
  await createChallan({ clientId: acme.id, quantity: '10.00', deliveredQuantity: '12.00', status: 'delivered' });
  await createChallan({ clientId: acme.id, quantity: '8.00', deliveredQuantity: null, status: 'dispatched' });
  // Globex: one short delivery (5 vs 6).
  await createChallan({ clientId: globex.id, quantity: '6.00', deliveredQuantity: '5.00', status: 'delivered' });

  const res = await request(app)
    .get('/api/reports/client-wise')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);

  const byName = Object.fromEntries(res.body.map((r: { clientName: string }) => [r.clientName, r]));

  // Acme: delivered 12, planned-for-delivered 10 (the in-flight challan excluded), variance +2.
  assert.equal(Number(byName['Acme Co'].totalQty), 18, 'totalQty includes the in-flight challan');
  assert.equal(Number(byName['Acme Co'].deliveredQty), 12);
  assert.equal(Number(byName['Acme Co'].plannedForDelivered), 10, 'in-flight challan excluded from planned-for-delivered');
  assert.equal(Number(byName['Acme Co'].variance), 2);
  assert.equal(Number(byName['Acme Co'].totalChallans), 2);

  // Globex: short delivery.
  assert.equal(Number(byName['Globex'].deliveredQty), 5);
  assert.equal(Number(byName['Globex'].plannedForDelivered), 6);
  assert.equal(Number(byName['Globex'].variance), -1);
});

test('client-wise variance is 0 when no challan has a delivered qty yet', async () => {
  const admin = await createUser();
  const acme = await createClient('Acme Co');
  await createChallan({ clientId: acme.id, quantity: '10.00', deliveredQuantity: null, status: 'dispatched' });

  const res = await request(app)
    .get('/api/reports/client-wise')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  const row = res.body.find((r: { clientName: string }) => r.clientName === 'Acme Co');
  assert.equal(Number(row.deliveredQty), 0);
  assert.equal(Number(row.plannedForDelivered), 0, 'no delivered challans means nothing is planned-for-delivered');
  assert.equal(Number(row.variance), 0, 'variance is not skewed by in-flight challans');
});

test('grade-wise variance aggregates the delivered subset per grade', async () => {
  const admin = await createUser();
  const acme = await createClient('Acme Co');

  // M25: 12 delivered vs 10 planned (+2), plus an in-flight one that must not count.
  await createChallan({ clientId: acme.id, grade: 'M25', quantity: '10.00', deliveredQuantity: '12.00', status: 'delivered' });
  await createChallan({ clientId: acme.id, grade: 'M25', quantity: '9.00', deliveredQuantity: null, status: 'dispatched' });
  // M30: 4 delivered vs 6 planned (-2).
  await createChallan({ clientId: acme.id, grade: 'M30', quantity: '6.00', deliveredQuantity: '4.00', status: 'delivered' });

  const res = await request(app)
    .get('/api/reports/grade-wise')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  const byGrade = Object.fromEntries(res.body.map((r: { grade: string }) => [r.grade, r]));

  assert.equal(Number(byGrade['M25'].deliveredQty), 12);
  assert.equal(Number(byGrade['M25'].plannedForDelivered), 10);
  assert.equal(Number(byGrade['M25'].variance), 2);

  assert.equal(Number(byGrade['M30'].deliveredQty), 4);
  assert.equal(Number(byGrade['M30'].plannedForDelivered), 6);
  assert.equal(Number(byGrade['M30'].variance), -2);
});

test('dispatch aggregate reports variance per day, excluding in-flight challans', async () => {
  const admin = await createUser();
  const acme = await createClient('Acme Co');

  const day = new Date('2026-05-01T09:00:00Z');
  // Same day: one over (+2.5) delivered, one in-flight that must not skew the figures.
  await createChallan({ clientId: acme.id, quantity: '10.00', deliveredQuantity: '12.50', status: 'delivered', createdAt: day });
  await createChallan({ clientId: acme.id, quantity: '7.00', deliveredQuantity: null, status: 'dispatched', createdAt: day });

  const res = await request(app)
    .get('/api/reports/dispatch')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  const row = res.body[0];
  assert.equal(Number(row.totalQty), 17, 'totalQty includes both challans');
  assert.equal(Number(row.deliveredQty), 12.5);
  assert.equal(Number(row.plannedForDelivered), 10, 'in-flight challan excluded');
  assert.equal(Number(row.variance), 2.5);
  assert.equal(Number(row.count), 2);
});

test('dispatch CSV export includes a Variance (m³) column of delivered minus planned', async () => {
  const admin = await createUser();
  const acme = await createClient('Acme Co');

  const overCh = await createChallan({ clientId: acme.id, quantity: '10.00', deliveredQuantity: '12.00', status: 'delivered' }); // +2.00
  const shortCh = await createChallan({ clientId: acme.id, quantity: '6.00', deliveredQuantity: '5.50', status: 'delivered' });   // -0.50
  const pendingCh = await createChallan({ clientId: acme.id, quantity: '8.00', deliveredQuantity: null, status: 'dispatched' });    // blank

  const res = await request(app)
    .get('/api/reports/export?report=dispatch')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);

  const lines = res.text.trim().split('\n');
  const header = lines[0];
  assert.ok(header.includes('Variance (m³)'), 'header carries the Variance column');

  const cols = header.split(',');
  const varianceIdx = cols.indexOf('Variance (m³)');
  assert.ok(varianceIdx >= 0);

  // Map each data row's challan number → variance cell (the client field has no comma,
  // so a plain comma split is unambiguous for this tiny dataset).
  const over = lines.find(l => l.includes(overCh.challanNo))!.split(',');
  const short = lines.find(l => l.includes(shortCh.challanNo))!.split(',');
  const pending = lines.find(l => l.includes(pendingCh.challanNo))!.split(',');

  assert.equal(over[varianceIdx], '2.00', 'over-delivery variance is +2.00');
  assert.equal(short[varianceIdx], '-0.50', 'short-delivery variance is -0.50');
  assert.equal(pending[varianceIdx], '', 'an undelivered challan has a blank variance');
});
