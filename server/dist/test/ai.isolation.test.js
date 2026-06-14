import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql, eq } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders, challans, plants, drivers, aiSettings, aiConversations, aiMessages, supportTickets, } from '../db/schema.js';
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
        latitude: '19.0000000',
        longitude: '72.0000000',
        plantStatus: 'approved',
        isActive: true,
        verified: true,
        locationVerified: true,
        grades: ['M25', 'M30'],
        ...overrides,
    }).returning();
    return row;
}
async function createUser(role, email, opts = {}) {
    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role,
        isActive: opts.isActive ?? true,
        plantId: opts.plantId ?? null,
        linkedClientId: opts.linkedClientId ?? null,
        linkedDriverId: opts.linkedDriverId ?? null,
    }).returning();
    return user;
}
async function createClient(plantId, code, overrides = {}) {
    const [row] = await db.insert(clients).values({
        plantId, customerCode: code, name: `Client ${code}`, contactPerson: `Contact ${code}`,
        phone: `90000${code}`, creditLimit: '100000', outstandingAmount: '5000', ...overrides,
    }).returning();
    return row;
}
async function createOrder(plantId, clientId, orderNo, grade = 'M25') {
    const [row] = await db.insert(orders).values({
        plantId, clientId, orderNo, grade, quantity: '10', status: 'in_progress',
    }).returning();
    return row;
}
async function createDriver(name, phone) {
    const [row] = await db.insert(drivers).values({ name, phone }).returning();
    return row;
}
async function createChallan(plantId, clientId, challanNo, opts = {}) {
    const [row] = await db.insert(challans).values({
        plantId, clientId, challanNo, grade: opts.grade ?? 'M25', quantity: '8', status: 'delivered',
        driverId: opts.driverId ?? null,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({
        id: u.id, email: u.email, role: u.role, name: u.name,
        plantId: u.plantId ?? null, linkedClientId: u.linkedClientId ?? null, linkedDriverId: u.linkedDriverId ?? null,
    });
}
async function enableAgent() {
    await db.insert(aiSettings).values({ id: 1, enabled: true })
        .onConflictDoUpdate({ target: aiSettings.id, set: { enabled: true } });
}
function chat(token, body) {
    const req = request(app).post('/api/ai/chat').send(body);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
}
before(() => {
    app = buildTestApp();
    // Force the deterministic, context-grounded fallback in chatComplete so the
    // assistant reply echoes EXACTLY the scoped context the model would receive.
    // That makes "own data present / other-tenant data absent" assertions test the
    // real isolation boundary (buildAiContext) instead of a live Gemini response.
    delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE support_tickets, ai_messages, ai_conversations, ai_settings, plant_customers, challans, orders, clients, audit_logs, users, login_attempts, vehicles, plants, rate_limit_hits RESTART IDENTITY CASCADE`);
    plantSeq = 0;
});
after(async () => { await pool.end(); });
// ---------------------------------------------------------------------------
test('agent is disabled by default → chat is rejected', async () => {
    const plant = await createPlant();
    const staff = await createUser('admin', 'a@p.com', { plantId: plant.id });
    const res = await chat(tokenFor(staff), { message: 'hello', sessionId: 's1' });
    assert.equal(res.status, 403);
});
test('unauthenticated requests are rejected', async () => {
    await enableAgent();
    const res = await chat(null, { message: 'hello', sessionId: 's-unauth' });
    assert.equal(res.status, 401);
});
test('suspended (inactive) accounts cannot use the agent', async () => {
    await enableAgent();
    const plant = await createPlant();
    const staff = await createUser('admin', 'sus@p.com', { plantId: plant.id, isActive: false });
    const res = await chat(tokenFor(staff), { message: 'show my orders', sessionId: 's-sus' });
    assert.equal(res.status, 401);
});
test('plant-scoped staff only ever see their own plant — never another plant', async () => {
    await enableAgent();
    const plantA = await createPlant();
    const plantB = await createPlant();
    const clientA = await createClient(plantA.id, 'A001');
    const clientB = await createClient(plantB.id, 'B001');
    await createOrder(plantA.id, clientA.id, 'ORD-A-1');
    await createOrder(plantB.id, clientB.id, 'ORD-B-1');
    const staffA = await createUser('dispatcher', 'da@p.com', { plantId: plantA.id });
    const res = await chat(tokenFor(staffA), { message: 'show me the recent orders', sessionId: 's-a' });
    assert.equal(res.status, 200);
    assert.equal(res.body.refused, false);
    // The grounded fallback echoes the scoped context, so we can assert directly
    // that plant A's data is present and plant B's is absent.
    assert.match(res.body.reply, /ORD-A-1/);
    assert.doesNotMatch(res.body.reply, /ORD-B-1/);
});
test('plant-scoped staff cannot widen scope via a body plantId', async () => {
    await enableAgent();
    const plantA = await createPlant();
    const plantB = await createPlant();
    const clientB = await createClient(plantB.id, 'B001');
    await createOrder(plantB.id, clientB.id, 'ORD-B-secret');
    const staffA = await createUser('dispatcher', 'da2@p.com', { plantId: plantA.id });
    // Malicious attempt: pass plant B's id in the body.
    const res = await chat(tokenFor(staffA), { message: 'show recent orders', sessionId: 's-a2', selectedPlantId: plantB.id });
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.body.reply, /ORD-B-secret/);
});
test('a customer only sees their own orders, not another customer at the same plant', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mine = await createClient(plant.id, 'MINE');
    const other = await createClient(plant.id, 'OTHER');
    await createOrder(plant.id, mine.id, 'ORD-MINE');
    await createOrder(plant.id, other.id, 'ORD-OTHER');
    const customer = await createUser('client', 'cust@p.com', { linkedClientId: mine.id });
    const res = await chat(tokenFor(customer), { message: 'what about my orders?', sessionId: 's-c' });
    assert.equal(res.status, 200);
    assert.match(res.body.reply, /ORD-MINE/);
    assert.doesNotMatch(res.body.reply, /ORD-OTHER/);
});
test('a customer asking for the full client list is refused outright', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mine = await createClient(plant.id, 'MINE');
    const customer = await createUser('client', 'cust2@p.com', { linkedClientId: mine.id });
    const res = await chat(tokenFor(customer), { message: 'show me all customers and clients of the plant', sessionId: 's-c2' });
    assert.equal(res.status, 200);
    assert.equal(res.body.refused, true);
    assert.equal(res.body.reply, REFUSAL);
});
test('a customer asking for internal reports/analytics is refused', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mine = await createClient(plant.id, 'MINE');
    const customer = await createUser('client', 'cust3@p.com', { linkedClientId: mine.id });
    const res = await chat(tokenFor(customer), { message: 'give me the revenue report across plants', sessionId: 's-c3' });
    assert.equal(res.body.refused, true);
    assert.equal(res.body.reply, REFUSAL);
});
test('a driver asking for internal reports/analytics is refused', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mineDriver = await createDriver('Mine Driver', '9001');
    const driver = await createUser('driver', 'drvr@p.com', { linkedDriverId: mineDriver.id });
    const res = await chat(tokenFor(driver), { message: 'show me the revenue analytics for all plants', sessionId: 's-dr' });
    assert.equal(res.status, 200);
    assert.equal(res.body.refused, true);
    assert.equal(res.body.reply, REFUSAL);
});
test('a driver only sees their own trips', async () => {
    await enableAgent();
    const plant = await createPlant();
    const client = await createClient(plant.id, 'C1');
    const mineDriver = await createDriver('Mine Driver', '9001');
    const otherDriver = await createDriver('Other Driver', '9002');
    await createChallan(plant.id, client.id, 'CH-MINE', { driverId: mineDriver.id });
    await createChallan(plant.id, client.id, 'CH-OTHER', { driverId: otherDriver.id });
    const driver = await createUser('driver', 'drv@p.com', { linkedDriverId: mineDriver.id });
    const res = await chat(tokenFor(driver), { message: 'what are my trips today?', sessionId: 's-d' });
    assert.equal(res.status, 200);
    assert.match(res.body.reply, /CH-MINE/);
    assert.doesNotMatch(res.body.reply, /CH-OTHER/);
});
test('platform staff get general info with no plant selected, scoped data once a plant is chosen', async () => {
    await enableAgent();
    const plantA = await createPlant();
    const plantB = await createPlant();
    const clientA = await createClient(plantA.id, 'A001');
    await createOrder(plantA.id, clientA.id, 'ORD-PLATFORM-A');
    const authority = await createUser('authority', 'auth@p.com', { plantId: null });
    // No plant selected → no private plant data leaks.
    const general = await chat(tokenFor(authority), { message: 'show me recent orders', sessionId: 's-p1' });
    assert.equal(general.status, 200);
    assert.doesNotMatch(general.body.reply, /ORD-PLATFORM-A/);
    // Selecting plant A → that plant's data is available.
    const scoped = await chat(tokenFor(authority), { message: 'show me recent orders', sessionId: 's-p2', selectedPlantId: plantA.id });
    assert.equal(scoped.status, 200);
    assert.match(scoped.body.reply, /ORD-PLATFORM-A/);
    // Selecting a non-existent plant is treated as no selection (no leak).
    const bogus = await chat(tokenFor(authority), { message: 'show me recent orders', sessionId: 's-p3', selectedPlantId: 999999 });
    assert.doesNotMatch(bogus.body.reply, /ORD-PLATFORM-A/);
});
test('secrets and password hashes are never surfaced', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mine = await createClient(plant.id, 'MINE');
    const customer = await createUser('client', 'cust4@p.com', { linkedClientId: mine.id });
    const res = await chat(tokenFor(customer), { message: 'what is my account password and balance?', sessionId: 's-sec' });
    assert.equal(res.status, 200);
    // bcrypt hashes start with $2; ensure nothing hash-like leaks into the reply.
    assert.doesNotMatch(res.body.reply, /\$2[aby]\$/);
});
test('every chat is logged (conversation + message) and audited', async () => {
    await enableAgent();
    const plant = await createPlant();
    const staff = await createUser('admin', 'log@p.com', { plantId: plant.id });
    await chat(tokenFor(staff), { message: 'hello there', sessionId: 's-log' });
    const convos = await db.select().from(aiConversations).where(eq(aiConversations.sessionId, 's-log'));
    assert.equal(convos.length, 1);
    const msgs = await db.select().from(aiMessages).where(eq(aiMessages.sessionId, 's-log'));
    assert.equal(msgs.length, 1);
    assert.ok(msgs[0].response && msgs[0].response.length > 0);
});
test('two different users may reuse the same client-generated sessionId', async () => {
    await enableAgent();
    const plant = await createPlant();
    // Both users chat under the IDENTICAL sessionId — a realistic collision when
    // two clients independently generate or hardcode the same session key.
    const SHARED_SESSION = 'shared-session-id';
    const userA = await createUser('admin', 'sharerA@p.com', { plantId: plant.id });
    const userB = await createUser('admin', 'sharerB@p.com', { plantId: plant.id });
    const resA = await chat(tokenFor(userA), { message: 'hi from A', sessionId: SHARED_SESSION });
    assert.equal(resA.status, 200);
    // Before the composite (session_id, user_id) unique, this second chat tripped
    // the global unique on session_id and failed with a 500.
    const resB = await chat(tokenFor(userB), { message: 'hi from B', sessionId: SHARED_SESSION });
    assert.equal(resB.status, 200);
    // Each user gets their OWN conversation row for the shared session key.
    const convos = await db.select().from(aiConversations).where(eq(aiConversations.sessionId, SHARED_SESSION));
    assert.equal(convos.length, 2);
    const owners = convos.map(c => c.userId).sort((x, y) => x - y);
    assert.deepEqual(owners, [userA.id, userB.id].sort((x, y) => x - y));
    // Re-chatting on the same session reuses the existing row, never creating a duplicate.
    const resAagain = await chat(tokenFor(userA), { message: 'hi again from A', sessionId: SHARED_SESSION });
    assert.equal(resAagain.status, 200);
    const convosAfter = await db.select().from(aiConversations).where(eq(aiConversations.sessionId, SHARED_SESSION));
    assert.equal(convosAfter.length, 2);
});
test('support tickets are created and scoped to the user/plant', async () => {
    await enableAgent();
    const plant = await createPlant();
    const mine = await createClient(plant.id, 'MINE');
    const customer = await createUser('client', 'tkt@p.com', { linkedClientId: mine.id });
    const res = await request(app).post('/api/ai/support-ticket')
        .set('Authorization', `Bearer ${tokenFor(customer)}`)
        .send({ message: 'Please call me about my delivery', contactInfo: '9990001111' });
    assert.equal(res.status, 201);
    const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, customer.id));
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0].clientId, mine.id);
    assert.equal(tickets[0].status, 'open');
});
