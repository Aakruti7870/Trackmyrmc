import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { drivers, plants, users } from '../db/schema.js';

let app: Express;

const ENV_KEYS = [
  'REVIEW_OWNER_EMAIL',
  'REVIEW_OWNER_PASSWORD',
  'REVIEW_OWNER_PLANT_NAME',
  'REVIEW_DRIVER_PHONE',
  'REVIEW_DRIVER_OTP',
  'REVIEW_DRIVER_PLANT_NAME',
] as const;
const savedEnv: Record<string, string | undefined> = {};

const OWNER_EMAIL = 'review-owner@example.com';
const OWNER_PASSWORD = 'ReviewPass123!';
const OWNER_PLANT = 'Concreteking Panvel Test';
const DRIVER_PHONE = '7000000001';
const DRIVER_OTP = '654321';
const DRIVER_PLANT_ALIAS = 'Concreteking@panvel Test';

before(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.REVIEW_OWNER_EMAIL = OWNER_EMAIL;
  process.env.REVIEW_OWNER_PASSWORD = OWNER_PASSWORD;
  process.env.REVIEW_OWNER_PLANT_NAME = OWNER_PLANT;
  process.env.REVIEW_DRIVER_PHONE = DRIVER_PHONE;
  process.env.REVIEW_DRIVER_OTP = DRIVER_OTP;
  process.env.REVIEW_DRIVER_PLANT_NAME = DRIVER_PLANT_ALIAS;
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users, drivers, plants, login_attempts RESTART IDENTITY CASCADE`);
});

after(async () => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  await pool.end();
});

test('reviewer owner login-method seeds a hidden plant-scoped owner and requests password', async () => {
  const res = await request(app)
    .post('/api/auth/staff/login-method')
    .send({ email: OWNER_EMAIL });

  assert.equal(res.status, 200);
  assert.equal(res.body.method, 'password');

  const [owner] = await db.select().from(users).where(eq(users.email, OWNER_EMAIL));
  assert.ok(owner);
  assert.equal(owner.role, 'plant_owner');
  assert.equal(owner.isActive, true);
  assert.ok(owner.plantId);

  const [plant] = await db.select().from(plants).where(eq(plants.id, owner.plantId!));
  assert.ok(plant);
  assert.equal(plant.name, OWNER_PLANT);
  // The compatibility-safe fallback is kept out of customer discovery by the
  // durable visibility gates shared across current production schemas: it is
  // pending on the network and is neither platform-verified nor location-verified.
  assert.equal(plant.networkStatus, 'pending');
  assert.equal(plant.verified, false);
  assert.equal(plant.locationVerified, false);
});

test('reviewer owner can log in with the configured password without secondary OTP', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });

  assert.equal(res.status, 200);
  assert.equal(typeof res.body.token, 'string');
  assert.equal(res.body.user.email, OWNER_EMAIL);
  assert.equal(res.body.user.role, 'plant_owner');
  assert.ok(res.body.user.plantId);
});

test('reviewer owner rejects a wrong password', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: OWNER_EMAIL, password: 'wrong-password' });

  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Invalid credentials');
});

test('reviewer driver fixed OTP signs in as a provisioned plant-scoped driver', async () => {
  const send = await request(app)
    .post('/api/auth/otp/send')
    .send({ phone: DRIVER_PHONE });

  assert.equal(send.status, 200);
  assert.equal(send.body.ok, true);
  assert.equal(send.body.channel, 'review');
  assert.equal(send.body.devMode, false);
  assert.equal(send.body.devCode, undefined);

  const verify = await request(app)
    .post('/api/auth/otp/verify')
    .send({ phone: DRIVER_PHONE, code: DRIVER_OTP });

  assert.equal(verify.status, 200);
  assert.equal(typeof verify.body.token, 'string');
  assert.equal(verify.body.user.role, 'driver');
  assert.ok(verify.body.user.plantId);
  assert.ok(verify.body.user.linkedDriverId);

  const [driver] = await db.select().from(drivers).where(eq(drivers.id, verify.body.user.linkedDriverId));
  assert.ok(driver);
  assert.equal(driver.isActive, true);
  assert.equal(driver.phone.replace(/\D/g, '').slice(-10), DRIVER_PHONE);

  const [driverUser] = await db.select().from(users).where(eq(users.linkedDriverId, driver.id));
  assert.ok(driverUser);
  assert.equal(driverUser.role, 'driver');
  assert.equal(driverUser.plantId, verify.body.user.plantId);
});

test('reviewer driver rejects a wrong fixed OTP', async () => {
  const res = await request(app)
    .post('/api/auth/otp/verify')
    .send({ phone: DRIVER_PHONE, code: '000000' });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /incorrect|expired/i);
});
