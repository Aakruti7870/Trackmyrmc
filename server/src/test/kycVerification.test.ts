import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, plants, vehicles, kycProfiles, kycDocuments, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';

let app: Express;
const PASSWORD = 'secret123';
let plantSeq = 0;

async function createPlant() {
  plantSeq += 1;
  const [row] = await db.insert(plants).values({
    plantCode: `KYC-${String(plantSeq).padStart(3, '0')}`,
    name: `KYC Plant ${plantSeq}`,
    legalName: `KYC Plant ${plantSeq} Concrete Pvt Ltd`,
    gstNo: `27AAACK${String(plantSeq).padStart(4, '0')}B1Z5`,
    email: `kycplant${plantSeq}@test.com`,
    latitude: '19.0000000',
    longitude: '72.0000000',
    plantStatus: 'approved',
    isActive: true,
    locationVerified: true,
    grades: ['M25'],
  }).returning();
  return row;
}

async function createUser(role: string, email: string, plantId: number | null = null, extra: Partial<typeof users.$inferInsert> = {}) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: `${role} ${email}`, email, passwordHash,
    role: role as typeof users.$inferInsert['role'],
    isActive: true, plantId, ...extra,
  }).returning();
  return row;
}

async function createClientUser(email: string) {
  const [client] = await db.insert(clients).values({
    name: `Client ${email}`, contactPerson: 'C', phone: '9999999999',
  }).returning();
  const user = await createUser('client', email, null, { linkedClientId: client.id });
  return { user, client };
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ${kycDocuments} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${kycProfiles} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${auditLogs} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${vehicles} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${users} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${clients} RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${plants} RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

// ---------------------------------------------------------------------------
// Self-service profile
// ---------------------------------------------------------------------------

test('client creates a KYC profile; Aadhaar is stored masked (last 4 only)', async () => {
  const { user } = await createClientUser('kyc-client1@test.com');
  const token = tokenFor(user);

  const res = await request(app)
    .put('/api/kyc-verification/me')
    .set('Authorization', `Bearer ${token}`)
    .send({ legalName: 'Acme Constructions', gstNumber: '27AAACK0001B1Z5', panNumber: 'AAAPL1234C', aadhaarMasked: '4321' });
  assert.equal(res.status, 201);
  assert.equal(res.body.aadhaarMasked, 'XXXX-XXXX-4321');
  assert.equal(res.body.entityType, 'customer');
  assert.equal(res.body.status, 'draft');

  const me = await request(app).get('/api/kyc-verification/me').set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.profile.legalName, 'Acme Constructions');
});

test('a full 12-digit Aadhaar number is refused outright', async () => {
  const { user } = await createClientUser('kyc-client2@test.com');
  const res = await request(app)
    .put('/api/kyc-verification/me')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ aadhaarMasked: '123412341234' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /LAST 4 digits/);
});

test('invalid GST and PAN formats are rejected', async () => {
  const { user } = await createClientUser('kyc-client3@test.com');
  const token = tokenFor(user);
  const gst = await request(app).put('/api/kyc-verification/me').set('Authorization', `Bearer ${token}`).send({ gstNumber: 'NOT-A-GST' });
  assert.equal(gst.status, 400);
  const pan = await request(app).put('/api/kyc-verification/me').set('Authorization', `Bearer ${token}`).send({ panNumber: '12345' });
  assert.equal(pan.status, 400);
});

test('submit flow: draft -> submitted; resubmission blocked; edit drops back to draft', async () => {
  const { user } = await createClientUser('kyc-client4@test.com');
  const token = tokenFor(user);
  await request(app).put('/api/kyc-verification/me').set('Authorization', `Bearer ${token}`).send({ legalName: 'X' });

  const sub = await request(app).post('/api/kyc-verification/me/submit').set('Authorization', `Bearer ${token}`).send({});
  assert.equal(sub.status, 200);
  assert.equal(sub.body.status, 'submitted');

  const again = await request(app).post('/api/kyc-verification/me/submit').set('Authorization', `Bearer ${token}`).send({});
  assert.equal(again.status, 409);

  const edit = await request(app).put('/api/kyc-verification/me').set('Authorization', `Bearer ${token}`).send({ legalName: 'Y' });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.status, 'draft');
});

test('an approved profile can no longer be edited by its subject', async () => {
  const { user } = await createClientUser('kyc-client5@test.com');
  await db.insert(kycProfiles).values({ entityType: 'customer', userId: user.id, status: 'verified', legalName: 'Locked' });
  const res = await request(app)
    .put('/api/kyc-verification/me')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ legalName: 'Changed' });
  assert.equal(res.status, 409);
});

// ---------------------------------------------------------------------------
// Review workflow
// ---------------------------------------------------------------------------

