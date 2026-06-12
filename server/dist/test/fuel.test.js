import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, vehicles, challans, fuelLogs, vehicleAlerts } from '../db/schema.js';
import { setSetting } from '../lib/settings.js';
import { FUEL_KEYS } from '../lib/fuelConfig.js';
import { signToken } from '../middleware/auth.js';
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
async function createVehicle(vehicleNo, opts = {}) {
    const [row] = await db.insert(vehicles).values({
        vehicleNo, capacity: '6.00',
        mileageKmpl: opts.mileageKmpl ?? null, idleBurnLph: opts.idleBurnLph ?? null,
    }).returning();
    return row;
}
let challanSeq = 0;
async function createChallan(opts) {
    challanSeq += 1;
    const [row] = await db.insert(challans).values({
        challanNo: `CH-F${String(challanSeq).padStart(4, '0')}`,
        clientId: opts.clientId,
        driverId: opts.driverId ?? null,
        vehicleId: opts.vehicleId,
        grade: 'M25', quantity: '6.00', status: 'delivered',
        dispatchTime: new Date(),
        odometerStart: opts.odometerStart ?? null,
        odometerEnd: opts.odometerEnd ?? null,
        siteArrivalTime: opts.siteArrivalTime ?? null,
        siteReleaseTime: opts.siteReleaseTime ?? null,
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
// --- Fuel log route: role gating & CRUD -----------------------------------
test('fuel logs are staff-only — clients and drivers are forbidden', async () => {
    const client = await createClient('Acme');
    const driver = await createDriver('Dave');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const driverUser = await createUser('driver', 'd@test.com', { linkedDriverId: driver.id });
    for (const u of [clientUser, driverUser]) {
        const res = await request(app).get('/api/fuel').set('Authorization', `Bearer ${tokenFor(u)}`);
        assert.equal(res.status, 403, `${u.role} must not read fuel logs`);
    }
});
test('an admin can create, list, update and delete a fuel log', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const vehicle = await createVehicle('MH01AB1234');
    const auth = `Bearer ${tokenFor(admin)}`;
    const created = await request(app).post('/api/fuel').set('Authorization', auth)
        .send({ vehicleId: vehicle.id, litres: 40, amount: 4000, odometer: 12000 });
    assert.equal(created.status, 201);
    assert.equal(Number(created.body.litres), 40);
    assert.equal(created.body.recordedByName, admin.name);
    const id = created.body.id;
    const list = await request(app).get('/api/fuel').set('Authorization', auth);
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].vehicleNo, 'MH01AB1234');
    assert.equal(list.body[0].hasBillPhoto, false);
    const updated = await request(app).put(`/api/fuel/${id}`).set('Authorization', auth)
        .send({ litres: 45 });
    assert.equal(updated.status, 200);
    assert.equal(Number(updated.body.litres), 45);
    const del = await request(app).delete(`/api/fuel/${id}`).set('Authorization', auth);
    assert.equal(del.status, 200);
    const after = await request(app).get('/api/fuel').set('Authorization', auth);
    assert.equal(after.body.length, 0);
});
test('creating a fuel log rejects a non-positive litres value and an unknown vehicle', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const vehicle = await createVehicle('MH01AB1234');
    const auth = `Bearer ${tokenFor(admin)}`;
    const badLitres = await request(app).post('/api/fuel').set('Authorization', auth)
        .send({ vehicleId: vehicle.id, litres: 0 });
    assert.equal(badLitres.status, 400);
    const badVehicle = await request(app).post('/api/fuel').set('Authorization', auth)
        .send({ vehicleId: 999999, litres: 10 });
    assert.equal(badVehicle.status, 400);
});
// --- Reconciliation report -------------------------------------------------
test('reconciliation flags a vehicle whose actual diesel exceeds expected beyond the variance threshold', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const client = await createClient('Acme');
    // 5 km/l vehicle, no idle burn. 100 km driven => 20 L expected.
    const vehicle = await createVehicle('MH01AB1234', { mileageKmpl: '5.00', idleBurnLph: '0' });
    await createChallan({ vehicleId: vehicle.id, clientId: client.id, odometerStart: 1000, odometerEnd: 1100 });
    // Filled 30 L against 20 L expected => +50% variance, over the default 15%.
    await db.insert(fuelLogs).values({ vehicleId: vehicle.id, litres: '30', filledAt: new Date() });
    const res = await request(app).get('/api/reports/fuel-reconciliation')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const row = res.body.rows.find((r) => r.vehicleId === vehicle.id);
    assert.ok(row, 'the active vehicle appears in the reconciliation');
    assert.equal(row.km, 100);
    assert.equal(row.expectedLitres, 20);
    assert.equal(row.actualLitres, 30);
    assert.equal(row.flagged, true);
});
test('reconciliation does not flag a vehicle running within the variance threshold', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const client = await createClient('Acme');
    const vehicle = await createVehicle('MH02CD5678', { mileageKmpl: '5.00', idleBurnLph: '0' });
    await createChallan({ vehicleId: vehicle.id, clientId: client.id, odometerStart: 2000, odometerEnd: 2100 });
    // 20 L expected, 21 L actual => +5%, under the 15% default.
    await db.insert(fuelLogs).values({ vehicleId: vehicle.id, litres: '21', filledAt: new Date() });
    const res = await request(app).get('/api/reports/fuel-reconciliation')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    const row = res.body.rows.find((r) => r.vehicleId === vehicle.id);
    assert.ok(row);
    assert.equal(row.flagged, false);
});
test('reconciliation reports the fuel report only to staff, never to clients', async () => {
    const client = await createClient('Acme');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const res = await request(app).get('/api/reports/fuel-reconciliation')
        .set('Authorization', `Bearer ${tokenFor(clientUser)}`);
    assert.equal(res.status, 403);
});
// --- Alerts feed -----------------------------------------------------------
test('staff can list open alerts and acknowledge them; ack removes them from the open feed', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const client = await createClient('Acme');
    const driver = await createDriver('Dave');
    const vehicle = await createVehicle('MH03EF9012');
    const challan = await createChallan({ vehicleId: vehicle.id, clientId: client.id, driverId: driver.id });
    const [alert] = await db.insert(vehicleAlerts).values({
        challanId: challan.id, vehicleId: vehicle.id, driverId: driver.id,
        type: 'unscheduled_stop', detail: 'Stopped 25 min away from plant', distanceM: 4200,
    }).returning();
    const auth = `Bearer ${tokenFor(admin)}`;
    const open = await request(app).get('/api/positions/alerts?open=1').set('Authorization', auth);
    assert.equal(open.status, 200);
    assert.equal(open.body.length, 1);
    assert.equal(open.body[0].type, 'unscheduled_stop');
    assert.equal(open.body[0].vehicleNo, 'MH03EF9012');
    assert.equal(open.body[0].driverName, 'Dave');
    const ack = await request(app).post(`/api/positions/alerts/${alert.id}/ack`).set('Authorization', auth);
    assert.equal(ack.status, 200);
    assert.ok(ack.body.acknowledgedAt);
    const afterAck = await request(app).get('/api/positions/alerts?open=1').set('Authorization', auth);
    assert.equal(afterAck.body.length, 0, 'acknowledged alerts drop out of the open feed');
    const all = await request(app).get('/api/positions/alerts').set('Authorization', auth);
    assert.equal(all.body.length, 1, 'but remain in the full feed');
});
test('the alerts feed and acknowledgement are forbidden to clients', async () => {
    const client = await createClient('Acme');
    const clientUser = await createUser('client', 'c@test.com', { linkedClientId: client.id });
    const auth = `Bearer ${tokenFor(clientUser)}`;
    assert.equal((await request(app).get('/api/positions/alerts').set('Authorization', auth)).status, 403);
    assert.equal((await request(app).post('/api/positions/alerts/1/ack').set('Authorization', auth)).status, 403);
});
// --- Admin fuel settings ---------------------------------------------------
test('admin fuel-settings round-trips persisted thresholds and exposes defaults', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const auth = `Bearer ${tokenFor(admin)}`;
    const initial = await request(app).get('/api/admin/fuel-settings').set('Authorization', auth);
    assert.equal(initial.status, 200);
    assert.ok(initial.body.defaults, 'defaults are exposed for placeholder display');
    const saved = await request(app).post('/api/admin/fuel-settings').set('Authorization', auth)
        .send({ reconVariancePct: '10', plantLat: '23.0225', plantLng: '72.5714' });
    assert.equal(saved.status, 200);
    const reread = await request(app).get('/api/admin/fuel-settings').set('Authorization', auth);
    assert.equal(reread.body.reconVariancePct, 10);
    assert.equal(reread.body.plantLat, 23.0225);
    assert.equal(reread.body.plantLng, 72.5714);
});
test('persisted plant variance threshold changes which vehicles get flagged', async () => {
    const admin = await createUser('admin', 'a@test.com');
    const client = await createClient('Acme');
    const vehicle = await createVehicle('MH04GH3456', { mileageKmpl: '5.00', idleBurnLph: '0' });
    await createChallan({ vehicleId: vehicle.id, clientId: client.id, odometerStart: 5000, odometerEnd: 5100 });
    // 20 L expected, 21 L actual => +5%.
    await db.insert(fuelLogs).values({ vehicleId: vehicle.id, litres: '21', filledAt: new Date() });
    // Tighten the threshold below 5% so the same vehicle now trips.
    await setSetting(FUEL_KEYS.reconVariancePct, '2');
    const res = await request(app).get('/api/reports/fuel-reconciliation')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    const row = res.body.rows.find((r) => r.vehicleId === vehicle.id);
    assert.equal(row.flagged, true, 'a 5% overrun is flagged once the threshold is 2%');
});
