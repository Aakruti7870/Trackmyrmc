import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
let app;
const PASSWORD = 'secret123';
// Base coordinates for the seeded verified plant (Navi Mumbai).
const BASE_LAT = 19.033;
const BASE_LNG = 73.0297;
// At ~19°N, 1° of latitude ≈ 111 km, so 0.001° ≈ 111 m and 0.005° ≈ 555 m.
// The server's near-duplicate radius (DUPE_KM) is 0.3 km (300 m).
const INSIDE_LAT = BASE_LAT + 0.001; // ~111 m away  -> inside the 300 m radius
const OUTSIDE_LAT = BASE_LAT + 0.005; // ~555 m away  -> outside the 300 m radius
// Company details required to create/verify a plant (mirror missingVerifyFields).
const COMPANY = {
    legalName: 'Acme Infra Pvt Ltd',
    gstNo: '27AAKCK0001A1Z5',
    contactNumber: '9820011001',
    email: 'acme@example.com',
};
async function createPlatformAdmin() {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: 'Platform Admin',
        email: 'admin@test.com',
        passwordHash,
        role: 'admin',
        // plantId left null => platform staff (passes platformStaffOnly guard).
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function seedVerifiedPlant() {
    const [row] = await db.insert(plants).values({
        name: 'Original Verified Plant',
        latitude: BASE_LAT.toFixed(7),
        longitude: BASE_LNG.toFixed(7),
        plantStatus: 'approved',
        isActive: true,
        locationVerified: true,
        verified: true,
        deliveryRadiusKm: 40,
        grades: ['M-20', 'M-25'],
        openTime: '06:00',
        closeTime: '21:00',
        legalName: COMPANY.legalName,
        gstNo: COMPANY.gstNo,
        contactNumber: COMPANY.contactNumber,
        email: COMPANY.email,
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
test('POST /plants rejects a verified plant created within the near-duplicate radius', async () => {
    const admin = await createPlatformAdmin();
    const existing = await seedVerifiedPlant();
    const res = await request(app)
        .post('/api/plants')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({
        name: 'Too Close Plant',
        latitude: INSIDE_LAT.toFixed(7),
        longitude: BASE_LNG.toFixed(7),
        verified: true,
        ...COMPANY,
        email: 'tooclose@example.com',
    });
    assert.equal(res.status, 409, 'a pin within 300 m of a verified plant must be blocked');
    assert.equal(res.body.duplicatePlantId, existing.id);
    assert.equal(res.body.duplicatePlantName, existing.name);
    assert.match(res.body.error, /similar location/);
    // No second plant should have been persisted.
    const all = await db.select().from(plants);
    assert.equal(all.length, 1, 'the near-duplicate plant must not have been inserted');
});
test('POST /plants accepts a verified plant just outside the near-duplicate radius', async () => {
    const admin = await createPlatformAdmin();
    await seedVerifiedPlant();
    const res = await request(app)
        .post('/api/plants')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({
        name: 'Far Enough Plant',
        latitude: OUTSIDE_LAT.toFixed(7),
        longitude: BASE_LNG.toFixed(7),
        verified: true,
        ...COMPANY,
        email: 'farenough@example.com',
    });
    assert.equal(res.status, 201, 'a pin beyond 300 m must be accepted');
    assert.equal(res.body.verified, true);
    const all = await db.select().from(plants);
    assert.equal(all.length, 2, 'both the original and the new plant must exist');
});
test('PUT /plants/:id does not flag a verified plant against its own coordinates', async () => {
    const admin = await createPlatformAdmin();
    const existing = await seedVerifiedPlant();
    // Re-saving the plant at its own (unchanged) coordinates must not trip the
    // near-duplicate guard — a plant must never flag itself.
    const res = await request(app)
        .put(`/api/plants/${existing.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({
        verified: true,
        latitude: BASE_LAT.toFixed(7),
        longitude: BASE_LNG.toFixed(7),
        ...COMPANY,
    });
    assert.equal(res.status, 200, 'editing a plant to its own coordinates must not 409');
    assert.equal(res.body.id, existing.id);
    assert.equal(res.body.verified, true);
});
