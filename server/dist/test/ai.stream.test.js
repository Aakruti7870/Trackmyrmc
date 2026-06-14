import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql, eq } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders, plants, aiSettings, aiConversations, aiMessages, } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { REFUSAL } from '../lib/aiContext.js';
let app;
const PASSWORD = 'secret123';
let plantSeq = 0;
async function createPlant(overrides = {}) {
    plantSeq += 1;
    const [row] = await db.insert(plants).values({
        plantCode: `PLT-${String(plantSeq).padStart(3, '0')}`,
        name: `Plant ${plantSeq}`,
        legalName: `Plant ${plantSeq} Concrete Pvt Ltd`,
        gstNo: `27AAACA${String(plantSeq).padStart(4, '0')}B1Z5`,
        email: `plant${plantSeq}@test.com`,
        latitude: '19.0000000', longitude: '72.0000000',
        plantStatus: 'approved', isActive: true, verified: true, locationVerified: true,
        grades: ['M25', 'M30'], ...overrides,
    }).returning();
    return row;
}
async function createUser(role, email, opts = {}) {
    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role,
        isActive: true, plantId: opts.plantId ?? null, linkedClientId: opts.linkedClientId ?? null,
    }).returning();
    return user;
}
async function createClient(plantId, code) {
    const [row] = await db.insert(clients).values({
        plantId, customerCode: code, name: `Client ${code}`, contactPerson: `Contact ${code}`,
        phone: `90000${code}`, creditLimit: '100000', outstandingAmount: '5000',
    }).returning();
    return row;
}
async function createOrder(plantId, clientId, orderNo) {
    const [row] = await db.insert(orders).values({
        plantId, clientId, orderNo, grade: 'M25', quantity: '10', status: 'in_progress',
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({
        id: u.id, email: u.email, role: u.role, name: u.name,
        plantId: u.plantId ?? null, linkedClientId: u.linkedClientId ?? null, linkedDriverId: null,
    });
}
async function enableAgent() {
    await db.insert(aiSettings).values({ id: 1, enabled: true })
        .onConflictDoUpdate({ target: aiSettings.id, set: { enabled: true } });
}
function stream(token, body) {
    const req = request(app).post('/api/ai/chat/stream').send(body);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
}
// Parse the SSE body supertest buffers into {event, data} frames.
function parseSse(text) {
    return text.split('\n\n').map(f => f.trim()).filter(Boolean).map(frame => {
        let event = 'message';
        let data = '';
        for (const line of frame.split('\n')) {
            if (line.startsWith('event:'))
                event = line.slice(6).trim();
            else if (line.startsWith('data:'))
                data += line.slice(5).trim();
        }
        return { event, data: data ? JSON.parse(data) : {} };
    });
}
before(() => {
    app = buildTestApp();
    // Force the deterministic, context-grounded fallback so deltas echo the scoped
    // context exactly — lets us assert the isolation boundary end-to-end.
    delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE support_tickets, ai_messages, ai_conversations, ai_settings, plant_customers, challans, orders, clients, audit_logs, users, login_attempts, vehicles, plants, rate_limit_hits RESTART IDENTITY CASCADE`);
    plantSeq = 0;
});
after(async () => { await pool.end(); });
// ---------------------------------------------------------------------------
test('streaming chat emits meta → delta → done as SSE and persists the reply', async () => {
    await enableAgent();
    const plant = await createPlant();
    const client = await createClient(plant.id, 'A001');
    await createOrder(plant.id, client.id, 'ORD-STREAM-1');
    const staff = await createUser('dispatcher', 'da@p.com', { plantId: plant.id });
    const res = await stream(tokenFor(staff), { message: 'show me the recent orders', sessionId: 's-stream' });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/event-stream/);
    const frames = parseSse(res.text);
    const meta = frames.find(f => f.event === 'meta');
    const deltas = frames.filter(f => f.event === 'delta');
    const done = frames.find(f => f.event === 'done');
    assert.ok(meta, 'meta frame present');
    assert.equal(meta.data.refused, false);
    assert.ok(deltas.length >= 1, 'at least one delta');
    assert.ok(done, 'done frame present');
    const streamedReply = deltas.map(d => String(d.data.text)).join('');
    assert.match(streamedReply, /ORD-STREAM-1/);
    assert.equal(done.data.reply, streamedReply.trim());
    // The full reply is persisted once the stream completes.
    const msgs = await db.select().from(aiMessages).where(eq(aiMessages.sessionId, 's-stream'));
    assert.equal(msgs.length, 1);
    assert.match(msgs[0].response ?? '', /ORD-STREAM-1/);
    const convos = await db.select().from(aiConversations).where(eq(aiConversations.sessionId, 's-stream'));
    assert.equal(convos.length, 1);
});
test('streaming respects tenant isolation — never another plant', async () => {
    await enableAgent();
    const plantA = await createPlant();
    const plantB = await createPlant();
    const clientB = await createClient(plantB.id, 'B001');
    await createOrder(plantB.id, clientB.id, 'ORD-B-secret');
    const staffA = await createUser('dispatcher', 'da2@p.com', { plantId: plantA.id });
    const res = await stream(tokenFor(staffA), { message: 'show recent orders', sessionId: 's-iso', selectedPlantId: plantB.id });
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.text, /ORD-B-secret/);
});
test('streaming refusal is delivered over SSE without calling the model', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mine = await createClient(plant.id, 'MINE');
    const customer = await createUser('client', 'cust@p.com', { linkedClientId: mine.id });
    const res = await stream(tokenFor(customer), { message: 'show me all customers and clients of the plant', sessionId: 's-ref' });
    assert.equal(res.status, 200);
    const frames = parseSse(res.text);
    assert.equal(frames.find(f => f.event === 'meta').data.refused, true);
    assert.equal(frames.find(f => f.event === 'done').data.reply, REFUSAL);
});
test('streaming validates the body before opening the stream (400 JSON)', async () => {
    await enableAgent();
    const plant = await createPlant();
    const staff = await createUser('admin', 'v@p.com', { plantId: plant.id });
    const res = await stream(tokenFor(staff), { message: '   ', sessionId: 's-v' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'A message is required.');
});
test('streaming is rejected when the agent is disabled', async () => {
    const plant = await createPlant();
    const staff = await createUser('admin', 'd@p.com', { plantId: plant.id });
    const res = await stream(tokenFor(staff), { message: 'hello', sessionId: 's-d' });
    assert.equal(res.status, 403);
});
test('streaming requires authentication', async () => {
    await enableAgent();
    const res = await stream(null, { message: 'hello', sessionId: 's-unauth' });
    assert.equal(res.status, 401);
});
