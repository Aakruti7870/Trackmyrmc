import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { whatsappMessages } from '../db/schema.js';
let app;
const VERIFY_TOKEN = 'test_verify_token_123';
const APP_SECRET = 'test_app_secret_xyz';
// Snapshot the WhatsApp webhook env so a configured workspace secret can't flip
// the verify-token / signature branches under test.
let savedVerify;
let savedSecret;
before(() => {
    app = buildTestApp();
    savedVerify = process.env.WHATSAPP_META_VERIFY_TOKEN;
    savedSecret = process.env.WHATSAPP_META_APP_SECRET;
    process.env.WHATSAPP_META_VERIFY_TOKEN = VERIFY_TOKEN;
    // Default to NO app secret so the receiver tests exercise the best-effort
    // (unconfigured) accept path; the signature tests set it explicitly.
    delete process.env.WHATSAPP_META_APP_SECRET;
});
beforeEach(async () => {
    delete process.env.WHATSAPP_META_APP_SECRET;
    process.env.WHATSAPP_META_VERIFY_TOKEN = VERIFY_TOKEN;
    await db.execute(sql `TRUNCATE TABLE whatsapp_messages, challans, orders, clients, users, plants RESTART IDENTITY CASCADE`);
});
after(async () => {
    if (savedVerify === undefined)
        delete process.env.WHATSAPP_META_VERIFY_TOKEN;
    else
        process.env.WHATSAPP_META_VERIFY_TOKEN = savedVerify;
    if (savedSecret === undefined)
        delete process.env.WHATSAPP_META_APP_SECRET;
    else
        process.env.WHATSAPP_META_APP_SECRET = savedSecret;
    await pool.end();
});
async function seedMessage(over = {}) {
    const [row] = await db
        .insert(whatsappMessages)
        .values({
        messageSid: 'wamid.AAA',
        event: 'dispatch',
        toPhone: '+919991112222',
        status: 'accepted',
        channel: 'whatsapp',
        ...over,
    })
        .returning();
    return row;
}
function statusPayload(id, status, errorCode) {
    return {
        object: 'whatsapp_business_account',
        entry: [
            {
                id: 'WABA',
                changes: [
                    {
                        field: 'messages',
                        value: {
                            messaging_product: 'whatsapp',
                            statuses: [
                                {
                                    id,
                                    status,
                                    timestamp: '1700000000',
                                    recipient_id: '919991112222',
                                    ...(errorCode != null ? { errors: [{ code: errorCode, title: 'err' }] } : {}),
                                },
                            ],
                        },
                    },
                ],
            },
        ],
    };
}
function sign(secret, body) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(body, 'utf-8')).digest('hex');
}
// --- GET verification handshake ---------------------------------------------
test('GET echoes hub.challenge when the verify token matches', async () => {
    const res = await request(app).get('/api/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'CHALLENGE_42',
    });
    assert.equal(res.status, 200);
    assert.equal(res.text, 'CHALLENGE_42');
});
test('GET rejects a wrong verify token with 403', async () => {
    const res = await request(app).get('/api/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'WRONG',
        'hub.challenge': 'CHALLENGE_42',
    });
    assert.equal(res.status, 403);
});
test('GET rejects when verify token is unset (fails closed)', async () => {
    delete process.env.WHATSAPP_META_VERIFY_TOKEN;
    const res = await request(app).get('/api/webhooks/whatsapp').query({
        'hub.mode': 'subscribe',
        'hub.verify_token': '',
        'hub.challenge': 'C',
    });
    assert.equal(res.status, 403);
    process.env.WHATSAPP_META_VERIFY_TOKEN = VERIFY_TOKEN;
});
// --- POST status receiver (no app secret = best-effort accept) ---------------
test('POST advances the stored status by wamid', async () => {
    await seedMessage({ messageSid: 'wamid.DELIV', status: 'accepted' });
    const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(statusPayload('wamid.DELIV', 'delivered'));
    assert.equal(res.status, 200);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.DELIV'));
    assert.equal(row.status, 'delivered');
});
test('POST records the Meta error code on a failed status', async () => {
    await seedMessage({ messageSid: 'wamid.FAIL', status: 'sent' });
    const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(statusPayload('wamid.FAIL', 'failed', 131026));
    assert.equal(res.status, 200);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.FAIL'));
    assert.equal(row.status, 'failed');
    assert.equal(row.errorCode, '131026');
});
test('POST acks 200 for an unknown wamid without touching other rows', async () => {
    await seedMessage({ messageSid: 'wamid.KNOWN', status: 'accepted' });
    const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(statusPayload('wamid.UNKNOWN', 'read'));
    assert.equal(res.status, 200);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.KNOWN'));
    assert.equal(row.status, 'accepted');
});
// --- POST signature verification (app secret configured) --------------------
test('POST rejects a bad signature with 403 when an app secret is set', async () => {
    process.env.WHATSAPP_META_APP_SECRET = APP_SECRET;
    await seedMessage({ messageSid: 'wamid.SIG', status: 'accepted' });
    const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('X-Hub-Signature-256', 'sha256=deadbeef')
        .send(statusPayload('wamid.SIG', 'delivered'));
    assert.equal(res.status, 403);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.SIG'));
    assert.equal(row.status, 'accepted');
});
test('POST fails closed in production when no app secret is configured', async () => {
    delete process.env.WHATSAPP_META_APP_SECRET;
    const savedEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
        await seedMessage({ messageSid: 'wamid.PROD', status: 'accepted' });
        const res = await request(app)
            .post('/api/webhooks/whatsapp')
            .send(statusPayload('wamid.PROD', 'delivered'));
        assert.equal(res.status, 403);
        const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.PROD'));
        assert.equal(row.status, 'accepted');
    }
    finally {
        process.env.NODE_ENV = savedEnv;
    }
});
test('POST accepts a valid signature when an app secret is set', async () => {
    process.env.WHATSAPP_META_APP_SECRET = APP_SECRET;
    await seedMessage({ messageSid: 'wamid.SIGOK', status: 'accepted' });
    const payload = statusPayload('wamid.SIGOK', 'read');
    const raw = JSON.stringify(payload);
    const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', sign(APP_SECRET, raw))
        .send(raw);
    assert.equal(res.status, 200);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.SIGOK'));
    assert.equal(row.status, 'read');
});
