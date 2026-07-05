import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, plants, vehicles, drivers, sites, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE challans, sites, clients, drivers, vehicles, users, plants RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
function bearer(u) {
    return `Bearer ${signToken({ id: u.id, email: u.email, role: u.role, name: u.name })}`;
}
async function makeUser(role, email, plantId) {
    const [u] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash: 'x', role, isActive: true, plantId,
    }).returning();
    return u;
}
// Seeds a plant with one dispatched challan (vehicle + driver + site) and
// returns the ids. Each plant gets its own client/site/vehicle/driver so the
// plant-scoping assertions are unambiguous.
async function seedPlantWithTruck(tag, lat, lng) {
    const [plant] = await db.insert(plants).values({
        name: `Plant ${tag}`, latitude: lat, longitude: lng, openTime: null, closeTime: null,
    }).returning();
    const [client] = await db.insert(clients).values({
        name: `Client ${tag}`, contactPerson: tag, phone: `90000000${tag}`,
    }).returning();
    const [site] = await db.insert(sites).values({
        clientId: client.id, name: `Site ${tag}`, latitude: lat, longitude: lng,
    }).returning();
    const [vehicle] = await db.insert(vehicles).values({
        vehicleNo: `TM-${tag}`, capacity: '6.00', plantId: plant.id,
    }).returning();
    const [driver] = await db.insert(drivers).values({
        name: `Driver ${tag}`, phone: `80000000${tag}`,
    }).returning();
    const [challan] = await db.insert(challans).values({
        challanNo: `CH-${tag}`, plantId: plant.id, clientId: client.id, siteId: site.id,
        vehicleId: vehicle.id, driverId: driver.id, grade: 'M25', quantity: '6.00',
        status: 'dispatched',
    }).returning();
    return { plant, vehicle, challan };
}
test('live-fleet-map: Super Admin sees every plant, a plant admin only their own', async () => {
    const a = await seedPlantWithTruck('A', '19.0000000', '73.0000000');
    const b = await seedPlantWithTruck('B', '18.5000000', '73.8000000');
    const superAdmin = await makeUser('authority', 'super@test.com', null);
    const adminA = await makeUser('admin', 'admin-a@test.com', a.plant.id);
    const asSuper = await request(app).get('/api/live-fleet-map').set('Authorization', bearer(superAdmin));
    assert.equal(asSuper.status, 200);
    const superVehicles = asSuper.body.map(t => t.vehicleNo).sort();
    assert.deepEqual(superVehicles, ['TM-A', 'TM-B']);
    const asAdminA = await request(app).get('/api/live-fleet-map').set('Authorization', bearer(adminA));
    assert.equal(asAdminA.status, 200);
    const adminVehicles = asAdminA.body;
    assert.equal(adminVehicles.length, 1);
    assert.equal(adminVehicles[0].vehicleNo, 'TM-A');
    assert.equal(adminVehicles[0].plantId, a.plant.id);
    // The other plant's truck must never leak through.
    assert.ok(!adminVehicles.some(t => t.vehicleNo === 'TM-B'));
    void b;
});
test('live-fleet-map: a plant-scoped staffer with no plant fails closed (empty)', async () => {
    await seedPlantWithTruck('A', '19.0000000', '73.0000000');
    // An admin whose account is not yet bound to a plant must see nothing rather
    // than every plant's trucks — the scoping branch fails closed.
    const unboundAdmin = await makeUser('admin', 'unbound@test.com', null);
    const res = await request(app).get('/api/live-fleet-map').set('Authorization', bearer(unboundAdmin));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
});
test('live-fleet-map: drivers and clients are rejected', async () => {
    const [client] = await db.insert(clients).values({ name: 'C', contactPerson: 'C', phone: '911' }).returning();
    const clientUser = await makeUser('client', 'client@test.com', null);
    await db.update(users).set({ linkedClientId: client.id }).where(sql `${users.id} = ${clientUser.id}`);
    const driverUser = await makeUser('driver', 'driver@test.com', null);
    const asClient = await request(app).get('/api/live-fleet-map').set('Authorization', bearer(clientUser));
    assert.equal(asClient.status, 403);
    const asDriver = await request(app).get('/api/live-fleet-map').set('Authorization', bearer(driverUser));
    assert.equal(asDriver.status, 403);
});
test('plant-network-map: Super Admin only', async () => {
    await seedPlantWithTruck('A', '19.0000000', '73.0000000');
    await seedPlantWithTruck('B', '18.5000000', '73.8000000');
    const superAdmin = await makeUser('authority', 'super2@test.com', null);
    const asSuper = await request(app).get('/api/plant-network-map').set('Authorization', bearer(superAdmin));
    assert.equal(asSuper.status, 200);
    assert.equal(asSuper.body.length, 2);
    const admin = await makeUser('admin', 'admin2@test.com', 1);
    const owner = await makeUser('plant_owner', 'owner@test.com', 1);
    assert.equal((await request(app).get('/api/plant-network-map').set('Authorization', bearer(admin))).status, 403);
    assert.equal((await request(app).get('/api/plant-network-map').set('Authorization', bearer(owner))).status, 403);
});
