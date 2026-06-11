import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { emitSSEEvent, getSSEClientCount } from '../lib/sseEmitter.js';

// End-to-end coverage of the REAL `GET /api/events` connect handler. Unlike
// sse.routes.test.ts (which registers identities by hand against the emitter),
// this drives an actual HTTP SSE connection so the handler's JWT -> identity
// derivation is exercised: it must read role/linkedClientId/linkedDriverId off
// the user row and pass them into addSSEClient. A regression there (e.g.
// dropping linkedClientId) would silently leak every company's toasts even
// though the emitter filter and the routes are correct.

let app: Express;
let server: http.Server;
let port: number;

const PASSWORD = 'secret123';

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createClientRow(name: string) {
  const [row] = await db.insert(clients).values({
    name, contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  return row;
}

async function createDriverRow(name: string) {
  const [row] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  return row;
}

async function createUser(opts: {
  role: string; email: string; name?: string;
  linkedClientId?: number | null; linkedDriverId?: number | null;
  isActive?: boolean;
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await db.insert(users).values({
    name: opts.name ?? `${opts.role} user`,
    email: opts.email,
    passwordHash,
    role: opts.role as 'admin',
    isActive: opts.isActive ?? true,
    linkedClientId: opts.linkedClientId ?? null,
    linkedDriverId: opts.linkedDriverId ?? null,
  }).returning();
  return user;
}

type Connection = {
  status: number;
  body: string;
  events(): string[];
  close(): void;
};

// Opens a raw HTTP SSE connection to the real `/api/events` route. Resolves
// once the connection is established (the handler writes ':ok' after it has
// registered the client) or, for a rejection, once the error body has been
// read. The returned object exposes the SSE event names received so far.
function connect(token?: string): Promise<Connection> {
  return new Promise<Connection>((resolve, reject) => {
    const query = token != null ? `?token=${encodeURIComponent(token)}` : '';
    const req = http.get(`http://127.0.0.1:${port}/api/events${query}`, (res) => {
      res.setEncoding('utf8');
      const status = res.statusCode ?? 0;

      if (status !== 200) {
        let body = '';
        res.on('data', (c: string) => { body += c; });
        res.on('end', () => resolve({ status, body, events: () => [], close: () => req.destroy() }));
        return;
      }

      let buffer = '';
      let settled = false;
      const conn: Connection = {
        status,
        body: '',
        events() {
          return buffer
            .split('\n')
            .map((line) => /^event: (.+)$/.exec(line)?.[1])
            .filter((e): e is string => Boolean(e));
        },
        close() { req.destroy(); },
      };
      res.on('data', (chunk: string) => {
        buffer += chunk;
        // The handler registers the client and writes ':ok' synchronously, so
        // once we see it the connection is live and ready to receive events.
        if (!settled && buffer.includes(':ok')) {
          settled = true;
          resolve(conn);
        }
      });
      res.on('error', () => { /* connection torn down by close() */ });
    });
    req.on('error', reject);
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 1500): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 10));
  }
  return predicate();
}

before(async () => {
  app = buildTestApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, orders, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

const open: Connection[] = [];
afterEach(() => {
  for (const c of open) c.close();
  open.length = 0;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

test('a client connection is tagged with the user\'s linked client id', async () => {
  const ownClient = await createClientRow('Acme Co');
  const otherClient = await createClientRow('Globex');
  const clientUser = await createUser({
    role: 'client', email: 'client@test.com', linkedClientId: ownClient.id,
  });

  const conn = await connect(tokenFor(clientUser));
  open.push(conn);
  assert.equal(conn.status, 200);

  // An event for the user's own company must arrive; one for another company
  // must not. A trailing broadcast sentinel arrives on every connection and,
  // because a single SSE stream preserves order, guarantees the earlier
  // targeted events have already been delivered (or filtered) by the time we
  // assert — making the negative check deterministic.
  emitSSEEvent('match.event', { ok: true }, { clientId: ownClient.id });
  emitSSEEvent('wrong.event', { ok: false }, { clientId: otherClient.id });
  emitSSEEvent('sentinel', {});

  const sawSentinel = await waitFor(() => conn.events().includes('sentinel'));
  assert.ok(sawSentinel, 'sentinel broadcast should reach the connection');

  assert.ok(conn.events().includes('match.event'),
    'the handler must derive the linked client id so own-company events arrive');
  assert.ok(!conn.events().includes('wrong.event'),
    "another company's events must NOT reach this client");
});

test('a driver connection is tagged with the user\'s linked driver id', async () => {
  const ownDriver = await createDriverRow('Dave Driver');
  const otherDriver = await createDriverRow('Other Driver');
  const driverUser = await createUser({
    role: 'driver', email: 'dave@test.com', name: 'Dave Driver',
    linkedDriverId: ownDriver.id,
  });

  const conn = await connect(tokenFor(driverUser));
  open.push(conn);
  assert.equal(conn.status, 200);

  emitSSEEvent('match.event', { ok: true }, { driverId: ownDriver.id });
  emitSSEEvent('wrong.event', { ok: false }, { driverId: otherDriver.id });
  emitSSEEvent('sentinel', {});

  const sawSentinel = await waitFor(() => conn.events().includes('sentinel'));
  assert.ok(sawSentinel, 'sentinel broadcast should reach the connection');

  assert.ok(conn.events().includes('match.event'),
    'the handler must derive the linked driver id so own-trip events arrive');
  assert.ok(!conn.events().includes('wrong.event'),
    "another driver's events must NOT reach this driver");
});

test('a client connection does not receive a different company by driver targeting', async () => {
  // Guards against the handler mixing up the two ids: a client with a linked
  // client id must not match an event addressed only to a driver.
  const ownClient = await createClientRow('Acme Co');
  const someDriver = await createDriverRow('Some Driver');
  const clientUser = await createUser({
    role: 'client', email: 'client2@test.com', linkedClientId: ownClient.id,
  });

  const conn = await connect(tokenFor(clientUser));
  open.push(conn);
  assert.equal(conn.status, 200);

  emitSSEEvent('driver.only', { ok: false }, { driverId: someDriver.id });
  emitSSEEvent('sentinel', {});

  const sawSentinel = await waitFor(() => conn.events().includes('sentinel'));
  assert.ok(sawSentinel, 'sentinel broadcast should reach the connection');
  assert.ok(!conn.events().includes('driver.only'),
    'a client must not receive driver-targeted events');
});

test('closing a connection unregisters it so it no longer receives events', async () => {
  // The connect handler must wire `req.on('close')` -> removeSSEClient. If that
  // teardown ever regressed, the disconnected stream would stay registered:
  // getSSEClientCount() would never drop and the emitter would keep writing
  // targeted events to a dead socket. This drives the real lifecycle end to end.
  const ownClient = await createClientRow('Acme Co');
  const clientUser = await createUser({
    role: 'client', email: 'leaver@test.com', linkedClientId: ownClient.id,
  });

  const before = getSSEClientCount();

  const conn = await connect(tokenFor(clientUser));
  open.push(conn);
  assert.equal(conn.status, 200);

  // The connection is registered once :ok has been flushed.
  const registered = await waitFor(() => getSSEClientCount() === before + 1);
  assert.ok(registered, 'the connection should be registered with the emitter');

  // Confirm it is live by delivering one targeted event before disconnecting.
  emitSSEEvent('match.event', { ok: true }, { clientId: ownClient.id });
  const sawMatch = await waitFor(() => conn.events().includes('match.event'));
  assert.ok(sawMatch, 'the live connection should receive its targeted event');

  const eventsBeforeClose = conn.events().length;

  // Disconnect. The server's `req.on('close')` should fire and unregister us.
  conn.close();

  const unregistered = await waitFor(() => getSSEClientCount() === before);
  assert.ok(unregistered,
    'closing the socket must call removeSSEClient so the count drops back');

  // A subsequent event addressed to this (now-gone) connection must not be
  // written to the closed stream — nothing new should have arrived.
  emitSSEEvent('after.close', { ok: false }, { clientId: ownClient.id });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(conn.events().length, eventsBeforeClose,
    'no events should be written to the stream after it was closed');
  assert.ok(!conn.events().includes('after.close'),
    'events emitted after close must not reach the unregistered connection');
});

test('a connection without a token is rejected with 401', async () => {
  const conn = await connect(undefined);
  assert.equal(conn.status, 401);
  assert.match(conn.body, /Token required/);
});

test('a connection with an invalid token is rejected with 401', async () => {
  const conn = await connect('not-a-real-jwt');
  assert.equal(conn.status, 401);
  assert.match(conn.body, /Invalid token/);
});

test('a connection for a deactivated account is rejected with 401', async () => {
  const ownClient = await createClientRow('Acme Co');
  const inactive = await createUser({
    role: 'client', email: 'inactive@test.com',
    linkedClientId: ownClient.id, isActive: false,
  });

  const conn = await connect(tokenFor(inactive));
  assert.equal(conn.status, 401);
  assert.match(conn.body, /deactivated/i);
});
