import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
async function createUser(opts) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'client',
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function createPlant(opts) {
    const [row] = await db.insert(plants).values({
        name: opts.name,
        city: opts.city ?? 'Pune',
        latitude: '19.0330000',
        longitude: '73.0297000',
        plantStatus: opts.plantStatus ?? 'approved',
        isActive: opts.isActive ?? true,
        locationVerified: opts.locationVerified ?? true,
        verified: opts.verified ?? true,
        deliveryRadiusKm: 40,
        grades: opts.grades ?? ['M20', 'M25'],
        openTime: '06:00',
        closeTime: '21:00',
    }).returning();
    return row;
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE users, plants RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('GET /plants/directory returns verified partners with their grades', async () => {
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await createPlant({ name: 'Acme RMC', grades: ['M20', 'M25', 'M30'], city: 'Pune' });
    const res = await request(app)
        .get('/api/plants/directory')
        .set('Authorization', `Bearer ${tokenFor(customer)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    const entry = res.body[0];
    assert.equal(entry.name, 'Acme RMC');
    assert.equal(entry.city, 'Pune');
    assert.deepEqual(entry.grades, ['M20', 'M25', 'M30']);
    assert.equal(entry.openTime, '06:00');
    assert.equal(entry.closeTime, '21:00');
});
test('GET /plants/directory hides leads and unavailable plants from customers', async () => {
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await createPlant({ name: 'Verified Partner', verified: true });
    await createPlant({ name: 'Onboarding Lead', verified: false });
    await createPlant({ name: 'Unverified Pin', locationVerified: false });
    await createPlant({ name: 'Inactive Plant', isActive: false });
    await createPlant({ name: 'Pending Plant', plantStatus: 'pending' });
    const res = await request(app)
        .get('/api/plants/directory')
        .set('Authorization', `Bearer ${tokenFor(customer)}`);
    assert.equal(res.status, 200);
    const names = res.body.map(p => p.name);
    assert.deepEqual(names, ['Verified Partner'], 'only fully-orderable verified partners are listed');
});
test('GET /plants/directory is sorted by plant name', async () => {
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await createPlant({ name: 'Zenith Concrete' });
    await createPlant({ name: 'Alpha Mix' });
    await createPlant({ name: 'Mid RMC' });
    const res = await request(app)
        .get('/api/plants/directory')
        .set('Authorization', `Bearer ${tokenFor(customer)}`);
    assert.equal(res.status, 200);
    const names = res.body.map(p => p.name);
    assert.deepEqual(names, ['Alpha Mix', 'Mid RMC', 'Zenith Concrete']);
});
test('GET /plants/directory requires authentication', async () => {
    await createPlant({ name: 'Acme RMC' });
    const res = await request(app).get('/api/plants/directory');
    assert.equal(res.status, 401);
});
