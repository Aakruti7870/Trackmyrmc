import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs, clients, challans, challanProofPhotos } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;

const PASSWORD = 'secret123';

// A minimal but valid 1x1 transparent PNG as an image data URL.
const BASE64_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
const BASE64_PHOTO_2 = BASE64_PHOTO.replace('iVBOR', 'iVBOX');

async function createUser(opts: { name: string; email: string; role?: Role }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'dispatcher',
    isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

let challanSeq = 0;
async function createChallan() {
  const [client] = await db.insert(clients).values({
    name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  challanSeq += 1;
  const [challan] = await db.insert(challans).values({
    challanNo: `CH-A${String(challanSeq).padStart(4, '0')}`,
    clientId: client.id,
    grade: 'M25',
    quantity: '6.00',
    status: 'delivered',
    dispatchTime: new Date(),
  }).returning();
  return challan;
}

async function addPhoto(challanId: number, photo: string) {
  const [row] = await db.insert(challanProofPhotos).values({ challanId, photo }).returning();
  return row;
}

async function photoById(id: number): Promise<string> {
  const [row] = await db.select({ photo: challanProofPhotos.photo })
    .from(challanProofPhotos).where(eq(challanProofPhotos.id, id));
  return row.photo;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challan_proof_photos, challans, clients, audit_logs, users RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

test('GET /api/admin/proof-photos/stuck rejects a non-admin with 403', async () => {
  const dispatcher = await createUser({ name: 'Dispatch', email: 'd@test.com', role: 'dispatcher' });
  const res = await request(app)
    .get('/api/admin/proof-photos/stuck')
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
  assert.equal(res.status, 403);
});

test('GET /api/admin/proof-photos/stuck rejects an unauthenticated request with 401', async () => {
  const res = await request(app).get('/api/admin/proof-photos/stuck');
  assert.equal(res.status, 401);
});

test('POST /api/admin/proof-photos/retry rejects a non-admin with 403 and uploads nothing', async (t) => {
  const driver = await createUser({ name: 'Driver', email: 'driver@test.com', role: 'driver' });
  const challan = await createChallan();
  await addPhoto(challan.id, BASE64_PHOTO);

  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => '/objects/uploads/nope');

  const res = await request(app)
    .post('/api/admin/proof-photos/retry')
    .set('Authorization', `Bearer ${tokenFor(driver)}`)
    .send({});

  assert.equal(res.status, 403);
  assert.equal(storeMock.mock.callCount(), 0, 'a forbidden caller never triggers an upload');
});

// ---------------------------------------------------------------------------
// GET /api/admin/proof-photos/stuck
// ---------------------------------------------------------------------------

test('reports only the rows still stored as base64 as stuck', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const challan = await createChallan();
  const stuckA = await addPhoto(challan.id, BASE64_PHOTO);
  const stuckB = await addPhoto(challan.id, BASE64_PHOTO_2);
  await addPhoto(challan.id, '/objects/uploads/already-there');

  const res = await request(app)
    .get('/api/admin/proof-photos/stuck')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 2);
  assert.deepEqual(
    res.body.photos.map((p: { id: number }) => p.id).sort((a: number, b: number) => a - b),
    [stuckA.id, stuckB.id].sort((a, b) => a - b),
  );
  assert.equal(res.body.photos[0].challanId, challan.id);
});

test('reports zero stuck photos when everything is already an object path', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const challan = await createChallan();
  await addPhoto(challan.id, '/objects/uploads/a');
  await addPhoto(challan.id, '/objects/uploads/b');

  const res = await request(app)
    .get('/api/admin/proof-photos/stuck')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { count: 0, photos: [] });
});

// ---------------------------------------------------------------------------
// POST /api/admin/proof-photos/retry
// ---------------------------------------------------------------------------

test('with no ids: retries every stuck row, rewrites the recovered ones, and audit-logs success', async (t) => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const challan = await createChallan();
  const rowA = await addPhoto(challan.id, BASE64_PHOTO);
  const rowB = await addPhoto(challan.id, BASE64_PHOTO_2);

  let counter = 0;
  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => `/objects/uploads/ok-${counter++}`);

  const res = await request(app)
    .post('/api/admin/proof-photos/retry')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(storeMock.mock.callCount(), 2, 'both stuck rows are retried');
  assert.equal(res.body.migrated, 2);
  assert.equal(res.body.failed, 0);
  assert.deepEqual(res.body.failures, []);

  // Both rows now hold object paths.
  assert.ok((await photoById(rowA.id)).startsWith('/objects/'));
  assert.ok((await photoById(rowB.id)).startsWith('/objects/'));

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'proof_photos_retried'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorId, admin.id);
  assert.equal(logs[0].status, 'success');
});

test('partial failure: still-stuck rows come back as a fresh actionable report and audit-logs failure', async (t) => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const challan = await createChallan();
  const rowA = await addPhoto(challan.id, BASE64_PHOTO);
  const rowB = await addPhoto(challan.id, BASE64_PHOTO_2);

  // rowA recovers; rowB still fails.
  const storeMock = t.mock.method(proofPhotoStore, 'store', async (dataUrl: string) => {
    if (dataUrl === BASE64_PHOTO) return '/objects/uploads/recovered';
    throw new Error('still down');
  });

  const res = await request(app)
    .post('/api/admin/proof-photos/retry')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(storeMock.mock.callCount(), 2);
  assert.equal(res.body.migrated, 1);
  assert.equal(res.body.failed, 1);
  assert.deepEqual(res.body.failures, [
    { id: rowB.id, challanId: challan.id, error: 'still down' },
  ]);

  // The recovered row is rewritten; the still-failing one keeps its base64.
  assert.equal(await photoById(rowA.id), '/objects/uploads/recovered');
  assert.equal(await photoById(rowB.id), BASE64_PHOTO_2);

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'proof_photos_retried'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'failure');
});

test('with explicit ids: retries only those rows', async (t) => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const challan = await createChallan();
  const rowA = await addPhoto(challan.id, BASE64_PHOTO);
  const rowB = await addPhoto(challan.id, BASE64_PHOTO_2);

  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => '/objects/uploads/targeted');

  const res = await request(app)
    .post('/api/admin/proof-photos/retry')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ ids: [rowA.id] });

  assert.equal(res.status, 200);
  assert.equal(storeMock.mock.callCount(), 1, 'only the requested row is retried');
  assert.equal(res.body.migrated, 1);
  assert.ok((await photoById(rowA.id)).startsWith('/objects/'));
  assert.equal(await photoById(rowB.id), BASE64_PHOTO_2, 'the untargeted row is untouched');
});

test('rejects invalid ids with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/admin/proof-photos/retry')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ ids: [0, -3] });
  assert.equal(res.status, 400);
});

test('with nothing stuck and no ids: a no-op success', async (t) => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const challan = await createChallan();
  await addPhoto(challan.id, '/objects/uploads/done');

  const storeMock = t.mock.method(proofPhotoStore, 'store', async () => '/objects/uploads/should-not-happen');

  const res = await request(app)
    .post('/api/admin/proof-photos/retry')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(storeMock.mock.callCount(), 0);
  assert.deepEqual(res.body, { migrated: 0, skipped: 0, failed: 0, failures: [] });
});
