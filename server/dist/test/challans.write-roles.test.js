import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, vehicles, challans } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';
let app;
const PASSWORD = 'secret123';
// Creates a user of an arbitrary role. The write-role branch of PUT /:id keys
// off req.user.role only (no profile lookup), so a plain user row is enough.
async function createUser(role, email) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [user] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role, isActive: true,
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
        challanNo: `CH-W${String(challanSeq).padStart(4, '0')}`,
        clientId: opts.clientId,
        driverId: opts.driverId ?? null,
        vehicleId: opts.vehicleId ?? null,
        grade: 'M25',
        quantity: '6.00',
        status: opts.status ?? 'dispatched',
        notes: opts.notes ?? null,
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
async function createDriver(name) {
    const [row] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
    return row;
}
async function createVehicle(vehicleNo) {
    const [row] = await db.insert(vehicles).values({ vehicleNo, capacity: '6.00' }).returning();
    return row;
}
// Captures SSE events broadcast via emitSSEEvent by registering a fake client
// against the real emitter. Returns the parsed event names so tests can assert
// that challan.updated is (or is not) emitted.
function captureSSE() {
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
    const id = addSSEClient(mockRes);
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
    await db.execute(sql `TRUNCATE TABLE challans, drivers, vehicles, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});
let sse = null;
afterEach(() => {
    if (sse) {
        sse.close();
        sse = null;
    }
});
after(async () => {
    await pool.end();
});
for (const role of ['admin', 'dispatcher']) {
    test(`${role} can update a challan's status/fields and emits challan.updated`, async () => {
        const client = await createClient();
        const driver = await createDriver('Assigned Driver');
        const vehicle = await createVehicle('GJ-01-AB-1234');
        const actor = await createUser(role, `${role}@test.com`);
        const challan = await createChallan({ clientId: client.id, status: 'pending' });
        sse = captureSSE();
        const res = await request(app)
            .put(`/api/challans/${challan.id}`)
            .set('Authorization', `Bearer ${tokenFor(actor)}`)
            .send({
            status: 'dispatched',
            vehicleId: vehicle.id,
            driverId: driver.id,
            notes: 'Reassigned by dispatch desk',
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'dispatched');
        const [row] = await db.select({
            status: challans.status,
            vehicleId: challans.vehicleId,
            driverId: challans.driverId,
            notes: challans.notes,
        }).from(challans).where(eq(challans.id, challan.id));
        assert.equal(row.status, 'dispatched');
        assert.equal(row.vehicleId, vehicle.id, 'vehicle reassignment persisted');
        assert.equal(row.driverId, driver.id, 'driver reassignment persisted');
        assert.equal(row.notes, 'Reassigned by dispatch desk', 'notes overwritten as supplied');
        assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted on a write-role update');
    });
    test(`${role} editing a challan's note overwrites the existing note (not append) and emits challan.updated`, async () => {
        const client = await createClient();
        const actor = await createUser(role, `${role}@test.com`);
        const challan = await createChallan({
            clientId: client.id, status: 'dispatched', notes: 'Dispatched at 9am',
        });
        sse = captureSSE();
        const res = await request(app)
            .put(`/api/challans/${challan.id}`)
            .set('Authorization', `Bearer ${tokenFor(actor)}`)
            .send({ notes: 'Corrected delivery note' });
        assert.equal(res.status, 200);
        assert.equal(res.body.notes, 'Corrected delivery note', 'the dispatcher/admin note edit overwrites, it does not append to the old note');
        const [row] = await db.select({ notes: challans.notes })
            .from(challans).where(eq(challans.id, challan.id));
        assert.equal(row.notes, 'Corrected delivery note', 'overwritten note is persisted (no newline append)');
        assert.ok(!row.notes?.includes('Dispatched at 9am'), 'the original note is gone, confirming overwrite-not-append semantics');
        assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted on a note edit');
    });
    test(`${role} marking a challan delivered stamps deliveryTime`, async () => {
        const client = await createClient();
        const actor = await createUser(role, `${role}@test.com`);
        const challan = await createChallan({ clientId: client.id, status: 'dispatched' });
        sse = captureSSE();
        const res = await request(app)
            .put(`/api/challans/${challan.id}`)
            .set('Authorization', `Bearer ${tokenFor(actor)}`)
            .send({ status: 'delivered' });
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'delivered');
        assert.ok(res.body.deliveryTime, 'deliveryTime is returned on delivery');
        const [row] = await db.select({ status: challans.status, deliveryTime: challans.deliveryTime })
            .from(challans).where(eq(challans.id, challan.id));
        assert.equal(row.status, 'delivered');
        assert.ok(row.deliveryTime instanceof Date, 'deliveryTime persisted on delivery');
        assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted');
    });
}
for (const role of ['client', 'plant_operator']) {
    test(`${role} attempting to update a challan gets 403 and changes nothing`, async () => {
        const client = await createClient();
        const actor = await createUser(role, `${role}@test.com`);
        const challan = await createChallan({
            clientId: client.id, status: 'dispatched', notes: 'Original note',
        });
        sse = captureSSE();
        const res = await request(app)
            .put(`/api/challans/${challan.id}`)
            .set('Authorization', `Bearer ${tokenFor(actor)}`)
            .send({ status: 'cancelled', notes: 'Tampered note' });
        assert.equal(res.status, 403);
        assert.match(res.body.error, /forbidden/i);
        const [row] = await db.select({ status: challans.status, notes: challans.notes })
            .from(challans).where(eq(challans.id, challan.id));
        assert.equal(row.status, 'dispatched', 'status is unchanged after a forbidden write');
        assert.equal(row.notes, 'Original note', 'notes are unchanged after a forbidden write');
        assert.ok(!sse.events().includes('challan.updated'), 'no SSE event is emitted on a forbidden update');
    });
}
