import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

// Stub the outbound email channel so the job never touches real SMTP and we
// can inspect the share link it actually built. Must be registered before the
// unit under test is loaded.
type EmailCall = { to: string[]; subject: string; ctaUrl?: string };
let emails: EmailCall[] = [];

mock.module('../lib/automationEmail.js', {
  namedExports: {
    sendAutomationEmail: async (msg: EmailCall) => {
      emails.push(msg);
      return true;
    },
  },
});

const { buildTestApp } = await import('./app.js');
const { db, pool } = await import('../db/index.js');
const { users, clients, plants, automationSends, trackingTokens } = await import('../db/schema.js');
const { signToken } = await import('../middleware/auth.js');
const { sanitizeConfig, saveAutomationSettings } = await import('../lib/automations.js');
const { maybeSendTripShare } = await import('../lib/automationJobs.js');
const { resolveTrackingToken } = await import('../lib/trackingTokens.js');
const { hashPassword } = await import('../lib/password.js');

// The base-URL resolution is config-only (APP_URL / PUBLIC_URL, with a Replit
// dev-domain fallback). Snapshot and clear all three so each test controls
// exactly what the job sees, regardless of workspace env.
const ENV_KEYS = ['APP_URL', 'PUBLIC_URL', 'REPLIT_DEV_DOMAIN'] as const;
const savedEnv: Record<string, string | undefined> = {};

let app: Express;
let token = '';
let clientId = 0;
let plantId = 0;

async function enableTripShare() {
  await saveAutomationSettings('tripShare', null, true,
    sanitizeConfig('tripShare', { ttlHours: 24, email: true, push: false, whatsapp: false }));
}

async function dispatchChallan(): Promise<{ id: number; challanNo: string }> {
  const res = await request(app)
    .post('/api/challans')
    .set('Authorization', `Bearer ${token}`)
    .send({ clientId, plantId, grade: 'M25', quantity: 12 });
  assert.equal(res.status, 201);
  return res.body;
}

// The trip-share hook is fire-and-forget from the dispatch route, so give the
// background promise a moment to land before asserting on its side effects.
async function waitForSends(expected: number, timeoutMs = 5000): Promise<typeof automationSends.$inferSelect[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = await db.select().from(automationSends);
    if (rows.length >= expected || Date.now() > deadline) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
}

before(async () => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  app = buildTestApp();
});

beforeEach(async () => {
  emails = [];
  for (const k of ENV_KEYS) delete process.env[k];
  await db.execute(sql`
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      tracking_tokens, challans, orders, clients, plants, audit_logs, users
    RESTART IDENTITY CASCADE
  `);
  const [plant] = await db.insert(plants).values({
    name: 'Trip Share Plant', latitude: '12.9716000', longitude: '77.5946000', verified: true,
  }).returning();
  plantId = plant.id;
  const [client] = await db.insert(clients).values({
    name: 'Share Client', contactPerson: 'C', phone: '+911234567890',
    email: 'share-client@test.com', plantId: plant.id,
  }).returning();
  clientId = client.id;
  const [admin] = await db.insert(users).values({
    name: 'Dispatch Admin', email: 'dispatch-admin@test.com',
    passwordHash: await hashPassword('secret123'), role: 'admin', isActive: true,
  }).returning();
  token = signToken({ id: admin.id, email: admin.email, role: admin.role, name: admin.name });
});

after(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await pool.end();
});

test('a dispatched challan with tripShare on records exactly one send with a working share link', async () => {
  process.env.APP_URL = 'https://track.example.com';
  await enableTripShare();

  const challan = await dispatchChallan();
  const sends = await waitForSends(1);

  assert.equal(sends.length, 1, 'exactly one trip-share send is recorded');
  assert.equal(sends[0].automation, 'tripShare');
  assert.equal(sends[0].targetType, 'challan');
  assert.equal(sends[0].targetId, challan.id);
  assert.equal(sends[0].plantId, plantId);

  assert.equal(emails.length, 1, 'the customer got exactly one email');
  assert.deepEqual(emails[0].to, ['share-client@test.com']);
  const url = emails[0].ctaUrl ?? '';
  assert.match(url, /^https:\/\/track\.example\.com\/track\/[0-9a-f]{48}$/,
    'the share link points at the configured base URL');

  // The raw token embedded in the link must resolve back to this challan.
  const rawToken = url.split('/track/')[1];
  assert.equal(await resolveTrackingToken(rawToken), challan.id);

  // Once-only: replaying the hook (e.g. a retried dispatch path) sends nothing new.
  await maybeSendTripShare(challan.id);
  assert.equal((await db.select().from(automationSends)).length, 1);
  assert.equal(emails.length, 1);
});

test('without a configured base URL the send is skipped instead of building a bad link', async () => {
  await enableTripShare();

  const challan = await dispatchChallan();
  // Deterministic replay of the hook (the route's own call is fire-and-forget
  // and also skips): nothing may be claimed, sent, or minted.
  await maybeSendTripShare(challan.id);

  assert.equal((await db.select().from(automationSends)).length, 0, 'no send is claimed');
  assert.equal((await db.select().from(trackingTokens)).length, 0, 'no share token is minted');
  assert.equal(emails.length, 0);
});

test('GET /api/automations reports whether the share base URL is configured', async () => {
  const unset = await request(app).get('/api/automations').set('Authorization', `Bearer ${token}`);
  assert.equal(unset.status, 200);
  assert.equal(unset.body.shareBaseConfigured, false);

  process.env.APP_URL = 'https://track.example.com';
  const set = await request(app).get('/api/automations').set('Authorization', `Bearer ${token}`);
  assert.equal(set.status, 200);
  assert.equal(set.body.shareBaseConfigured, true);
});
