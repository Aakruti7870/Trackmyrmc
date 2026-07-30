import { test, before, beforeEach, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, kycVerifications } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { signToken } from '../middleware/auth.js';
import { updateKycSettings } from '../lib/kyc.js';
let app;
const PASSWORD = 'secret123';
// The Sandbox provider talks to global.fetch; snapshot the real one plus any
// KYC_* env fallbacks so an unconfigured test truly sees "unconfigured".
const realFetch = global.fetch;
const KYC_ENV = ['KYC_ENABLED', 'KYC_BASE_URL', 'KYC_API_KEY', 'KYC_API_SECRET', 'KYC_API_VERSION', 'KYC_PROVIDER', 'APP_URL', 'PUBLIC_URL'];
const savedEnv = {};
async function createUser(opts) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'client',
        plantId: opts.plantId ?? null,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// Persist a fully-usable KYC config (app_settings). configured requires the
// toggle on AND baseUrl + apiKey + apiSecret all present.
async function configureKyc() {
    await updateKycSettings({
        enabled: true,
        provider: 'sandbox',
        baseUrl: 'https://kyc.test',
        apiVersion: '2.0',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
    });
}
// A tiny fetch double keyed off the request URL, mirroring the Sandbox wire
// format (authenticate → session → aadhaar). `aadhaar` lets a test force the
// eKYC branch (verified payload / empty / error status).
function stubSandbox(opts = {}) {
    const res = (status, body) => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
    global.fetch = (async (input) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/authenticate')) {
            return res(200, { data: { access_token: 'tok-123' } });
        }
        if (url.endsWith('/kyc/digilocker/session')) {
            return res(200, { data: { authorization_url: 'https://digilocker.test/consent/abc', transaction_id: 'txn-777' } });
        }
        if (/\/kyc\/digilocker\/.+\/aadhaar$/.test(url)) {
            const a = opts.aadhaar
                ? opts.aadhaar()
                : { status: 200, body: { data: { masked_aadhaar: 'XXXXXXXX1234', name: 'Test Customer', date_of_birth: '1990-01-01', gender: 'M' } } };
            return res(a.status, a.body);
        }
        throw new Error(`unexpected fetch to ${url}`);
    });
}
before(() => {
    app = buildTestApp();
    for (const k of KYC_ENV) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
    }
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE users, kyc_verifications, app_settings RESTART IDENTITY CASCADE`);
    global.fetch = realFetch;
});
afterEach(() => {
    global.fetch = realFetch;
});
after(async () => {
    for (const k of KYC_ENV) {
        if (savedEnv[k] === undefined)
            delete process.env[k];
        else
            process.env[k] = savedEnv[k];
    }
    await pool.end();
});
test('GET /kyc/status reports not_started + unconfigured for a fresh customer', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const res = await request(app).get('/api/kyc/status').set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'not_started'); // route maps internal 'unverified' → spec-aligned 'not_started'
    assert.equal(res.body.configured, false);
    assert.equal(res.body.maskedAadhaar, null);
});
test('POST /kyc/start returns 503 (never a fake pass) when unconfigured', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    const res = await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    assert.equal(res.status, 503);
    const rows = await db.select().from(kycVerifications);
    assert.equal(rows.length, 0, 'no attempt row is created when unconfigured');
});
test('/kyc/status and /kyc/start are client-only', async () => {
    const staff = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
    const auth = `Bearer ${tokenFor(staff)}`;
    assert.equal((await request(app).get('/api/kyc/status').set('Authorization', auth)).status, 403);
    assert.equal((await request(app).post('/api/kyc/start').set('Authorization', auth).send({})).status, 403);
});
test('/kyc endpoints require authentication', async () => {
    assert.equal((await request(app).get('/api/kyc/status')).status, 401);
    assert.equal((await request(app).post('/api/kyc/start').send({})).status, 401);
});
test('POST /kyc/start (configured) opens a session and records a pending attempt', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await configureKyc();
    stubSandbox();
    const res = await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.authUrl, 'https://digilocker.test/consent/abc');
    const [row] = await db.select().from(kycVerifications);
    assert.ok(row, 'a verification row is created');
    assert.equal(row.status, 'pending');
    assert.equal(row.providerTxnId, 'txn-777');
    assert.ok(row.providerRef && row.providerRef.length > 0);
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.kycStatus, 'pending');
});
test('GET /kyc/callback verifies, stores ONLY masked Aadhaar, and flips the badge', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await configureKyc();
    stubSandbox();
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    const cb = await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    assert.equal(cb.status, 200);
    assert.match(cb.text, /verified/i);
    const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.id, pending.id));
    assert.equal(row.status, 'verified');
    assert.equal(row.maskedAadhaar, 'XXXXXXXX1234');
    assert.equal(row.fullName, 'Test Customer');
    const status = await request(app).get('/api/kyc/status').set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(status.body.status, 'verified');
    assert.equal(status.body.maskedAadhaar, 'XXXXXXXX1234');
    assert.ok(status.body.verifiedAt);
});
test('GET /kyc/callback marks the attempt failed when the aggregator returns no eKYC data', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await configureKyc();
    stubSandbox({ aadhaar: () => ({ status: 500, body: { error: 'upstream' } }) });
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    const cb = await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    assert.equal(cb.status, 200);
    const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.id, pending.id));
    assert.equal(row.status, 'failed');
    assert.equal(row.maskedAadhaar, null);
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.kycStatus, 'failed');
});
test('GET /kyc/callback NEVER stores a full Aadhaar even if the aggregator returns one', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await configureKyc();
    // Simulate a misbehaving aggregator that returns the raw 12-digit number.
    stubSandbox({ aadhaar: () => ({ status: 200, body: { data: { aadhaar_number: '123456789012', name: 'Test Customer' } } }) });
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.id, pending.id));
    assert.equal(row.status, 'verified');
    assert.equal(row.maskedAadhaar, 'XXXXXXXX9012', 'the raw number is collapsed to masked form');
    assert.ok(!/^\d{12}$/.test(row.maskedAadhaar ?? ''), 'no full 12-digit number is persisted');
});
test('GET /kyc/callback does NOT verify when only demographics (no masked Aadhaar) return', async () => {
    const cust = await createUser({ name: 'Cust', email: 'cust@test.com', role: 'client' });
    await configureKyc();
    stubSandbox({ aadhaar: () => ({ status: 200, body: { data: { name: 'Test Customer', date_of_birth: '1990-01-01' } } }) });
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.id, pending.id));
    assert.equal(row.status, 'failed');
    assert.equal(row.maskedAadhaar, null);
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.kycStatus, 'failed');
});
test('GET /kyc/callback rejects a missing or unknown ref', async () => {
    assert.equal((await request(app).get('/api/kyc/callback')).status, 400);
    assert.equal((await request(app).get('/api/kyc/callback?ref=does-not-exist')).status, 404);
});
// ── Task #8: displayName update after DigiLocker verification ─────────────────
test('GET /kyc/callback replaces auto-generated "Customer ####" displayName with verified legal name', async () => {
    // Seed a customer whose name is still the auto-generated placeholder.
    const cust = await createUser({ name: 'Customer 9999', email: 'cust@test.com', role: 'client' });
    await configureKyc();
    stubSandbox({ aadhaar: () => ({ status: 200, body: { data: {
                    masked_aadhaar: 'XXXXXXXX5678', name: 'Priya Sharma',
                    date_of_birth: '1992-03-15', gender: 'F',
                } } }) });
    // Start a KYC session (creates the pending kycVerifications row).
    const startRes = await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    assert.equal(startRes.status, 200, 'session should open successfully');
    const [pending] = await db.select().from(kycVerifications);
    // Fire the aggregator callback.
    const cb = await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    assert.equal(cb.status, 200);
    assert.match(cb.text, /verified/i);
    // kycStatus must transition to 'verified'.
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.kycStatus, 'verified', 'kycStatus should be verified');
    // The "Customer ####" placeholder must be replaced by the legal name from DigiLocker.
    assert.equal(user.name, 'Priya Sharma', 'displayName should be updated to the verified legal name');
    // GET /kyc/status must expose the legal name via verifiedLegalName.
    const status = await request(app).get('/api/kyc/status').set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(status.body.status, 'verified');
    assert.equal(status.body.verifiedLegalName, 'Priya Sharma', 'verifiedLegalName must match the legal name from DigiLocker');
});
test('GET /kyc/callback does NOT overwrite a custom displayName — only "Customer ####" placeholders are replaced', async () => {
    // A customer who already set their own name before KYC should keep it after verification.
    const cust = await createUser({ name: 'Ravi Kumar', email: 'ravi@test.com', role: 'client' });
    await configureKyc();
    stubSandbox({ aadhaar: () => ({ status: 200, body: { data: {
                    masked_aadhaar: 'XXXXXXXX1111', name: 'Ravi Kumar Official',
                    date_of_birth: '1985-06-10', gender: 'M',
                } } }) });
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.kycStatus, 'verified');
    // Custom name must be preserved — only the auto-generated pattern is replaced.
    assert.equal(user.name, 'Ravi Kumar', 'custom displayName should not be overwritten by the DigiLocker legal name');
});
// ── Task #9: auto-expire pending attempts in /status ─────────────────────────
test('GET /kyc/status auto-expires a pending attempt that is past its expiry window', async () => {
    const cust = await createUser({ name: 'Customer 5678', email: 'expiry@test.com', role: 'client' });
    await configureKyc();
    // Seed a pending attempt with expiresAt already in the past (1 hour ago).
    await db.insert(kycVerifications).values({
        userId: cust.id,
        provider: 'sandbox',
        providerRef: 'expired-ref-001',
        providerTxnId: 'txn-expired',
        status: 'pending',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    });
    // Also flip the user badge to 'pending' (as /start would have done).
    await db.update(users).set({ kycStatus: 'pending' }).where(eq(users.id, cust.id));
    // Calling /status should auto-expire the stale attempt and return 'failed'.
    const res = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'failed', 'expired pending attempt should be surfaced as failed');
    // Verify the DB row was actually transitioned.
    const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.providerRef, 'expired-ref-001'));
    assert.equal(row.status, 'failed', 'kycVerifications row status should be failed');
    assert.ok(row.completedAt, 'completedAt should be set on expiry');
    // User badge should also be updated.
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.kycStatus, 'failed', 'users.kycStatus badge should be flipped to failed');
});
test('GET /kyc/status does NOT expire a pending attempt that is still within its window', async () => {
    const cust = await createUser({ name: 'Customer 9012', email: 'active@test.com', role: 'client' });
    await configureKyc();
    // Seed a pending attempt that expires 10 minutes from now (still valid).
    await db.insert(kycVerifications).values({
        userId: cust.id,
        provider: 'sandbox',
        providerRef: 'active-ref-002',
        providerTxnId: 'txn-active',
        status: 'pending',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    });
    await db.update(users).set({ kycStatus: 'pending' }).where(eq(users.id, cust.id));
    const res = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'pending', 'still-valid pending attempt should remain pending');
    const [row] = await db.select().from(kycVerifications).where(eq(kycVerifications.providerRef, 'active-ref-002'));
    assert.equal(row.status, 'pending', 'row status should still be pending');
});
// ── Task #22: nameUpdateFailed field in /status ───────────────────────────────
test('GET /kyc/status returns nameUpdateFailed:false on normal verified flow', async () => {
    const cust = await createUser({ name: 'Customer 3456', email: 'namefail@test.com', role: 'client' });
    await configureKyc();
    stubSandbox({ aadhaar: () => ({ status: 200, body: { data: {
                    masked_aadhaar: 'XXXXXXXX7890', name: 'Anil Sharma',
                    date_of_birth: '1988-04-20', gender: 'M',
                } } }) });
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    // Name was placeholder → should have been updated → nameUpdateFailed should be false.
    const res = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'verified');
    assert.equal(res.body.nameUpdateFailed, false, 'nameUpdateFailed should be false when name was updated successfully');
    // Verify the name was actually replaced.
    const [user] = await db.select().from(users).where(eq(users.id, cust.id));
    assert.equal(user.name, 'Anil Sharma', 'name should be updated to verified legal name');
});
test('GET /kyc/status returns nameUpdateFailed:true when name update is blocked (placeholder remains)', async () => {
    const cust = await createUser({ name: 'Customer 1111', email: 'blocked@test.com', role: 'client' });
    await configureKyc();
    stubSandbox({ aadhaar: () => ({ status: 200, body: { data: {
                    masked_aadhaar: 'XXXXXXXX2222', name: 'Blocked Name',
                    date_of_birth: '1990-07-10', gender: 'F',
                } } }) });
    await request(app).post('/api/kyc/start').set('Authorization', `Bearer ${tokenFor(cust)}`).send({});
    const [pending] = await db.select().from(kycVerifications);
    await request(app).get(`/api/kyc/callback?ref=${pending.providerRef}`);
    // Simulate the failure: manually reset the name back to the placeholder pattern
    // to mimic what would happen if the UPDATE to users.name was blocked by a
    // constraint or other error during the transaction.
    await db.update(users).set({ name: 'Customer 1111' }).where(eq(users.id, cust.id));
    const res = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${tokenFor(cust)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'verified');
    assert.equal(res.body.nameUpdateFailed, true, 'nameUpdateFailed should be true when verified but name is still a placeholder');
});
