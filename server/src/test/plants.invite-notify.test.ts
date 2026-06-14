import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express, Response } from 'express';

import { db, pool } from '../db/index.js';
import { users, plantInvites } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient, type SSEIdentity } from '../lib/sseEmitter.js';

type Role = 'admin' | 'authority' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

// Record every call the route makes to the plant-request mailer without
// touching real SMTP. The other exports are inert stubs so the routes mounted
// by buildTestApp still link.
let inviteCalls: Array<{ emails: string[]; plantName: string }> = [];
mock.module('../lib/email.js', {
  namedExports: {
    sendPlantInviteNotification: async (emails: string[], details: { plantName: string }) => {
      inviteCalls.push({ emails, plantName: details.plantName });
      return true;
    },
    sendWelcomeEmail: async () => true,
    sendOwnerInviteEmail: async () => true,
    sendPasswordResetNotification: async () => false,
    sendDeliveryNotificationEmail: async () => true,
    sendTestEmail: async () => ({ ok: false }),
    getSmtpSettings: async () => ({ host: null, port: null, user: null, from: null, configured: false }),
    verifySmtpConnection: async () => ({ ok: false }),
    getSmtpConfig: async () => ({ host: null, port: null, user: null, pass: null, from: null }),
    SMTP_KEYS: { host: 'smtp_host', port: 'smtp_port', user: 'smtp_user', pass: 'smtp_pass', from: 'smtp_from' },
  },
});

const { buildTestApp } = await import('./app.js');

let app: Express;
const PASSWORD = 'secret123';

async function createUser(opts: { name: string; email: string; role?: Role }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'client',
    isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// Registers a fake identity-bearing SSE connection and records the event names
// it actually receives, mirroring the helper used by sse.routes.test.ts.
function captureSSE(identity?: SSEIdentity) {
  const raw: string[] = [];
  const mockRes = {
    writableEnded: false,
    destroyed: false,
    req: { httpVersionMajor: 2 },
    setHeader() {},
    flushHeaders() {},
    write(payload: string) { raw.push(payload); return true; },
    end() { (mockRes as { writableEnded: boolean }).writableEnded = true; },
  };
  const id = addSSEClient(mockRes as unknown as Response, identity);
  return {
    id,
    events() {
      return raw
        .map((chunk) => /^event: (.+)$/m.exec(chunk)?.[1])
        .filter((e): e is string => Boolean(e));
    },
    close() { removeSSEClient(id); },
  };
}

const LEAD = {
  placeId: 'ChIJ_notify_001',
  name: 'Sunrise RMC Plant',
  address: '12 Industrial Rd, Navi Mumbai',
  latitude: 19.033,
  longitude: 73.0297,
  contactNumber: '9820011001',
};

// The notification is fire-and-forget after the response, so give the
// microtask/IO a brief window to settle before asserting on the mailer.
function flush(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE plant_invites, users RESTART IDENTITY CASCADE`);
  inviteCalls = [];
});

after(async () => {
  await pool.end();
});

test('a NEW invite emails admins+authority and toasts them over SSE (not staff/clients)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const authority = await createUser({ name: 'Boss', email: 'boss@test.com', role: 'authority' });
  await createUser({ name: 'Dispatch', email: 'dispatch@test.com', role: 'dispatcher' });
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });

  const adminSSE = captureSSE({ role: 'admin' });
  const authoritySSE = captureSSE({ role: 'authority' });
  const dispatcherSSE = captureSSE({ role: 'dispatcher' });
  const clientSSE = captureSSE({ role: 'client', clientId: 1 });

  try {
    const res = await request(app)
      .post('/api/plants/invite')
      .set('Authorization', `Bearer ${tokenFor(customer)}`)
      .send(LEAD);
    assert.equal(res.status, 201);
    assert.equal(res.body.deduped, false);

    // SSE: only admin + authority receive the alert.
    assert.ok(adminSSE.events().includes('plant.invite'), 'admin receives plant.invite');
    assert.ok(authoritySSE.events().includes('plant.invite'), 'authority receives plant.invite');
    assert.ok(!dispatcherSSE.events().includes('plant.invite'), 'a dispatcher must NOT receive it');
    assert.ok(!clientSSE.events().includes('plant.invite'), 'a client must NOT receive it');

    // Email: sent once to exactly the admin + authority mailboxes.
    await flush();
    assert.equal(inviteCalls.length, 1, 'the mailer is invoked exactly once');
    assert.equal(inviteCalls[0].plantName, LEAD.name);
    assert.deepEqual(
      [...inviteCalls[0].emails].sort(),
      [admin.email, authority.email].sort(),
      'only admin + authority mailboxes are notified',
    );
  } finally {
    adminSSE.close(); authoritySSE.close(); dispatcherSSE.close(); clientSSE.close();
  }
});

test('a repeat (deduped) request does NOT notify again', async () => {
  await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });

  const adminSSE = captureSSE({ role: 'admin' });
  try {
    await request(app).post('/api/plants/invite').set('Authorization', `Bearer ${tokenFor(customer)}`).send(LEAD);
    await flush();
    assert.equal(inviteCalls.length, 1, 'first request notifies');

    const res = await request(app)
      .post('/api/plants/invite')
      .set('Authorization', `Bearer ${tokenFor(customer)}`)
      .send(LEAD);
    assert.equal(res.body.deduped, true);

    await flush();
    assert.equal(inviteCalls.length, 1, 'a deduped repeat must NOT send another email');
    const inviteEvents = adminSSE.events().filter((e) => e === 'plant.invite');
    assert.equal(inviteEvents.length, 1, 'a deduped repeat must NOT emit another SSE toast');
  } finally {
    adminSSE.close();
  }
});

test('a new request with no admins in the system sends no email and does not error', async () => {
  const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
  const res = await request(app)
    .post('/api/plants/invite')
    .set('Authorization', `Bearer ${tokenFor(customer)}`)
    .send(LEAD);
  assert.equal(res.status, 201);
  await flush();
  assert.equal(inviteCalls.length, 0, 'no admins => the mailer is never called');

  const rows = await db.select().from(plantInvites);
  assert.equal(rows.length, 1, 'the invite is still recorded');
});
