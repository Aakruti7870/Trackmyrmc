import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, rateCards, appSettings, auditLogs } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { COMMISSION_KEY } from '../lib/commission.js';
let app;
const PASSWORD = 'secret123';
async function createUser(opts) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: (opts.role ?? 'admin'),
        plantId: opts.plantId ?? null,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function createPlant(name) {
    const [row] = await db.insert(plants).values({
        name,
        latitude: '19.0330000',
        longitude: '73.0297000',
        plantStatus: 'approved',
        isActive: true,
        verified: true,
        deliveryRadiusKm: 40,
        grades: ['M-20', 'M-25'],
    }).returning();
    return row;
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, rate_cards, users, plants, app_settings RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('platform admin can create, list, update and delete a rate card', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const plant = await createPlant('Alpha Plant');
    const created = await request(app)
        .post(`/api/plants/${plant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'M-25', ratePerM3: 4500 });
    assert.equal(created.status, 201);
    assert.equal(created.body.grade, 'M-25');
    assert.equal(Number(created.body.ratePerM3), 4500);
    const list = await request(app)
        .get(`/api/plants/${plant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    const updated = await request(app)
        .put(`/api/plants/${plant.id}/rate-cards/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ratePerM3: 5000 });
    assert.equal(updated.status, 200);
    assert.equal(Number(updated.body.ratePerM3), 5000);
    const del = await request(app)
        .delete(`/api/plants/${plant.id}/rate-cards/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(del.status, 200);
    const after = await db.select().from(rateCards).where(eq(rateCards.plantId, plant.id));
    assert.equal(after.length, 0);
});
test('POST upserts by (plantId, grade) instead of duplicating', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const plant = await createPlant('Beta Plant');
    await request(app).post(`/api/plants/${plant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`).send({ grade: 'M-30', ratePerM3: 4000 });
    const second = await request(app).post(`/api/plants/${plant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`).send({ grade: 'M-30', ratePerM3: 4200 });
    assert.equal(second.status, 201);
    const rows = await db.select().from(rateCards).where(eq(rateCards.plantId, plant.id));
    assert.equal(rows.length, 1, 'same grade must update, not duplicate');
    assert.equal(Number(rows[0].ratePerM3), 4200);
});
test('a plant-scoped owner can only manage their own plant rate cards', async () => {
    const ownPlant = await createPlant('Own Plant');
    const otherPlant = await createPlant('Other Plant');
    const owner = await createUser({ name: 'Owner', email: 'owner@test.com', role: 'plant_owner', plantId: ownPlant.id });
    const token = tokenFor(owner);
    const own = await request(app)
        .post(`/api/plants/${ownPlant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'M-20', ratePerM3: 3800 });
    assert.equal(own.status, 201);
    const cross = await request(app)
        .post(`/api/plants/${otherPlant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ grade: 'M-20', ratePerM3: 3800 });
    assert.equal(cross.status, 403);
    const crossList = await request(app)
        .get(`/api/plants/${otherPlant.id}/rate-cards`)
        .set('Authorization', `Bearer ${token}`);
    assert.equal(crossList.status, 403);
});
test('a client cannot manage rate cards', async () => {
    const client = await createUser({ name: 'Client', email: 'client@test.com', role: 'client' });
    const plant = await createPlant('Gamma Plant');
    const res = await request(app)
        .get(`/api/plants/${plant.id}/rate-cards`)
        .set('Authorization', `Bearer ${tokenFor(client)}`);
    assert.equal(res.status, 403);
});
test('rate card validation rejects a negative rate', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant('Delta Plant');
    const res = await request(app)
        .post(`/api/plants/${plant.id}/rate-cards`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ grade: 'M-25', ratePerM3: -5 });
    assert.equal(res.status, 400);
});
test('commission defaults to 0 then persists with an audit entry', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const token = tokenFor(admin);
    const before = await request(app)
        .get('/api/admin/commission')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(before.status, 200);
    assert.equal(before.body.pct, 0);
    const saved = await request(app)
        .post('/api/admin/commission')
        .set('Authorization', `Bearer ${token}`)
        .send({ pct: '2.5' });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.pct, 2.5);
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, COMMISSION_KEY));
    assert.equal(setting.value, '2.5');
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'platform_commission_updated'));
    assert.ok(log, 'commission change must be audited');
});
test('commission rejects an out-of-range value', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
        .post('/api/admin/commission')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ pct: '150' });
    assert.equal(res.status, 400);
});
test('per-plant commission override is saved via the plant editor PUT', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant('Epsilon Plant');
    const res = await request(app)
        .put(`/api/plants/${plant.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ commissionPct: 3.75 });
    assert.equal(res.status, 200);
    assert.equal(Number(res.body.commissionPct), 3.75);
    const cleared = await request(app)
        .put(`/api/plants/${plant.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ commissionPct: '' });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.commissionPct, null);
});
