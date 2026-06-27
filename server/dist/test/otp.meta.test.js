import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { otpCodes } from '../db/schema.js';
import { sendOtp, verifyOtp, isMetaOtpConfigured, isOtpDeliveryConfigured, metaOtpTemplateName, } from '../lib/otp.js';
// Exercises the Meta WhatsApp Cloud API OTP path: with Twilio Verify absent but
// the shared Meta sender configured, sendOtp must generate + store a code,
// deliver it via the approved AUTHENTICATION template (Graph API, stubbed here),
// and let verifyOtp check it LOCALLY. Env is forced for the whole file so it does
// not depend on whatever the harness happens to strip/set.
const META_KEYS = [
    'WHATSAPP_META_PHONE_NUMBER_ID',
    'WHATSAPP_META_ACCESS_TOKEN',
    'WHATSAPP_META_OTP_TEMPLATE',
];
const TWILIO_VERIFY_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'];
const saved = {};
const realFetch = global.fetch;
before(() => {
    for (const k of [...META_KEYS, ...TWILIO_VERIFY_KEYS])
        saved[k] = process.env[k];
    // Force the "Meta configured, Twilio Verify absent" combination.
    for (const k of TWILIO_VERIFY_KEYS)
        delete process.env[k];
    process.env.WHATSAPP_META_PHONE_NUMBER_ID = 'pn-test';
    process.env.WHATSAPP_META_ACCESS_TOKEN = 'tok-test';
    delete process.env.WHATSAPP_META_OTP_TEMPLATE; // use the default name
});
beforeEach(async () => {
    await db.delete(otpCodes);
});
after(async () => {
    for (const k of [...META_KEYS, ...TWILIO_VERIFY_KEYS]) {
        if (saved[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = saved[k];
    }
    global.fetch = realFetch;
    await pool.end();
});
test('Meta counts as a configured OTP delivery channel', () => {
    assert.equal(isMetaOtpConfigured(), true);
    assert.equal(isOtpDeliveryConfigured(), true);
});
test('sendOtp delivers via the Meta auth template and verifies locally', async () => {
    const calls = [];
    global.fetch = (async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 });
    });
    const phone = '+919812345678';
    const res = await sendOtp(phone);
    assert.equal(res.ok, true);
    assert.equal(res.channel, 'whatsapp');
    assert.equal(res.devCode, undefined, 'never echo the code back over a real channel');
    assert.equal(calls.length, 1, 'Meta Graph endpoint was called once');
    const cap = calls[0];
    assert.match(cap.url, /\/pn-test\/messages$/);
    assert.equal(cap.body.template.name, metaOtpTemplateName());
    const bodyCode = cap.body.template.components[0].parameters[0].text;
    const buttonCode = cap.body.template.components[1].parameters[0].text;
    assert.match(bodyCode, /^\d{6}$/);
    assert.equal(buttonCode, bodyCode, 'same code in the body and the OTP button');
    // A hash (not the plaintext) is stored, and the real code verifies + is consumed.
    const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
    assert.ok(row, 'code stored for local verification');
    assert.notEqual(row.codeHash, bodyCode, 'stored value is hashed, not plaintext');
    const check = await verifyOtp(phone, bodyCode);
    assert.equal(check.ok, true);
    const remaining = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
    assert.equal(remaining.length, 0, 'single-use code consumed on success');
});
test('a failed Meta send removes the stored code', async () => {
    global.fetch = (async () => new Response('bad template name', { status: 400 }));
    const phone = '+919800000123';
    const res = await sendOtp(phone);
    assert.equal(res.ok, false);
    assert.equal(res.channel, 'whatsapp');
    const rows = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
    assert.equal(rows.length, 0, 'no live code left behind after a failed send');
});
