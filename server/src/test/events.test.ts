import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { getSSEClientCount, emitSSEEvent } from '../lib/sseEmitter.js';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;
// A real listening server is needed only for the long-lived stream case: an
// accepted SSE response never ends, so supertest's request would hang and
// aborting it leaks an ECONNRESET. Native http gives us a clean close().
let server: http.Server;
let baseUrl: string;

async function createUser(opts: {
  name: string;
  email: string;
  role?: Role;
  isActive?: boolean;
  linkedClientId?: number;
  linkedDriverId?: number;
}) {
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    // /api/events never checks the password; a placeholder hash satisfies the
    // NOT NULL column without the cost of bcrypt.
    passwordHash: 'placeholder',
    role: opts.role ?? 'dispatcher',
    isActive: opts.isActive ?? true,
    linkedClientId: opts.linkedClientId ?? null,
    linkedDriverId: opts.linkedDriverId ?? null,
  }).returning();
  return row;
}

async function createClient(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Contact', phone: '0000000000',
  }).returning();
  return row;
}

async function createDriver(name: string) {
  const [row] = await db.insert(drivers).values({
    name, phone: '0000000000',
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// Polls a condition until it holds or a timeout elapses. Used to observe the
// asynchronous register/unregister of an SSE client without arbitrary sleeps.
async function waitFor(cond: () => boolean, message: string, timeoutMs = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timeout waiting for: ${message}`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

// Opens the SSE stream and resolves once the response headers arrive (the
// stream itself stays open). Returns the HTTP status plus a close() that tears
// down the connection so the server fires its 'close' handler.
function openStream(token?: string): Promise<{ status: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const url = token !== undefined
      ? `${baseUrl}/api/events?token=${encodeURIComponent(token)}`
      : `${baseUrl}/api/events`;
    let settled = false;
    const req = http.get(url, (res) => {
      settled = true;
      // Drain the stream and swallow the teardown error that destroy() causes.
      res.on('error', () => {});
      res.resume();
      resolve({ status: res.statusCode ?? 0, close: () => req.destroy() });
    });
    // destroy() after we have resolved surfaces as ECONNRESET; ignore it once
    // the response has been handed back.
    req.on('error', (err) => {
      if (!settled) reject(err);
    });
  });
}

// Like openStream, but accumulates the raw SSE bytes the server pushes so a
// test can assert which targeted events actually reached this connection.
// received() returns everything written to the stream so far.
function openCapturingStream(
  token: string,
): Promise<{ status: number; received: () => string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}/api/events?token=${encodeURIComponent(token)}`;
    let settled = false;
    let buffer = '';
    const req = http.get(url, (res) => {
      settled = true;
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { buffer += chunk; });
      res.on('error', () => {});
      resolve({
        status: res.statusCode ?? 0,
        received: () => buffer,
        close: () => req.destroy(),
      });
    });
    req.on('error', (err) => {
      if (!settled) reject(err);
    });
  });
}

before(async () => {
  app = buildTestApp();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
  // Each authorization case below is rejected before registration, so the
  // emitter's client map should start (and stay) empty.
  assert.equal(getSSEClientCount(), 0, 'no SSE clients should be registered between tests');
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

test('rejects a request with no token (401) and registers no SSE client', async () => {
  const res = await request(app).get('/api/events');
  assert.equal(res.status, 401);
  assert.match(res.body.error, /token required/i);
  assert.equal(getSSEClientCount(), 0, 'an unauthenticated caller must not be registered');
});

test('rejects an invalid/garbage token (401) and registers no SSE client', async () => {
  const res = await request(app).get('/api/events').query({ token: 'not-a-real-jwt' });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /invalid token/i);
  assert.equal(getSSEClientCount(), 0, 'a caller with a bad token must not be registered');
});

test('rejects a well-formed token signed with the wrong secret (401)', async () => {
  // A structurally valid JWT that fails signature verification must be treated
  // the same as garbage — it must never be accepted.
  const forged = jwt.sign({ id: 1, email: 'x@test.com', role: 'admin', name: 'X' }, 'the-wrong-secret');
  const res = await request(app).get('/api/events').query({ token: forged });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /invalid token/i);
  assert.equal(getSSEClientCount(), 0);
});

test('rejects a valid token for a deactivated (isActive=false) user (401)', async () => {
  const user = await createUser({
    name: 'Dormant', email: 'dormant@test.com', role: 'dispatcher', isActive: false,
  });
  const res = await request(app).get('/api/events').query({ token: tokenFor(user) });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /deactivated/i);
  assert.equal(getSSEClientCount(), 0, 'a deactivated account must not be registered');
});

test('rejects a valid token for a user that no longer exists (401)', async () => {
  // Sign a token for an id that is not in the database (e.g. the account was
  // purged). The lookup returns no row, so it is treated as deactivated.
  const token = signToken({ id: 999999, email: 'gone@test.com', role: 'admin', name: 'Gone' });
  const res = await request(app).get('/api/events').query({ token });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /deactivated/i);
  assert.equal(getSSEClientCount(), 0);
});

