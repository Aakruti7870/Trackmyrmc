import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, loginAttempts } from '../db/schema.js';
import { MAX_ATTEMPTS } from '../lib/loginAttempts.js';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;

const PASSWORD = 'secret123';
const WRONG_PASSWORD = 'wrongpass';

async function createUser(opts: {
  name: string; email: string; role?: Role; isActive?: boolean;
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'dispatcher',
    isActive: opts.isActive ?? true,
  }).returning();
  return row;
}

function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password });
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Lockout is created after MAX_ATTEMPTS failed logins
// ---------------------------------------------------------------------------

test('locks the account after MAX_ATTEMPTS failed logins and blocks even a correct password', async () => {
  const email = 'victim@test.com';
  await createUser({ name: 'Victim', email });

  // The first MAX_ATTEMPTS - 1 wrong-password attempts are rejected as invalid
  // credentials (401) but do not lock the account yet.
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
    const res = await login(email, WRONG_PASSWORD);
    assert.equal(res.status, 401, `attempt ${i + 1} should be 401 (not yet locked)`);
  }

  // The MAX_ATTEMPTS-th wrong-password attempt trips the lockout: the request
  // is now answered with 429 rather than 401.
  const tripping = await login(email, WRONG_PASSWORD);
  assert.equal(tripping.status, 429, 'the MAX_ATTEMPTS-th attempt should trigger the lockout');

  // A row recording the lockout exists with an active lockedUntil in the future.
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, `login:${email}`));
  assert.ok(row, 'a login_attempts row should exist');
  assert.ok(row.count >= MAX_ATTEMPTS, 'failure count should have reached the threshold');
  assert.ok(row.lockedUntil && row.lockedUntil.getTime() > Date.now(), 'lockedUntil should be in the future');

  // Once locked, even the correct password is rejected with 429.
  const correct = await login(email, PASSWORD);
  assert.equal(correct.status, 429, 'a correct password should still be blocked while locked');
});

// ---------------------------------------------------------------------------
// A successful login resets the failure counter
// ---------------------------------------------------------------------------

test('a successful login before the threshold resets the failure counter', async () => {
  const email = 'resetme@test.com';
  await createUser({ name: 'Reset', email });

  // Rack up failures just short of the threshold.
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
    const res = await login(email, WRONG_PASSWORD);
    assert.equal(res.status, 401);
  }

  // A correct login succeeds and clears the recorded failures.
  const good = await login(email, PASSWORD);
  assert.equal(good.status, 200, 'correct credentials should succeed before lockout');
  assert.ok(good.body.token, 'a token should be issued on success');

  const after = await db.select().from(loginAttempts).where(eq(loginAttempts.key, `login:${email}`));
  assert.equal(after.length, 0, 'the failure counter row should be cleared on success');

  // Because the counter was reset, another full run of (MAX_ATTEMPTS - 1)
  // failures still does not lock the account.
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
    const res = await login(email, WRONG_PASSWORD);
    assert.equal(res.status, 401, `post-reset attempt ${i + 1} should still be 401`);
  }
});

// ---------------------------------------------------------------------------
// Attempts below the threshold do not lock out
// ---------------------------------------------------------------------------

test('attempts below the threshold do not lock the account', async () => {
  const email = 'belowthreshold@test.com';
  await createUser({ name: 'Below', email });

  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
    const res = await login(email, WRONG_PASSWORD);
    assert.equal(res.status, 401);
  }

  // No active lockout has been written.
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, `login:${email}`));
  assert.ok(row, 'a counter row should exist');
  assert.equal(row.lockedUntil, null, 'no lockout should be set below the threshold');

  // The correct password still logs in successfully.
  const good = await login(email, PASSWORD);
  assert.equal(good.status, 200, 'correct credentials should succeed when below the threshold');
  assert.ok(good.body.token);
});
