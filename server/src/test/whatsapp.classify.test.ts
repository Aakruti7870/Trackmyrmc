import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Verifies sendWhatsAppTemplate classifies failures as transient (retryable) vs
// permanent. The real module is used; only global.fetch and the Twilio env vars
// are stubbed so isWhatsAppMessagingConfigured() is true and we control the
// provider's response. This is the contract the retry queue depends on.

const ORIGINAL_ENV = {
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_WHATSAPP_FROM,
};
const ORIGINAL_FETCH = globalThis.fetch;

before(() => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token_test';
  process.env.TWILIO_WHATSAPP_FROM = '+14155550000';
});

after(() => {
  if (ORIGINAL_ENV.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
  else process.env.TWILIO_ACCOUNT_SID = ORIGINAL_ENV.sid;
  if (ORIGINAL_ENV.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
  else process.env.TWILIO_AUTH_TOKEN = ORIGINAL_ENV.token;
  if (ORIGINAL_ENV.from === undefined) delete process.env.TWILIO_WHATSAPP_FROM;
  else process.env.TWILIO_WHATSAPP_FROM = ORIGINAL_ENV.from;
  globalThis.fetch = ORIGINAL_FETCH;
});

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

const { sendWhatsAppTemplate } = await import('../lib/whatsapp.js');

const PHONE = '+919876543210';
const SID = 'HXtemplate';

function stubFetch(impl: () => Promise<Response> | Response) {
  globalThis.fetch = (async () => impl()) as typeof fetch;
}

test('a 5xx provider error is retryable', async () => {
  stubFetch(() => new Response('upstream down', { status: 503 }));
  const res = await sendWhatsAppTemplate(PHONE, SID, { '1': 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, true);
});

test('a 429 (rate limited) is retryable', async () => {
  stubFetch(() => new Response('slow down', { status: 429 }));
  const res = await sendWhatsAppTemplate(PHONE, SID, { '1': 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, true);
});

test('a 400 (bad request / invalid number) is permanent', async () => {
  stubFetch(() => new Response('invalid To number', { status: 400 }));
  const res = await sendWhatsAppTemplate(PHONE, SID, { '1': 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, false);
});

test('a network-level throw is retryable', async () => {
  stubFetch(() => { throw new Error('ECONNREFUSED'); });
  const res = await sendWhatsAppTemplate(PHONE, SID, { '1': 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, true);
});

test('a 2xx is a success (not retryable)', async () => {
  stubFetch(() => new Response('{"sid":"SM1"}', { status: 201 }));
  const res = await sendWhatsAppTemplate(PHONE, SID, { '1': 'x' });
  assert.equal(res.ok, true);
  assert.equal(res.retryable, undefined);
});

test('a missing recipient is permanent (no provider call)', async () => {
  stubFetch(() => { throw new Error('should not be called'); });
  const res = await sendWhatsAppTemplate(null, SID, { '1': 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, false);
});

test('a missing template is permanent (no provider call)', async () => {
  stubFetch(() => { throw new Error('should not be called'); });
  const res = await sendWhatsAppTemplate(PHONE, null, { '1': 'x' });
  assert.equal(res.ok, false);
  assert.equal(res.retryable, false);
});
