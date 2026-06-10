import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { Express, Response } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';

let app: Express;

const PASSWORD = 'secret123';

// A driver user authenticates by role AND matches a drivers row by *name*
// (see the driver branch in routes/challans.ts), so the user.name and the
// drivers.name must be identical for the profile lookup to succeed.
async function createDriverUser(name: string, email: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
  }).returning();
  return { user, driver };
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

let challanSeq = 0;
async function createChallan(opts: {
  driverId: number | null;
  clientId: number;
  status?: 'pending' | 'dispatched' | 'delivered' | 'cancelled';
  notes?: string | null;
}) {
  challanSeq += 1;
  const [row] = await db.insert(challans).values({
    challanNo: `CH-T${String(challanSeq).padStart(4, '0')}`,
    clientId: opts.clientId,
    driverId: opts.driverId,
    grade: 'M25',
    quantity: '6.00',
    status: opts.status ?? 'dispatched',
    notes: opts.notes ?? null,
    dispatchTime: new Date(),
  }).returning();
  return row;
}

async function createClient() {
  const [row] = await db.insert(clients).values({
    name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
  }).returning();
  return row;
}

// Captures SSE events broadcast via emitSSEEvent by registering a fake client
// against the real emitter. Returns the parsed event names so tests can assert
// that challan.updated is (or is not) emitted.
function captureSSE() {
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
  const id = addSSEClient(mockRes as unknown as Response);
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

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(
    sql`TRUNCATE TABLE challans, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`,
  );
});

let sse: ReturnType<typeof captureSSE> | null = null;
afterEach(() => {
  if (sse) { sse.close(); sse = null; }
});

after(async () => {
  await pool.end();
});

test('driver delivering their own dispatched challan succeeds and emits challan.updated', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
  sse = captureSSE();

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'delivered');
  assert.ok(res.body.deliveryTime, 'deliveryTime is stamped on delivery');

  const [row] = await db.select({ status: challans.status, deliveryTime: challans.deliveryTime })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.status, 'delivered');
  assert.ok(row.deliveryTime instanceof Date, 'deliveryTime persisted');

  assert.ok(
    sse.events().includes('challan.updated'),
    'a challan.updated SSE event is emitted on successful delivery',
  );
});

test('driver delivery records the actual delivered quantity on the challan', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
  sse = captureSSE();

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered', deliveredQuantity: '5.5' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'delivered');

  const [row] = await db.select({ deliveredQuantity: challans.deliveredQuantity })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(Number(row.deliveredQuantity), 5.5, 'delivered quantity is persisted');
});

test('driver delivery with a negative delivered quantity is rejected', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered', deliveredQuantity: '-2' });

  assert.equal(res.status, 400);
  assert.match(res.body.error, /non-negative/i);

  const [row] = await db.select({ status: challans.status, deliveredQuantity: challans.deliveredQuantity })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.status, 'dispatched', 'the challan is not marked delivered on a bad quantity');
  assert.equal(row.deliveredQuantity, null, 'no delivered quantity is stored');
});

test('driver delivering a challan NOT assigned to them gets 403 and changes nothing', async () => {
  const client = await createClient();
  const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
  const { driver: otherDriver } = await createDriverUser('Other Driver', 'other@test.com');
  const challan = await createChallan({ driverId: otherDriver.id, clientId: client.id, status: 'dispatched' });
  sse = captureSSE();

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered' });

  assert.equal(res.status, 403);
  assert.match(res.body.error, /not assigned/i);

  const [row] = await db.select({ status: challans.status })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.status, 'dispatched', "another driver's challan is untouched");
  assert.ok(!sse.events().includes('challan.updated'), 'no SSE event is emitted on a rejected delivery');
});

test('driver attempting any status other than delivered gets 403', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
  sse = captureSSE();

  for (const status of ['cancelled', 'pending', 'dispatched']) {
    const res = await request(app)
      .put(`/api/challans/${challan.id}`)
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ status });
    assert.equal(res.status, 403, `status='${status}' must be rejected`);
    assert.match(res.body.error, /only mark challans as delivered/i);
  }

  const [row] = await db.select({ status: challans.status })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.status, 'dispatched', 'the challan keeps its original status');
  assert.ok(!sse.events().includes('challan.updated'), 'no SSE event is emitted for a rejected status');
});

test('driver adds a delivery note when delivering and it is persisted', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
  sse = captureSSE();

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered', notes: '  Delivered to gate B  ' });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'delivered');
  assert.equal(res.body.notes, 'Delivered to gate B', 'note is trimmed and returned');

  const [row] = await db.select({ notes: challans.notes })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.notes, 'Delivered to gate B', 'note is persisted');
  assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted');
});

test('driver delivery note is newline-appended to an existing dispatch note', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({
    driverId: driver.id, clientId: client.id, status: 'dispatched',
    notes: 'Dispatched at 9am',
  });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered', notes: 'Received by site engineer' });

  assert.equal(res.status, 200);
  assert.equal(res.body.notes, 'Dispatched at 9am\nReceived by site engineer',
    'the delivery note is appended after the existing note, not overwriting it');

  const [row] = await db.select({ notes: challans.notes })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.notes, 'Dispatched at 9am\nReceived by site engineer', 'appended note persisted');
});

test('driver delivering with an empty/whitespace note leaves an existing note untouched', async () => {
  const client = await createClient();
  const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
  const challan = await createChallan({
    driverId: driver.id, clientId: client.id, status: 'dispatched',
    notes: 'Dispatched at 9am',
  });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered', notes: '   ' });

  assert.equal(res.status, 200);
  assert.equal(res.body.notes, 'Dispatched at 9am', 'a blank note is ignored, existing note kept');

  const [row] = await db.select({ notes: challans.notes })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.notes, 'Dispatched at 9am', 'existing note unchanged in DB');
});

test('a note sent to an unassigned challan is rejected and never written', async () => {
  const client = await createClient();
  const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
  const { driver: otherDriver } = await createDriverUser('Other Driver', 'other@test.com');
  const challan = await createChallan({
    driverId: otherDriver.id, clientId: client.id, status: 'dispatched',
    notes: 'Dispatched at 9am',
  });
  sse = captureSSE();

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered', notes: 'Sneaky note' });

  assert.equal(res.status, 403);
  assert.match(res.body.error, /not assigned/i);

  const [row] = await db.select({ notes: challans.notes })
    .from(challans).where(eq(challans.id, challan.id));
  assert.equal(row.notes, 'Dispatched at 9am', "another driver's note is untouched");
  assert.ok(!sse.events().includes('challan.updated'), 'no SSE event on a rejected delivery');
});

test('a driver user with no matching driver profile gets 403', async () => {
  const client = await createClient();
  // A driver-role user whose name matches NO drivers row (the profile lookup fails).
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [user] = await db.insert(users).values({
    name: 'Ghost Driver', email: 'ghost@test.com', passwordHash, role: 'driver', isActive: true,
  }).returning();
  // A challan exists (assigned to nobody) so the failure is the missing profile,
  // not a missing challan.
  const challan = await createChallan({ driverId: null, clientId: client.id, status: 'dispatched' });

  const res = await request(app)
    .put(`/api/challans/${challan.id}`)
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ status: 'delivered' });

  assert.equal(res.status, 403);
  assert.match(res.body.error, /driver profile not found/i);
});
