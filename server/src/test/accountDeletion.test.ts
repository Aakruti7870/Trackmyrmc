import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { accountDeletionRequests, clients, orders, users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

const app = buildTestApp();

// Snapshot and clear any configured OTP-delivery provider env vars so that
// sendOtp() falls through to the dev path and returns devCode.  Without this,
// a workspace with Meta WhatsApp or Twilio Verify configured would try to send
// a real message and never echo the code back, breaking the assertions below.
const OTP_PROVIDER_KEYS = [
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID',
  'WHATSAPP_META_PHONE_ID', 'WHATSAPP_META_TOKEN',
] as const;
type EnvKey = (typeof OTP_PROVIDER_KEYS)[number];
let savedEnv: Partial<Record<EnvKey, string | undefined>> = {};

before(() => {
  process.env.NODE_ENV = 'test';
  for (const k of OTP_PROVIDER_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});
beforeEach(async () => { await db.execute(sql`TRUNCATE TABLE account_deletion_requests, users, clients, orders, audit_logs, otp_codes, rate_limit_hits RESTART IDENTITY CASCADE`); });
after(async () => {
  for (const k of OTP_PROVIDER_KEYS) {
    if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
    else delete process.env[k];
  }
  await pool.end();
});

async function customer(phone = '+919876543210') {
  const [client] = await db.insert(clients).values({ name:'Test Customer', contactPerson:'Test Customer', phone, email:'customer@example.com' }).returning();
  const [user] = await db.insert(users).values({ name:'Test Customer', email:'customer@example.com', phone, role:'client', linkedClientId:client.id }).returning();
  return { user, client, token:signToken({ id:user.id, email:user.email, name:user.name, role:user.role, linkedClientId:client.id }) };
}

test('public account deletion page returns 200 without authentication and contains exact app identity', async () => {
  const response = await request(app).get('/account-deletion');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /html/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.text, /Concrete King \| Ready-Mix Concrete Tracking &amp; RMC Plant Discovery/);
  assert.match(response.text, /com\.trackmyrmc\.concreteking/);
  assert.match(response.text, /REQUEST ACCOUNT DELETION/);
});

test('legacy deletion URL serves the canonical server-rendered form', async () => {
  const response = await request(app).get('/delete-account');
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /html/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.text, /Delete Account.*TrackMyRMC.*Concrete King/);
  assert.match(response.text, /REQUEST ACCOUNT DELETION/);
});

test('public form rejects invalid identity and prevents duplicate active requests', async () => {
  await customer();
  const invalid = await request(app).post('/api/account-deletion-requests').send({ fullName:'T', mobile:'bad', email:'', reason:'', confirmed:true });
  assert.equal(invalid.status, 400);
  const payload = { fullName:'Test Customer', mobile:'9876543210', email:'', reason:'Leaving', confirmed:true };
  assert.equal((await request(app).post('/api/account-deletion-requests').send(payload)).status, 201);
  assert.equal((await request(app).post('/api/account-deletion-requests').send(payload)).status, 409);
});

test('in-app deletion is customer-only, requires OTP, revokes sessions and retains orders', async () => {
  const { user, client, token } = await customer();
  const [staff] = await db.insert(users).values({ name:'Staff', email:'staff@example.com', role:'dispatcher' }).returning();
  const staffToken = signToken({ id:staff.id, email:staff.email, name:staff.name, role:staff.role });
  assert.equal((await request(app).post('/api/account-deletion-requests/otp').set('Authorization',`Bearer ${staffToken}`).send({})).status, 403);
  // Wrong OTP now returns 422 (not 401) so the frontend 401-redirect handler
  // doesn't fire and silently log the user out instead of showing the error.
  assert.equal((await request(app).post('/api/account-deletion-requests/complete').set('Authorization',`Bearer ${token}`).send({ confirmed:true, otp:'000000' })).status, 422);
  const otp = await request(app).post('/api/account-deletion-requests/otp').set('Authorization',`Bearer ${token}`).send({});
  assert.equal(otp.status, 200);
  assert.match(otp.body.devCode, /^\d{6}$/);
  const [order] = await db.insert(orders).values({ orderNo:'DEL-KEEP-1', clientId:client.id, grade:'M25', quantity:'5' }).returning();
  const complete = await request(app).post('/api/account-deletion-requests/complete').set('Authorization',`Bearer ${token}`).send({ confirmed:true, otp:otp.body.devCode });
  assert.equal(complete.status, 200);
  assert.equal((await request(app).get('/api/me/profile').set('Authorization',`Bearer ${token}`)).status, 401);
  const [retained] = await db.select().from(orders).where(sql`${orders.id}=${order.id}`);
  assert.equal(retained.id, order.id);
  const [deleted] = await db.select().from(users).where(sql`${users.id}=${user.id}`);
  assert.equal(deleted.isActive, false);
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.phone, null);
  const [record] = await db.select().from(accountDeletionRequests).where(sql`${accountDeletionRequests.userId}=${user.id}`);
  assert.equal(record.status, 'completed');
});
