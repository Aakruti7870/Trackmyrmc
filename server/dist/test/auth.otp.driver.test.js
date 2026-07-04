import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq, and, isNull } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, vehicles, plants, otpCodes, rateLimitHits } from '../db/schema.js';
let app;
before(() => {
    // Rely on the dev OTP fallback: strip any provider creds a stray env var set.
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    delete process.env.WHATSAPP_META_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_META_ACCESS_TOKEN;
    app = buildTestApp();
});
beforeEach(async () => {
    await db.delete(otpCodes);
    await db.delete(rateLimitHits);
    // Order matters: users reference clients/drivers; vehicles reference drivers.
    await db.delete(users).where(sql `${users.email} LIKE 'otp_%@otp.local' OR ${users.email} LIKE 'driver_%@otp.local'`);
    await db.delete(vehicles).where(sql `${vehicles.vehicleNo} LIKE 'DRVTEST-%'`);
    await db.delete(drivers).where(sql `${drivers.phone} LIKE '%55500%'`);
    await db.delete(clients).where(sql `${clients.phone} LIKE '+91%'`);
});
after(async () => {
    await pool.end();
});
function send(body) {
    return request(app).post('/api/auth/otp/send').send(body);
}
function verify(body) {
    return request(app).post('/api/auth/otp/verify').send(body);
}
test('an active driver signs in as role driver, not customer', async () => {
    const phone = '+919000555001';
    const [plant] = await db.insert(plants).values({
        name: 'Driver Test Plant', plantCode: 'DRVTP1',
        latitude: '19.0000000', longitude: '72.0000000',
    }).returning();
    // Driver phone stored in a raw local format to prove last-10-digit matching.
    const [driver] = await db.insert(drivers).values({
        name: 'Suresh Driver', phone: '9000555001', isActive: true,
    }).returning();
    const [truck] = await db.insert(vehicles).values({
        plantId: plant.id, vehicleNo: 'DRVTEST-01', capacity: '6.00', driverId: driver.id,
    }).returning();
    const sent = await send({ phone });
    const res = await verify({ phone, code: sent.body.devCode });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'driver');
    assert.equal(res.body.user.linkedDriverId, driver.id);
    assert.equal(res.body.user.plantId, plant.id, 'plant derived from assigned truck');
    assert.equal(res.body.user.truckId, truck.id);
    assert.equal(res.body.user.truckNo, 'DRVTEST-01');
    // A linked driver login was created; NO customer/client row was minted.
    const [u] = await db.select().from(users)
        .where(and(eq(users.linkedDriverId, driver.id), isNull(users.deletedAt)));
    assert.ok(u, 'driver login persisted');
    assert.equal(u.role, 'driver');
    assert.equal(u.phone, null, 'driver login keeps users.phone NULL');
    assert.match(u.email, /^driver_\d+@otp\.local$/);
    const custRows = await db.select().from(users).where(eq(users.phone, phone));
    assert.equal(custRows.length, 0, 'no customer account created for a driver number');
});
test('a returning driver reuses the same login', async () => {
    const phone = '+919000555002';
    const [driver] = await db.insert(drivers).values({
        name: 'Repeat Driver', phone: '+919000555002', isActive: true,
    }).returning();
    const s1 = await send({ phone });
    const r1 = await verify({ phone, code: s1.body.devCode });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.user.role, 'driver');
    const s2 = await send({ phone });
    const r2 = await verify({ phone, code: s2.body.devCode });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.user.id, r1.body.user.id, 'same driver login on repeat');
    const rows = await db.select().from(users)
        .where(and(eq(users.linkedDriverId, driver.id), isNull(users.deletedAt)));
    assert.equal(rows.length, 1, 'no duplicate driver login created');
});
test('an inactive driver falls through to a customer account', async () => {
    const phone = '+919000555003';
    await db.insert(drivers).values({
        name: 'Retired Driver', phone: '9000555003', isActive: false,
    }).returning();
    const sent = await send({ phone });
    const res = await verify({ phone, code: sent.body.devCode });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'client', 'inactive driver is not a driver login');
    assert.equal(res.body.user.phone, phone);
});
