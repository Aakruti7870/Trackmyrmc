import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { getSSEClientCount } from '../lib/sseEmitter.js';
let app;
// A real listening server is needed only for the long-lived stream case: an
// accepted SSE response never ends, so supertest's request would hang and
// aborting it leaks an ECONNRESET. Native http gives us a clean close().
let server;
let baseUrl;
async function createUser(opts) {
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        // /api/events never checks the password; a placeholder hash satisfies the
        // NOT NULL column without the cost of bcrypt.
        passwordHash: 'placeholder',
        role: opts.role ?? 'dispatcher',
        isActive: opts.isActive ?? true,
    }).returning();
    return row;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// Polls a condition until it holds or a timeout elapses. Used to observe the
// asynchronous register/unregister of an SSE client without arbitrary sleeps.
async function waitFor(cond, message, timeoutMs = 3000) {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`timeout waiting for: ${message}`);
        }
        await new Promise((r) => setTimeout(r, 10));
    }
}
// Opens the SSE stream and resolves once the response headers arrive (the
// stream itself stays open). Returns the HTTP status plus a close() that tears
// down the connection so the server fires its 'close' handler.
function openStream(token) {
    return new Promise((resolve, reject) => {
        const url = token !== undefined
            ? `${baseUrl}/api/events?token=${encodeURIComponent(token)}`
            : `${baseUrl}/api/events`;
        let settled = false;
        const req = http.get(url, (res) => {
            settled = true;
            // Drain the stream and swallow the teardown error that destroy() causes.
            res.on('error', () => { });
            res.resume();
            resolve({ status: res.statusCode ?? 0, close: () => req.destroy() });
        });
        // destroy() after we have resolved surfaces as ECONNRESET; ignore it once
        // the response has been handed back.
        req.on('error', (err) => {
            if (!settled)
                reject(err);
        });
    });
}
before(async () => {
    app = buildTestApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
    // Each authorization case below is rejected before registration, so the
    // emitter's client map should start (and stay) empty.
    assert.equal(getSSEClientCount(), 0, 'no SSE clients should be registered between tests');
});
after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
    await pool.end();
});
test('rejects a request with no token (401) and registers no SSE client', async () => {
    const res = await request(app).get('/api/events');
    assert.equal(res.status, 401);
    assert.match(res.body.error, /token required/i);
    assert.equal(getSSEClientCount(), 0, 'an unauthenticated caller must not be registered');
});
test('rejects an invalid/garbage token (401) and registers no SSE client', async () => {
    const res = await request(app).get('/api/events').query({ token: 'not-a-real-jwt' });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /invalid token/i);
    assert.equal(getSSEClientCount(), 0, 'a caller with a bad token must not be registered');
});
test('rejects a well-formed token signed with the wrong secret (401)', async () => {
    // A structurally valid JWT that fails signature verification must be treated
    // the same as garbage — it must never be accepted.
    const forged = jwt.sign({ id: 1, email: 'x@test.com', role: 'admin', name: 'X' }, 'the-wrong-secret');
    const res = await request(app).get('/api/events').query({ token: forged });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /invalid token/i);
    assert.equal(getSSEClientCount(), 0);
});
test('rejects a valid token for a deactivated (isActive=false) user (401)', async () => {
    const user = await createUser({
        name: 'Dormant', email: 'dormant@test.com', role: 'dispatcher', isActive: false,
    });
    const res = await request(app).get('/api/events').query({ token: tokenFor(user) });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /deactivated/i);
    assert.equal(getSSEClientCount(), 0, 'a deactivated account must not be registered');
});
test('rejects a valid token for a user that no longer exists (401)', async () => {
    // Sign a token for an id that is not in the database (e.g. the account was
    // purged). The lookup returns no row, so it is treated as deactivated.
    const token = signToken({ id: 999999, email: 'gone@test.com', role: 'admin', name: 'Gone' });
    const res = await request(app).get('/api/events').query({ token });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /deactivated/i);
    assert.equal(getSSEClientCount(), 0);
});
test('accepts a valid active user, registers an SSE client, and unregisters on disconnect', async () => {
    const user = await createUser({ name: 'Live Admin', email: 'live@test.com', role: 'admin' });
    const token = tokenFor(user);
    const before = getSSEClientCount();
    const stream = await openStream(token);
    assert.equal(stream.status, 200, 'a valid active user is accepted with a 200 stream');
    // The connection is registered with the emitter so it can receive events.
    await waitFor(() => getSSEClientCount() === before + 1, 'the accepted connection to be registered as an SSE client');
    // Closing the stream must release the slot (the route's 'close' handler).
    stream.close();
    await waitFor(() => getSSEClientCount() === before, 'the SSE client to be unregistered after the connection closes');
});
