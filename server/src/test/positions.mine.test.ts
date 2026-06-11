import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
const PASSWORD = 'secret123';

async function createClient(name: string, phone: string) {
  const [row] = await db.insert(clients).values({ name, contactPerson: 'C', phone }).returning();
  return row;
}

async function createClientUser(email: string, clientId: number) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await db.insert(users).values({
    name: 'client user', email, passwordHash, role: 'client', isActive: true, linkedClientId: clientId,
  }).returning();
  return user;
}

async function createDriverUser(email: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [driver] = await db.insert(drivers).values({ name: 'Driver', phone: '0000000000' }).returning();
  const [user] = await db.insert(users).values({
    name: 'driver user', email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
  }).returning();
  return { user, driver };
}

let seq = 0;
async function createChallan(clientId: number, driverId: number) {
  seq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-M${String(seq).padStart(4, '0')}`,
    clientId, driverId, grade: 'M25', quantity: '6.00',
    status: 'dispatched', dispatchTime: new Date(),
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, drivers, clients, users RESTART IDENTITY CASCADE`,
  );
});

after(async () => { await pool.end(); });

test('a client sees only their own live positions', async () => {
  const mine = await createClient('Mine', '1110000000');
  const other = await createClient('Other', '2220000000');
  const meUser = await createClientUser('me@test.com', mine.id);
  const { user: driverUser, driver } = await createDriverUser('drv@test.com');
  const driverAuth = `Bearer ${tokenFor(driverUser)}`;

  // The driver must be assigned to each challan it reports a fix for.
  const myChallan = await createChallan(mine.id, driver.id);
  const otherChallan = await createChallan(other.id, driver.id);

  await request(app).post('/api/positions').set('Authorization', driverAuth)
    .send({ challanId: myChallan.id, lat: 18.5, lng: 73.8 });
  await request(app).post('/api/positions').set('Authorization', driverAuth)
    .send({ challanId: otherChallan.id, lat: 19.0, lng: 72.8 });

  const res = await request(app).get('/api/positions/mine').set('Authorization', `Bearer ${tokenFor(meUser)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].challanId, myChallan.id);
  assert.equal(res.body[0].clientId, mine.id);
});

test('staff GET /positions is forbidden to clients, but /mine is allowed', async () => {
  const mine = await createClient('Mine', '1110000001');
  const meUser = await createClientUser('me2@test.com', mine.id);
  const auth = `Bearer ${tokenFor(meUser)}`;

  const staff = await request(app).get('/api/positions').set('Authorization', auth);
  assert.equal(staff.status, 403);

  // /mine is client-accessible (unlike the staff-only collection view). Assert
  // access + shape only: livePositions is an in-memory, process-wide Map that
  // TRUNCATE can't reset, so a prior test's entry may linger here.
  const ownView = await request(app).get('/api/positions/mine').set('Authorization', auth);
  assert.equal(ownView.status, 200);
  assert.ok(Array.isArray(ownView.body));
});
