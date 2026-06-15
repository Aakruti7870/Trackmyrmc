import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, auditLogs } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';

type Role = 'admin' | 'authority' | 'client';

let app: Express;
const PASSWORD = 'secret123';

async function createUser(opts: { name: string; email: string; role?: Role; plantId?: number }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'admin',
    plantId: opts.plantId ?? null,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

interface ImportRowResult { row: number; name: string; status: 'created' | 'skipped'; reason?: string }
interface ImportResult { created: number; skipped: number; results: ImportRowResult[] }

const HEADER = 'name,address,city,latitude,longitude,contactNumber,email,legalName,gstNo';

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, plants RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

test('POST /plants/import creates valid rows as un-verified leads', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const csv = [
    HEADER,
    'Alpha RMC,1 MG Road,Mumbai,19.0330,73.0297,9820011001,alpha@example.com,Alpha Infra Pvt Ltd,27AAKCK0001A1Z5',
    'Beta RMC,2 FC Road,Pune,18.5204,73.8567,,,,', // minimal but valid
  ].join('\n');

  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv });

  assert.equal(res.status, 201);
  const body = res.body as ImportResult;
  assert.equal(body.created, 2);
  assert.equal(body.skipped, 0);

  const rows = await db.select().from(plants).orderBy(plants.id);
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.verified, false, 'imported rows must be un-verified leads');
  }
  const alpha = rows.find(r => r.name === 'Alpha RMC')!;
  assert.equal(alpha.city, 'Mumbai');
  assert.equal(alpha.email, 'alpha@example.com');
  assert.equal(alpha.gstNo, '27AAKCK0001A1Z5');

  const audit = await db.select().from(auditLogs).where(eq(auditLogs.action, 'plants.imported'));
  assert.equal(audit.length, 1, 'a successful import writes one audit entry');
});

test('POST /plants/import skips rows with an invalid GST and reports a reason', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const csv = [
    HEADER,
    'Good RMC,,,19.10,73.10,,,,27AAKCK0001A1Z5',
    'Bad GST RMC,,,19.20,73.20,,,,NOTAGST',
  ].join('\n');

  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv });

  assert.equal(res.status, 201);
  const body = res.body as ImportResult;
  assert.equal(body.created, 1);
  assert.equal(body.skipped, 1);
  const bad = body.results.find(r => r.name === 'Bad GST RMC')!;
  assert.equal(bad.status, 'skipped');
  assert.match(bad.reason!, /GST/i);

  const rows = await db.select().from(plants);
  assert.equal(rows.length, 1);
});

test('POST /plants/import skips missing name / lat / lng rows', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const csv = [
    HEADER,
    ',,,19.30,73.30,,,,',          // missing name
    'No Coords RMC,,,,,,,,',       // missing lat/lng
    'Bad Coords RMC,,,abc,xyz,,,,', // non-numeric lat/lng
  ].join('\n');

  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv });

  assert.equal(res.status, 200, 'no rows created -> 200');
  const body = res.body as ImportResult;
  assert.equal(body.created, 0);
  assert.equal(body.skipped, 3);
  assert.match(body.results[0].reason!, /name/i);
  assert.match(body.results[1].reason!, /latitude|longitude/i);
  assert.match(body.results[2].reason!, /latitude|longitude/i);
});

test('POST /plants/import rejects duplicate coordinates (existing + within batch)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  // An existing plant at the same spot the first CSV row claims.
  await db.insert(plants).values({ name: 'Existing RMC', latitude: '19.4000000', longitude: '73.4000000' });

  const csv = [
    HEADER,
    'Dupe Of Existing,,,19.4000,73.4000,,,,',  // collides with existing
    'First New,,,20.0000,74.0000,,,,',         // fresh, accepted
    'Second New,,,20.00001,74.00001,,,,',      // ~1m from First New -> batch dupe
  ].join('\n');

  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv });

  assert.equal(res.status, 201);
  const body = res.body as ImportResult;
  assert.equal(body.created, 1, 'only First New should be created');
  assert.equal(body.skipped, 2);
  const dupes = body.results.filter(r => r.status === 'skipped');
  for (const d of dupes) assert.match(d.reason!, /duplicate location/i);
});

test('POST /plants/import skips a row whose name already exists', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await db.insert(plants).values({ name: 'Taken RMC', latitude: '1.0000000', longitude: '1.0000000' });

  const csv = [HEADER, 'Taken RMC,,,30.0,75.0,,,,'].join('\n');
  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv });

  assert.equal(res.status, 200);
  const body = res.body as ImportResult;
  assert.equal(body.created, 0);
  assert.match(body.results[0].reason!, /name already exists/i);
});

test('POST /plants/import requires the mandatory headers', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv: 'foo,bar\n1,2' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /name, latitude, longitude/);
});

test('POST /plants/import rejects an empty payload', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv: '' });
  assert.equal(res.status, 400);
});

test('POST /plants/import handles a header-only CSV', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv: HEADER });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /no data rows/i);
});

test('POST /plants/import parses quoted fields containing commas', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const csv = [
    HEADER,
    '"Quoted RMC","12, Industrial Estate, Phase 2",Nagpur,21.1458,79.0882,,,,',
  ].join('\n');

  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ csv });
  assert.equal(res.status, 201);
  const [row] = await db.select().from(plants);
  assert.equal(row.name, 'Quoted RMC');
  assert.equal(row.address, '12, Industrial Estate, Phase 2');
});

test('POST /plants/import is staff-only (client rejected)', async () => {
  const client = await createUser({ name: 'Client', email: 'client@test.com', role: 'client' });
  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(client)}`)
    .send({ csv: `${HEADER}\nX,,,1,1,,,,` });
  assert.equal(res.status, 403);
});

test('POST /plants/import is blocked for a plant-scoped admin (platform staff only)', async () => {
  const plant = (await db.insert(plants).values({ name: 'Scoped Plant', latitude: '5.0', longitude: '5.0' }).returning())[0];
  const scopedAdmin = await createUser({ name: 'Scoped', email: 'scoped@test.com', role: 'admin', plantId: plant.id });
  const res = await request(app)
    .post('/api/plants/import')
    .set('Authorization', `Bearer ${tokenFor(scopedAdmin)}`)
    .send({ csv: `${HEADER}\nX,,,1,1,,,,` });
  assert.equal(res.status, 403);
});
