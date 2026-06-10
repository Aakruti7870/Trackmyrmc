import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient, getSSEClientCount, } from '../lib/sseEmitter.js';
let app;
const PASSWORD = 'secret123';
// A driver-role user is authorized for POST /api/positions only when it has a
// linkedDriverId (the route reads req.user.linkedDriverId and 403s without it),
// and the challan it reports on must reference that same drivers.id.
async function createDriverUser(name, email) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
    const [user] = await db.insert(users).values({
        name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
    }).returning();
    return { user, driver };
}
async function createClient(name) {
    const [row] = await db.insert(clients).values({
        name, contactPerson: 'Contact', phone: '1112223333',
    }).returning();
    return row;
}
let challanSeq = 0;
async function createChallan(opts) {
    challanSeq += 1;
    const [row] = await db.insert(challans).values({
        challanNo: `CH-P${String(challanSeq).padStart(4, '0')}`,
        clientId: opts.clientId,
        driverId: opts.driverId,
        grade: 'M25',
        quantity: '6.00',
        status: 'dispatched',
        dispatchTime: new Date(),
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// A fake SSE connection registered against the real emitter with a given
// identity, so we can observe exactly which roles a live position reaches when
// it is emitted by the positions route (not by the test directly).
function captureSSE(identity) {
    const raw = [];
    const mockRes = {
        writableEnded: false,
        destroyed: false,
        req: { httpVersionMajor: 2 },
        setHeader() { },
        flushHeaders() { },
        write(payload) { raw.push(payload); return true; },
        end() { mockRes.writableEnded = true; },
    };
    const id = addSSEClient(mockRes, identity);
    return {
        id,
        events() {
            return raw
                .map((chunk) => /^event: (.+)$/m.exec(chunk)?.[1])
                .filter((e) => Boolean(e));
        },
        close() { removeSSEClient(id); },
    };
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE challans, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
    assert.equal(getSSEClientCount(), 0, 'no SSE clients should be registered between tests');
});
const openStreams = [];
afterEach(() => {
    for (const s of openStreams)
        s.close();
    openStreams.length = 0;
    assert.equal(getSSEClientCount(), 0, 'all SSE clients should be cleaned up between tests');
});
after(async () => {
    await pool.end();
});
test('a driver GPS fix reaches only the owning client, the assigned driver, and staff', async () => {
    const ownClient = await createClient('Acme Co');
    const otherClient = await createClient('Rival Co');
    const { user: driverUser, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const { driver: otherDriver } = await createDriverUser('Olga Other', 'olga@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: ownClient.id });
    // Listeners for every audience class that the route's scoping must separate.
    const owningClientSse = captureSSE({ role: 'client', clientId: ownClient.id });
    const otherClientSse = captureSSE({ role: 'client', clientId: otherClient.id });
    const assignedDriverSse = captureSSE({ role: 'driver', driverId: driver.id });
    const otherDriverSse = captureSSE({ role: 'driver', driverId: otherDriver.id });
    const adminSse = captureSSE({ role: 'admin' });
    const dispatcherSse = captureSSE({ role: 'dispatcher' });
    const operatorSse = captureSSE({ role: 'plant_operator' });
    openStreams.push(owningClientSse, otherClientSse, assignedDriverSse, otherDriverSse, adminSse, dispatcherSse, operatorSse);
    // The driver POSTs a real GPS fix through the route. No site coordinates are
    // set on the challan, so no geofence auto-delivery occurs — only the live
    // vehicle.position event is emitted, scoped to this challan's client/driver.
    const res = await request(app)
        .post('/api/positions')
        .set('Authorization', `Bearer ${tokenFor(driverUser)}`)
        .send({ challanId: challan.id, lat: 19.07, lng: 72.87, accuracy: 10 });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.delivered, false, 'no geofence delivery without site coordinates');
    // The owning client and the assigned driver each see exactly one position.
    assert.ok(owningClientSse.events().includes('vehicle.position'), 'the owning client receives the live truck position');
    assert.ok(assignedDriverSse.events().includes('vehicle.position'), 'the assigned driver receives the live truck position');
    // A different company and an unassigned driver must never see it.
    assert.ok(!otherClientSse.events().includes('vehicle.position'), "another company's client must NOT see the live truck position");
    assert.ok(!otherDriverSse.events().includes('vehicle.position'), 'an unassigned driver must NOT see the live truck position');
    // Every staff role still receives it for the control-room map.
    for (const [name, observer] of [
        ['admin', adminSse], ['dispatcher', dispatcherSse], ['operator', operatorSse],
    ]) {
        assert.ok(observer.events().includes('vehicle.position'), `${name} must receive every truck position for the live map`);
    }
});
test('a driver reporting a challan not assigned to them is rejected and emits nothing', async () => {
    const ownClient = await createClient('Acme Co');
    const { user: driverUser } = await createDriverUser('Dave Driver', 'dave@test.com');
    const { driver: otherDriver } = await createDriverUser('Olga Other', 'olga@test.com');
    // The challan belongs to a different driver, so Dave must not be able to
    // report a position for it, and no listener should receive anything.
    const challan = await createChallan({ driverId: otherDriver.id, clientId: ownClient.id });
    const clientSse = captureSSE({ role: 'client', clientId: ownClient.id });
    const adminSse = captureSSE({ role: 'admin' });
    openStreams.push(clientSse, adminSse);
    const res = await request(app)
        .post('/api/positions')
        .set('Authorization', `Bearer ${tokenFor(driverUser)}`)
        .send({ challanId: challan.id, lat: 19.07, lng: 72.87, accuracy: 10 });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /not assigned/i);
    assert.ok(!clientSse.events().includes('vehicle.position'), 'no position is emitted for a rejected report');
    assert.ok(!adminSse.events().includes('vehicle.position'), 'staff also receive nothing for a rejected report');
});
