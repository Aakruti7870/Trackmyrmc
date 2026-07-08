import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, plants, orders, kycProfiles, kycDocuments } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
let seq = 0;
async function createPlant(extra = {}) {
    seq += 1;
    const [row] = await db.insert(plants).values({
        plantCode: `KB-${String(seq).padStart(3, '0')}`,
        name: `Badge Plant ${seq}`,
        latitude: '19.0000000',
        longitude: '72.0000000',
        plantStatus: 'approved',
        isActive: true,
        locationVerified: true,
        verified: true,
        networkStatus: 'active',
        showOnNetwork: true,
        grades: ['M25'],
        ...extra,
    }).returning();
    return row;
}
async function createUser(role, email, plantId = null, extra = {}) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: `${role} ${email}`, email, passwordHash,
        role: role,
        isActive: true, plantId, ...extra,
    }).returning();
    return row;
}
async function createClientRow(plantId = null) {
    seq += 1;
    const [client] = await db.insert(clients).values({
        name: `Badge Client ${seq}`, contactPerson: 'C', phone: `98${String(seq).padStart(8, '0')}`,
        plantId,
    }).returning();
    return client;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE ${kycDocuments} RESTART IDENTITY CASCADE`);
    await db.execute(sql `TRUNCATE TABLE ${kycProfiles} RESTART IDENTITY CASCADE`);
    await db.execute(sql `TRUNCATE TABLE ${orders} RESTART IDENTITY CASCADE`);
    await db.execute(sql `TRUNCATE TABLE ${users} RESTART IDENTITY CASCADE`);
    await db.execute(sql `TRUNCATE TABLE ${clients} RESTART IDENTITY CASCADE`);
    await db.execute(sql `TRUNCATE TABLE ${plants} RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
// ---------------------------------------------------------------------------
// Customer E-KYC badge (clients + orders)
// ---------------------------------------------------------------------------
test('client list flags kycVerified when a linked user completed Aadhaar eKYC', async () => {
    const plant = await createPlant();
    const admin = await createUser('admin', 'kb-admin1@test.com', plant.id);
    const verifiedClient = await createClientRow(plant.id);
    await createUser('client', 'kb-cust1@test.com', null, {
        linkedClientId: verifiedClient.id, kycStatus: 'verified',
    });
    const plainClient = await createClientRow(plant.id);
    await createUser('client', 'kb-cust2@test.com', null, { linkedClientId: plainClient.id });
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const byId = new Map(res.body.map((c) => [c.id, c.kycVerified]));
    assert.equal(byId.get(verifiedClient.id), true);
    assert.equal(byId.get(plainClient.id), false);
    const detail = await request(app).get(`/api/clients/${verifiedClient.id}`).set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.kycVerified, true);
});
test('an approved KYC profile also verifies the client; deleted users never count', async () => {
    const plant = await createPlant();
    const admin = await createUser('admin', 'kb-admin2@test.com', plant.id);
    const approvedClient = await createClientRow(plant.id);
    const approvedUser = await createUser('client', 'kb-cust3@test.com', null, { linkedClientId: approvedClient.id });
    await db.insert(kycProfiles).values({
        entityType: 'customer', userId: approvedUser.id, status: 'approved',
    });
    const ghostClient = await createClientRow(plant.id);
    await createUser('client', 'kb-cust4@test.com', null, {
        linkedClientId: ghostClient.id, kycStatus: 'verified', deletedAt: new Date(),
    });
    const res = await request(app).get('/api/clients').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const byId = new Map(res.body.map((c) => [c.id, c.kycVerified]));
    assert.equal(byId.get(approvedClient.id), true);
    assert.equal(byId.get(ghostClient.id), false);
});
test('staff order list carries customerKycVerified for the ordering client', async () => {
    const plant = await createPlant();
    const admin = await createUser('admin', 'kb-admin3@test.com', plant.id);
    const client = await createClientRow(plant.id);
    await createUser('client', 'kb-cust5@test.com', null, {
        linkedClientId: client.id, kycStatus: 'verified',
    });
    await db.insert(orders).values({
        orderNo: 'KB-ORD-1', plantId: plant.id, clientId: client.id,
        grade: 'M25', quantity: '10.00', status: 'pending',
    });
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const order = res.body.find((o) => o.orderNo === 'KB-ORD-1');
    assert.ok(order);
    assert.equal(order.customerKycVerified, true);
});
// ---------------------------------------------------------------------------
// Plant GST & PAN badge
// ---------------------------------------------------------------------------
test('plant listings flag gstPanVerified only when the approved profile has BOTH GST and PAN', async () => {
    const fullPlant = await createPlant();
    const gstOnlyPlant = await createPlant();
    const draftPlant = await createPlant();
    const owner1 = await createUser('plant_owner', 'kb-own1@test.com', fullPlant.id);
    const owner2 = await createUser('plant_owner', 'kb-own2@test.com', gstOnlyPlant.id);
    const owner3 = await createUser('plant_owner', 'kb-own3@test.com', draftPlant.id);
    await db.insert(kycProfiles).values([
        { entityType: 'plant_owner', userId: owner1.id, plantId: fullPlant.id, status: 'approved', gstNumber: '27AAACK0001B1Z5', panNumber: 'AAAPL1234C' },
        { entityType: 'plant_owner', userId: owner2.id, plantId: gstOnlyPlant.id, status: 'approved', gstNumber: '27AAACK0002B1Z5' },
        { entityType: 'plant_owner', userId: owner3.id, plantId: draftPlant.id, status: 'draft', gstNumber: '27AAACK0003B1Z5', panNumber: 'AAAPL5678C' },
    ]);
    const customer = await createUser('client', 'kb-cust6@test.com');
    const token = tokenFor(customer);
    const nearby = await request(app)
        .get('/api/plants/nearby?lat=19.0&lng=72.0&radiusKm=250')
        .set('Authorization', `Bearer ${token}`);
    assert.equal(nearby.status, 200);
    const nearbyById = new Map(nearby.body.map((p) => [p.id, p.gstPanVerified]));
    assert.equal(nearbyById.get(fullPlant.id), true);
    assert.equal(nearbyById.get(gstOnlyPlant.id), false);
    assert.equal(nearbyById.get(draftPlant.id), false);
    const dir = await request(app).get('/api/plants/directory').set('Authorization', `Bearer ${token}`);
    assert.equal(dir.status, 200);
    const dirById = new Map(dir.body.map((p) => [p.id, p.gstPanVerified]));
    assert.equal(dirById.get(fullPlant.id), true);
    assert.equal(dirById.get(gstOnlyPlant.id), false);
});
test('an uploaded PAN document satisfies the PAN half of the badge', async () => {
    const plant = await createPlant();
    const owner = await createUser('plant_owner', 'kb-own4@test.com', plant.id);
    const [profile] = await db.insert(kycProfiles).values({
        entityType: 'plant_owner', userId: owner.id, plantId: plant.id,
        status: 'approved', gstNumber: '27AAACK0009B1Z5',
    }).returning();
    await db.insert(kycDocuments).values({
        profileId: profile.id, docType: 'pan', objectPath: '/objects/kyc/pan.pdf',
        fileName: 'pan.pdf',
    });
    const customer = await createUser('client', 'kb-cust7@test.com');
    const res = await request(app)
        .get('/api/plants/map')
        .set('Authorization', `Bearer ${tokenFor(customer)}`);
    assert.equal(res.status, 200);
    const row = res.body.find((p) => p.id === plant.id);
    assert.ok(row);
    assert.equal(row.gstPanVerified, true);
});
