import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

let app: Express;
const PASSWORD = 'secret123';

async function createAdmin() {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: 'Admin', email: 'admin@test.com', passwordHash, role: 'admin', isActive: true,
  }).returning();
  return row;
}

async function createClient(name = 'Acme Corp') {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Contact', phone: '8888888888', creditLimit: '0', outstandingAmount: '0',
  }).returning();
  return row;
}

async function createDriver(name = 'John Driver') {
  const [row] = await db.insert(drivers).values({ name, phone: '9999999999' }).returning();
  return row;
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

test('client delete is blocked when an active user is linked', async () => {
  const admin = await createAdmin();
  const client = await createClient();
  const passwordHash = await hashPassword(PASSWORD);
  const [linked] = await db.insert(users).values({
    name: 'Client Login', email: 'client@test.com', passwordHash, role: 'client',
    isActive: true, linkedClientId: client.id,
  }).returning();

  const res = await request(app)
    .delete(`/api/clients/${client.id}`)
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 409);
  assert.match(res.body.error, /Client Login/);
  assert.match(res.body.error, /client@test.com/);
  assert.equal(res.body.linkedUsers[0].id, linked.id);

  const [stillThere] = await db.select().from(clients).where(eq(clients.id, client.id));
  assert.ok(stillThere, 'client should not be deleted');
});

test('client delete succeeds when the only linked user is soft-deleted', async () => {
  const admin = await createAdmin();
  const client = await createClient();
  const passwordHash = await hashPassword(PASSWORD);
  await db.insert(users).values({
    name: 'Old Login', email: 'old@test.com', passwordHash, role: 'client',
    isActive: false, deletedAt: new Date(), linkedClientId: client.id,
  });

  const res = await request(app)
    .delete(`/api/clients/${client.id}`)
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 200);
  const [gone] = await db.select().from(clients).where(eq(clients.id, client.id));
  assert.equal(gone, undefined, 'client should be deleted');
});

test('client delete succeeds when no user is linked', async () => {
  const admin = await createAdmin();
  const client = await createClient();
  const res = await request(app)
    .delete(`/api/clients/${client.id}`)
    .set('Authorization', `Bearer ${signToken(admin)}`);
  assert.equal(res.status, 200);
});

test('driver delete is blocked when an active user is linked', async () => {
  const admin = await createAdmin();
  const driver = await createDriver();
  const passwordHash = await hashPassword(PASSWORD);
  const [linked] = await db.insert(users).values({
    name: 'Driver Login', email: 'driver@test.com', passwordHash, role: 'driver',
    isActive: true, linkedDriverId: driver.id,
  }).returning();

  const res = await request(app)
    .delete(`/api/drivers/${driver.id}`)
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 409);
  assert.match(res.body.error, /Driver Login/);
  assert.match(res.body.error, /driver@test.com/);
  assert.equal(res.body.linkedUsers[0].id, linked.id);

  const [stillThere] = await db.select().from(drivers).where(eq(drivers.id, driver.id));
  assert.ok(stillThere, 'driver should not be deleted');
});

test('driver delete succeeds when the only linked user is soft-deleted', async () => {
  const admin = await createAdmin();
  const driver = await createDriver();
  const passwordHash = await hashPassword(PASSWORD);
  await db.insert(users).values({
    name: 'Old Driver Login', email: 'oldd@test.com', passwordHash, role: 'driver',
    isActive: false, deletedAt: new Date(), linkedDriverId: driver.id,
  });

  const res = await request(app)
    .delete(`/api/drivers/${driver.id}`)
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 200);
  const [gone] = await db.select().from(drivers).where(eq(drivers.id, driver.id));
  assert.equal(gone, undefined, 'driver should be deleted');
});

test('driver delete succeeds when no user is linked', async () => {
  const admin = await createAdmin();
  const driver = await createDriver();
  const res = await request(app)
    .delete(`/api/drivers/${driver.id}`)
    .set('Authorization', `Bearer ${signToken(admin)}`);
  assert.equal(res.status, 200);
});

test('GET /clients includes linkedUsers for active linked accounts and empty otherwise', async () => {
  const admin = await createAdmin();
  const linkedClient = await createClient('Linked Corp');
  const plainClient = await createClient('Plain Corp');
  const passwordHash = await hashPassword(PASSWORD);
  const [linked] = await db.insert(users).values({
    name: 'Client Login', email: 'clogin@test.com', passwordHash, role: 'client',
    isActive: true, linkedClientId: linkedClient.id,
  }).returning();

  const res = await request(app)
    .get('/api/clients')
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 200);
  const linkedRow = res.body.find((c: { id: number }) => c.id === linkedClient.id);
  const plainRow = res.body.find((c: { id: number }) => c.id === plainClient.id);
  assert.deepEqual(linkedRow.linkedUsers, [
    { id: linked.id, name: 'Client Login', email: 'clogin@test.com' },
  ]);
  assert.deepEqual(plainRow.linkedUsers, []);
});

test('GET /clients excludes soft-deleted users from linkedUsers', async () => {
  const admin = await createAdmin();
  const client = await createClient('Soft Corp');
  const passwordHash = await hashPassword(PASSWORD);
  await db.insert(users).values({
    name: 'Old Login', email: 'oldc@test.com', passwordHash, role: 'client',
    isActive: false, deletedAt: new Date(), linkedClientId: client.id,
  });

  const res = await request(app)
    .get('/api/clients')
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 200);
  const row = res.body.find((c: { id: number }) => c.id === client.id);
  assert.deepEqual(row.linkedUsers, []);
});

test('GET /drivers includes linkedUsers for active linked accounts and empty otherwise', async () => {
  const admin = await createAdmin();
  const linkedDriver = await createDriver('Linked Driver');
  const plainDriver = await createDriver('Plain Driver');
  const passwordHash = await hashPassword(PASSWORD);
  const [linked] = await db.insert(users).values({
    name: 'Driver Login', email: 'dlogin@test.com', passwordHash, role: 'driver',
    isActive: true, linkedDriverId: linkedDriver.id,
  }).returning();

  const res = await request(app)
    .get('/api/drivers')
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 200);
  const linkedRow = res.body.find((d: { id: number }) => d.id === linkedDriver.id);
  const plainRow = res.body.find((d: { id: number }) => d.id === plainDriver.id);
  assert.deepEqual(linkedRow.linkedUsers, [
    { id: linked.id, name: 'Driver Login', email: 'dlogin@test.com' },
  ]);
  assert.deepEqual(plainRow.linkedUsers, []);
});

test('GET /drivers excludes soft-deleted users from linkedUsers', async () => {
  const admin = await createAdmin();
  const driver = await createDriver('Soft Driver');
  const passwordHash = await hashPassword(PASSWORD);
  await db.insert(users).values({
    name: 'Old Driver Login', email: 'oldd2@test.com', passwordHash, role: 'driver',
    isActive: false, deletedAt: new Date(), linkedDriverId: driver.id,
  });

  const res = await request(app)
    .get('/api/drivers')
    .set('Authorization', `Bearer ${signToken(admin)}`);

  assert.equal(res.status, 200);
  const row = res.body.find((d: { id: number }) => d.id === driver.id);
  assert.deepEqual(row.linkedUsers, []);
});
