import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express, Response } from 'express';

import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, drivers, driverExpenses, emergencies } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';

let app: Express;
const PASSWORD = 'secret123';

async function createDriver(name: string, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
  }).returning();
  return { user, driver };
}

type StaffRole = 'admin' | 'supervisor' | 'authority' | 'plant_owner' | 'fleet_manager' | 'accountant';
async function createStaff(role: StaffRole, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name: `${role} User`, email, passwordHash, role, isActive: true,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// Registers a fake SSE client with the given identity and returns the parsed
// event names it received, so we can assert emergency.raised routing.
function captureSSE(identity: { role: string; plantId?: number | null }) {
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
  const id = addSSEClient(mockRes as unknown as Response, {
    role: identity.role, plantId: identity.plantId ?? null,
  });
  return {
    id,
    events() {
      return raw.join('').split('\n')
        .filter((l) => l.startsWith('event:'))
        .map((l) => l.slice('event:'.length).trim());
    },
  };
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${driverExpenses} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${emergencies} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${users} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${drivers} RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

// ---------------------------------------------------------------------------
// Driver Expenses
// ---------------------------------------------------------------------------

test('driver submits an expense and sees it in their own list', async () => {
  const { user } = await createDriver('Ravi', 'ravi@otp.local');
  const token = tokenFor(user);

  const create = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'fuel', amount: 500, description: 'Diesel top-up' });
  assert.equal(create.status, 201);
  assert.equal(create.body.category, 'fuel');
  assert.equal(create.body.status, 'pending');

  const mine = await request(app)
    .get('/api/expenses/mine')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.length, 1);
  assert.equal(Number(mine.body[0].amount), 500);
});

test('a driver never sees another driver\'s expenses', async () => {
  const a = await createDriver('Amit', 'amit@otp.local');
  const b = await createDriver('Bala', 'bala@otp.local');
  await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(a.user)}`)
    .send({ category: 'toll', amount: 120 });

  const mine = await request(app)
    .get('/api/expenses/mine')
    .set('Authorization', `Bearer ${tokenFor(b.user)}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.length, 0);
});

test('a positive amount is required', async () => {
  const { user } = await createDriver('Ravi', 'ravi@otp.local');
  const res = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ category: 'fuel', amount: 0 });
  assert.equal(res.status, 400);
});

test('a non-driver cannot submit an expense', async () => {
  const admin = await createStaff('admin', 'admin@rmc.test');
  const res = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ category: 'fuel', amount: 500 });
  assert.equal(res.status, 403);
});

test('staff approve + reimburse an expense in a single step', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const admin = await createStaff('admin', 'admin@rmc.test');

  const created = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ category: 'repair', amount: 2000 });
  const id = created.body.id;

  const review = await request(app)
    .patch(`/api/expenses/${id}/review`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ decision: 'approved', reimbursed: true, remark: 'ok' });
  assert.equal(review.status, 200);
  assert.equal(review.body.status, 'approved');
  assert.equal(review.body.reimbursementStatus, 'reimbursed');
  assert.equal(review.body.reviewerRemark, 'ok');
  assert.equal(review.body.reviewedByName, admin.name);
});

test('reject leaves reimbursement unpaid even if reimbursed=true is sent', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const admin = await createStaff('admin', 'admin@rmc.test');
  const created = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ category: 'food', amount: 150 });

  const review = await request(app)
    .patch(`/api/expenses/${created.body.id}/review`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ decision: 'rejected', reimbursed: true });
  assert.equal(review.status, 200);
  assert.equal(review.body.status, 'rejected');
  assert.equal(review.body.reimbursementStatus, 'pending');
});

test('a driver deletes their own pending expense but not after approval', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const admin = await createStaff('admin', 'admin@rmc.test');

  const c1 = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ category: 'parking', amount: 40 });
  const del = await request(app)
    .delete(`/api/expenses/${c1.body.id}`)
    .set('Authorization', `Bearer ${tokenFor(driver)}`);
  assert.equal(del.status, 200);

  const c2 = await request(app)
    .post('/api/expenses')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ category: 'parking', amount: 60 });
  await request(app)
    .patch(`/api/expenses/${c2.body.id}/review`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ decision: 'approved', reimbursed: false });
  const del2 = await request(app)
    .delete(`/api/expenses/${c2.body.id}`)
    .set('Authorization', `Bearer ${tokenFor(driver)}`);
  assert.equal(del2.status, 409);
});

// ---------------------------------------------------------------------------
// SOS / Emergency
// ---------------------------------------------------------------------------

test('a driver raises an SOS and supervisors receive the SSE alert', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const supervisor = await createStaff('supervisor', 'sup@rmc.test');
  const sub = captureSSE({ role: 'supervisor', plantId: null });

  try {
    const res = await request(app)
      .post('/api/emergencies')
      .set('Authorization', `Bearer ${tokenFor(driver)}`)
      .send({ type: 'breakdown', message: 'Engine failure', lat: 12.9, lng: 77.6 });
    assert.equal(res.status, 201);
    assert.equal(res.body.type, 'breakdown');
    assert.equal(res.body.status, 'open');

    assert.ok(sub.events().includes('emergency.raised'), 'supervisor should receive emergency.raised');
  } finally {
    removeSSEClient(sub.id);
  }
});

test('a driver sees their own raised alerts', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  await request(app)
    .post('/api/emergencies')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ type: 'medical' });
  const mine = await request(app)
    .get('/api/emergencies/mine')
    .set('Authorization', `Bearer ${tokenFor(driver)}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.length, 1);
  assert.equal(mine.body[0].type, 'medical');
});

test('a driver cannot view the supervisor emergency queue', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const res = await request(app)
    .get('/api/emergencies')
    .set('Authorization', `Bearer ${tokenFor(driver)}`);
  assert.equal(res.status, 403);
});

test('a supervisor acknowledges then resolves an emergency', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const supervisor = await createStaff('supervisor', 'sup@rmc.test');
  const created = await request(app)
    .post('/api/emergencies')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ type: 'safety' });
  const id = created.body.id;

  const ack = await request(app)
    .patch(`/api/emergencies/${id}`)
    .set('Authorization', `Bearer ${tokenFor(supervisor)}`)
    .send({ status: 'acknowledged' });
  assert.equal(ack.status, 200);
  assert.equal(ack.body.status, 'acknowledged');
  assert.equal(ack.body.acknowledgedByName, supervisor.name);

  const resolve = await request(app)
    .patch(`/api/emergencies/${id}`)
    .set('Authorization', `Bearer ${tokenFor(supervisor)}`)
    .send({ status: 'resolved' });
  assert.equal(resolve.status, 200);
  assert.equal(resolve.body.status, 'resolved');
  assert.ok(resolve.body.resolvedAt);
});

test('an invalid emergency type is rejected', async () => {
  const { user: driver } = await createDriver('Ravi', 'ravi@otp.local');
  const res = await request(app)
    .post('/api/emergencies')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({ type: 'zombies' });
  assert.equal(res.status, 400);
});
