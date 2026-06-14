import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, whatsappMessages, orders, challans, clients } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';
let app;
const PASSWORD = 'secret123';
// Capture SSE events broadcast via emitSSEEvent by registering an identity-less
// fake client against the real emitter. Such an observer receives every event
// regardless of audience, so we can assert that whatsapp.failed is (or is not)
// emitted and inspect its payload.
function captureSSE() {
    const raw = [];
    const mockRes = {
        writableEnded: false,
        destroyed: false,
        req: { httpVersionMajor: 2 },
        setHeader() { },
        flushHeaders() { },
        write(payload) { raw.push(payload); return true; },
        end() { mockRes.writableEnded = true; },
    };
    const id = addSSEClient(mockRes);
    return {
        id,
        events() {
            return raw
                .map((chunk) => /^event: (.+)$/m.exec(chunk)?.[1])
                .filter((e) => Boolean(e));
        },
        payloads(eventName) {
            const out = [];
            for (const chunk of raw) {
                const ev = /^event: (.+)$/m.exec(chunk)?.[1];
                if (ev !== eventName)
                    continue;
                const data = /^data: (.+)$/m.exec(chunk)?.[1];
                if (data)
                    out.push(JSON.parse(data));
            }
            return out;
        },
        close() { removeSSEClient(id); },
    };
}
// Let the fire-and-forget staff alert (kicked off after the webhook acks) settle.
function flush() {
    return new Promise((resolve) => setTimeout(resolve, 50));
}
// The webhook validates the X-Twilio-Signature against the URL Twilio was told to
// call. Pin it so the signed-request test can compute a matching HMAC instead of
// depending on supertest's random ephemeral host.
const CALLBACK_URL = 'https://app.test/api/whatsapp/status';
async function createUser(role, email, plantId = null) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: role, email, passwordHash, role: role, isActive: true, plantId,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name, plantId: u.plantId ?? null });
}
let plantSeq = 0;
async function createPlant() {
    plantSeq += 1;
    const [row] = await db.insert(plants).values({
        name: `Plant ${plantSeq}`, latitude: '18.5', longitude: '73.8',
    }).returning();
    return row;
}
// Build a valid Twilio signature for the pinned callback URL + form params.
function sign(authToken, params) {
    let data = CALLBACK_URL;
    for (const key of Object.keys(params).sort())
        data += key + params[key];
    return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.APP_URL;
    delete process.env.PUBLIC_URL;
    await db.execute(sql `TRUNCATE TABLE whatsapp_messages, challans, orders, clients, users, plants RESTART IDENTITY CASCADE`);
});
after(async () => {
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.APP_URL;
    await pool.end();
});
async function seedMessage(over = {}) {
    const [row] = await db.insert(whatsappMessages).values({
        messageSid: 'SM000001', event: 'dispatch', toPhone: '+919991112222',
        status: 'queued', channel: 'whatsapp', ...over,
    }).returning();
    return row;
}
// --- Webhook -----------------------------------------------------------------
test('status callback advances the stored status by SID (dev: no auth token = accepted)', async () => {
    await seedMessage({ messageSid: 'SMabc', status: 'queued' });
    const res = await request(app)
        .post('/api/whatsapp/status')
        .type('form')
        .send({ MessageSid: 'SMabc', MessageStatus: 'delivered' });
    assert.equal(res.status, 204);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'SMabc'));
    assert.equal(row.status, 'delivered');
});
test('status callback records the Twilio error code on a failed message', async () => {
    await seedMessage({ messageSid: 'SMfail', status: 'sent' });
    const res = await request(app)
        .post('/api/whatsapp/status')
        .type('form')
        .send({ MessageSid: 'SMfail', MessageStatus: 'failed', ErrorCode: '63016' });
    assert.equal(res.status, 204);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'SMfail'));
    assert.equal(row.status, 'failed');
    assert.equal(row.errorCode, '63016');
});
test('a valid signature is accepted when an auth token is configured', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.APP_URL = 'https://app.test';
    await seedMessage({ messageSid: 'SMsigned', status: 'queued' });
    const params = { MessageSid: 'SMsigned', MessageStatus: 'read' };
    const res = await request(app)
        .post('/api/whatsapp/status')
        .type('form')
        .set('X-Twilio-Signature', sign('test-token', params))
        .send(params);
    assert.equal(res.status, 204);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'SMsigned'));
    assert.equal(row.status, 'read');
});
test('an invalid/missing signature is rejected (403) when an auth token is configured', async () => {
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.APP_URL = 'https://app.test';
    await seedMessage({ messageSid: 'SMguard', status: 'queued' });
    const res = await request(app)
        .post('/api/whatsapp/status')
        .type('form')
        .set('X-Twilio-Signature', 'not-the-real-signature')
        .send({ MessageSid: 'SMguard', MessageStatus: 'delivered' });
    assert.equal(res.status, 403);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'SMguard'));
    assert.equal(row.status, 'queued');
});
test('a callback for an unknown SID is acknowledged but changes nothing', async () => {
    const res = await request(app)
        .post('/api/whatsapp/status')
        .type('form')
        .send({ MessageSid: 'SMnope', MessageStatus: 'delivered' });
    assert.equal(res.status, 204);
    const rows = await db.select().from(whatsappMessages);
    assert.equal(rows.length, 0);
});
// --- Staff failure alert -----------------------------------------------------
test('a failed callback alerts staff via SSE naming the challan, phone and error code', async () => {
    const [client] = await db.insert(clients).values({
        name: 'Acme', contactPerson: 'Jane', phone: '999', email: null,
    }).returning();
    const [challan] = await db.insert(challans).values({
        challanNo: 'CH-A1', clientId: client.id, grade: 'M30', quantity: '8.00', status: 'dispatched',
    }).returning();
    await seedMessage({ messageSid: 'SMalert', event: 'dispatch', challanId: challan.id, toPhone: '+919991112222', status: 'sent' });
    const sse = captureSSE();
    try {
        const res = await request(app)
            .post('/api/whatsapp/status')
            .type('form')
            .send({ MessageSid: 'SMalert', MessageStatus: 'failed', ErrorCode: '63016' });
        assert.equal(res.status, 204);
        await flush();
        const alerts = sse.payloads('whatsapp.failed');
        assert.equal(alerts.length, 1);
        assert.equal(alerts[0].challanNo, 'CH-A1');
        assert.equal(alerts[0].toPhone, '+919991112222');
        assert.equal(alerts[0].errorCode, '63016');
        assert.equal(alerts[0].status, 'failed');
        assert.equal(alerts[0].event, 'dispatch');
    }
    finally {
        sse.close();
    }
});
test('an undelivered callback also alerts staff', async () => {
    await seedMessage({ messageSid: 'SMundel', event: 'order', status: 'sent' });
    const sse = captureSSE();
    try {
        await request(app)
            .post('/api/whatsapp/status')
            .type('form')
            .send({ MessageSid: 'SMundel', MessageStatus: 'undelivered', ErrorCode: '63024' });
        await flush();
        assert.equal(sse.payloads('whatsapp.failed').length, 1);
    }
    finally {
        sse.close();
    }
});
test('a repeated failed callback does not re-alert staff (dedupe)', async () => {
    await seedMessage({ messageSid: 'SMdup', event: 'dispatch', status: 'failed', errorCode: '63016' });
    const sse = captureSSE();
    try {
        await request(app)
            .post('/api/whatsapp/status')
            .type('form')
            .send({ MessageSid: 'SMdup', MessageStatus: 'failed', ErrorCode: '63016' });
        await flush();
        assert.equal(sse.payloads('whatsapp.failed').length, 0);
    }
    finally {
        sse.close();
    }
});
test('a successful (delivered) callback does not alert staff', async () => {
    await seedMessage({ messageSid: 'SMok', event: 'delivery', status: 'sent' });
    const sse = captureSSE();
    try {
        await request(app)
            .post('/api/whatsapp/status')
            .type('form')
            .send({ MessageSid: 'SMok', MessageStatus: 'delivered' });
        await flush();
        assert.equal(sse.payloads('whatsapp.failed').length, 0);
    }
    finally {
        sse.close();
    }
});
// --- Staff messages list -----------------------------------------------------
test('staff list returns notifications with their order/challan reference', async () => {
    const admin = await createUser('admin', 'admin@test.com');
    const [client] = await db.insert(clients).values({
        name: 'Acme', contactPerson: 'Jane', phone: '999', email: null,
    }).returning();
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-1', clientId: client.id, grade: 'M25', quantity: '6.00', status: 'pending',
    }).returning();
    await seedMessage({ messageSid: 'SMlist', event: 'order', orderId: order.id, status: 'sent' });
    const res = await request(app)
        .get('/api/whatsapp/messages')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].event, 'order');
    assert.equal(res.body[0].status, 'sent');
    assert.equal(res.body[0].orderNo, 'ORD-1');
});
test('the staff list is plant-scoped to the actor', async () => {
    const plantA = await createPlant();
    const plantB = await createPlant();
    const adminA = await createUser('admin', 'a@test.com', plantA.id);
    await seedMessage({ messageSid: 'SMa', plantId: plantA.id });
    await seedMessage({ messageSid: 'SMb', plantId: plantB.id });
    const res = await request(app)
        .get('/api/whatsapp/messages')
        .set('Authorization', `Bearer ${tokenFor(adminA)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].messageSid, 'SMa');
});
test('a global admin (null plant) sees every plant\'s notifications', async () => {
    const plantA = await createPlant();
    const plantB = await createPlant();
    const globalAdmin = await createUser('authority', 'g@test.com', null);
    await seedMessage({ messageSid: 'SMa', plantId: plantA.id });
    await seedMessage({ messageSid: 'SMb', plantId: plantB.id });
    const res = await request(app)
        .get('/api/whatsapp/messages')
        .set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
});
test('the staff list filters by event when asked', async () => {
    const admin = await createUser('admin', 'admin@test.com');
    await seedMessage({ messageSid: 'SM1', event: 'order' });
    await seedMessage({ messageSid: 'SM2', event: 'dispatch' });
    await seedMessage({ messageSid: 'SM3', event: 'delivery' });
    const res = await request(app)
        .get('/api/whatsapp/messages?event=dispatch')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].messageSid, 'SM2');
});
test('customers and drivers cannot read the staff list (403)', async () => {
    const driver = await createUser('driver', 'd@test.com');
    const res = await request(app)
        .get('/api/whatsapp/messages')
        .set('Authorization', `Bearer ${tokenFor(driver)}`);
    assert.equal(res.status, 403);
});
test('the messages list requires authentication (401)', async () => {
    const res = await request(app).get('/api/whatsapp/messages');
    assert.equal(res.status, 401);
});
