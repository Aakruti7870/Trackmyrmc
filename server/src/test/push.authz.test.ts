import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';
import type { Express } from 'express';

import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, pushSubscriptions } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

// Ownership coverage for the push unsubscribe route: a user may only remove
// their own subscription endpoint, never another user's.

let app: Express;
const PASSWORD = 'secret123';

async function createUser(email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: email, email, passwordHash, role: 'client', isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string; plantId?: number | null }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name, plantId: u.plantId ?? null });
}

let seq = 0;
async function seedSubscription(userId: number) {
  seq += 1;
  const endpoint = `https://push.example.com/sub/${userId}-${seq}`;
  await db.insert(pushSubscriptions).values({
    userId, endpoint, p256dh: `p256dh-${seq}`, auth: `auth-${seq}`, userAgent: null,
  });
  return endpoint;
}

async function subscriptionExists(endpoint: string) {
  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return rows.length > 0;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.delete(pushSubscriptions);
  await db.delete(users);
});

after(async () => {
  await pool.end();
});

test('unsubscribe removes the caller\'s own endpoint', async () => {
  const userA = await createUser('a@otp.local');
  const endpoint = await seedSubscription(userA.id);

  const res = await request(app)
    .post('/api/push/unsubscribe')
    .set('Authorization', `Bearer ${tokenFor(userA)}`)
    .send({ endpoint });

  assert.equal(res.status, 200);
  assert.equal(await subscriptionExists(endpoint), false);
});

test('a user cannot unsubscribe another user\'s endpoint', async () => {
  const userA = await createUser('a@otp.local');
  const userB = await createUser('b@otp.local');
  const endpointB = await seedSubscription(userB.id);

  const res = await request(app)
    .post('/api/push/unsubscribe')
    .set('Authorization', `Bearer ${tokenFor(userA)}`)
    .send({ endpoint: endpointB });

  // Endpoint-scoped delete is a no-op for a non-owner; B's subscription stays.
  assert.equal(res.status, 200);
  assert.equal(await subscriptionExists(endpointB), true);

  const stillOwnedByB = await db.select().from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpointB), eq(pushSubscriptions.userId, userB.id)));
  assert.equal(stillOwnedByB.length, 1);
});
