import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq, and, isNull } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, otpCodes, rateLimitHits } from '../db/schema.js';
let app;
before(() => {
    // These tests rely on the dev fallback (no provider configured). Guard against a
    // stray env var making the suite hit a real provider — both Twilio Verify and
    // the Meta Cloud API OTP path now count as real delivery channels.
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_META_ACCESS_TOKEN;
    app = buildTestApp();
});
beforeEach(async () => {
    await db.delete(otpCodes);
    // The OTP send/verify routes share an unnamed ('default') DB-backed rate-limit
    // counter keyed by IP. Every request in this file comes from 127.0.0.1, so
    // without resetting the counter the per-window budget (max 5) is consumed
    // across tests and later sends/verifies 429 — making the suite order-flaky.
    // Clearing it per test keeps each case deterministic.
    await db.delete(rateLimitHits);
    // Clean up any OTP-created customer accounts/clients from prior runs.
    await db.delete(users).where(sql `${users.email} LIKE 'otp_%@otp.local'`);
    await db.delete(clients).where(sql `${clients.phone} LIKE '+91%'`);
});
after(async () => {
    await pool.end();
});
function send(body) {
    return request(app).post('/api/auth/otp/send').send(body);
}
function verify(body) {
    return request(app).post('/api/auth/otp/verify').send(body);
}
test('send returns a dev code in dev mode and normalizes a bare 10-digit number', async () => {
    const res = await send({ phone: '98765 43210' });
    assert.equal(res.status, 200);
    assert.equal(res.body.devMode, true);
    assert.equal(res.body.channel, 'dev');
    assert.match(res.body.devCode, /^\d{6}$/);
    const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, '+919876543210'));
    assert.ok(row, 'code row stored under normalized E.164 phone');
});
test('send rejects an unparseable phone number', async () => {
    const res = await send({ phone: 'abc' });
    assert.equal(res.status, 400);
});
test('verify with the correct code creates a client account and issues a token', async () => {
    const phone = '+919812345678';
    const sent = await send({ phone, name: 'Ramesh Builders' });
    const code = sent.body.devCode;
    const res = await verify({ phone, code, name: 'Ramesh Builders' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'JWT returned');
    assert.equal(res.body.user.role, 'client');
    assert.equal(res.body.user.phone, phone);
    assert.equal(res.body.user.name, 'Ramesh Builders');
    const [user] = await db.select().from(users)
        .where(and(eq(users.phone, phone), isNull(users.deletedAt)));
    assert.ok(user, 'user persisted');
    assert.ok(user.linkedClientId, 'user linked to a new client');
    assert.match(user.email, /^otp_\d+@otp\.local$/);
    // The single-use code is consumed on success.
    const remaining = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
    assert.equal(remaining.length, 0);
});
test('verifying a returning number reuses the same account', async () => {
    const phone = '+919800000001';
    const first = await send({ phone });
    const u1 = await verify({ phone, code: first.body.devCode });
    assert.equal(u1.status, 200);
    const second = await send({ phone });
    const u2 = await verify({ phone, code: second.body.devCode });
    assert.equal(u2.status, 200);
    assert.equal(u2.body.user.id, u1.body.user.id, 'same account on repeat login');
    const rows = await db.select().from(users).where(eq(users.phone, phone));
    assert.equal(rows.length, 1, 'no duplicate account created');
});
test('verify rejects a wrong code without creating an account', async () => {
    const phone = '+919700000002';
    const sent = await send({ phone });
    const wrong = sent.body.devCode === '000000' ? '111111' : '000000';
    const res = await verify({ phone, code: wrong });
    assert.equal(res.status, 400);
    const rows = await db.select().from(users).where(eq(users.phone, phone));
    assert.equal(rows.length, 0, 'no account created on failed verification');
});
test('with Meta configured, /otp/send reports a real channel and never leaks the code', async () => {
    // Route-level guard for the devMode wiring: a real Meta send must NOT be flagged
    // as dev mode and must NOT echo the code back in the response.
    process.env.WHATSAPP_META_PHONE_NUMBER_ID = 'pn-test';
    process.env.WHATSAPP_META_ACCESS_TOKEN = 'tok-test';
    const realFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 }));
    try {
        const res = await send({ phone: '+919812345000' });
        assert.equal(res.status, 200);
        assert.equal(res.body.channel, 'whatsapp');
        assert.equal(res.body.devMode, false);
        assert.equal(res.body.devCode, undefined, 'never echo the code over a real channel');
    }
    finally {
        delete process.env.WHATSAPP_META_PHONE_NUMBER_ID;
        delete process.env.WHATSAPP_META_ACCESS_TOKEN;
        global.fetch = realFetch;
    }
});
