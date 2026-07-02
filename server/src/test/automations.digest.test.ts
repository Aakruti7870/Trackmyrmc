import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

// Stub the two outbound channels so runDigests never touches real SMTP or
// WhatsApp and we can observe exactly which channel it tried per config.
// Mocks must be registered before the unit under test is loaded.
type EmailCall = { to: string[]; subject: string; heading: string; lines: string[] };
type WaCall = { phone: string; template: string; vars: Record<string, string> };
let emails: EmailCall[] = [];
let waSends: WaCall[] = [];

mock.module('../lib/automationEmail.js', {
  namedExports: {
    sendAutomationEmail: async (msg: EmailCall) => {
      emails.push(msg);
      return true;
    },
  },
});

mock.module('../lib/whatsappRetry.js', {
  namedExports: {
    MAX_ATTEMPTS: 5,
    BACKOFF_BASE_MS: 60_000,
    MAX_BACKOFF_MS: 30 * 60_000,
    LEASE_MS: 5 * 60_000,
    backoffDelayMs: () => 60_000,
    enqueueWhatsAppRetry: async () => undefined,
    sendWhatsAppWithRetry: async (phone: string, template: string, vars: Record<string, string>) => {
      waSends.push({ phone, template, vars });
      return { ok: true, sid: 'SM-stub', channel: 'dev', status: 'dev', error: null };
    },
    runDueWhatsAppRetries: async () => ({ processed: 0, sent: 0, rescheduled: 0, gaveUp: 0 }),
    listPendingWhatsAppRetries: async () => [],
    cancelWhatsAppRetry: async () => false,
    retryWhatsAppNow: async () => 'notFound',
  },
});

const { db, pool } = await import('../db/index.js');
const { users, plants, automationSends, whatsappMessages } = await import('../db/schema.js');
const { loadAutomationSnapshot, sanitizeConfig, saveAutomationSettings } = await import('../lib/automations.js');
const { runDigests } = await import('../lib/automationJobs.js');
const { hashPassword } = await import('../lib/password.js');

async function seedPlantWithAdmin() {
  const [plant] = await db.insert(plants).values({
    name: 'Digest Plant', latitude: '12.9716000', longitude: '77.5946000', verified: true,
  }).returning();
  const passwordHash = await hashPassword('secret123');
  await db.insert(users).values({
    name: 'Plant Admin', email: 'digest-admin@test.com', passwordHash,
    role: 'admin', isActive: true, plantId: plant.id, phone: '+919876543210',
  });
  return plant;
}

async function enableDigest(config: Record<string, unknown>) {
  await saveAutomationSettings('digest', null, true,
    sanitizeConfig('digest', { frequency: 'daily', sendHour: 0, ...config }));
}

before(() => {
  // Module mocks registered above; nothing else to set up.
});

beforeEach(async () => {
  emails = [];
  waSends = [];
  await db.execute(sql`
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      whatsapp_messages, orders, clients, plants, audit_logs, users
    RESTART IDENTITY CASCADE
  `);
});

after(async () => {
  await pool.end();
});

test('sanitizeConfig keeps the digest channel toggles and template name', () => {
  const cfg = sanitizeConfig('digest', { email: 0, whatsapp: true, whatsappTemplate: '  digest_tpl  ' });
  assert.equal(cfg.email, false);
  assert.equal(cfg.whatsapp, true);
  assert.equal(cfg.whatsappTemplate, 'digest_tpl');
});

test('email-only digest sends the email and no WhatsApp', async () => {
  const plant = await seedPlantWithAdmin();
  await enableDigest({ email: true, whatsapp: false });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot), 1);

  assert.equal(emails.length, 1);
  assert.deepEqual(emails[0].to, ['digest-admin@test.com']);
  assert.match(emails[0].subject, /Daily digest — Digest Plant/);
  assert.equal(waSends.length, 0);

  const sends = await db.select().from(automationSends);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].automation, 'digest');
  assert.equal(sends[0].plantId, plant.id);
});

test('WhatsApp-only digest sends the template to staff phones and records message history', async () => {
  const plant = await seedPlantWithAdmin();
  await enableDigest({ email: false, whatsapp: true, whatsappTemplate: 'digest_tpl' });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot), 1);

  assert.equal(emails.length, 0);
  assert.equal(waSends.length, 1);
  assert.equal(waSends[0].phone, '+919876543210');
  assert.equal(waSends[0].template, 'digest_tpl');
  assert.equal(waSends[0].vars['1'], 'Digest Plant');

  const history = await db.select().from(whatsappMessages);
  assert.equal(history.length, 1);
  assert.equal(history[0].event, 'automation:digest');
  assert.equal(history[0].plantId, plant.id);
});

test('both channels fire together, but never twice for the same window', async () => {
  await seedPlantWithAdmin();
  await enableDigest({ email: true, whatsapp: true, whatsappTemplate: 'digest_tpl' });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot), 1);
  assert.equal(emails.length, 1);
  assert.equal(waSends.length, 1);

  // Same IST day → the once-only claim blocks a repeat on both channels.
  assert.equal(await runDigests(snapshot), 0);
  assert.equal(emails.length, 1);
  assert.equal(waSends.length, 1);
});

test('WhatsApp toggle without a template name sends nothing over WhatsApp', async () => {
  await seedPlantWithAdmin();
  await enableDigest({ email: false, whatsapp: true, whatsappTemplate: '' });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot), 1, 'the digest window is still claimed');
  assert.equal(waSends.length, 0);
  assert.equal(emails.length, 0);
});
