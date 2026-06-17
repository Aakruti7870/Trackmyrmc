import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
// Verifies the Meta WhatsApp Cloud API send path: that sendWhatsAppTemplate
// targets Meta's Graph API (and NOT Twilio) when WHATSAPP_META_* is configured,
// builds the template payload correctly, parses the message id, and classifies
// failures as transient (retryable) vs permanent exactly like the Twilio path.
// The real module is used; only global.fetch and the env vars are stubbed.
const ORIGINAL_ENV = {
    phoneNumberId: process.env.WHATSAPP_META_PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_META_ACCESS_TOKEN,
    version: process.env.WHATSAPP_META_API_VERSION,
    lang: process.env.WHATSAPP_META_LANG,
    // Twilio creds too: we assert Meta wins even when Twilio is ALSO configured.
    twSid: process.env.TWILIO_ACCOUNT_SID,
    twToken: process.env.TWILIO_AUTH_TOKEN,
    twFrom: process.env.TWILIO_WHATSAPP_FROM,
};
const ORIGINAL_FETCH = globalThis.fetch;
before(() => {
    process.env.WHATSAPP_META_PHONE_NUMBER_ID = '1145638218639031';
    process.env.WHATSAPP_META_ACCESS_TOKEN = 'meta_test_token';
    process.env.WHATSAPP_META_API_VERSION = 'v21.0';
    process.env.WHATSAPP_META_LANG = 'en_US';
    // Configure Twilio as well, so the precedence test is meaningful.
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'token_test';
    process.env.TWILIO_WHATSAPP_FROM = '+14155550000';
});
after(() => {
    const restore = (key, val) => {
        if (val === undefined)
            delete process.env[key];
        else
            process.env[key] = val;
    };
    restore('WHATSAPP_META_PHONE_NUMBER_ID', ORIGINAL_ENV.phoneNumberId);
    restore('WHATSAPP_META_ACCESS_TOKEN', ORIGINAL_ENV.token);
    restore('WHATSAPP_META_API_VERSION', ORIGINAL_ENV.version);
    restore('WHATSAPP_META_LANG', ORIGINAL_ENV.lang);
    restore('TWILIO_ACCOUNT_SID', ORIGINAL_ENV.twSid);
    restore('TWILIO_AUTH_TOKEN', ORIGINAL_ENV.twToken);
    restore('TWILIO_WHATSAPP_FROM', ORIGINAL_ENV.twFrom);
    globalThis.fetch = ORIGINAL_FETCH;
});
beforeEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
});
const { sendWhatsAppTemplate, metaWhatsAppConfig, isWhatsAppMessagingConfigured } = await import('../lib/whatsapp.js');
const PHONE = '+919876543210';
const TEMPLATE = 'order_placed';
// Stub global.fetch, capturing the request so the payload can be asserted, and
// returning the given response.
function stubFetch(impl) {
    const calls = [];
    globalThis.fetch = (async (url, init) => {
        calls.push({ url, init });
        return impl();
    });
    return calls;
}
test('metaWhatsAppConfig reflects the env + isWhatsAppMessagingConfigured is true', () => {
    const cfg = metaWhatsAppConfig();
    assert.ok(cfg);
    assert.equal(cfg.phoneNumberId, '1145638218639031');
    assert.equal(cfg.version, 'v21.0');
    assert.equal(cfg.lang, 'en_US');
    assert.equal(isWhatsAppMessagingConfigured(), true);
});
test('a successful send targets Meta Graph API and returns the wamid', async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ messages: [{ id: 'wamid.ABC123' }] }), { status: 200 }));
    const res = await sendWhatsAppTemplate(PHONE, TEMPLATE, { '1': 'Acme', '2': 'ORD-1' });
    assert.equal(res.ok, true);
    assert.equal(res.channel, 'whatsapp');
    assert.equal(res.sid, 'wamid.ABC123');
    assert.equal(res.status, 'accepted');
    // It hit Meta, not Twilio.
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.startsWith('https://graph.facebook.com/v21.0/1145638218639031/messages'));
    assert.ok(!calls[0].url.includes('api.twilio.com'));
    // Auth + JSON content-type.
    const headers = calls[0].init.headers;
    assert.equal(headers.Authorization, 'Bearer meta_test_token');
    assert.equal(headers['Content-Type'], 'application/json');
    // Payload: template name + language, recipient digits (no +), positional params.
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.messaging_product, 'whatsapp');
    assert.equal(body.to, '919876543210');
    assert.equal(body.type, 'template');
    assert.equal(body.template.name, TEMPLATE);
    assert.equal(body.template.language.code, 'en_US');
    assert.deepEqual(body.template.components, [
        { type: 'body', parameters: [
                { type: 'text', text: 'Acme' },
                { type: 'text', text: 'ORD-1' },
            ] },
    ]);
});
test('variables are ordered numerically (10 sorts after 2, not after 1)', async () => {
    const calls = stubFetch(() => new Response(JSON.stringify({ messages: [{ id: 'wamid.X' }] }), { status: 200 }));
    await sendWhatsAppTemplate(PHONE, TEMPLATE, { '2': 'b', '1': 'a', '10': 'j', '3': 'c' });
    const body = JSON.parse(calls[0].init.body);
    assert.deepEqual(body.template.components[0].parameters.map((p) => p.text), ['a', 'b', 'c', 'j']);
});
test('a 5xx provider error is retryable', async () => {
    stubFetch(() => new Response('upstream down', { status: 503 }));
    const res = await sendWhatsAppTemplate(PHONE, TEMPLATE, { '1': 'x' });
    assert.equal(res.ok, false);
    assert.equal(res.retryable, true);
});
test('a 429 (rate limited) is retryable', async () => {
    stubFetch(() => new Response('slow down', { status: 429 }));
    const res = await sendWhatsAppTemplate(PHONE, TEMPLATE, { '1': 'x' });
    assert.equal(res.ok, false);
    assert.equal(res.retryable, true);
});
test('a 400 (bad template / number) is permanent', async () => {
    stubFetch(() => new Response('{"error":{"message":"bad"}}', { status: 400 }));
    const res = await sendWhatsAppTemplate(PHONE, TEMPLATE, { '1': 'x' });
    assert.equal(res.ok, false);
    assert.equal(res.retryable, false);
});
test('a network-level throw is retryable', async () => {
    stubFetch(() => { throw new Error('ECONNREFUSED'); });
    const res = await sendWhatsAppTemplate(PHONE, TEMPLATE, { '1': 'x' });
    assert.equal(res.ok, false);
    assert.equal(res.retryable, true);
});
test('a missing recipient is permanent and never calls the provider', async () => {
    stubFetch(() => { throw new Error('should not be called'); });
    const res = await sendWhatsAppTemplate(null, TEMPLATE, { '1': 'x' });
    assert.equal(res.ok, false);
    assert.equal(res.retryable, false);
});
