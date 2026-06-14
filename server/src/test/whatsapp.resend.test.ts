import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, whatsappMessages, orders, challans, clients } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { setSetting } from '../lib/settings.js';
import { WHATSAPP_KEYS } from '../lib/whatsapp.js';

// HTTP coverage for the staff "re-send" action. No Twilio sender is configured in
// the test env, so a real send takes the dev/fail-closed branch and records a
// fresh whatsapp_messages row with status 'dev' — enough to assert that the
// notify helper was re-invoked and a new attempt was logged.

let app: Express;
const PASSWORD = 'secret123';

async function createUser(role: string, email: string, plantId: number | null = null) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: role, email, passwordHash, role: role as typeof users.$inferInsert['role'], isActive: true, plantId,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string; plantId?: number | null }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name, plantId: u.plantId ?? null });
}

let plantSeq = 0;
async function createPlant() {
  plantSeq += 1;
  const [row] = await db.insert(plants).values({
    name: `Plant ${plantSeq}`, latitude: '18.5', longitude: '73.8',
  }).returning();
  return row;
}

let seq = 0;
async function seedClient(opts: { phone?: string | null; plantId?: number | null } = {}) {
  seq += 1;
  const [client] = await db.insert(clients).values({
    name: `Acme ${seq}`, contactPerson: 'Jane',
    phone: opts.phone === undefined ? '9991112222' : (opts.phone as string),
    email: null, plantId: opts.plantId ?? null,
  }).returning();
  return client;
}

async function seedChallanMessage(opts: {
  event?: 'dispatch' | 'delivery';
  status?: string;
  phone?: string | null;
  plantId?: number | null;
} = {}) {
  const plantId = opts.plantId ?? null;
  const client = await seedClient({ phone: opts.phone, plantId });
  seq += 1;
  const [challan] = await db.insert(challans).values({
    challanNo: `CH-R${String(seq).padStart(4, '0')}`,
    clientId: client.id, plantId, grade: 'M30', quantity: '8.00',
    status: 'dispatched', dispatchTime: new Date(),
  }).returning();
  const [msg] = await db.insert(whatsappMessages).values({
    messageSid: `SMold${seq}`, event: opts.event ?? 'dispatch', challanId: challan.id,
    plantId, toPhone: '9991112222', status: opts.status ?? 'failed', errorCode: '63016', channel: 'whatsapp',
  }).returning();
  return { client, challan, msg };
}

async function seedOrderMessage(opts: { status?: string; phone?: string | null; plantId?: number | null } = {}) {
  const plantId = opts.plantId ?? null;
  const client = await seedClient({ phone: opts.phone, plantId });
  seq += 1;
  const [order] = await db.insert(orders).values({
    orderNo: `ORD-R${String(seq).padStart(3, '0')}`,
    clientId: client.id, plantId, grade: 'M25', quantity: '6.00', status: 'pending',
  }).returning();
  const [msg] = await db.insert(whatsappMessages).values({
    messageSid: `SMold${seq}`, event: 'order', orderId: order.id,
    plantId, toPhone: '9991112222', status: opts.status ?? 'failed', channel: 'whatsapp',
  }).returning();
  return { client, order, msg };
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  seq = 0;
  await db.execute(
    sql`TRUNCATE TABLE whatsapp_messages, challans, orders, clients, users, plants, app_settings RESTART IDENTITY CASCADE`,
  );
  // Configure all three templates so eventEnabled passes and the (dev) send fires.
  await setSetting(WHATSAPP_KEYS.orderTemplateSid, 'HXorder');
  await setSetting(WHATSAPP_KEYS.dispatchTemplateSid, 'HXdispatch');
  await setSetting(WHATSAPP_KEYS.deliveryTemplateSid, 'HXdelivery');
});

after(async () => { await pool.end(); });

test('re-sending a failed dispatch records a fresh message row', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const { challan, msg } = await seedChallanMessage({ event: 'dispatch', status: 'failed' });

  const res = await request(app)
    .post(`/api/whatsapp/messages/${msg.id}/resend`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.resent, true);
  assert.ok(res.body.message);
  assert.notEqual(res.body.message.id, msg.id);
  assert.equal(res.body.message.event, 'dispatch');

  const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.challanId, challan.id));
  assert.equal(rows.length, 2, 'a brand-new attempt row is added alongside the original');
});

test('re-sending a failed order confirmation records a fresh message row', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const { order, msg } = await seedOrderMessage({ status: 'undelivered' });

  const res = await request(app)
    .post(`/api/whatsapp/messages/${msg.id}/resend`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.resent, true);
  assert.equal(res.body.message.event, 'order');
  assert.equal(res.body.message.orderNo, order.orderNo);

  const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.orderId, order.id));
  assert.equal(rows.length, 2);
});

test('reports resent=false (no new row) when the event is gated off', async () => {
  await db.execute(sql`TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE`); // drop the template SIDs
  const admin = await createUser('admin', 'admin@test.com');
  const { challan, msg } = await seedChallanMessage({ event: 'dispatch', status: 'failed' });

  const res = await request(app)
    .post(`/api/whatsapp/messages/${msg.id}/resend`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.resent, false);
  assert.equal(res.body.message, null);

  const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.challanId, challan.id));
  assert.equal(rows.length, 1, 'nothing sent → no new row');
});

test('a plant-bound actor cannot re-send another plant\'s notification (404)', async () => {
  const plantA = await createPlant();
  const plantB = await createPlant();
  const adminA = await createUser('admin', 'a@test.com', plantA.id);
  const { msg } = await seedChallanMessage({ event: 'dispatch', plantId: plantB.id });

  const res = await request(app)
    .post(`/api/whatsapp/messages/${msg.id}/resend`)
    .set('Authorization', `Bearer ${tokenFor(adminA)}`);

  assert.equal(res.status, 404);
  const rows = await db.select().from(whatsappMessages);
  assert.equal(rows.length, 1, 'no new attempt created for an out-of-scope message');
});

test('a plant-bound actor can re-send their own plant\'s notification', async () => {
  const plantA = await createPlant();
  const adminA = await createUser('admin', 'a@test.com', plantA.id);
  const { msg } = await seedChallanMessage({ event: 'dispatch', plantId: plantA.id });

  const res = await request(app)
    .post(`/api/whatsapp/messages/${msg.id}/resend`)
    .set('Authorization', `Bearer ${tokenFor(adminA)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.resent, true);
});

test('an unknown message id returns 404', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app)
    .post('/api/whatsapp/messages/999999/resend')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 404);
});

test('customers and drivers cannot re-send (403)', async () => {
  const driver = await createUser('driver', 'd@test.com');
  const { msg } = await seedChallanMessage();
  const res = await request(app)
    .post(`/api/whatsapp/messages/${msg.id}/resend`)
    .set('Authorization', `Bearer ${tokenFor(driver)}`);
  assert.equal(res.status, 403);
});

test('re-send requires authentication (401)', async () => {
  const { msg } = await seedChallanMessage();
  const res = await request(app).post(`/api/whatsapp/messages/${msg.id}/resend`);
  assert.equal(res.status, 401);
});
