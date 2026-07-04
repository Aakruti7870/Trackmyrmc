import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, plants } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
let plantSeq = 0;
async function createPlant() {
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
        locationVerified: true,
        grades: ['M25', 'M30'],
    }).returning();
    return row;
}
async function createStaff(role, plantId, email) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role, isActive: true, plantId,
    }).returning();
    return row;
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    plantSeq = 0;
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, clients, plants, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('a plant-bound supervisor may list clients (403 fix) and is scoped to its own plant', async () => {
    const plant = await createPlant();
    const other = await createPlant();
    const supervisor = await createStaff('supervisor', plant.id, 'sup@test.com');
    const [mine] = await db.insert(clients).values({
        name: 'My Client', contactPerson: 'C', phone: '8888888888',
        creditLimit: '0', outstandingAmount: '0', plantId: plant.id,
    }).returning();
    await db.insert(clients).values({
        name: 'Their Client', contactPerson: 'C', phone: '7777777777',
        creditLimit: '0', outstandingAmount: '0', plantId: other.id,
    });
    const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${signToken(supervisor)}`);
    assert.equal(res.status, 200);
    const ids = res.body.map((c) => c.id);
    assert.deepEqual(ids, [mine.id], 'supervisor sees only its own plant clients');
});
test('a plant-bound plant_owner may add a customer', async () => {
    const plant = await createPlant();
    const owner = await createStaff('plant_owner', plant.id, 'owner@test.com');
    const res = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${signToken(owner)}`)
        .send({ name: 'New Customer', contactPerson: 'Ravi', phone: '9999999999' });
    assert.equal(res.status, 201);
    assert.equal(res.body.plantId, plant.id, 'new customer is bound to the owner plant');
});
test('a plant-scoped role with no plant binding is rejected (never falls through to global)', async () => {
    const unbound = await createStaff('plant_owner', null, 'unbound-owner@test.com');
    const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${signToken(unbound)}`);
    assert.equal(res.status, 403);
});
test('an unbound supervisor is rejected too', async () => {
    const unbound = await createStaff('supervisor', null, 'unbound-sup@test.com');
    const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${signToken(unbound)}`);
    assert.equal(res.status, 403);
});
test('a customer (client role) still cannot reach the staff clients surface', async () => {
    const customer = await createStaff('client', null, 'cust@test.com');
    const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${signToken(customer)}`);
    assert.equal(res.status, 403);
});
