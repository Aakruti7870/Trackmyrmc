import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, sites, orders, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
async function createAdmin() {
    const [row] = await db.insert(users).values({
        name: 'Owner', email: 'owner@test.com', passwordHash: null, role: 'admin', isActive: true,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE challans, orders, sites, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('challan detail prefers the order-captured delivery brief over client/site records', async () => {
    const admin = await createAdmin();
    const [client] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Client Contact', phone: '1110001111',
    }).returning();
    const [site] = await db.insert(sites).values({
        clientId: client.id, name: 'Master Site', address: 'Master Site Address',
    }).returning();
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-BRIEF-1', clientId: client.id, siteId: site.id,
        grade: 'M25', quantity: '6.00',
        contactPerson: 'Order Contact', contactNumber: '9998887777',
        siteName: 'Order Site Name', siteAddress: 'Order Site Address',
    }).returning();
    const [challan] = await db.insert(challans).values({
        challanNo: 'CH-BRIEF-1', clientId: client.id, siteId: site.id, orderId: order.id,
        grade: 'M25', quantity: '6.00', status: 'dispatched', dispatchTime: new Date(),
    }).returning();
    const res = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.siteName, 'Order Site Name', 'order snapshot site name wins');
    assert.equal(res.body.siteAddress, 'Order Site Address', 'order snapshot address wins');
    assert.equal(res.body.contactPerson, 'Order Contact', 'order contact person wins');
    assert.equal(res.body.contactNumber, '9998887777', 'order contact number wins');
});
test('challan detail falls back to client/site records when there is no linked order', async () => {
    const admin = await createAdmin();
    const [client] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Client Contact', phone: '1110001111',
    }).returning();
    const [site] = await db.insert(sites).values({
        clientId: client.id, name: 'Master Site', address: 'Master Site Address',
    }).returning();
    const [challan] = await db.insert(challans).values({
        challanNo: 'CH-BRIEF-2', clientId: client.id, siteId: site.id,
        grade: 'M30', quantity: '4.00', status: 'dispatched', dispatchTime: new Date(),
    }).returning();
    const res = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.siteName, 'Master Site', 'falls back to site record');
    assert.equal(res.body.siteAddress, 'Master Site Address', 'falls back to site address');
    assert.equal(res.body.contactPerson, 'Client Contact', 'falls back to client contact');
    assert.equal(res.body.contactNumber, '1110001111', 'falls back to client phone');
});
test('challan detail with an order that has no snapshot fields still falls back cleanly', async () => {
    const admin = await createAdmin();
    const [client] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Client Contact', phone: '1110001111',
    }).returning();
    const [site] = await db.insert(sites).values({
        clientId: client.id, name: 'Master Site', address: 'Master Site Address',
    }).returning();
    const [order] = await db.insert(orders).values({
        orderNo: 'ORD-BRIEF-3', clientId: client.id, siteId: site.id,
        grade: 'M25', quantity: '6.00',
    }).returning();
    const [challan] = await db.insert(challans).values({
        challanNo: 'CH-BRIEF-3', clientId: client.id, siteId: site.id, orderId: order.id,
        grade: 'M25', quantity: '6.00', status: 'dispatched', dispatchTime: new Date(),
    }).returning();
    const res = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.siteName, 'Master Site');
    assert.equal(res.body.siteAddress, 'Master Site Address');
    assert.equal(res.body.contactPerson, 'Client Contact');
    assert.equal(res.body.contactNumber, '1110001111');
});
