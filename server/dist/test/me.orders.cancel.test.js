import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
async function createClient(name, phone) {
    const [row] = await db.insert(clients).values({
        name, contactPerson: 'Jane', phone,
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
async function createOrder(clientId, orderNo, status) {
    const [row] = await db.insert(orders).values({
        orderNo, clientId, grade: 'M25', quantity: '10', status,
    }).returning();
    return row;
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
test('a client cancels their own pending order', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const order = await createOrder(client.id, 'ORD-001', 'pending');
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.id, order.id);
    assert.equal(res.body.status, 'cancelled');
});
test('a client cannot cancel another client\'s order (404)', async () => {
    const mine = await createClient('Acme Co', '1112223333');
    const other = await createClient('Other Co', '4445556666');
    const clientUser = await createUser('client', 'client@test.com', mine.id);
    const otherOrder = await createOrder(other.id, 'ORD-002', 'pending');
    const res = await request(app)
        .patch(`/api/me/orders/${otherOrder.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({});
    assert.equal(res.status, 404);
});
test('a non-pending order cannot be cancelled (409)', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const order = await createOrder(client.id, 'ORD-003', 'in_progress');
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({});
    assert.equal(res.status, 409);
});
test('an invalid order id is rejected with 400', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const res = await request(app)
        .patch('/api/me/orders/abc/cancel')
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({});
    assert.equal(res.status, 400);
});
test('cancel is gated on pending status atomically (no clobber of in_progress)', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const order = await createOrder(client.id, 'ORD-005', 'in_progress');
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({});
    assert.equal(res.status, 409);
    // The order must remain in_progress — never silently flipped to cancelled.
    const [after] = await db.select({ status: orders.status }).from(orders);
    assert.equal(after.status, 'in_progress');
});
test('a non-client role is forbidden (403)', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const staff = await createUser('admin', 'admin@test.com');
    const order = await createOrder(client.id, 'ORD-004', 'pending');
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(staff)}`)
        .send({});
    assert.equal(res.status, 403);
});
test('the cancellation reason is persisted on the order', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const order = await createOrder(client.id, 'ORD-006', 'pending');
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ reason: 'Change of plans' });
    assert.equal(res.status, 200);
    const [after] = await db.select({ reason: orders.cancellationReason }).from(orders);
    assert.equal(after.reason, 'Change of plans');
});
test('a date-only order (no delivery time) is never cutoff-locked', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const today = new Date();
    const deliveryDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-012', clientId: client.id, grade: 'M25', quantity: '10',
        status: 'approved', deliveryDate, // no deliveryTime → no concrete slot
    }).returning();
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ reason: 'Change of plans' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
});
// A delivery scheduled `mins` minutes from now, as YYYY-MM-DD + HH:MM strings.
function slotFromNow(mins) {
    const d = new Date(Date.now() + mins * 60_000);
    const deliveryDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const deliveryTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { deliveryDate, deliveryTime };
}
test('cancel is blocked within 20 minutes of the scheduled delivery (409)', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const slot = slotFromNow(10); // 10 min out → inside the 20-min cutoff
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-007', clientId: client.id, grade: 'M25', quantity: '10',
        status: 'approved', ...slot,
    }).returning();
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ reason: 'Change of plans' });
    assert.equal(res.status, 409);
    const [after] = await db.select({ status: orders.status }).from(orders);
    assert.equal(after.status, 'approved'); // untouched
});
test('cancel is allowed comfortably before the cutoff', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const slot = slotFromNow(120); // 2 hours out → well outside the cutoff
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-008', clientId: client.id, grade: 'M25', quantity: '10',
        status: 'approved', ...slot,
    }).returning();
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ reason: 'Change of plans' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
});
test('reschedule moves the delivery slot; an approved order re-enters approval', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-009', clientId: client.id, grade: 'M25', quantity: '10',
        status: 'approved', deliveryDate: '2099-01-01', deliveryTime: '09:00',
    }).returning();
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/reschedule`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ deliveryDate: '2099-02-02', deliveryTime: '14:30' });
    assert.equal(res.status, 200);
    assert.equal(res.body.deliveryDate, '2099-02-02');
    assert.equal(res.body.status, 'pending_approval'); // date change forces re-approval
});
test('reschedule is blocked within 20 minutes of the current slot (409)', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const slot = slotFromNow(10); // current slot is inside the cutoff
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-010', clientId: client.id, grade: 'M25', quantity: '10',
        status: 'approved', ...slot,
    }).returning();
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/reschedule`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send({ deliveryDate: '2099-02-02', deliveryTime: '14:30' });
    assert.equal(res.status, 409);
});
test('reschedule rejects a new slot inside the cutoff from now (400)', async () => {
    const client = await createClient('Acme Co', '1112223333');
    const clientUser = await createUser('client', 'client@test.com', client.id);
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-011', clientId: client.id, grade: 'M25', quantity: '10',
        status: 'approved', deliveryDate: '2099-01-01', deliveryTime: '09:00',
    }).returning();
    const soon = slotFromNow(5); // 5 min from now → too soon
    const res = await request(app)
        .patch(`/api/me/orders/${order.id}/reschedule`)
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`)
        .send(soon);
    assert.equal(res.status, 400);
});
