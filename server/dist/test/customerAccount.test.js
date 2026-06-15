import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { resolveCustomerByPhone, placeholderEmailFor } from '../lib/customerAccount.js';
let app;
// CLERK_SECRET_KEY is read live from the environment by the /clerk/customer
// guard, so snapshot and restore it around the suite to avoid leaking state.
const ORIGINAL_CLERK_SECRET = process.env.CLERK_SECRET_KEY;
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE users, clients, audit_logs RESTART IDENTITY CASCADE`);
});
afterEach(() => {
    delete process.env.CLERK_SECRET_KEY;
});
after(async () => {
    if (ORIGINAL_CLERK_SECRET === undefined)
        delete process.env.CLERK_SECRET_KEY;
    else
        process.env.CLERK_SECRET_KEY = ORIGINAL_CLERK_SECRET;
    await pool.end();
});
// ---------------------------------------------------------------------------
// resolveCustomerByPhone — the shared verified-phone → client mapping, tested
// directly against the database (no Clerk/Twilio verification needed; the caller
// is responsible for that).
// ---------------------------------------------------------------------------
test('resolveCustomerByPhone creates a live client account on first sign-in', async () => {
    const res = await resolveCustomerByPhone('+919876500001', 'Acme Builders');
    assert.equal(res.ok, true);
    if (!res.ok)
        return;
    assert.equal(res.user.role, 'client');
    assert.equal(res.user.phone, '+919876500001');
    assert.equal(res.user.isActive, true);
    assert.equal(res.user.name, 'Acme Builders');
    assert.equal(res.user.email, placeholderEmailFor('+919876500001'));
    assert.ok(res.user.linkedClientId, 'should be linked to a client record');
});
test('resolveCustomerByPhone is idempotent — same number returns the same account', async () => {
    const first = await resolveCustomerByPhone('+919876500002', 'First Name');
    const second = await resolveCustomerByPhone('+919876500002', 'Different Name');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok)
        return;
    assert.equal(second.user.id, first.user.id);
    // The name is only used at creation time; an existing account keeps its name.
    assert.equal(second.user.name, 'First Name');
});
test('resolveCustomerByPhone defaults a display name when none is supplied', async () => {
    const res = await resolveCustomerByPhone('+919876500003');
    assert.equal(res.ok, true);
    if (!res.ok)
        return;
    assert.match(res.user.name, /0003$/);
});
test('resolveCustomerByPhone rejects a deactivated account', async () => {
    const phone = '+919876500004';
    await db.insert(users).values({
        name: 'Disabled Customer', email: placeholderEmailFor(phone), phone,
        passwordHash: 'x', role: 'client', isActive: false,
    });
    const res = await resolveCustomerByPhone(phone);
    assert.equal(res.ok, false);
    if (!res.ok)
        assert.equal(res.status, 403);
});
test('resolveCustomerByPhone refuses a number registered to a non-client account', async () => {
    const phone = '+919876500006';
    // A staff/driver account that somehow carries this phone must never be
    // reachable through the customer phone flow — phone maps to clients only.
    await db.insert(users).values({
        name: 'Fleet Driver', email: `driver_${placeholderEmailFor(phone)}`, phone,
        passwordHash: 'x', role: 'driver', isActive: true,
    });
    const res = await resolveCustomerByPhone(phone);
    assert.equal(res.ok, false);
    if (!res.ok)
        assert.equal(res.status, 403);
});
test('resolveCustomerByPhone re-applies the client-only gate on the 23505 race re-read path', async () => {
    const phone = '+919876500007';
    // Reproduce the narrow concurrency window the first-pass check cannot cover:
    // the initial lookup finds nothing (so we enter the create branch), but a
    // concurrent insert claims the number with a NON-client role before our insert
    // lands, surfacing as a unique violation. The catch's re-read must re-apply the
    // role gate rather than issue a token for that non-client row.
    mock.method(db, 'transaction', async () => {
        await db.insert(users).values({
            name: 'Race Driver', email: `race_${placeholderEmailFor(phone)}`, phone,
            passwordHash: 'x', role: 'driver', isActive: true,
        });
        const err = new Error('duplicate key');
        err.code = '23505';
        throw err;
    });
    try {
        const res = await resolveCustomerByPhone(phone);
        assert.equal(res.ok, false);
        if (!res.ok)
            assert.equal(res.status, 403);
    }
    finally {
        mock.restoreAll();
    }
});
test('resolveCustomerByPhone ignores a soft-deleted account and creates a fresh one', async () => {
    const phone = '+919876500005';
    await db.insert(users).values({
        name: 'Old Customer', email: `old_${placeholderEmailFor(phone)}`, phone,
        passwordHash: 'x', role: 'client', isActive: true, deletedAt: new Date(),
    });
    const res = await resolveCustomerByPhone(phone);
    assert.equal(res.ok, true);
    if (!res.ok)
        return;
    assert.equal(res.user.isActive, true);
    assert.equal(res.user.deletedAt, null);
});
// ---------------------------------------------------------------------------
// POST /api/auth/clerk/customer — the deterministic, no-Clerk-call guard paths.
// The full verify→exchange flow requires a live Clerk session and is covered in
// manual/e2e verification.
// ---------------------------------------------------------------------------
test('POST /api/auth/clerk/customer returns 503 when Clerk is not configured', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const res = await request(app).post('/api/auth/clerk/customer').send({ token: 'anything' });
    assert.equal(res.status, 503);
});
test('POST /api/auth/clerk/customer returns 400 when no token is supplied', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    const res = await request(app).post('/api/auth/clerk/customer').send({});
    assert.equal(res.status, 400);
});
test('POST /api/auth/clerk/customer returns 401 for an invalid token', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    const res = await request(app).post('/api/auth/clerk/customer').send({ token: 'not-a-real-token' });
    assert.equal(res.status, 401);
});
