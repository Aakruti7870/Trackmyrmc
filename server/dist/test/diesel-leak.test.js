import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, vehicles, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
// Diesel data — odometer readings (challans), mileage/idle-burn baselines
// (vehicles) and the fuel-reconciliation report — is owner/staff-only and must
// never reach client or driver accounts. These tests lock that boundary in.
let app;
const PASSWORD = 'secret123';
async function createUser(role, email, opts = {}) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [user] = await db.insert(users).values({
        name: email.split('@')[0], email, passwordHash, role, isActive: true,
        linkedDriverId: opts.linkedDriverId ?? null, linkedClientId: opts.linkedClientId ?? null,
    }).returning();
    return user;
}
async function createClient(name) {
    const [row] = await db.insert(clients).values({ name, contactPerson: 'C', phone: '1112223333' }).returning();
    return row;
}
async function createDriver(name) {
    const [row] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
    return row;
}
async function createVehicle(vehicleNo) {
    const [row] = await db.insert(vehicles).values({
        vehicleNo, capacity: '6.00', mileageKmpl: '3.50', idleBurnLph: '2.00',
    }).returning();
    return row;
}
let seq = 0;
async function createChallan(opts) {
    seq += 1;
    const [row] = await db.insert(challans).values({
        challanNo: `CH-L${String(seq).padStart(4, '0')}`,
        clientId: opts.clientId, vehicleId: opts.vehicleId,
        grade: 'M25', quantity: '6.00', status: 'delivered',
        dispatchTime: new Date(), odometerStart: 12000, odometerEnd: 12080,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE vehicle_alerts, fuel_logs, challans, vehicles, drivers, clients, audit_logs, app_settings, users, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
// --- Vehicles: diesel baselines ------------------------------------------
test('GET /api/vehicles hides mileage/idle-burn from clients and drivers but shows staff', async () => {
    await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    const driver = await createDriver('Dave');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const driverUser = await createUser('driver', 'd@test.com', { linkedDriverId: driver.id });
    const admin = await createUser('admin', 'a@test.com');
    for (const u of [clientUser, driverUser]) {
        const res = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${tokenFor(u)}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 1);
        assert.equal('mileageKmpl' in res.body[0], false, `${u.role} must not see mileageKmpl`);
        assert.equal('idleBurnLph' in res.body[0], false, `${u.role} must not see idleBurnLph`);
    }
    const staffRes = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(staffRes.status, 200);
    assert.equal('mileageKmpl' in staffRes.body[0], true);
    assert.equal('idleBurnLph' in staffRes.body[0], true);
});
test('GET /api/vehicles/:id hides mileage/idle-burn from clients but shows staff', async () => {
    const vehicle = await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const admin = await createUser('admin', 'a@test.com');
    const clientRes = await request(app).get(`/api/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${tokenFor(clientUser)}`);
    assert.equal(clientRes.status, 200);
    assert.equal('mileageKmpl' in clientRes.body, false);
    assert.equal('idleBurnLph' in clientRes.body, false);
    const staffRes = await request(app).get(`/api/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(staffRes.status, 200);
    assert.equal('mileageKmpl' in staffRes.body, true);
});
test('vehicle write endpoints are forbidden for clients and drivers', async () => {
    const vehicle = await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    const driver = await createDriver('Dave');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const driverUser = await createUser('driver', 'd@test.com', { linkedDriverId: driver.id });
    for (const u of [clientUser, driverUser]) {
        const auth = `Bearer ${tokenFor(u)}`;
        const created = await request(app).post('/api/vehicles').set('Authorization', auth)
            .send({ vehicleNo: 'NEW123', capacity: '6.00', mileageKmpl: '9.99', idleBurnLph: '9.99' });
        assert.equal(created.status, 403, `${u.role} must not create vehicles`);
        const updated = await request(app).put(`/api/vehicles/${vehicle.id}`).set('Authorization', auth)
            .send({ vehicleNo: 'MH01AB1234', capacity: '6.00', mileageKmpl: '0.01' });
        assert.equal(updated.status, 403, `${u.role} must not edit vehicles`);
        const removed = await request(app).delete(`/api/vehicles/${vehicle.id}`).set('Authorization', auth);
        assert.equal(removed.status, 403, `${u.role} must not delete vehicles`);
    }
});
test('staff can create vehicles with diesel baselines', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const res = await request(app).post('/api/vehicles').set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ vehicleNo: 'MH09XY9999', capacity: '6.00', mileageKmpl: '3.50', idleBurnLph: '2.00' });
    assert.equal(res.status, 201);
    assert.equal(Number(res.body.mileageKmpl), 3.5);
});
// --- Challans: odometer readings -----------------------------------------
test('GET /api/challans hides odometer from clients and drivers but shows staff', async () => {
    const vehicle = await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    await createChallan({ vehicleId: vehicle.id, clientId: client.id });
    const driver = await createDriver('Dave');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const driverUser = await createUser('driver', 'd@test.com', { linkedDriverId: driver.id });
    const admin = await createUser('admin', 'a@test.com');
    for (const u of [clientUser, driverUser]) {
        const res = await request(app).get('/api/challans').set('Authorization', `Bearer ${tokenFor(u)}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.length, 1);
        assert.equal('odometerStart' in res.body[0], false, `${u.role} must not see odometerStart`);
        assert.equal('odometerEnd' in res.body[0], false, `${u.role} must not see odometerEnd`);
    }
    const staffRes = await request(app).get('/api/challans').set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(staffRes.status, 200);
    assert.equal('odometerStart' in staffRes.body[0], true);
    assert.equal('odometerEnd' in staffRes.body[0], true);
});
test('GET /api/challans/:id hides odometer from clients but shows staff', async () => {
    const vehicle = await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    const challan = await createChallan({ vehicleId: vehicle.id, clientId: client.id });
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const admin = await createUser('admin', 'a@test.com');
    const clientRes = await request(app).get(`/api/challans/${challan.id}`).set('Authorization', `Bearer ${tokenFor(clientUser)}`);
    assert.equal(clientRes.status, 200);
    assert.equal('odometerStart' in clientRes.body, false);
    assert.equal('odometerEnd' in clientRes.body, false);
    const staffRes = await request(app).get(`/api/challans/${challan.id}`).set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(staffRes.status, 200);
    assert.equal('odometerStart' in staffRes.body, true);
});
test('challan create/delete is forbidden for clients and drivers', async () => {
    const vehicle = await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    const challan = await createChallan({ vehicleId: vehicle.id, clientId: client.id });
    const driver = await createDriver('Dave');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const driverUser = await createUser('driver', 'd@test.com', { linkedDriverId: driver.id });
    for (const u of [clientUser, driverUser]) {
        const auth = `Bearer ${tokenFor(u)}`;
        const created = await request(app).post('/api/challans').set('Authorization', auth)
            .send({ clientId: client.id, vehicleId: vehicle.id, grade: 'M25', quantity: '6.00', odometerStart: 99999 });
        assert.equal(created.status, 403, `${u.role} must not create challans`);
        const removed = await request(app).delete(`/api/challans/${challan.id}`).set('Authorization', auth);
        assert.equal(removed.status, 403, `${u.role} must not delete challans`);
    }
});
test('staff can create and delete challans with odometer', async () => {
    const vehicle = await createVehicle('MH01AB1234');
    const client = await createClient('Acme');
    const admin = await createUser('admin', 'a@test.com');
    const auth = `Bearer ${tokenFor(admin)}`;
    const created = await request(app).post('/api/challans').set('Authorization', auth)
        .send({ clientId: client.id, vehicleId: vehicle.id, grade: 'M25', quantity: '6.00', odometerStart: 12000 });
    assert.equal(created.status, 201);
    assert.equal(created.body.odometerStart, 12000);
    const removed = await request(app).delete(`/api/challans/${created.body.id}`).set('Authorization', auth);
    assert.equal(removed.status, 200);
});
// --- Reports: fuel-reconciliation CSV export -----------------------------
test('GET /api/reports/export?report=fuel-reconciliation is forbidden for clients and drivers', async () => {
    const client = await createClient('Acme');
    const driver = await createDriver('Dave');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const driverUser = await createUser('driver', 'd@test.com', { linkedDriverId: driver.id });
    for (const u of [clientUser, driverUser]) {
        const res = await request(app).get('/api/reports/export?report=fuel-reconciliation')
            .set('Authorization', `Bearer ${tokenFor(u)}`);
        assert.equal(res.status, 403, `${u.role} must not export fuel reconciliation`);
    }
});
test('GET /api/reports/export?report=fuel-reconciliation succeeds for staff', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const res = await request(app).get('/api/reports/export?report=fuel-reconciliation')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.text, /Diesel reconciliation/);
});
