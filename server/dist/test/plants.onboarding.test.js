import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { and, eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, auditLogs } from '../db/schema.js';
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
        role: opts.role ?? 'admin',
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function createPlant(opts) {
    const [row] = await db.insert(plants).values({
        name: opts.name,
        latitude: '19.0330000',
        longitude: '73.0297000',
        plantStatus: 'approved',
        isActive: true,
        locationVerified: opts.locationVerified ?? true,
        verified: opts.verified ?? false,
        deliveryRadiusKm: 40,
        grades: ['M-20', 'M-25'],
        openTime: '06:00',
        closeTime: '21:00',
    }).returning();
    return row;
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, plants RESTART IDENTITY CASCADE`);
});
after(async () => {
    await pool.end();
});
test('GET /plants returns ownerCount per plant for staff', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const lead = await createPlant({ name: 'Lead Plant', verified: false });
    const verified = await createPlant({ name: 'Verified Plant', verified: true });
    // One live owner login bound to the verified plant, plus a soft-deleted one
    // that must not be counted.
    await db.insert(users).values({
        name: 'Owner', email: 'owner@test.com', passwordHash: await hashPassword(PASSWORD), role: 'admin', plantId: verified.id,
    });
    await db.insert(users).values({
        name: 'Gone', email: 'gone@test.com', passwordHash: await hashPassword(PASSWORD), role: 'admin', plantId: verified.id, deletedAt: new Date(),
    });
    const res = await request(app).get('/api/plants').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const byId = new Map(res.body.map(p => [p.id, p]));
    assert.equal(byId.get(lead.id).ownerCount, 0);
    assert.equal(byId.get(lead.id).verified, false);
    assert.equal(byId.get(verified.id).ownerCount, 1, 'soft-deleted owner must not be counted');
    assert.equal(byId.get(verified.id).verified, true);
});
test('PUT /plants/:id can mark a lead verified and edit company details', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const lead = await createPlant({ name: 'Lead Plant', verified: false });
    const res = await request(app)
        .put(`/api/plants/${lead.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ verified: true, legalName: 'Lead Infra Pvt Ltd', gstNo: '27AAKCK0001A1Z5', email: 'lead@example.com', contactNumber: '9820011001' });
    assert.equal(res.status, 200);
    assert.equal(res.body.verified, true);
    assert.equal(res.body.legalName, 'Lead Infra Pvt Ltd');
    assert.equal(res.body.gstNo, '27AAKCK0001A1Z5');
    assert.equal(res.body.email, 'lead@example.com');
    assert.equal(res.body.contactNumber, '9820011001');
});
test('PUT /plants/:id rejects verifying a plant with missing company details', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const lead = await createPlant({ name: 'Lead Plant', verified: false });
    // A scripted request flipping verified=true on a bare lead must be blocked.
    const res = await request(app)
        .put(`/api/plants/${lead.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ verified: true });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /legal \/ company name/);
    assert.match(res.body.error, /GST number/);
    assert.match(res.body.error, /contact number/);
    assert.match(res.body.error, /email/);
    // The plant must remain an unverified lead.
    const [after] = await db.select().from(plants).where(eq(plants.id, lead.id));
    assert.equal(after.verified, false, 'plant must not have been published');
});
test('PUT /plants/:id rejects verifying when a single detail is blank', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const lead = await createPlant({ name: 'Lead Plant', verified: false });
    // Fill everything except email, then try to publish with email blank.
    await db.update(plants).set({
        legalName: 'Lead Infra Pvt Ltd', gstNo: '27AAKCK0001A1Z5', contactNumber: '9820011001',
    }).where(eq(plants.id, lead.id));
    const res = await request(app)
        .put(`/api/plants/${lead.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ verified: true, email: '   ' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /email/);
    assert.doesNotMatch(res.body.error, /GST number/);
});
test('PUT /plants/:id allows verifying when stored details are complete (partial PUT)', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const lead = await createPlant({ name: 'Lead Plant', verified: false });
    await db.update(plants).set({
        legalName: 'Lead Infra Pvt Ltd', gstNo: '27AAKCK0001A1Z5',
        contactNumber: '9820011001', email: 'lead@example.com',
    }).where(eq(plants.id, lead.id));
    // Only the verified flag is sent — the guard merges against the stored row.
    const res = await request(app)
        .put(`/api/plants/${lead.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ verified: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.verified, true);
});
test('PUT /plants/:id can still un-verify and edit a plant with missing details', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const verified = await createPlant({ name: 'Verified Plant', verified: true });
    // Un-verifying (and any other edit) must not be blocked by missing details.
    const res = await request(app)
        .put(`/api/plants/${verified.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ verified: false, legalName: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.verified, false);
});
test('GET /plants/nearby excludes unverified leads, includes verified partners', async () => {
    await createPlant({ name: 'Lead Plant', verified: false, locationVerified: true });
    await createPlant({ name: 'Verified Plant', verified: true, locationVerified: true });
    const customer = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const res = await request(app)
        .get('/api/plants/nearby')
        .set('Authorization', `Bearer ${tokenFor(customer)}`)
        .query({ lat: 19.033, lng: 73.0297 });
    assert.equal(res.status, 200);
    const names = res.body.map((p) => p.name);
    assert.ok(names.includes('Verified Plant'), 'verified partner should be visible to customers');
    assert.ok(!names.includes('Lead Plant'), 'onboarding lead must never reach customers');
});
test('GET /plants/nearby rejects logged-out callers (customer-only discovery)', async () => {
    await createPlant({ name: 'Verified Plant', verified: true, locationVerified: true });
    const res = await request(app).get('/api/plants/nearby').query({ lat: 19.033, lng: 73.0297 });
    assert.equal(res.status, 401, 'nearby discovery must require authentication');
});
test('POST /plants/:id/owner provisions a plant-scoped login and writes an audit log', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Plant Owner', email: 'plantowner@test.com', password: 'ownerpass1' });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, 'plantowner@test.com');
    assert.equal(res.body.role, 'admin', 'defaults to owner (admin) role');
    assert.equal(res.body.plantId, plant.id);
    const [created] = await db.select().from(users).where(eq(users.email, 'plantowner@test.com'));
    assert.ok(created, 'user row should exist');
    assert.equal(created.plantId, plant.id, 'login must be hard-scoped to the plant');
    const audit = await db.select().from(auditLogs)
        .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, created.id)));
    assert.equal(audit.length, 1, 'provisioning should write one audit entry');
});
test('POST /plants/:id/owner honours an explicit role', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Dispatcher', email: 'disp@test.com', password: 'ownerpass1', role: 'dispatcher' });
    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'dispatcher');
});
test('POST /plants/:id/owner rejects a duplicate email with 409', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    await createUser({ name: 'Existing', email: 'taken@test.com', role: 'client' });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Owner', email: 'taken@test.com', password: 'ownerpass1' });
    assert.equal(res.status, 409);
});
test('POST /plants/:id/owner validates the body', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: '', email: 'not-an-email', password: '123' });
    assert.equal(res.status, 400);
});
test('POST /plants/:id/owner is 404 for an unknown plant', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const res = await request(app)
        .post('/api/plants/999999/owner')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Owner', email: 'owner@test.com', password: 'ownerpass1' });
    assert.equal(res.status, 404);
});
test('GET /plants/:id/owner lists the plant-scoped logins, omitting soft-deleted', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    const other = await createPlant({ name: 'Other Plant', verified: true });
    await db.insert(users).values({
        name: 'Owner', email: 'owner@test.com', passwordHash: await hashPassword(PASSWORD), role: 'admin', plantId: plant.id,
    });
    await db.insert(users).values({
        name: 'Disp', email: 'disp@test.com', passwordHash: await hashPassword(PASSWORD), role: 'dispatcher', plantId: plant.id, isActive: false,
    });
    // Soft-deleted login on the same plant must not appear.
    await db.insert(users).values({
        name: 'Gone', email: 'gone@test.com', passwordHash: await hashPassword(PASSWORD), role: 'admin', plantId: plant.id, deletedAt: new Date(),
    });
    // A login on a different plant must not leak in.
    await db.insert(users).values({
        name: 'Elsewhere', email: 'elsewhere@test.com', passwordHash: await hashPassword(PASSWORD), role: 'admin', plantId: other.id,
    });
    const res = await request(app).get(`/api/plants/${plant.id}/owner`).set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const emails = res.body.map(u => u.email).sort();
    assert.deepEqual(emails, ['disp@test.com', 'owner@test.com'], 'only live logins for this plant');
    const disp = res.body.find(u => u.email === 'disp@test.com');
    assert.equal(disp.isActive, false, 'active state is surfaced');
    assert.equal(disp.role, 'dispatcher');
});
test('GET /plants/:id/owner is 404 for an unknown plant', async () => {
    const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const res = await request(app).get('/api/plants/999999/owner').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 404);
});
test('GET /plants/:id/owner is staff-only (client token rejected)', async () => {
    const client = await createUser({ name: 'Client', email: 'client@test.com', role: 'client' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    const res = await request(app).get(`/api/plants/${plant.id}/owner`).set('Authorization', `Bearer ${tokenFor(client)}`);
    assert.equal(res.status, 403);
});
test('owner provisioning is staff-only (client token rejected)', async () => {
    const client = await createUser({ name: 'Client', email: 'client@test.com', role: 'client' });
    const plant = await createPlant({ name: 'Verified Plant', verified: true });
    const res = await request(app)
        .post(`/api/plants/${plant.id}/owner`)
        .set('Authorization', `Bearer ${tokenFor(client)}`)
        .send({ name: 'Owner', email: 'owner@test.com', password: 'ownerpass1' });
    assert.equal(res.status, 403);
});
