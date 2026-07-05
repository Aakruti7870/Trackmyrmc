import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
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
async function createClient() {
    const [row] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
    }).returning();
    return row;
}
const ORDER_FIELDS = {
    deliveryDate: '2026-06-15',
    contactPerson: 'Site Manager',
    contactNumber: '9998887777',
    siteAddress: '12 Industrial Rd, Pune',
    latitude: '18.5204',
    longitude: '73.8567',
};
async function placeCustomerOrder(clientAuth, overrides = {}) {
    const res = await request(app).post('/api/me/orders').set('Authorization', clientAuth)
        .send({ grade: 'M25', quantity: 12, ...ORDER_FIELDS, ...overrides });
    return res;
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE challans, orders, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('staff can approve a pending_approval order', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const admin = await createUser('admin', 'admin@test.com');
    const placed = await placeCustomerOrder(`Bearer ${tokenFor(clientUser)}`);
    assert.equal(placed.status, 201);
    assert.equal(placed.body.status, 'pending_approval');
    const res = await request(app)
        .post(`/api/orders/${placed.body.id}/approve`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'approved');
});
test('staff can reject a pending_approval order with a reason', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client2@test.com', client.id);
    const admin = await createUser('admin', 'admin2@test.com');
    const placed = await placeCustomerOrder(`Bearer ${tokenFor(clientUser)}`);
    const res = await request(app)
        .post(`/api/orders/${placed.body.id}/reject`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ reason: 'Outside delivery zone' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'rejected');
    assert.equal(res.body.rejectionReason, 'Outside delivery zone');
});
test('approving a non-pending_approval order is a 409', async () => {
    const client = await createClient();
    const admin = await createUser('admin', 'admin3@test.com');
    const [ord] = await db.insert(orders).values({
        orderNo: 'ORD-900', clientId: client.id, grade: 'M25', quantity: '10.00', status: 'approved',
    }).returning();
    const res = await request(app)
        .post(`/api/orders/${ord.id}/approve`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({});
    assert.equal(res.status, 409);
});
test('a challan cannot be generated from a pending_approval order but can after approval', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client4@test.com', client.id);
    const admin = await createUser('admin', 'admin4@test.com');
    const adminAuth = `Bearer ${tokenFor(admin)}`;
    const placed = await placeCustomerOrder(`Bearer ${tokenFor(clientUser)}`);
    const orderId = placed.body.id;
    const blocked = await request(app).post('/api/challans').set('Authorization', adminAuth)
        .send({ orderId, clientId: client.id, grade: 'M25', quantity: 6, pumpRequired: false });
    assert.equal(blocked.status, 409);
    const approve = await request(app).post(`/api/orders/${orderId}/approve`).set('Authorization', adminAuth).send({});
    assert.equal(approve.status, 200);
    const ok = await request(app).post('/api/challans').set('Authorization', adminAuth)
        .send({ orderId, clientId: client.id, grade: 'M25', quantity: 6, pumpRequired: false });
    assert.equal(ok.status, 201);
});
test('a customer edit of a major field on an approved order reverts it to pending_approval', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client5@test.com', client.id);
    const admin = await createUser('admin', 'admin5@test.com');
    const clientAuth = `Bearer ${tokenFor(clientUser)}`;
    const placed = await placeCustomerOrder(clientAuth);
    const orderId = placed.body.id;
    await request(app).post(`/api/orders/${orderId}/approve`).set('Authorization', `Bearer ${tokenFor(admin)}`).send({});
    // Change the quantity (a major field) — must fall back to pending_approval.
    const res = await request(app).put(`/api/me/orders/${orderId}`).set('Authorization', clientAuth)
        .send({ grade: 'M25', quantity: 20, ...ORDER_FIELDS });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'pending_approval');
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    assert.equal(row.status, 'pending_approval');
    assert.equal(row.quantity, '20.00');
});
test('a customer edit of only a minor field on an approved order keeps it approved', async () => {
    const client = await createClient();
    const clientUser = await createUser('client', 'client6@test.com', client.id);
    const admin = await createUser('admin', 'admin6@test.com');
    const clientAuth = `Bearer ${tokenFor(clientUser)}`;
    const placed = await placeCustomerOrder(clientAuth);
    const orderId = placed.body.id;
    await request(app).post(`/api/orders/${orderId}/approve`).set('Authorization', `Bearer ${tokenFor(admin)}`).send({});
    // Change only the notes (a minor field) — status must stay approved.
    const res = await request(app).put(`/api/me/orders/${orderId}`).set('Authorization', clientAuth)
        .send({ grade: 'M25', quantity: 12, ...ORDER_FIELDS, notes: 'Gate code 4321' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'approved');
});
