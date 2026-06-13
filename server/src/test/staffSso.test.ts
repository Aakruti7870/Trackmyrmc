import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { resolveStaffSsoUser } from '../lib/staffSso.js';

let app: Express;

const PASSWORD = 'secret123';

// Both the authority allow-list (AUTHORITY_EMAILS) and the Clerk secret
// (CLERK_SECRET_KEY) are read live from the environment, so snapshot and restore
// them around the suite to avoid leaking state into other test files.
const ORIGINAL_AUTHORITY_EMAILS = process.env.AUTHORITY_EMAILS;
const ORIGINAL_CLERK_SECRET = process.env.CLERK_SECRET_KEY;

async function createUser(
  role: string,
  email: string,
  opts: { isActive?: boolean; deletedAt?: Date | null } = {},
) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name: `${role} user`, email, passwordHash, role: role as 'admin',
    isActive: opts.isActive ?? true,
    deletedAt: opts.deletedAt ?? null,
  }).returning();
  return user;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
});

afterEach(() => {
  delete process.env.AUTHORITY_EMAILS;
  delete process.env.CLERK_SECRET_KEY;
});

after(async () => {
  if (ORIGINAL_AUTHORITY_EMAILS === undefined) delete process.env.AUTHORITY_EMAILS;
  else process.env.AUTHORITY_EMAILS = ORIGINAL_AUTHORITY_EMAILS;
  if (ORIGINAL_CLERK_SECRET === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = ORIGINAL_CLERK_SECRET;
  await pool.end();
});

// ---------------------------------------------------------------------------
// resolveStaffSsoUser — the SSO security boundary, tested directly against the
// database without a real Clerk session.
// ---------------------------------------------------------------------------

test('resolveStaffSsoUser rejects an unknown email', async () => {
  const res = await resolveStaffSsoUser('nobody@aakruti.com');
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 403);
});

test('resolveStaffSsoUser rejects a client account (SSO is staff-only)', async () => {
  await createUser('client', 'client@aakruti.com');
  const res = await resolveStaffSsoUser('client@aakruti.com');
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.status, 403);
});

test('resolveStaffSsoUser rejects a driver account (SSO is staff-only)', async () => {
  await createUser('driver', 'driver@aakruti.com');
  const res = await resolveStaffSsoUser('driver@aakruti.com');
  assert.equal(res.ok, false);
});

test('resolveStaffSsoUser rejects a deactivated staff account', async () => {
  await createUser('dispatcher', 'inactive@aakruti.com', { isActive: false });
  const res = await resolveStaffSsoUser('inactive@aakruti.com');
  assert.equal(res.ok, false);
});

test('resolveStaffSsoUser rejects a soft-deleted staff account', async () => {
  await createUser('admin', 'gone@aakruti.com', { deletedAt: new Date() });
  const res = await resolveStaffSsoUser('gone@aakruti.com');
  assert.equal(res.ok, false);
});

test('resolveStaffSsoUser accepts admin, dispatcher and plant_operator', async () => {
  await createUser('admin', 'admin@aakruti.com');
  await createUser('dispatcher', 'dispatch@aakruti.com');
  await createUser('plant_operator', 'plant@aakruti.com');

  for (const email of ['admin@aakruti.com', 'dispatch@aakruti.com', 'plant@aakruti.com']) {
    const res = await resolveStaffSsoUser(email);
    assert.equal(res.ok, true, `${email} should be allowed`);
    if (res.ok) assert.equal(res.user.email, email);
  }
});

test('resolveStaffSsoUser matches case-insensitively', async () => {
  await createUser('admin', 'admin@aakruti.com');
  const res = await resolveStaffSsoUser('  ADMIN@Aakruti.com  ');
  assert.equal(res.ok, true);
});

test('resolveStaffSsoUser rejects an authority account that is not allow-listed', async () => {
  process.env.AUTHORITY_EMAILS = 'boss@aakruti.com';
  await createUser('authority', 'ghost@aakruti.com');
  const res = await resolveStaffSsoUser('ghost@aakruti.com');
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /allow-list/i);
});

test('resolveStaffSsoUser accepts an allow-listed authority account', async () => {
  process.env.AUTHORITY_EMAILS = 'boss@aakruti.com';
  await createUser('authority', 'boss@aakruti.com');
  const res = await resolveStaffSsoUser('boss@aakruti.com');
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.user.role, 'authority');
});

// ---------------------------------------------------------------------------
// POST /api/auth/clerk — the deterministic, no-Clerk-call guard paths. The full
// verify→exchange flow is covered end-to-end with real keys in manual/e2e
// verification, since it requires a live Clerk session.
// ---------------------------------------------------------------------------

test('POST /api/auth/clerk returns 503 when Clerk is not configured', async () => {
  delete process.env.CLERK_SECRET_KEY;
  const res = await request(app).post('/api/auth/clerk').send({ token: 'anything' });
  assert.equal(res.status, 503);
});

test('POST /api/auth/clerk returns 400 when no token is supplied', async () => {
  process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
  const res = await request(app).post('/api/auth/clerk').send({});
  assert.equal(res.status, 400);
});
