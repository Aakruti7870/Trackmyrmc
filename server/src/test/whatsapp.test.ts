import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import { setSetting } from '../lib/settings.js';
import {
  WHATSAPP_KEYS,
  DEFAULT_META_TEMPLATE_NAMES,
  getWhatsAppConfig,
  eventEnabled,
  ensureWhatsAppTemplateDefaults,
  sendWhatsAppTemplate,
  type WhatsAppConfig,
} from '../lib/whatsapp.js';

// Unit coverage for the WhatsApp sender/config itself (the orchestration test in
// whatsappNotify.test.ts mocks this module, so the real gating + fail-closed
// behaviour is verified here). These tests assume the Twilio WhatsApp sender is
// NOT configured (TWILIO_WHATSAPP_FROM is unset in the test env), so delivery
// takes the dev/fail-closed branch rather than calling the live API.

function cfg(over: Partial<WhatsAppConfig> = {}): WhatsAppConfig {
  return {
    enabled: true, orderEnabled: true, dispatchEnabled: true, deliveryEnabled: true,
    orderTemplateSid: 'HXorder', dispatchTemplateSid: 'HXdispatch', deliveryTemplateSid: 'HXdelivery',
    configured: false, ...over,
  };
}

// These assertions cover the UNCONFIGURED sender (dev-fallback / fail-closed)
// branches, so they must not depend on whatever Twilio creds happen to be set in
// the ambient environment. Snapshot + clear them for the whole file, restore after.
const TWILIO_ENV_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'] as const;
const savedTwilioEnv: Record<string, string | undefined> = {};

before(() => {
  for (const k of TWILIO_ENV_KEYS) {
    savedTwilioEnv[k] = process.env[k];
    delete process.env[k];
  }
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE`);
});

after(async () => {
  for (const k of TWILIO_ENV_KEYS) {
    if (savedTwilioEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedTwilioEnv[k];
  }
  await pool.end();
});

test('getWhatsAppConfig defaults to all-on with no templates when unset', async () => {
  const c = await getWhatsAppConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.orderEnabled, true);
  assert.equal(c.dispatchEnabled, true);
  assert.equal(c.deliveryEnabled, true);
  assert.equal(c.orderTemplateSid, null);
  assert.equal(c.dispatchTemplateSid, null);
  assert.equal(c.deliveryTemplateSid, null);
  // No TWILIO_WHATSAPP_FROM in tests → not configured for real delivery.
  assert.equal(c.configured, false);
});

test('getWhatsAppConfig reads persisted toggles + SIDs', async () => {
  await setSetting(WHATSAPP_KEYS.enabled, 'false');
  await setSetting(WHATSAPP_KEYS.orderEnabled, 'true');
  await setSetting(WHATSAPP_KEYS.dispatchEnabled, 'false');
  await setSetting(WHATSAPP_KEYS.orderTemplateSid, 'HXabc');
  const c = await getWhatsAppConfig();
  assert.equal(c.enabled, false);
  assert.equal(c.orderEnabled, true);
  assert.equal(c.dispatchEnabled, false);
  assert.equal(c.orderTemplateSid, 'HXabc');
});

test('eventEnabled requires global switch, per-event toggle AND a template', () => {
  assert.equal(eventEnabled(cfg(), 'order'), true);
  assert.equal(eventEnabled(cfg({ enabled: false }), 'order'), false);
  assert.equal(eventEnabled(cfg({ orderEnabled: false }), 'order'), false);
  assert.equal(eventEnabled(cfg({ orderTemplateSid: null }), 'order'), false);
  // Per-event isolation: dispatch off doesn't disable delivery.
  assert.equal(eventEnabled(cfg({ dispatchEnabled: false }), 'delivery'), true);
  assert.equal(eventEnabled(cfg({ deliveryTemplateSid: null }), 'delivery'), false);
});

test('sendWhatsAppTemplate dev-fallback returns ok when unconfigured (non-prod)', async () => {
  const res = await sendWhatsAppTemplate('9991112222', 'HXabc', { '1': 'x' });
  assert.equal(res.ok, true);
  assert.equal(res.channel, 'dev');
});

test('sendWhatsAppTemplate skips with no recipient phone', async () => {
  const res = await sendWhatsAppTemplate(null, 'HXabc', {});
  assert.equal(res.ok, false);
  assert.equal(res.channel, 'dev');
});

test('sendWhatsAppTemplate skips with no template SID', async () => {
  const res = await sendWhatsAppTemplate('9991112222', null, {});
  assert.equal(res.ok, false);
  assert.equal(res.channel, 'dev');
});

test('sendWhatsAppTemplate fails CLOSED in production when unconfigured', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await sendWhatsAppTemplate('9991112222', 'HXabc', { '1': 'x' });
    assert.equal(res.ok, false, 'must not silently succeed without a provider in prod');
    assert.equal(res.channel, 'dev');
  } finally {
    process.env.NODE_ENV = prev;
  }
});

// Run `fn` with the Meta Cloud API env either configured or cleared, restoring
// the prior values afterwards so the boot-seed branch is exercised deterministically
// regardless of the ambient (stripped) test env.
const META_ENV_KEYS = ['WHATSAPP_META_PHONE_NUMBER_ID', 'WHATSAPP_META_ACCESS_TOKEN'] as const;
async function withMetaEnv(configured: boolean, fn: () => Promise<void>): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const k of META_ENV_KEYS) saved[k] = process.env[k];
  if (configured) {
    process.env.WHATSAPP_META_PHONE_NUMBER_ID = 'pn-test';
    process.env.WHATSAPP_META_ACCESS_TOKEN = 'tok-test';
  } else {
    for (const k of META_ENV_KEYS) delete process.env[k];
  }
  try {
    await fn();
  } finally {
    for (const k of META_ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('ensureWhatsAppTemplateDefaults no-ops when Meta is not configured', async () => {
  await withMetaEnv(false, async () => {
    const n = await ensureWhatsAppTemplateDefaults();
    assert.equal(n, 0);
    const c = await getWhatsAppConfig();
    assert.equal(c.orderTemplateSid, null);
    assert.equal(c.dispatchTemplateSid, null);
    assert.equal(c.deliveryTemplateSid, null);
  });
});

test('ensureWhatsAppTemplateDefaults seeds the approved names when Meta is configured', async () => {
  await withMetaEnv(true, async () => {
    const n = await ensureWhatsAppTemplateDefaults();
    assert.equal(n, 3);
    const c = await getWhatsAppConfig();
    assert.equal(c.orderTemplateSid, DEFAULT_META_TEMPLATE_NAMES.order);
    assert.equal(c.dispatchTemplateSid, DEFAULT_META_TEMPLATE_NAMES.dispatch);
    assert.equal(c.deliveryTemplateSid, DEFAULT_META_TEMPLATE_NAMES.delivery);
  });
});

test('ensureWhatsAppTemplateDefaults never overwrites an admin-set template name', async () => {
  await withMetaEnv(true, async () => {
    await setSetting(WHATSAPP_KEYS.orderTemplateSid, 'custom_order_tpl');
    const n = await ensureWhatsAppTemplateDefaults();
    // order already present → only dispatch + delivery are inserted.
    assert.equal(n, 2);
    const c = await getWhatsAppConfig();
    assert.equal(c.orderTemplateSid, 'custom_order_tpl');
    assert.equal(c.dispatchTemplateSid, DEFAULT_META_TEMPLATE_NAMES.dispatch);
    assert.equal(c.deliveryTemplateSid, DEFAULT_META_TEMPLATE_NAMES.delivery);
  });
});
