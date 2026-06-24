import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, uploadedFiles } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { registerUploadedFile, getStorageUsage, listPlantFiles } from '../lib/uploadedFiles.js';

type Role = 'admin' | 'authority' | 'dispatcher' | 'plant_owner' | 'client';

let app: Express;
const PASSWORD = 'secret123';

async function createUser(opts: { name: string; email: string; role?: Role; plantId?: number | null }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: (opts.role ?? 'admin') as typeof users.$inferInsert['role'],
    plantId: opts.plantId ?? null,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createPlant(name: string) {
  const [row] = await db.insert(plants).values({
    name,
    latitude: '19.0330000',
    longitude: '73.0297000',
    plantStatus: 'approved',
    isActive: true,
    verified: true,
    deliveryRadiusKm: 40,
    grades: ['M-20'],
  }).returning();
  return row;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE uploaded_files, users, plants RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

test('registerUploadedFile is idempotent on storagePath', async () => {
  const plant = await createPlant('P1');
  const first = await registerUploadedFile({ storagePath: '/objects/abc', fileType: 'proof_photo', plantId: plant.id });
  assert.ok(first);
  const second = await registerUploadedFile({ storagePath: '/objects/abc', fileType: 'proof_photo', plantId: plant.id });
  assert.equal(second, null, 'duplicate path must be a no-op');
  const rows = await db.select().from(uploadedFiles);
  assert.equal(rows.length, 1);
});

test('listPlantFiles filters by plant and type', async () => {
  const a = await createPlant('A');
  const b = await createPlant('B');
  await registerUploadedFile({ storagePath: '/objects/a1', fileType: 'proof_photo', plantId: a.id });
  await registerUploadedFile({ storagePath: '/objects/a2', fileType: 'fuel_bill', plantId: a.id });
  await registerUploadedFile({ storagePath: '/objects/b1', fileType: 'proof_photo', plantId: b.id });

  const allA = await listPlantFiles(a.id);
  assert.equal(allA.length, 2);
  const fuelA = await listPlantFiles(a.id, 'fuel_bill');
  assert.equal(fuelA.length, 1);
  assert.equal(fuelA[0].storagePath, '/objects/a2');
});

test('getStorageUsage groups by plant and type', async () => {
  const a = await createPlant('A');
  const b = await createPlant('B');
  await registerUploadedFile({ storagePath: '/objects/a1', fileType: 'proof_photo', plantId: a.id });
  await registerUploadedFile({ storagePath: '/objects/a2', fileType: 'proof_photo', plantId: a.id });
  await registerUploadedFile({ storagePath: '/objects/b1', fileType: 'fuel_bill', plantId: b.id });

  const usage = await getStorageUsage();
  const aProof = usage.find(u => u.plantId === a.id && u.fileType === 'proof_photo');
  assert.equal(aProof?.fileCount, 2);
  const bFuel = usage.find(u => u.plantId === b.id && u.fileType === 'fuel_bill');
  assert.equal(bFuel?.fileCount, 1);
});

test('platform staff can read any plant vault', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin', plantId: null });
  const plant = await createPlant('Alpha');
  await registerUploadedFile({ storagePath: '/objects/x1', fileType: 'proof_photo', plantId: plant.id });

  const res = await request(app)
    .get(`/api/files/plant/${plant.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].fileType, 'proof_photo');
});

test('plant-scoped staff can only read their own plant vault', async () => {
  const own = await createPlant('Own');
  const other = await createPlant('Other');
  const owner = await createUser({ name: 'Owner', email: 'owner@test.com', role: 'plant_owner', plantId: own.id });

  const okRes = await request(app)
    .get(`/api/files/plant/${own.id}`)
    .set('Authorization', `Bearer ${tokenFor(owner)}`);
  assert.equal(okRes.status, 200);

  const crossRes = await request(app)
    .get(`/api/files/plant/${other.id}`)
    .set('Authorization', `Bearer ${tokenFor(owner)}`);
  assert.equal(crossRes.status, 403);
});

test('a client cannot read the vault', async () => {
  const client = await createUser({ name: 'Client', email: 'client@test.com', role: 'client' });
  const plant = await createPlant('Alpha');
  const res = await request(app)
    .get(`/api/files/plant/${plant.id}`)
    .set('Authorization', `Bearer ${tokenFor(client)}`);
  assert.equal(res.status, 403);
});

test('storage usage endpoint is platform-staff only', async () => {
  const a = await createPlant('A');
  await registerUploadedFile({ storagePath: '/objects/a1', fileType: 'proof_photo', plantId: a.id });
  const platform = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin', plantId: null });
  const scoped = await createUser({ name: 'Scoped', email: 'scoped@test.com', role: 'admin', plantId: a.id });

  const ok = await request(app)
    .get('/api/files/usage')
    .set('Authorization', `Bearer ${tokenFor(platform)}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.totalFiles, 1);
  assert.equal(ok.body.byPlant[0].plantName, 'A');

  const denied = await request(app)
    .get('/api/files/usage')
    .set('Authorization', `Bearer ${tokenFor(scoped)}`);
  assert.equal(denied.status, 403);
});
