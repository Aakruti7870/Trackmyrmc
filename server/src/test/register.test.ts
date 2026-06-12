import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, auditLogs } from '../db/schema.js';

let app: Express;

const validBody = {
  name: 'Priya Shah',
  companyName: 'Shah Constructions',
  email: 'Priya@Shah.com',
  phone: '9876543210',
  password: 'supersecret',
  gstNo: '27ABCDE1234F1Z5',
  city: 'Panvel',
  address: '12 Industrial Estate',
};

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE vehicle_alerts, fuel_logs, challans, vehicles, drivers, clients, audit_logs, app_settings, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => { await pool.end(); });

test('public register creates an inactive client linked to a new client record', async () => {
  const res = await request(app).post('/api/auth/register').send(validBody);
  assert.equal(res.status, 201);
  assert.equal(res.body.pendingApproval, true);

  const [user] = await db.select().from(users).where(eq(users.email, 'priya@shah.com'));
  assert.ok(user, 'user created');
  assert.equal(user.email, 'priya@shah.com', 'email lowercased');
  assert.equal(user.role, 'client');
  assert.equal(user.isActive, false, 'account starts inactive pending approval');
  assert.ok(user.linkedClientId, 'linked to a client');

  const [client] = await db.select().from(clients).where(eq(clients.id, user.linkedClientId!));
  assert.equal(client.name, 'Shah Constructions');
  assert.equal(client.contactPerson, 'Priya Shah');
  assert.equal(client.gstNo, '27ABCDE1234F1Z5');

  const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'account_registered'));
  assert.ok(audit, 'registration is audited');
  assert.equal(audit.targetUserEmail, 'priya@shah.com');
});

test('a freshly registered account cannot log in until activated', async () => {
  await request(app).post('/api/auth/register').send(validBody).expect(201);
  const res = await request(app).post('/api/auth/login').send({ email: 'priya@shah.com', password: 'supersecret' });
  assert.equal(res.status, 401, 'inactive account is rejected at login');
});

test('admin activation lets the account log in', async () => {
  await request(app).post('/api/auth/register').send(validBody).expect(201);
  await db.update(users).set({ isActive: true }).where(eq(users.email, 'priya@shah.com'));
  const res = await request(app).post('/api/auth/login').send({ email: 'priya@shah.com', password: 'supersecret' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'token issued after activation');
});

test('duplicate email is rejected with 409', async () => {
  const passwordHash = await bcrypt.hash('existing123', 10);
  await db.insert(users).values({ name: 'Existing', email: 'priya@shah.com', passwordHash, role: 'client', isActive: true });
  const res = await request(app).post('/api/auth/register').send(validBody);
  assert.equal(res.status, 409);
});

test('duplicate against a soft-deleted account is also rejected', async () => {
  const passwordHash = await bcrypt.hash('existing123', 10);
  await db.insert(users).values({
    name: 'Gone', email: 'priya@shah.com', passwordHash, role: 'client', isActive: false, deletedAt: new Date(),
  });
  const res = await request(app).post('/api/auth/register').send(validBody);
  assert.equal(res.status, 409);
});

test('invalid payloads are rejected with 400 and create nothing', async () => {
  const bad = [
    { ...validBody, email: 'not-an-email' },
    { ...validBody, password: 'short' },
    { ...validBody, name: '' },
    { ...validBody, companyName: '' },
  ];
  for (const body of bad) {
    const res = await request(app).post('/api/auth/register').send(body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  const rows = await db.select().from(users);
  assert.equal(rows.length, 0, 'no users created from invalid payloads');
});

test('optional fields may be omitted', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Min User', companyName: 'Min Co', email: 'min@co.com', phone: '9000000000', password: 'password1',
  });
  assert.equal(res.status, 201);
  const [user] = await db.select().from(users).where(eq(users.email, 'min@co.com'));
  const [client] = await db.select().from(clients).where(eq(clients.id, user.linkedClientId!));
  assert.equal(client.gstNo, null);
  assert.equal(client.city, null);
});
