import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, challans, challanProofPhotos } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';

let app: Express;

const PASSWORD = 'secret123';

async function createClient(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  return row;
}

async function createUser(role: string, email: string, linkedClientId?: number) {
  const passwordHash = await hashPassword(PASSWORD);
  const [user] = await db.insert(users).values({
    name: `${role} user`, email, passwordHash, role: role as 'admin',
    isActive: true, linkedClientId: linkedClientId ?? null,
  }).returning();
  return user;
}

let challanSeq = 0;
async function createChallan(clientId: number, status: 'pending' | 'dispatched' | 'delivered' = 'delivered') {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-D${String(challanSeq).padStart(4, '0')}`,
    clientId, grade: 'M25', quantity: '6.00', status, dispatchTime: new Date(),
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challan_proof_photos, challans, orders, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

after(async () => {
  await pool.end();
});

test('a client reads their own challan detail with resolved proof photos', async (t) => {
  t.mock.method(proofPhotoStore, 'resolve', async (stored: string | null | undefined) =>
    stored ? `https://signed.example/${stored.replace(/^\/objects\//, '')}` : null);

  const client = await createClient('Acme Co');
  const clientUser = await createUser('client', 'client@test.com', client.id);
  const challan = await createChallan(client.id);
  await db.insert(challanProofPhotos).values([
    { challanId: challan.id, photo: '/objects/uploads/p1' },
    { challanId: challan.id, photo: '/objects/uploads/p2' },
  ]);

  const res = await request(app)
    .get(`/api/me/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.id, challan.id);
  assert.deepEqual(res.body.proofPhotos, [
    'https://signed.example/uploads/p1',
    'https://signed.example/uploads/p2',
  ]);
});

test("a client cannot read another client's challan (404, no leak)", async (t) => {
  const resolveMock = t.mock.method(proofPhotoStore, 'resolve', async () => 'https://signed.example/leak');

  const mine = await createClient('My Co');
  const other = await createClient('Other Co');
  const clientUser = await createUser('client', 'me@test.com', mine.id);
  const otherChallan = await createChallan(other.id);
  await db.insert(challanProofPhotos).values({ challanId: otherChallan.id, photo: '/objects/uploads/secret' });

  const res = await request(app)
    .get(`/api/me/challans/${otherChallan.id}`)
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`);

  assert.equal(res.status, 404);
  assert.equal(resolveMock.mock.callCount(), 0);
});

test('a non-client role is forbidden from the client challan detail endpoint', async () => {
  const client = await createClient('Acme Co');
  const challan = await createChallan(client.id);
  const staff = await createUser('admin', 'admin@test.com');

  const res = await request(app)
    .get(`/api/me/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(staff)}`);

  assert.equal(res.status, 403);
});

test('an unknown challan id returns 404', async () => {
  const client = await createClient('Acme Co');
  const clientUser = await createUser('client', 'client@test.com', client.id);

  const res = await request(app)
    .get('/api/me/challans/999999')
    .set('Authorization', `Bearer ${tokenFor(clientUser)}`);

  assert.equal(res.status, 404);
});
