import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, sites } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
async function createClient(name = 'Acme Co', phone = '1112223333') {
    const [row] = await db.insert(clients).values({ name, contactPerson: 'Jane', phone }).returning();
    return row;
}
async function createUser(email, linkedClientId, verified = true) {
    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await db.insert(users).values({
        name: 'client user', email, passwordHash, role: 'client',
        isActive: true, linkedClientId: linkedClientId ?? null,
        kycStatus: verified ? 'verified' : 'pending',
    }).returning();
    return user;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE recurring_orders, orders, sites, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('creating a weekly recurring order sets a future next run date', async () => {
    const client = await createClient();
    const user = await createUser('rec1@test.com', client.id);
    const res = await request(app).post('/api/me/recurring').set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 3, pumpRequired: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.frequency, 'weekly');
    assert.equal(res.body.anchor, 3);
    assert.equal(res.body.active, true);
    assert.match(res.body.nextRunDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(res.body.nextRunDate).getUTCDay(), 3);
});
test('unverified customer cannot create a recurring order schedule', async () => {
    const client = await createClient();
    const user = await createUser('rec-unverified@test.com', client.id, false);
    const res = await request(app).post('/api/me/recurring').set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 3 });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'CUSTOMER_KYC_REQUIRED');
});
test('unverified customer can pause a schedule but cannot resume it', async () => {
    const client = await createClient();
    const user = await createUser('rec-pause@test.com', client.id);
    const auth = `Bearer ${tokenFor(user)}`;
    const created = await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 3 });
    assert.equal(created.status, 201);
    await db.update(users).set({ kycStatus: 'pending' }).where(eq(users.id, user.id));
    const paused = await request(app).patch(`/api/me/recurring/${created.body.id}`)
        .set('Authorization', auth).send({ active: false });
    assert.equal(paused.status, 200);
    assert.equal(paused.body.active, false);
    const resumed = await request(app).patch(`/api/me/recurring/${created.body.id}`)
        .set('Authorization', auth).send({ active: true });
    assert.equal(resumed.status, 403);
    assert.equal(resumed.body.code, 'CUSTOMER_KYC_REQUIRED');
});
test('invalid anchor for the frequency is rejected', async () => {
    const client = await createClient();
    const auth = `Bearer ${tokenFor(await createUser('rec2@test.com', client.id))}`;
    const weekly = await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 9 });
    assert.equal(weekly.status, 400);
    const monthly = await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 8, frequency: 'monthly', anchor: 31 });
    assert.equal(monthly.status, 400);
});
test('the list includes the joined site name', async () => {
    const client = await createClient();
    const user = await createUser('rec3@test.com', client.id);
    const auth = `Bearer ${tokenFor(user)}`;
    const [site] = await db.insert(sites).values({ clientId: client.id, name: 'Depot' }).returning();
    await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M30', quantity: 6, frequency: 'monthly', anchor: 5, siteId: site.id });
    const list = await request(app).get('/api/me/recurring').set('Authorization', auth);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].siteName, 'Depot');
});
test('pause then resume toggles active without touching the schedule', async () => {
    const client = await createClient();
    const auth = `Bearer ${tokenFor(await createUser('rec4@test.com', client.id))}`;
    const created = await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 1 });
    const id = created.body.id;
    const nextRun = created.body.nextRunDate;
    const paused = await request(app).patch(`/api/me/recurring/${id}`).set('Authorization', auth).send({ active: false });
    assert.equal(paused.body.active, false);
    assert.equal(paused.body.nextRunDate, nextRun);
    const resumed = await request(app).patch(`/api/me/recurring/${id}`).set('Authorization', auth).send({ active: true });
    assert.equal(resumed.body.active, true);
});
test('editing the schedule recomputes the next run date', async () => {
    const client = await createClient();
    const auth = `Bearer ${tokenFor(await createUser('rec5@test.com', client.id))}`;
    const created = await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 1 });
    const edit = await request(app).patch(`/api/me/recurring/${created.body.id}`).set('Authorization', auth)
        .send({ grade: 'M35', quantity: 12, frequency: 'monthly', anchor: 10 });
    assert.equal(edit.status, 200);
    assert.equal(edit.body.grade, 'M35');
    assert.equal(edit.body.frequency, 'monthly');
    assert.equal(new Date(edit.body.nextRunDate).getUTCDate(), 10);
});
test('a client cannot touch another client schedule', async () => {
    const mine = await createClient('Mine', '1110000002');
    const other = await createClient('Other', '2220000002');
    const auth = `Bearer ${tokenFor(await createUser('rec6@test.com', mine.id))}`;
    const otherAuth = `Bearer ${tokenFor(await createUser('rec7@test.com', other.id))}`;
    const created = await request(app).post('/api/me/recurring').set('Authorization', otherAuth)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 1 });
    const patch = await request(app).patch(`/api/me/recurring/${created.body.id}`).set('Authorization', auth).send({ active: false });
    assert.equal(patch.status, 404);
    const del = await request(app).delete(`/api/me/recurring/${created.body.id}`).set('Authorization', auth);
    assert.equal(del.status, 404);
});
test('delete removes the schedule', async () => {
    const client = await createClient();
    const auth = `Bearer ${tokenFor(await createUser('rec8@test.com', client.id))}`;
    const created = await request(app).post('/api/me/recurring').set('Authorization', auth)
        .send({ grade: 'M25', quantity: 8, frequency: 'weekly', anchor: 1 });
    const del = await request(app).delete(`/api/me/recurring/${created.body.id}`).set('Authorization', auth);
    assert.equal(del.status, 204);
    const list = await request(app).get('/api/me/recurring').set('Authorization', auth);
    assert.deepEqual(list.body, []);
});