test('reviewer approves a submitted profile; audit history is recorded', async () => {
  const { user } = await createClientUser('kyc-client6@test.com');
  const admin = await createUser('admin', 'kyc-admin1@test.com');
  const [profile] = await db.insert(kycProfiles).values({
    entityType: 'customer', userId: user.id, status: 'submitted', submittedAt: new Date(), legalName: 'Acme',
  }).returning();

  const res = await request(app)
    .post(`/api/kyc-verification/profiles/${profile.id}/approve`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'verified');
  assert.equal(res.body.reviewedByName, admin.name);

  const detail = await request(app)
    .get(`/api/kyc-verification/profiles/${profile.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.history.some((h: { action: string }) => h.action === 'kyc.verified'));
});

test('rejection requires a reason; only submitted profiles can be reviewed', async () => {
  const { user } = await createClientUser('kyc-client7@test.com');
  const admin = await createUser('admin', 'kyc-admin2@test.com');
  const [profile] = await db.insert(kycProfiles).values({
    entityType: 'customer', userId: user.id, status: 'submitted', submittedAt: new Date(),
  }).returning();

  const noReason = await request(app)
    .post(`/api/kyc-verification/profiles/${profile.id}/reject`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(noReason.status, 400);

  const rejected = await request(app)
    .post(`/api/kyc-verification/profiles/${profile.id}/reject`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ reason: 'Blurry documents' });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.rejectionReason, 'Blurry documents');

  // No longer 'submitted' -> further review attempts 409
  const again = await request(app)
    .post(`/api/kyc-verification/profiles/${profile.id}/approve`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(again.status, 409);
});

test('nobody can review their own KYC profile', async () => {
  const admin = await createUser('admin', 'kyc-admin3@test.com');
  const [profile] = await db.insert(kycProfiles).values({
    entityType: 'staff', userId: admin.id, status: 'submitted', submittedAt: new Date(),
  }).returning();
  const res = await request(app)
    .post(`/api/kyc-verification/profiles/${profile.id}/approve`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(res.status, 403);
});

test('clients and drivers cannot access the review dashboard', async () => {
  const { user } = await createClientUser('kyc-client8@test.com');
  const res = await request(app)
    .get('/api/kyc-verification/profiles')
    .set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 403);
});

test('plant-bound reviewer only sees their own plant subjects', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const ownerA = await createUser('plant_owner', 'kyc-ownerA@test.com', plantA.id);
  const staffA = await createUser('dispatcher', 'kyc-staffA@test.com', plantA.id);
  const staffB = await createUser('dispatcher', 'kyc-staffB@test.com', plantB.id);
  const [pA] = await db.insert(kycProfiles).values({
    entityType: 'staff', userId: staffA.id, plantId: plantA.id, status: 'submitted', submittedAt: new Date(),
  }).returning();
  const [pB] = await db.insert(kycProfiles).values({
    entityType: 'staff', userId: staffB.id, plantId: plantB.id, status: 'submitted', submittedAt: new Date(),
  }).returning();

  const list = await request(app)
    .get('/api/kyc-verification/profiles')
    .set('Authorization', `Bearer ${tokenFor(ownerA)}`);
  assert.equal(list.status, 200);
  const ids = list.body.map((r: { id: number }) => r.id);
  assert.ok(ids.includes(pA.id));
  assert.ok(!ids.includes(pB.id));

  const detail = await request(app)
    .get(`/api/kyc-verification/profiles/${pB.id}`)
    .set('Authorization', `Bearer ${tokenFor(ownerA)}`);
  assert.equal(detail.status, 404);

  const decide = await request(app)
    .post(`/api/kyc-verification/profiles/${pB.id}/approve`)
    .set('Authorization', `Bearer ${tokenFor(ownerA)}`)
    .send({});
  assert.equal(decide.status, 404);
});

// ---------------------------------------------------------------------------
// Vehicle KYC
// ---------------------------------------------------------------------------

test('plant-bound fleet manager manages vehicle KYC; unbound supervisor is refused', async () => {
  const plant = await createPlant();
  const fleet = await createUser('fleet_manager', 'kyc-fleet@test.com', plant.id);
  const unbound = await createUser('supervisor', 'kyc-sup-unbound@test.com', null);
  const [vehicle] = await db.insert(vehicles).values({ vehicleNo: 'MH01-KYC-1', capacity: '8.00', plantId: plant.id }).returning();

  const put = await request(app)
    .put(`/api/kyc-verification/vehicles/${vehicle.id}`)
    .set('Authorization', `Bearer ${tokenFor(fleet)}`)
    .send({ legalName: 'Concrete King Logistics' });
  assert.equal(put.status < 300, true, `expected success, got ${put.status}: ${JSON.stringify(put.body)}`);

  const submit = await request(app)
    .post(`/api/kyc-verification/vehicles/${vehicle.id}/submit`)
    .set('Authorization', `Bearer ${tokenFor(fleet)}`)
    .send({});
  assert.equal(submit.status, 200);
  assert.equal(submit.body.status, 'submitted');

  const refused = await request(app)
    .put(`/api/kyc-verification/vehicles/${vehicle.id}`)
    .set('Authorization', `Bearer ${tokenFor(unbound)}`)
    .send({ legalName: 'X' });
  assert.equal(refused.status, 403);
});

test('vehicle KYC is plant-scoped for plant-bound managers', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const fleetA = await createUser('fleet_manager', 'kyc-fleetA@test.com', plantA.id);
  const [vehicleB] = await db.insert(vehicles).values({ vehicleNo: 'MH02-KYC-2', capacity: '8.00', plantId: plantB.id }).returning();

  const res = await request(app)
    .get(`/api/kyc-verification/vehicles/${vehicleB.id}`)
    .set('Authorization', `Bearer ${tokenFor(fleetA)}`);
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// Expiring documents + badges
// ---------------------------------------------------------------------------

test('expiring endpoint lists documents inside the window only', async () => {
  const admin = await createUser('admin', 'kyc-admin4@test.com');
  const { user } = await createClientUser('kyc-client9@test.com');
  const [profile] = await db.insert(kycProfiles).values({ entityType: 'customer', userId: user.id, status: 'verified' }).returning();
  const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const far = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
  await db.insert(kycDocuments).values([
    { profileId: profile.id, docType: 'insurance', objectPath: '/objects/kyc/a', expiryDate: soon, uploadedBy: user.id },
    { profileId: profile.id, docType: 'puc', objectPath: '/objects/kyc/b', expiryDate: far, uploadedBy: user.id },
  ]);

  const res = await request(app)
    .get('/api/kyc-verification/expiring?days=30')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  const types = res.body.map((r: { docType: string }) => r.docType);
  assert.ok(types.includes('insurance'));
  assert.ok(!types.includes('puc'));
});

test('badges endpoint returns a status map for requested vehicle ids', async () => {
  const plant = await createPlant();
  const admin = await createUser('admin', 'kyc-admin5@test.com');
  const [v1] = await db.insert(vehicles).values({ vehicleNo: 'MH03-KYC-3', capacity: '8.00', plantId: plant.id }).returning();
  const [v2] = await db.insert(vehicles).values({ vehicleNo: 'MH03-KYC-4', capacity: '8.00', plantId: plant.id }).returning();
  await db.insert(kycProfiles).values({ entityType: 'vehicle', vehicleId: v1.id, plantId: plant.id, status: 'verified' });

  const res = await request(app)
    .get(`/api/kyc-verification/badges?entity=vehicle&ids=${v1.id},${v2.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body[v1.id], 'approved');
  assert.equal(res.body[v2.id], undefined);
});

test('badges endpoint refuses plant-unbound sub-admin roles', async () => {
  const plant = await createPlant();
  const [v1] = await db.insert(vehicles).values({ vehicleNo: 'MH04-KYC-5', capacity: '8.00', plantId: plant.id }).returning();
  await db.insert(kycProfiles).values({ entityType: 'vehicle', vehicleId: v1.id, plantId: plant.id, status: 'verified' });

  for (const role of ['supervisor', 'fleet_manager', 'dispatcher'] as const) {
    const unbound = await createUser(role, `kyc-unbound-${role}@test.com`, null);
    const res = await request(app)
      .get(`/api/kyc-verification/badges?entity=vehicle&ids=${v1.id}`)
      .set('Authorization', `Bearer ${tokenFor(unbound)}`);
    assert.equal(res.status, 403, `${role} with no plant binding must be refused`);
  }

  // A plant-bound supervisor still gets their own plant's badges.
  const bound = await createUser('supervisor', 'kyc-bound-sup@test.com', plant.id);
  const ok = await request(app)
    .get(`/api/kyc-verification/badges?entity=vehicle&ids=${v1.id}`)
    .set('Authorization', `Bearer ${tokenFor(bound)}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body[v1.id], 'approved');
});

test('document metadata endpoints validate object paths and doc types', async (t) => {
  const { user } = await createClientUser('kyc-client10@test.com');
  const token = tokenFor(user);
  await request(app).put('/api/kyc-verification/me').set('Authorization', `Bearer ${token}`).send({ legalName: 'D' });
  // The document row only stores the object path; pretend the upload landed.
  t.mock.method(proofPhotoStore, 'verifyExists', async () => true);
  t.mock.method(proofPhotoStore, 'remove', async () => {});

  const badPath = await request(app)
    .post('/api/kyc-verification/me/documents')
    .set('Authorization', `Bearer ${token}`)
    .send({ docType: 'pan', objectPath: 'https://evil.example/x.png' });
  assert.equal(badPath.status, 400);

  const badType = await request(app)
    .post('/api/kyc-verification/me/documents')
    .set('Authorization', `Bearer ${token}`)
    .send({ docType: 'passport', objectPath: '/objects/kyc/x' });
  assert.equal(badType.status, 400);

  const ok = await request(app)
    .post('/api/kyc-verification/me/documents')
    .set('Authorization', `Bearer ${token}`)
    .send({ docType: 'pan', objectPath: '/objects/kyc/x', fileName: 'pan.png' });
  assert.equal(ok.status, 201);

  const del = await request(app)
    .delete(`/api/kyc-verification/me/documents/${ok.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status < 300, true);
});