test('accepts a valid active user, registers an SSE client, and unregisters on disconnect', async () => {
  const user = await createUser({ name: 'Live Admin', email: 'live@test.com', role: 'admin' });
  const token = tokenFor(user);

  const before = getSSEClientCount();
  const stream = await openStream(token);
  assert.equal(stream.status, 200, 'a valid active user is accepted with a 200 stream');

  // The connection is registered with the emitter so it can receive events.
  await waitFor(
    () => getSSEClientCount() === before + 1,
    'the accepted connection to be registered as an SSE client',
  );

  // Closing the stream must release the slot (the route's 'close' handler).
  stream.close();
  await waitFor(
    () => getSSEClientCount() === before,
    'the SSE client to be unregistered after the connection closes',
  );
});

// The following tests exercise the *wiring*: that /api/events maps the
// authenticated DB user (role + linkedClientId + linkedDriverId) into the SSE
// identity used for targeting. sse.test.ts proves the emitter filters by
// identity in isolation; these prove the real HTTP endpoint hands the emitter
// the right identity, so a regression in events.ts (e.g. dropping the linked
// id) would leak another company's live updates.

test('a client connection receives events for its own company but not another', async () => {
  const own = await createClient('Own Co');
  const other = await createClient('Other Co');
  const user = await createUser({
    name: 'Client User', email: 'client@test.com', role: 'client', linkedClientId: own.id,
  });
  const token = tokenFor(user);

  const before = getSSEClientCount();
  const stream = await openCapturingStream(token);
  assert.equal(stream.status, 200, 'the client user is accepted with a 200 stream');
  await waitFor(
    () => getSSEClientCount() === before + 1,
    'the client connection to be registered with its linked-client identity',
  );

  // Emit a foreign-company event first, then the owning-company event. Both
  // writes happen synchronously in order; the foreign one is filtered out of
  // this connection entirely, so once the owning event lands we can be sure the
  // foreign one was never going to arrive on this socket.
  emitSSEEvent('order.updated', { tag: 'foreign' }, { clientId: other.id });
  emitSSEEvent('order.updated', { tag: 'own' }, { clientId: own.id });

  await waitFor(
    () => stream.received().includes('"tag":"own"'),
    "the owning company's targeted event to reach the client connection",
  );
  assert.ok(
    !stream.received().includes('"tag":"foreign"'),
    "another company's targeted event must NOT reach this client connection",
  );

  stream.close();
  await waitFor(() => getSSEClientCount() === before, 'the client connection to unregister');
});

test('a driver connection receives events for its own trips but not another driver', async () => {
  const own = await createDriver('Own Driver');
  const other = await createDriver('Other Driver');
  const user = await createUser({
    name: 'Driver User', email: 'driver@test.com', role: 'driver', linkedDriverId: own.id,
  });
  const token = tokenFor(user);

  const before = getSSEClientCount();
  const stream = await openCapturingStream(token);
  assert.equal(stream.status, 200, 'the driver user is accepted with a 200 stream');
  await waitFor(
    () => getSSEClientCount() === before + 1,
    'the driver connection to be registered with its linked-driver identity',
  );

  // A trip assigned to another driver must not leak; the driver's own trip must.
  emitSSEEvent('challan.updated', { tag: 'foreign' }, { clientId: 1, driverId: other.id });
  emitSSEEvent('challan.updated', { tag: 'own' }, { clientId: 1, driverId: own.id });

  await waitFor(
    () => stream.received().includes('"tag":"own"'),
    "the driver's own assigned-trip event to reach the connection",
  );
  assert.ok(
    !stream.received().includes('"tag":"foreign"'),
    "another driver's targeted event must NOT reach this driver connection",
  );

  stream.close();
  await waitFor(() => getSSEClientCount() === before, 'the driver connection to unregister');
});

test('a staff connection receives every targeted event regardless of owner', async () => {
  const user = await createUser({
    name: 'Dispatch Staff', email: 'staff@test.com', role: 'dispatcher',
  });
  const token = tokenFor(user);

  const before = getSSEClientCount();
  const stream = await openCapturingStream(token);
  assert.equal(stream.status, 200, 'the staff user is accepted with a 200 stream');
  await waitFor(
    () => getSSEClientCount() === before + 1,
    'the staff connection to be registered with its staff identity',
  );

  // Events scoped to a specific (and from this staffer's perspective arbitrary)
  // client/driver must still reach staff for the control-room view.
  emitSSEEvent('order.updated', { tag: 'client-scoped' }, { clientId: 4242 });
  emitSSEEvent('challan.updated', { tag: 'driver-scoped' }, { clientId: 4242, driverId: 7373 });

  await waitFor(
    () => stream.received().includes('"tag":"client-scoped"')
      && stream.received().includes('"tag":"driver-scoped"'),
    'both client- and driver-scoped events to reach the staff connection',
  );

  stream.close();
  await waitFor(() => getSSEClientCount() === before, 'the staff connection to unregister');
});
