import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import { setSetting } from '../lib/settings.js';
import {
  WHATSAPP_KEYS,
  getWhatsAppConfig,
  eventEnabled,
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

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

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
