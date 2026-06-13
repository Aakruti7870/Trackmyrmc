import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
async function createClient() {
    const [row] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
    }).returning();
    return row;
}
async function createUser(role, email, linkedClientId) {
    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role,
        isActive: true, linkedClientId: linkedClientId ?? null,
    }).returning();
    return user;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE orders, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('a linked client places an order that lands as pending for their client', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const res = await request(app)
        .post('/api/me/orders')
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ grade: 'M25', quantity: 12, deliveryDate: '2026-06-15', pumpRequired: true, notes: 'Site near gate' });
    assert.equal(res.status, 201);
    assert.equal(res.body.clientId, client.id);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.grade, 'M25');
    assert.equal(res.body.pumpRequired, true);
    assert.match(res.body.orderNo, /^ORD-\d{3}$/);
});
test('a client cannot place an order for a different client (clientId in body is ignored)', async () => {
    const myClient = await createClient();
    const [other] = await db.insert(clients).values({
        name: 'Other Co', contactPerson: 'Bob', phone: '4445556666',
    }).returning();
    const clientUser = await createUser('client', 'client2@test.com', myClient.id);
    const res = await request(app)
        .post('/api/me/orders')
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ grade: 'M30', quantity: 5, clientId: other.id, status: 'completed' });
    assert.equal(res.status, 201);
    assert.equal(res.body.clientId, myClient.id);
    assert.equal(res.body.status, 'pending');
});
test('a non-client role is forbidden from placing a client order', async () => {
    const staff = await createUser('admin', 'admin@test.com');
    const res = await request(app)
        .post('/api/me/orders')
        .set('Authorization', `Bearer ${tokenFor(staff)}`)
        .send({ grade: 'M25', quantity: 10 });
    assert.equal(res.status, 403);
});
test('a client with no linked client gets a clear 400', async () => {
    const orphan = await createUser('client', 'orphan@test.com');
    const res = await request(app)
        .post('/api/me/orders')
        .set('Authorization', `Bearer ${tokenFor(orphan)}`)
        .send({ grade: 'M25', quantity: 10 });
    assert.equal(res.status, 400);
});
test('missing grade or non-positive quantity is rejected with 400', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client3@test.com', client.id);
    const auth = `Bearer ${tokenFor(clientUser)}`;
    const noGrade = await request(app).post('/api/me/orders').set('Authorization', auth)
        .send({ quantity: 10 });
    assert.equal(noGrade.status, 400);
    const badQty = await request(app).post('/api/me/orders').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 0 });
    assert.equal(badQty.status, 400);
});
