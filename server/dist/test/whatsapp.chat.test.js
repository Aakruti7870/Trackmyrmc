import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, clients, whatsappMessages } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
// HTTP coverage for the two-way WhatsApp chat: inbound customer messages stored
// by the Meta webhook, the platform-staff chat list/thread endpoints, and the
// 24-hour-window guarded free-text reply. No Meta sender is configured (env is
// snapshotted and cleared), so a reply exercises the dev fallback and records a
// row with channel 'dev'.
let app;
const META_ENV_KEYS = [
    'WHATSAPP_META_PHONE_NUMBER_ID',
    'WHATSAPP_META_ACCESS_TOKEN',
    'WHATSAPP_META_VERIFY_TOKEN',
    'WHATSAPP_META_APP_SECRET',
];
const savedEnv = {};
before(() => {
    app = buildTestApp();
    for (const k of META_ENV_KEYS) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
    }
});
beforeEach(async () => {
    for (const k of META_ENV_KEYS)
        delete process.env[k];
    await db.execute(sql `TRUNCATE TABLE whatsapp_messages, clients, users, plants RESTART IDENTITY CASCADE`);
});
after(async () => {
    for (const k of META_ENV_KEYS) {
        if (savedEnv[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = savedEnv[k];
    }
    await pool.end();
});
async function createUser(role, email, plantId = null) {
    const passwordHash = await hashPassword('secret123');
    const [row] = await db.insert(users).values({
        name: role, email, passwordHash, role: role, isActive: true, plantId,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name, plantId: u.plantId ?? null });
}
async function createPlant() {
    const [row] = await db.insert(plants).values({
        name: 'Plant X', latitude: '18.5', longitude: '73.8',
    }).returning();
    return row;
}
const CUSTOMER = '+919991112222';
async function seedInbound(over = {}) {
    const [row] = await db.insert(whatsappMessages).values({
        messageSid: `wamid.IN.${Math.random().toString(36).slice(2)}`,
        event: 'chat',
        direction: 'inbound',
        toPhone: CUSTOMER,
        status: 'received',
        channel: 'whatsapp',
        body: 'Hello, is my order ready?',
        profileName: 'Ramesh',
        ...over,
    }).returning();
    return row;
}
function inboundPayload(wamid, from, text, profileName = 'Ramesh') {
    return {
        object: 'whatsapp_business_account',
        entry: [{
                id: 'WABA',
                changes: [{
                        field: 'messages',
                        value: {
                            messaging_product: 'whatsapp',
                            contacts: [{ wa_id: from, profile: { name: profileName } }],
                            messages: [{
                                    id: wamid,
                                    from,
                                    timestamp: '1700000000',
                                    type: 'text',
                                    text: { body: text },
                                }],
                        },
                    }],
            }],
    };
}
// --- Webhook: inbound message storage ----------------------------------------
test('webhook stores an inbound text message as a chat row', async () => {
    const res = await request(app)
        .post('/api/webhooks/whatsapp')
        .send(inboundPayload('wamid.NEW1', '919991112222', 'Need 5 cum M25 tomorrow'));
    assert.equal(res.status, 200);
    const [row] = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.NEW1'));
    assert.ok(row, 'inbound row stored');
    assert.equal(row.direction, 'inbound');
    assert.equal(row.event, 'chat');
    assert.equal(row.toPhone, '+919991112222');
    assert.equal(row.body, 'Need 5 cum M25 tomorrow');
    assert.equal(row.profileName, 'Ramesh');
    assert.equal(row.status, 'received');
});
test('webhook dedupes a redelivered inbound message by wamid', async () => {
    const payload = inboundPayload('wamid.DUP', '919991112222', 'hello');
    await request(app).post('/api/webhooks/whatsapp').send(payload);
    await request(app).post('/api/webhooks/whatsapp').send(payload);
    const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.messageSid, 'wamid.DUP'));
    assert.equal(rows.length, 1);
});
test('webhook ignores a message with no wamid or sender', async () => {
    const res = await request(app).post('/api/webhooks/whatsapp').send({
        object: 'whatsapp_business_account',
        entry: [{ changes: [{ value: { messages: [{ type: 'text', text: { body: 'x' } }] } }] }],
    });
    assert.equal(res.status, 200);
    const rows = await db.select().from(whatsappMessages);
    assert.equal(rows.length, 0);
});
// --- Chat list & thread --------------------------------------------------------
test('GET /chats lists conversations for a global admin with window state', async () => {
    const admin = await createUser('admin', 'admin@x.test');
    await seedInbound({ body: 'First message' });
    await seedInbound({ toPhone: '+918880001111', profileName: 'Suresh', body: 'Another customer' });
    const res = await request(app)
        .get('/api/whatsapp/chats')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    const mine = res.body.find((c) => c.phone === CUSTOMER);
    assert.ok(mine);
    assert.equal(mine.profileName, 'Ramesh');
    assert.equal(mine.windowOpen, true);
});
test('GET /chats matches a known client by phone digits', async () => {
    const authority = await createUser('authority', 'auth@x.test');
    await db.insert(clients).values({
        name: 'Acme Constructions', contactPerson: 'Ramesh', phone: '9991112222', plantId: null,
    });
    await seedInbound();
    const res = await request(app)
        .get('/api/whatsapp/chats')
        .set('Authorization', `Bearer ${tokenFor(authority)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body[0].clientName, 'Acme Constructions');
});
test('GET /chats/:phone/messages returns the thread oldest-first with window info', async () => {
    const admin = await createUser('admin', 'admin@x.test');
    await seedInbound({ body: 'msg one' });
    await db.insert(whatsappMessages).values({
        event: 'chat', direction: 'outbound', toPhone: CUSTOMER, status: 'accepted',
        channel: 'whatsapp', body: 'our reply', messageSid: 'wamid.OUT1',
    });
    const res = await request(app)
        .get(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/messages`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.phone, CUSTOMER);
    assert.equal(res.body.messages.length, 2);
    assert.equal(res.body.messages[0].body, 'msg one');
    assert.equal(res.body.messages[1].body, 'our reply');
    assert.equal(res.body.windowOpen, true);
});
// --- Access control -------------------------------------------------------------
test('chat endpoints reject a plant-bound admin (403) and a dispatcher (403)', async () => {
    const plant = await createPlant();
    const plantAdmin = await createUser('admin', 'padmin@x.test', plant.id);
    const dispatcher = await createUser('dispatcher', 'disp@x.test');
    await seedInbound();
    const r1 = await request(app)
        .get('/api/whatsapp/chats')
        .set('Authorization', `Bearer ${tokenFor(plantAdmin)}`);
    assert.equal(r1.status, 403);
    const r2 = await request(app)
        .get('/api/whatsapp/chats')
        .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
    assert.equal(r2.status, 403);
    const r3 = await request(app)
        .post(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/reply`)
        .set('Authorization', `Bearer ${tokenFor(plantAdmin)}`)
        .send({ body: 'hi' });
    assert.equal(r3.status, 403);
});
test('chat endpoints reject a client entirely', async () => {
    const client = await createUser('client', 'cust@x.test');
    const res = await request(app)
        .get('/api/whatsapp/chats')
        .set('Authorization', `Bearer ${tokenFor(client)}`);
    assert.equal(res.status, 403);
});
// --- Reply -----------------------------------------------------------------------
test('POST reply inside the 24h window sends and stores an outbound chat row', async () => {
    const admin = await createUser('admin', 'admin@x.test');
    await seedInbound();
    const res = await request(app)
        .post(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/reply`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ body: 'Yes, dispatching at 9am.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.message.direction, 'outbound');
    assert.equal(res.body.message.event, 'chat');
    assert.equal(res.body.message.body, 'Yes, dispatching at 9am.');
    // No Meta sender configured in tests → dev fallback channel.
    assert.equal(res.body.message.channel, 'dev');
    const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.direction, 'outbound'));
    assert.equal(rows.length, 1);
});
test('POST reply outside the 24h window is rejected with 409 WINDOW_EXPIRED', async () => {
    const admin = await createUser('admin', 'admin@x.test');
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await seedInbound({ createdAt: old });
    const res = await request(app)
        .post(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/reply`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ body: 'too late' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'WINDOW_EXPIRED');
    const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.direction, 'outbound'));
    assert.equal(rows.length, 0);
});
test('POST reply with no prior inbound message is rejected with 409', async () => {
    const admin = await createUser('admin', 'admin@x.test');
    const res = await request(app)
        .post(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/reply`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ body: 'hello?' });
    assert.equal(res.status, 409);
});
test('POST reply validates the body (empty and over-long rejected)', async () => {
    const admin = await createUser('admin', 'admin@x.test');
    await seedInbound();
    const r1 = await request(app)
        .post(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/reply`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ body: '   ' });
    assert.equal(r1.status, 400);
    const r2 = await request(app)
        .post(`/api/whatsapp/chats/${encodeURIComponent(CUSTOMER)}/reply`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ body: 'x'.repeat(5000) });
    assert.equal(r2.status, 400);
});
