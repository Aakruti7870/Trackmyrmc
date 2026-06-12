import { test, before, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, drivers, challans, challanProofPhotos } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';
let app;
const PASSWORD = 'secret123';
// A driver user authenticates by role AND matches a drivers row by *name*
// (see the driver branch in routes/challans.ts), so the user.name and the
// drivers.name must be identical for the profile lookup to succeed.
async function createDriverUser(name, email) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [driver] = await db.insert(drivers).values({ name, phone: '0000000000' }).returning();
    const [user] = await db.insert(users).values({
        name, email, passwordHash, role: 'driver', isActive: true, linkedDriverId: driver.id,
    }).returning();
    return { user, driver };
}
// Challan deletion is a write-role action (admin/dispatcher), so the proof-photo
// cleanup tests below act as an admin while still assigning a driver to the row.
async function createWriteRoleUser(email) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [user] = await db.insert(users).values({
        name: 'Dispatch Admin', email, passwordHash, role: 'admin', isActive: true,
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
        challanNo: `CH-T${String(challanSeq).padStart(4, '0')}`,
        clientId: opts.clientId,
        driverId: opts.driverId,
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
    await db.execute(sql `TRUNCATE TABLE challan_proof_photos, challans, drivers, clients, audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
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
test('driver delivering their own dispatched challan succeeds and emits challan.updated', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    sse = captureSSE();
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'delivered');
    assert.ok(res.body.deliveryTime, 'deliveryTime is stamped on delivery');
    const [row] = await db.select({ status: challans.status, deliveryTime: challans.deliveryTime })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'delivered');
    assert.ok(row.deliveryTime instanceof Date, 'deliveryTime persisted');
    assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted on successful delivery');
});
test('driver delivery records the actual delivered quantity on the challan', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    sse = captureSSE();
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', deliveredQuantity: '5.5' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'delivered');
    const [row] = await db.select({ deliveredQuantity: challans.deliveredQuantity })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(Number(row.deliveredQuantity), 5.5, 'delivered quantity is persisted');
});
test('driver delivery with a negative delivered quantity is rejected', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', deliveredQuantity: '-2' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /non-negative/i);
    const [row] = await db.select({ status: challans.status, deliveredQuantity: challans.deliveredQuantity })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'dispatched', 'the challan is not marked delivered on a bad quantity');
    assert.equal(row.deliveredQuantity, null, 'no delivered quantity is stored');
});
test('driver delivering a challan NOT assigned to them gets 403 and changes nothing', async () => {
    const client = await createClient();
    const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
    const { driver: otherDriver } = await createDriverUser('Other Driver', 'other@test.com');
    const challan = await createChallan({ driverId: otherDriver.id, clientId: client.id, status: 'dispatched' });
    sse = captureSSE();
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /not assigned/i);
    const [row] = await db.select({ status: challans.status })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'dispatched', "another driver's challan is untouched");
    assert.ok(!sse.events().includes('challan.updated'), 'no SSE event is emitted on a rejected delivery');
});
test('driver attempting any status other than delivered gets 403', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    sse = captureSSE();
    for (const status of ['cancelled', 'pending', 'dispatched']) {
        const res = await request(app)
            .put(`/api/challans/${challan.id}`)
            .set('Authorization', `Bearer ${tokenFor(user)}`)
            .send({ status });
        assert.equal(res.status, 403, `status='${status}' must be rejected`);
        assert.match(res.body.error, /only mark challans as delivered/i);
    }
    const [row] = await db.select({ status: challans.status })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'dispatched', 'the challan keeps its original status');
    assert.ok(!sse.events().includes('challan.updated'), 'no SSE event is emitted for a rejected status');
});
test('driver adds a delivery note when delivering and it is persisted', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    sse = captureSSE();
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', notes: '  Delivered to gate B  ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'delivered');
    assert.equal(res.body.notes, 'Delivered to gate B', 'note is trimmed and returned');
    const [row] = await db.select({ notes: challans.notes })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.notes, 'Delivered to gate B', 'note is persisted');
    assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted');
});
test('driver delivery note is newline-appended to an existing dispatch note', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({
        driverId: driver.id, clientId: client.id, status: 'dispatched',
        notes: 'Dispatched at 9am',
    });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', notes: 'Received by site engineer' });
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, 'Dispatched at 9am\nReceived by site engineer', 'the delivery note is appended after the existing note, not overwriting it');
    const [row] = await db.select({ notes: challans.notes })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.notes, 'Dispatched at 9am\nReceived by site engineer', 'appended note persisted');
});
test('driver delivering with an empty/whitespace note leaves an existing note untouched', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({
        driverId: driver.id, clientId: client.id, status: 'dispatched',
        notes: 'Dispatched at 9am',
    });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', notes: '   ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.notes, 'Dispatched at 9am', 'a blank note is ignored, existing note kept');
    const [row] = await db.select({ notes: challans.notes })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.notes, 'Dispatched at 9am', 'existing note unchanged in DB');
});
test('a note sent to an unassigned challan is rejected and never written', async () => {
    const client = await createClient();
    const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
    const { driver: otherDriver } = await createDriverUser('Other Driver', 'other@test.com');
    const challan = await createChallan({
        driverId: otherDriver.id, clientId: client.id, status: 'dispatched',
        notes: 'Dispatched at 9am',
    });
    sse = captureSSE();
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', notes: 'Sneaky note' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /not assigned/i);
    const [row] = await db.select({ notes: challans.notes })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.notes, 'Dispatched at 9am', "another driver's note is untouched");
    assert.ok(!sse.events().includes('challan.updated'), 'no SSE event on a rejected delivery');
});
// A minimal but valid 1x1 transparent PNG as an image data URL.
const VALID_PROOF_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
async function proofPhotoCount(challanId) {
    const rows = await db.select({ id: challanProofPhotos.id })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challanId));
    return rows.length;
}
test('driver delivery with a single proof photo uploads it to object storage; the child table keeps only the entity path, detail returns a signed URL, list returns only the flag', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    sse = captureSSE();
    // Stub object storage in place: store() records the uploaded data URL and
    // returns an entity path; resolve() turns that path into a signed URL. This
    // keeps the test deterministic and avoids needing the storage sidecar.
    const OBJECT_PATH = '/objects/uploads/test-proof';
    const SIGNED_URL = 'https://storage.example/signed-proof';
    let uploaded = null;
    const storeMock = t.mock.method(proofPhotoStore, 'store', async (dataUrl) => {
        uploaded = dataUrl;
        return OBJECT_PATH;
    });
    t.mock.method(proofPhotoStore, 'resolve', async (stored) => stored === OBJECT_PATH ? SIGNED_URL : (stored ?? null));
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [VALID_PROOF_PHOTO] });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'delivered');
    assert.equal(res.body.hasProofPhoto, true, 'response reports the boolean flag');
    // The base64 data URL is handed to object storage, not the database.
    assert.equal(storeMock.mock.callCount(), 1, 'the photo is uploaded exactly once');
    assert.equal(uploaded, VALID_PROOF_PHOTO, 'the original data URL is uploaded to object storage');
    // The child table persists only the lightweight entity path, never the base64 payload.
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id));
    assert.deepEqual(rows.map(r => r.photo), [OBJECT_PATH], 'the child table stores the object-storage entity path');
    // GET /:id (detail) resolves each entity path to a signed URL for viewing.
    const detail = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.proofPhotos, [SIGNED_URL], 'detail endpoint exposes resolved signed URLs');
    assert.equal(detail.body.hasProofPhoto, true, 'detail also reports the boolean flag');
    // GET / (list) returns only hasProofPhoto, never the photo payload/path.
    const list = await request(app)
        .get('/api/challans')
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(list.status, 200);
    const listed = list.body.find((c) => c.id === challan.id);
    assert.ok(listed, 'the delivered challan appears in the list');
    assert.equal(listed.hasProofPhoto, true, 'list reports a proof photo exists');
    assert.equal(listed.proofPhotos, undefined, 'list never includes the photo payload');
    // The SSE update broadcast is also kept light (flag only, no payload).
    assert.ok(sse.events().includes('challan.updated'), 'a challan.updated SSE event is emitted');
});
test('driver delivery with several proof photos uploads and links all of them', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    // Each distinct data URL is uploaded to a distinct entity path.
    let counter = 0;
    t.mock.method(proofPhotoStore, 'store', async () => `/objects/uploads/test-proof-${counter++}`);
    const photoA = VALID_PROOF_PHOTO;
    const photoB = VALID_PROOF_PHOTO.replace('iVBOR', 'iVBOX'); // a distinct second data URL
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [photoA, photoB] });
    assert.equal(res.status, 200);
    assert.equal(res.body.hasProofPhoto, true);
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id))
        .orderBy(challanProofPhotos.id);
    assert.deepEqual(rows.map(r => r.photo), ['/objects/uploads/test-proof-0', '/objects/uploads/test-proof-1'], 'both uploaded entity paths are linked in insertion order');
    assert.equal(await proofPhotoCount(challan.id), 2, 'both photos are linked to the challan');
});
test('driver delivery still accepts the legacy single proofPhoto field', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    t.mock.method(proofPhotoStore, 'store', async () => '/objects/uploads/legacy-single');
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhoto: VALID_PROOF_PHOTO });
    assert.equal(res.status, 200);
    assert.equal(await proofPhotoCount(challan.id), 1, 'the legacy single photo is stored in the child table');
});
test('a legacy base64 proof photo already in the child table still renders via the detail endpoint', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    // Simulate a photo row written before the object-storage migration. resolve()
    // must pass base64 data URLs through unchanged, without any object-storage call.
    await db.insert(challanProofPhotos).values({ challanId: challan.id, photo: VALID_PROOF_PHOTO });
    const detail = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.proofPhotos, [VALID_PROOF_PHOTO], 'a legacy base64 data URL passes through unchanged');
    assert.equal(detail.body.hasProofPhoto, true, 'the boolean flag is still reported');
});
test('driver delivery with a non-image proof photo is rejected with 400 and stores nothing', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [VALID_PROOF_PHOTO, 'data:application/pdf;base64,Zm9v'] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /image data url/i);
    const [row] = await db.select({ status: challans.status })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'dispatched', 'the challan is not marked delivered on a bad photo');
    assert.equal(await proofPhotoCount(challan.id), 0, 'no proof photo is stored when any photo is invalid');
});
test('driver delivery with an oversized proof photo is rejected with 400 and stores nothing', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    // Exceeds the 8MB cap enforced by validateOneProofPhoto.
    const oversized = `data:image/png;base64,${'A'.repeat(8 * 1024 * 1024 + 1)}`;
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [oversized] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /too large/i);
    const [row] = await db.select({ status: challans.status })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'dispatched', 'the challan is not marked delivered on an oversized photo');
    assert.equal(await proofPhotoCount(challan.id), 0, 'no proof photo is stored');
});
test('driver delivery with too many proof photos is rejected with 400 and stores nothing', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    const tooMany = Array.from({ length: 9 }, () => VALID_PROOF_PHOTO);
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: tooMany });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /at most/i);
    assert.equal(await proofPhotoCount(challan.id), 0, 'no proof photo is stored when over the limit');
});
test('a driver PUT replaces an existing proof photo with a different one; hasProofPhoto stays true', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    // Mock object storage so each upload returns a distinct entity path and the
    // detail endpoint resolves that path to a signed URL. This keeps the test
    // deterministic whether or not object storage is configured.
    let storeCounter = 0;
    t.mock.method(proofPhotoStore, 'store', async () => `/objects/uploads/replace-${storeCounter++}`);
    t.mock.method(proofPhotoStore, 'resolve', async (stored) => stored ? `${stored}#signed` : null);
    // Store an initial proof photo on delivery.
    const first = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [VALID_PROOF_PHOTO] });
    assert.equal(first.status, 200);
    assert.equal(first.body.hasProofPhoto, true);
    assert.equal(await proofPhotoCount(challan.id), 1, 'exactly one photo after first store');
    // PUT a different valid image data URL — the stored photo must be replaced, not appended.
    const replacement = VALID_PROOF_PHOTO.replace('iVBOR', 'iVBOX'); // a distinct, still-valid data URL
    const second = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [replacement] });
    assert.equal(second.status, 200);
    assert.equal(second.body.hasProofPhoto, true, 'hasProofPhoto stays true after replacement');
    // The child table holds only the replacement's entity path, never the original.
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id));
    assert.deepEqual(rows.map(r => r.photo), ['/objects/uploads/replace-1'], 'old photo is gone, new entity path is stored');
    assert.equal(await proofPhotoCount(challan.id), 1, 'still exactly one photo, not two');
    // Detail reflects the replacement, resolved to a signed URL.
    const detail = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.proofPhotos, ['/objects/uploads/replace-1#signed'], 'detail returns the resolved signed URL for the replacement photo');
    assert.equal(detail.body.hasProofPhoto, true);
});
test('a driver PUT with proofPhotos: null clears a stored photo; hasProofPhoto becomes false on GET /:id and GET /', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    // Seed a stored photo first.
    const stored = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [VALID_PROOF_PHOTO] });
    assert.equal(stored.status, 200);
    assert.equal(stored.body.hasProofPhoto, true);
    assert.equal(await proofPhotoCount(challan.id), 1);
    // Sending proofPhotos: null clears the photos (validateProofPhotos returns []).
    const cleared = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.hasProofPhoto, false, 'response flag flips to false on clear');
    // The child table is emptied.
    assert.equal(await proofPhotoCount(challan.id), 0, 'no proof photos remain after clear');
    // GET /:id reports no photo and an empty array.
    const detail = await request(app)
        .get(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.proofPhotos, [], 'detail returns an empty proof photos array');
    assert.equal(detail.body.hasProofPhoto, false, 'detail flag is false after clear');
    // GET / (list) also reports the flag is false.
    const list = await request(app)
        .get('/api/challans')
        .set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(list.status, 200);
    const listed = list.body.find((c) => c.id === challan.id);
    assert.ok(listed, 'the challan appears in the list');
    assert.equal(listed.hasProofPhoto, false, 'list flag is false after clear');
});
test('replacing object-storage proof photos removes the previously stored objects', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    // Seed two existing object-storage proof photos (the new entity-path format).
    const oldPaths = ['/objects/uploads/old-a', '/objects/uploads/old-b'];
    await db.insert(challanProofPhotos).values(oldPaths.map(photo => ({ challanId: challan.id, photo })));
    assert.equal(await proofPhotoCount(challan.id), 2, 'two old proof photos seeded');
    // The replacement is a direct-upload object path; verify passes, store is unused.
    t.mock.method(proofPhotoStore, 'verifyExists', async () => true);
    const removed = [];
    t.mock.method(proofPhotoStore, 'remove', async (stored) => {
        removed.push(stored);
    });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: ['/objects/uploads/new-c'] });
    assert.equal(res.status, 200);
    assert.equal(res.body.hasProofPhoto, true);
    // Only the new photo remains in the child table.
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id));
    assert.deepEqual(rows.map(r => r.photo), ['/objects/uploads/new-c'], 'old photos replaced by the new one');
    // Both old backing objects are removed from storage; the new one is not.
    assert.deepEqual(removed.sort(), oldPaths.slice().sort(), 'both replaced objects are cleaned up');
});
test('clearing proof photos removes the previously stored objects', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    const oldPaths = ['/objects/uploads/clear-a', '/objects/uploads/clear-b'];
    await db.insert(challanProofPhotos).values(oldPaths.map(photo => ({ challanId: challan.id, photo })));
    assert.equal(await proofPhotoCount(challan.id), 2, 'two old proof photos seeded');
    const removed = [];
    t.mock.method(proofPhotoStore, 'remove', async (stored) => {
        removed.push(stored);
    });
    // proofPhotos: null clears the photos.
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.hasProofPhoto, false);
    assert.equal(await proofPhotoCount(challan.id), 0, 'child table emptied');
    assert.deepEqual(removed.sort(), oldPaths.slice().sort(), 'both cleared objects are removed from storage');
});
test('clearing a legacy base64 proof photo removes no object and still succeeds', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    // A legacy base64 data URL has no separate backing object.
    await db.insert(challanProofPhotos).values({ challanId: challan.id, photo: VALID_PROOF_PHOTO });
    assert.equal(await proofPhotoCount(challan.id), 1);
    // Use the real remove() so its legacy branch (no object-storage call) is exercised.
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.hasProofPhoto, false);
    assert.equal(await proofPhotoCount(challan.id), 0, 'legacy photo row is gone');
});
test('replacing proof photos still succeeds when removing an old object fails', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    await db.insert(challanProofPhotos).values({ challanId: challan.id, photo: '/objects/uploads/will-fail' });
    t.mock.method(proofPhotoStore, 'store', async (dataUrl) => dataUrl);
    // Simulate a storage failure removing the old object — the PUT must still succeed.
    t.mock.method(proofPhotoStore, 'remove', async () => {
        throw new Error('object storage unavailable');
    });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [VALID_PROOF_PHOTO] });
    assert.equal(res.status, 200, 'update succeeds despite the storage cleanup failure');
    assert.equal(res.body.hasProofPhoto, true);
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id));
    assert.deepEqual(rows.map(r => r.photo), [VALID_PROOF_PHOTO], 'the new photo is stored');
});
test('a driver PUT with the legacy proofPhoto: null also clears a stored photo', async () => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhoto: VALID_PROOF_PHOTO });
    assert.equal(await proofPhotoCount(challan.id), 1, 'legacy single photo stored');
    const cleared = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhoto: null });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.hasProofPhoto, false, 'legacy null clears the flag');
    assert.equal(await proofPhotoCount(challan.id), 0, 'legacy null empties the child table');
});
test('a driver PUT that omits proof-photo fields leaves an existing stored photo untouched', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    // Mock object storage so the upload returns a stable entity path; the test can
    // then assert that path survives a later, photo-less PUT untouched.
    const OBJECT_PATH = '/objects/uploads/omit-fields';
    t.mock.method(proofPhotoStore, 'store', async () => OBJECT_PATH);
    await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [VALID_PROOF_PHOTO] });
    assert.equal(await proofPhotoCount(challan.id), 1);
    // A follow-up PUT with no proofPhoto/proofPhotos keys must NOT wipe the photo
    // (validateProofPhotos returns undefined => "leave existing untouched").
    const followUp = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', notes: 'A later note' });
    assert.equal(followUp.status, 200);
    assert.equal(followUp.body.hasProofPhoto, true, 'flag stays true when photo fields are omitted');
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id));
    assert.deepEqual(rows.map(r => r.photo), [OBJECT_PATH], 'the original entity path is preserved');
});
test('driver delivery with an object-storage path links it directly without re-uploading', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    const OBJECT_PATH = '/objects/uploads/direct-upload';
    // The phone has already uploaded to storage; the server must only verify the
    // path exists and persist it — never call store() (no base64 round-trip).
    const storeMock = t.mock.method(proofPhotoStore, 'store', async () => {
        throw new Error('store() must not be called for a direct-upload object path');
    });
    const verifyMock = t.mock.method(proofPhotoStore, 'verifyExists', async () => true);
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: [OBJECT_PATH] });
    assert.equal(res.status, 200);
    assert.equal(res.body.hasProofPhoto, true);
    assert.equal(storeMock.mock.callCount(), 0, 'a direct-upload path is not re-uploaded');
    assert.equal(verifyMock.mock.callCount(), 1, 'its existence is verified before linking');
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos).where(eq(challanProofPhotos.challanId, challan.id));
    assert.deepEqual(rows.map(r => r.photo), [OBJECT_PATH], 'the entity path is stored as-is');
});
test('driver delivery with an object path that is not in storage is rejected with 400', async (t) => {
    const client = await createClient();
    const { user, driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'dispatched' });
    // Storage reports the path does not exist — the client must not be able to
    // link a path it never actually uploaded.
    t.mock.method(proofPhotoStore, 'verifyExists', async () => false);
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered', proofPhotos: ['/objects/uploads/missing'] });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /not found in storage/i);
    const [row] = await db.select({ status: challans.status })
        .from(challans).where(eq(challans.id, challan.id));
    assert.equal(row.status, 'dispatched', 'the challan is not marked delivered on a missing upload');
    assert.equal(await proofPhotoCount(challan.id), 0, 'no proof photo is linked');
});
test('a driver can mint a presigned proof-photo upload URL', async (t) => {
    const { user } = await createDriverUser('Dave Driver', 'dave@test.com');
    t.mock.method(proofPhotoStore, 'createUploadUrl', async () => ({
        uploadURL: 'https://storage.example/signed-put',
        objectPath: '/objects/uploads/minted',
    }));
    const res = await request(app)
        .post('/api/challans/proof-upload-url')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ contentType: 'image/jpeg' });
    assert.equal(res.status, 200);
    assert.equal(res.body.uploadURL, 'https://storage.example/signed-put');
    assert.equal(res.body.objectPath, '/objects/uploads/minted');
});
test('a driver user with no matching driver profile gets 403', async () => {
    const client = await createClient();
    // A driver-role user whose name matches NO drivers row (the profile lookup fails).
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const [user] = await db.insert(users).values({
        name: 'Ghost Driver', email: 'ghost@test.com', passwordHash, role: 'driver', isActive: true,
    }).returning();
    // A challan exists (assigned to nobody) so the failure is the missing profile,
    // not a missing challan.
    const challan = await createChallan({ driverId: null, clientId: client.id, status: 'dispatched' });
    const res = await request(app)
        .put(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: 'delivered' });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /driver profile not found/i);
});
test('deleting a challan removes its object-storage proof photos from storage', async (t) => {
    const client = await createClient();
    const { driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const admin = await createWriteRoleUser('admin@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    // Seed two object-storage proof photos directly (entity paths, the new format).
    const paths = ['/objects/uploads/proof-a', '/objects/uploads/proof-b'];
    await db.insert(challanProofPhotos).values(paths.map(photo => ({ challanId: challan.id, photo })));
    assert.equal(await proofPhotoCount(challan.id), 2, 'two proof photos seeded');
    // Capture every entity path remove() is asked to clean up.
    const removed = [];
    t.mock.method(proofPhotoStore, 'remove', async (stored) => {
        removed.push(stored);
    });
    const res = await request(app)
        .delete(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    // Both backing objects are removed from storage.
    assert.deepEqual(removed.sort(), paths.slice().sort(), 'both proof-photo objects are removed from storage');
    // The challan row and its child rows are gone.
    const [row] = await db.select({ id: challans.id }).from(challans).where(eq(challans.id, challan.id));
    assert.equal(row, undefined, 'the challan row is deleted');
    assert.equal(await proofPhotoCount(challan.id), 0, 'the proof-photo child rows are gone');
});
test('deleting a challan with a legacy base64 proof photo deletes no object', async (t) => {
    const client = await createClient();
    const { driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const admin = await createWriteRoleUser('admin@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    // A legacy base64 data URL has no separate object to clean up.
    await db.insert(challanProofPhotos).values({ challanId: challan.id, photo: VALID_PROOF_PHOTO });
    // Use the real remove() so its legacy branch (no object-storage call) is exercised.
    // It must not throw and must not touch the object-storage service.
    const res = await request(app)
        .delete(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    const [row] = await db.select({ id: challans.id }).from(challans).where(eq(challans.id, challan.id));
    assert.equal(row, undefined, 'the challan row is deleted');
    assert.equal(await proofPhotoCount(challan.id), 0, 'the legacy photo row is gone');
});
test('deleting a challan still succeeds when removing a proof object fails', async (t) => {
    const client = await createClient();
    const { driver } = await createDriverUser('Dave Driver', 'dave@test.com');
    const admin = await createWriteRoleUser('admin@test.com');
    const challan = await createChallan({ driverId: driver.id, clientId: client.id, status: 'delivered' });
    await db.insert(challanProofPhotos).values({ challanId: challan.id, photo: '/objects/uploads/proof-missing' });
    // Simulate a storage failure (e.g. the object is already gone or unreachable).
    t.mock.method(proofPhotoStore, 'remove', async () => {
        throw new Error('object storage unavailable');
    });
    const res = await request(app)
        .delete(`/api/challans/${challan.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200, 'deletion succeeds despite the storage failure');
    assert.deepEqual(res.body, { ok: true });
    const [row] = await db.select({ id: challans.id }).from(challans).where(eq(challans.id, challan.id));
    assert.equal(row, undefined, 'the challan row is still deleted');
});
