import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomBytes, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

// Covers the /api/public/rmc-plants/:id/claim invite-token gate. Previously
// this endpoint only required `requireAuth`, so any signed-in user could
// claim (and overwrite the contact/legal details of) any Google-listed
// plant. It now requires the invite token the admin-only
// send-onboarding-invite endpoint generates, consumed atomically with the
// claim so a token can't be replayed and two concurrent claims can't both
// succeed.

let app: Express;

async function createCustomer(email: string) {
  const [row] = await db.insert(users).values({
    name: 'Claimant', email, passwordHash: 'not-used', role: 'client', isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createGoogleListedPlant(name: string) {
  const result = await pool.query(`
    INSERT INTO plants (name, latitude, longitude, verification_level, onboarding_status, owner_user_id)
    VALUES ($1, '19.0000000', '73.0000000', 'GOOGLE_LISTED', 'INVITED', NULL)
    RETURNING id
  `, [name]);
  return result.rows[0].id as number;
}

async function seedInvite(plantId: number, opts: { expired?: boolean; consumed?: boolean } = {}) {
  const token = randomBytes(16).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = opts.expired ? new Date(Date.now() - 1000) : new Date(Date.now() + 48 * 3_600_000);
  const [admin] = await db.insert(users).values({
    name: 'Authority', email: `authority-${tokenHash.slice(0, 8)}@test.com`, passwordHash: 'x', role: 'authority', isActive: true,
  }).returning();
  await pool.query(`
    INSERT INTO rmc_plant_onboarding_invites
      (plant_id, invited_mobile_number, invite_token_hash, invite_status, expires_at, created_by_user_id)
    VALUES ($1, '9800000000', $2, $3, $4, $5)
  `, [plantId, tokenHash, opts.consumed ? 'ACCEPTED' : 'INVITED', expiresAt, admin.id]);
  return token;
}

function claimPayload() {
  return {
    applicantName: 'Ramesh Patil',
    mobile: '9811122233',
    designation: 'Owner',
    legalBusinessName: 'Patil Concrete Works',
    plantAddress: 'MIDC, Pune',
    latitude: 19.01,
    longitude: 73.01,
    availableGrades: ['M25'],
    deliveryRadiusKm: 25,
    authorityConfirmed: true,
  };
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE rmc_plant_onboarding_invites RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE plants RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

test('claiming without an invite token is rejected', async () => {
  const plantId = await createGoogleListedPlant('Unclaimed RMC');
  const customer = await createCustomer('claimant1@test.com');

  const res = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send(claimPayload());

  assert.equal(res.status, 400);
});

test('claiming with an unknown/wrong invite token is rejected (403), plant untouched', async () => {
  const plantId = await createGoogleListedPlant('Unclaimed RMC 2');
  await seedInvite(plantId);
  const customer = await createCustomer('claimant2@test.com');

  const res = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...claimPayload(), inviteToken: 'not-the-real-token' });

  assert.equal(res.status, 403);
  const row = await pool.query('SELECT owner_user_id FROM plants WHERE id = $1', [plantId]);
  assert.equal(row.rows[0].owner_user_id, null);
});

test('claiming with an expired invite token is rejected (403)', async () => {
  const plantId = await createGoogleListedPlant('Unclaimed RMC 3');
  const token = await seedInvite(plantId, { expired: true });
  const customer = await createCustomer('claimant3@test.com');

  const res = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...claimPayload(), inviteToken: token });

  assert.equal(res.status, 403);
});

test('claiming with an already-used invite token is rejected (403)', async () => {
  const plantId = await createGoogleListedPlant('Unclaimed RMC 4');
  const token = await seedInvite(plantId, { consumed: true });
  const customer = await createCustomer('claimant4@test.com');

  const res = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...claimPayload(), inviteToken: token });

  assert.equal(res.status, 403);
});

test('a valid invite token claims the plant, sets owner_user_id, and consumes the invite', async () => {
  const plantId = await createGoogleListedPlant('Claimable RMC');
  const token = await seedInvite(plantId);
  const customer = await createCustomer('claimant5@test.com');

  const res = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send({ ...claimPayload(), inviteToken: token });

  assert.equal(res.status, 202);
  assert.equal(res.body.onboardingStatus, 'CLAIM_PENDING');

  const plantRow = await pool.query('SELECT owner_user_id, onboarding_status FROM plants WHERE id = $1', [plantId]);
  assert.equal(plantRow.rows[0].owner_user_id, customer.id);
  assert.equal(plantRow.rows[0].onboarding_status, 'CLAIM_PENDING');

  const inviteRow = await pool.query('SELECT invite_status FROM rmc_plant_onboarding_invites WHERE plant_id = $1', [plantId]);
  assert.equal(inviteRow.rows[0].invite_status, 'ACCEPTED');
});

test('a second claim attempt with the same (now-consumed) token is rejected, not re-claimed', async () => {
  const plantId = await createGoogleListedPlant('Claimable RMC 2');
  const token = await seedInvite(plantId);
  const first = await createCustomer('claimant6a@test.com');
  const second = await createCustomer('claimant6b@test.com');

  const res1 = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(first)}`)
    .send({ ...claimPayload(), inviteToken: token });
  assert.equal(res1.status, 202);

  const res2 = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .set('Authorization', `Bearer ${tokenFor(second)}`)
    .send({ ...claimPayload(), inviteToken: token });
  assert.equal(res2.status, 403);

  const plantRow = await pool.query('SELECT owner_user_id FROM plants WHERE id = $1', [plantId]);
  assert.equal(plantRow.rows[0].owner_user_id, first.id, 'the second claimant must not overwrite the first');
});

test('claiming requires authentication', async () => {
  const plantId = await createGoogleListedPlant('Unclaimed RMC 5');
  const token = await seedInvite(plantId);

  const res = await request(app)
    .post(`/api/public/rmc-plants/${plantId}/claim`)
    .send({ ...claimPayload(), inviteToken: token });

  assert.equal(res.status, 401);
});
