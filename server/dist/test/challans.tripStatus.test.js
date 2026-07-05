import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans, tripSessions } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { createTripSessionForChallan } from '../lib/tripSessions.js';
import { createTrackingToken } from '../lib/trackingTokens.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';
let app;
const PASSWORD = 'secret123';
async function createDriverUser(name, email) {
    const passwordHash = await hashPassword(PASSWORD);
    const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
    const [user] = await db.insert(users).values({
        name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
    }).returning();
    return { user, driver };
}
async function createAdminUser(email) {
    const passwordHash = await hashPassword(PASSWORD);
    const [user] = await db.insert(users).values({
        name: 'Admin', email, passwordHash, role: 'admin', isActive: true,
    }).returning();
    return user;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
let challanSeq = 0;
async function createChallan(opts) {
    challanSeq += 1;
    const [row] = await db.insert(challans).values({
        challanNo: `CH-TS${String(challanSeq).padStart(4, '0')}`,
        clientId: opts.clientId,
        driverId: opts.driverId,
        grade: 'M25',
        quantity: '6.00',
        status: opts.status ?? 'dispatched',
        dispatchTime: new Date(),
    }).returning();
    return row;
}
async function createClient() {
    const [row] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
    }).returning();
    return row;
}
function captureSSE() {
    const raw = [];
    const mockRes = {
        writableEnded: false, destroyed: false, req: { httpVersionMajor: 2 },
        setHeader() { }, flushHeaders() { },
        write(payload) { raw.push(payload); return true; },
        end() { mockRes.writableEnded = true; },
    };
    const id = addSSEClient(mockRes);
    return {
        events() {
            return raw.map((c) => /^event: (.+)$/m.exec(c)?.[1]).filter((e) => Boolean(e));
        },
        close() { removeSSEClient(id); },
    };
}
before(() => { app = buildTestApp(); });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE trip_sessions, tracking_tokens, challans, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
let sse = null;
afterEach(() => { if (sse) {
    sse.close();
    sse = null;
} });
after(async () => { await pool.end(); });
test('driver advances their trip forward through the stages and it persists + emits trip.updated', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    sse = captureSSE();
    for (const status of ['in_transit', 'reached_site', 'unloading']) {
        const res = await request(app)
            .post(`/api/challans/${challan.id}/trip-status`)
            .set('Authorization', `Bearer ${tokenFor(user)}`)
            .send({ status });
        assert.equal(res.status, 200, `advancing to ${status} succeeds`);
    }
    const [row] = await db.select({ status: tripSessions.status })
        .from(tripSessions).where(eq(tripSessions.challanId, challan.id));
    assert.equal(row.status, 'unloading', 'the session persists the latest stage');
    assert.ok(sse.events().includes('trip.updated'), 'trip.updated SSE is emitted');
});
test('reaching the site stamps the challan siteArrivalTime once', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    const res = await request(app)
        .post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'reached_site' });
    assert.equal(res.status, 200);
    const [row] = await db.select({ siteArrivalTime: challans.siteArrivalTime })
        .from(challans).where(eq(challans.id, challan.id));
    assert.ok(row.siteArrivalTime instanceof Date, 'siteArrivalTime is stamped on reached_site');
});
test('a backward trip-status move is rejected 409 and does not regress the session', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'reached_site' });
    const back = await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'in_transit' });
    assert.equal(back.status, 409);
    assert.match(back.body.error, /backwards/i);
    const [row] = await db.select({ status: tripSessions.status })
        .from(tripSessions).where(eq(tripSessions.challanId, challan.id));
    assert.equal(row.status, 'reached_site', 'the session keeps its forward stage');
});
test('a driver cannot advance a trip on a challan not assigned to them (403)', async () => {
    const client = await createClient();
    const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
    const { driver: other } = await createDriverUser('Other Driver', 'other@test.com');
    const challan = await createChallan({ driverId: other.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    const res = await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'in_transit' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /not assigned/i);
});
test('an invalid trip-status value is rejected 400', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    const res = await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'delivered' });
    assert.equal(res.status, 400, 'delivered is a terminal path, not a driver stage');
});
test('advancing a trip after delivery is rejected 409 (trip closed)', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    await createTripSessionForChallan(challan.id);
    // Deliver via the driver PUT path, which closes the trip session.
    const del = await request(app).put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'delivered' });
    assert.equal(del.status, 200);
    const res = await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'unloading' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already completed/i);
});
test('public tracking payload exposes the finer trip status and stays open mid-trip', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'in_transit' });
    const raw = await createTrackingToken(challan.id, null, null);
    const res = await request(app).get(`/api/track/${raw}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.tripStatus, 'in_transit', 'the finer trip status is surfaced');
    assert.equal(res.body.closed, false, 'tracking stays open while the trip is live');
});
test('public tracking payload closes after delivery', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    await createTripSessionForChallan(challan.id);
    const raw = await createTrackingToken(challan.id, null, null);
    await request(app).put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'delivered' });
    const res = await request(app).get(`/api/track/${raw}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.closed, true, 'tracking closes once delivered');
    assert.equal(res.body.freshness, null, 'no live countdown once closed');
});
test('the staff live-drivers board lists a checked-in driver with their open trip status', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const admin = await createAdminUser('admin@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id });
    await createTripSessionForChallan(challan.id);
    // Driver checks in, then advances their trip.
    const ci = await request(app).post('/api/attendance/check-in')
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({});
    assert.ok(ci.status === 200 || ci.status === 201, 'driver check-in succeeds');
    await request(app).post(`/api/challans/${challan.id}/trip-status`)
        .set('Authorization', `Bearer ${tokenFor(user)}`).send({ status: 'in_transit' });
    const res = await request(app).get('/api/attendance/live')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    const me = res.body.drivers.find((d) => d.userId === user.id);
    assert.ok(me, 'the checked-in driver appears on the live board');
    assert.equal(me.status, 'in_transit', 'the live board reflects the open trip stage');
});
test('a driver cannot read the staff live-drivers board (403)', async () => {
    const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
    const res = await request(app).get('/api/attendance/live')
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(res.status, 403);
});
test('a GPS-inactive driver keeps their board row but their stale fix expires', async () => {
    const prev = process.env.LIVE_GPS_STALE_MS;
    process.env.LIVE_GPS_STALE_MS = '10';
    try {
        const { user } = await createDriverUser('Gus Driver', 'gus@test.com');
        const admin = await createAdminUser('boss@test.com');
        const ci = await request(app).post('/api/attendance/check-in')
            .set('Authorization', `Bearer ${tokenFor(user)}`).send({});
        assert.ok(ci.status === 200 || ci.status === 201, 'driver check-in succeeds');
        const loc = await request(app).post('/api/attendance/location')
            .set('Authorization', `Bearer ${tokenFor(user)}`).send({ lat: 12.9, lng: 77.5 });
        assert.equal(loc.status, 200, 'a live fix is accepted while checked in');
        // Let the fix age past the (10ms) stale window.
        await new Promise((r) => setTimeout(r, 40));
        const res = await request(app).get('/api/attendance/live')
            .set('Authorization', `Bearer ${tokenFor(admin)}`);
        assert.equal(res.status, 200);
        const me = res.body.drivers.find((d) => d.userId === user.id);
        assert.ok(me, 'the driver stays on the board (still checked in)');
        assert.equal(me.location, null, 'the stale GPS fix no longer shows as a live location');
    }
    finally {
        if (prev === undefined)
            delete process.env.LIVE_GPS_STALE_MS;
        else
            process.env.LIVE_GPS_STALE_MS = prev;
    }
});
