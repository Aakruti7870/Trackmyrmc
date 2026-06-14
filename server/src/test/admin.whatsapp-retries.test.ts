import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import type { Express } from 'express';

// Exercises the admin WhatsApp-retry-queue endpoints: listing pending retries,
// cancelling one, and forcing an immediate re-send.
//
// We deliberately do NOT mock the whatsapp.js module: buildTestApp pulls in the
// full route graph, and many modules import various exports from whatsapp.js, so
// a mock.module (which fully replaces the module) would have to re-declare every
// one of those exports and stays brittle as the module grows. Instead we set the
// Twilio env vars so sendWhatsAppTemplate takes its real provider branch and stub
// global.fetch to control each forced re-send's outcome. This also guards against
// real network calls if the validation environment has live Twilio secrets set.

process.env.TWILIO_ACCOUNT_SID = 'AC_test_dummy';
process.env.TWILIO_AUTH_TOKEN = 'token_test_dummy';
process.env.TWILIO_WHATSAPP_FROM = '+10000000000';

type FetchResult = { status: number; body: string };
let fetchResult: FetchResult = { status: 200, body: '' };
let twilioCalls = 0;
const originalFetch = globalThis.fetch;
// Intercept only Twilio's Messages endpoint; everything else falls through to the
// real fetch (these tests never trigger other outbound calls).
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.includes('api.twilio.com')) {
    twilioCalls += 1;
    const { status, body } = fetchResult;
    return new Response(body, { status });
  }
  return originalFetch(input, init);
}) as typeof fetch;

const { buildTestApp } = await import('./app.js');
const { db, pool } = await import('../db/index.js');
const { users, auditLogs, whatsappRetries } = await import('../db/schema.js');
const { hashPassword } = await import('../lib/password.js');
const { signToken } = await import('../middleware/auth.js');

type Role = 'admin' | 'authority' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;
const PASSWORD = 'secret123';
const PHONE = '+919876543210';
const SID = 'HXtemplate';

async function createUser(opts: { name: string; email: string; role?: Role }) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'dispatcher',
    isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function enqueue(opts: { event?: string | null; attempts?: number; lastError?: string | null; nextAttemptAt?: Date }) {
  const [row] = await db.insert(whatsappRetries).values({
    toPhone: PHONE,
    templateSid: SID,
    variables: { '1': 'Acme' },
    event: opts.event ?? 'dispatch',
    attempts: opts.attempts ?? 1,
    lastError: opts.lastError ?? 'provider down',
    nextAttemptAt: opts.nextAttemptAt ?? new Date(Date.now() + 60_000),
  }).returning();
  return row;
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  twilioCalls = 0;
  fetchResult = { status: 200, body: '' };
  await db.execute(sql`TRUNCATE TABLE whatsapp_retries RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE audit_logs, users RESTART IDENTITY CASCADE`);
});

after(async () => {
  globalThis.fetch = originalFetch;
  await pool.end();
});

// --- authorization ---------------------------------------------------------

test('GET /api/admin/whatsapp-retries rejects a non-admin with 403', async () => {
  const dispatcher = await createUser({ name: 'D', email: 'd@test.com', role: 'dispatcher' });
  const res = await request(app)
    .get('/api/admin/whatsapp-retries')
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
  assert.equal(res.status, 403);
});

test('GET /api/admin/whatsapp-retries rejects an unauthenticated request with 401', async () => {
  const res = await request(app).get('/api/admin/whatsapp-retries');
  assert.equal(res.status, 401);
});

// --- list ------------------------------------------------------------------

test('lists pending retries soonest-due first with the surfaced fields', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const later = await enqueue({ event: 'delivery', attempts: 2, lastError: 'still down', nextAttemptAt: new Date(Date.now() + 600_000) });
  const sooner = await enqueue({ event: 'order', attempts: 1, lastError: 'down', nextAttemptAt: new Date(Date.now() + 60_000) });

  const res = await request(app)
    .get('/api/admin/whatsapp-retries')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.count, 2);
  // soonest-due first
  assert.deepEqual(res.body.retries.map((r: { id: number }) => r.id), [sooner.id, later.id]);
  const first = res.body.retries[0];
  assert.equal(first.toPhone, PHONE);
  assert.equal(first.event, 'order');
  assert.equal(first.attempts, 1);
  assert.equal(first.lastError, 'down');
  assert.ok(first.nextAttemptAt);
  // the raw template payload is never surfaced
  assert.equal(first.templateSid, undefined);
  assert.equal(first.variables, undefined);
});

// --- cancel ----------------------------------------------------------------

test('cancels a queued retry, removes the row, and audit-logs it', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const row = await enqueue({});

  const res = await request(app)
    .post(`/api/admin/whatsapp-retries/${row.id}/cancel`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal((await db.select().from(whatsappRetries).where(eq(whatsappRetries.id, row.id))).length, 0);

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'whatsapp_retry_cancelled'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorId, admin.id);
  assert.equal(logs[0].status, 'success');
});

test('cancelling a missing retry returns 404', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/admin/whatsapp-retries/9999/cancel')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(res.status, 404);
});

test('cancel rejects a non-numeric id with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/admin/whatsapp-retries/abc/cancel')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(res.status, 400);
});

// --- force retry -----------------------------------------------------------

test('forcing a retry that succeeds sends, removes the row, and audit-logs success', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const row = await enqueue({});
  fetchResult = { status: 200, body: '' }; // provider accepts

  const res = await request(app)
    .post(`/api/admin/whatsapp-retries/${row.id}/retry`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, outcome: 'sent' });
  assert.equal(twilioCalls, 1);
  assert.equal((await db.select().from(whatsappRetries).where(eq(whatsappRetries.id, row.id))).length, 0);

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'whatsapp_retry_forced'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'success');
});

test('forcing a retry that fails transiently again reschedules it and logs a failure', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const row = await enqueue({ attempts: 1 });
  fetchResult = { status: 503, body: 'provider unavailable' }; // 5xx => transient

  const res = await request(app)
    .post(`/api/admin/whatsapp-retries/${row.id}/retry`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.outcome, 'retried');
  assert.equal(twilioCalls, 1);
  const [after] = await db.select().from(whatsappRetries).where(eq(whatsappRetries.id, row.id));
  assert.ok(after, 'row remains in the queue');
  assert.equal(after.attempts, 2);
  assert.match(after.lastError ?? '', /503/);

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'whatsapp_retry_forced'));
  assert.equal(logs[0].status, 'failure');
});

test('forcing a retry that fails permanently drops the row', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const row = await enqueue({});
  fetchResult = { status: 400, body: 'template removed' }; // 4xx => permanent

  const res = await request(app)
    .post(`/api/admin/whatsapp-retries/${row.id}/retry`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.outcome, 'gaveUp');
  assert.equal(twilioCalls, 1);
  assert.equal((await db.select().from(whatsappRetries).where(eq(whatsappRetries.id, row.id))).length, 0);
});

test('forcing a retry for a missing id returns 404 and never sends', async () => {
  const admin = await createUser({ name: 'Admin', email: 'a@test.com', role: 'admin' });
  const res = await request(app)
    .post('/api/admin/whatsapp-retries/9999/retry')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({});
  assert.equal(res.status, 404);
  assert.equal(twilioCalls, 0);
});
