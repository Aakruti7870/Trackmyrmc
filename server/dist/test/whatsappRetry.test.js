import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
let sendCalls = [];
let sendImpl = () => ({ ok: true, channel: 'whatsapp' });
mock.module('../lib/whatsapp.js', {
    namedExports: {
        sendWhatsAppTemplate: async (toPhone, templateSid, variables) => {
            sendCalls.push({ toPhone, templateSid, variables });
            return sendImpl();
        },
    },
});
const { db, pool } = await import('../db/index.js');
const { whatsappRetries } = await import('../db/schema.js');
const { enqueueWhatsAppRetry, runDueWhatsAppRetries, sendWhatsAppWithRetry, backoffDelayMs, MAX_ATTEMPTS, BACKOFF_BASE_MS, MAX_BACKOFF_MS, } = await import('../lib/whatsappRetry.js');
const PHONE = '+919876543210';
const SID = 'HXtemplate';
const VARS = { '1': 'Acme', '2': 'CH-0001' };
before(() => { });
beforeEach(async () => {
    sendCalls = [];
    sendImpl = () => ({ ok: true, channel: 'whatsapp' });
    await db.execute(sql `TRUNCATE TABLE whatsapp_retries RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
async function rows() {
    return db.select().from(whatsappRetries);
}
// --- backoff schedule ------------------------------------------------------
test('backoff doubles each attempt and caps at the ceiling', () => {
    assert.equal(backoffDelayMs(1), BACKOFF_BASE_MS);
    assert.equal(backoffDelayMs(2), BACKOFF_BASE_MS * 2);
    assert.equal(backoffDelayMs(3), BACKOFF_BASE_MS * 4);
    // A very high attempt count is clamped, never unbounded.
    assert.equal(backoffDelayMs(99), MAX_BACKOFF_MS);
});
// --- enqueue-on-failure (sendWhatsAppWithRetry) ----------------------------
test('a transient inline failure is enqueued for retry', async () => {
    sendImpl = () => ({ ok: false, channel: 'whatsapp', retryable: true, error: 'provider down' });
    const now = new Date('2026-06-14T10:00:00Z');
    const res = await sendWhatsAppWithRetry(PHONE, SID, VARS, 'dispatch');
    // wrapper returns the inline result unchanged
    assert.equal(res.ok, false);
    const queued = await rows();
    assert.equal(queued.length, 1);
    assert.equal(queued[0].toPhone, PHONE);
    assert.equal(queued[0].templateSid, SID);
    assert.deepEqual(queued[0].variables, VARS);
    assert.equal(queued[0].event, 'dispatch');
    assert.equal(queued[0].attempts, 1);
    assert.equal(queued[0].lastError, 'provider down');
    // first retry is scheduled in the future
    assert.ok(queued[0].nextAttemptAt.getTime() > now.getTime());
});
test('a permanent inline failure is NOT enqueued', async () => {
    sendImpl = () => ({ ok: false, channel: 'whatsapp', retryable: false, error: 'invalid number' });
    await sendWhatsAppWithRetry(PHONE, SID, VARS, 'order');
    assert.equal((await rows()).length, 0);
});
test('a successful inline send is NOT enqueued', async () => {
    sendImpl = () => ({ ok: true, channel: 'whatsapp' });
    const res = await sendWhatsAppWithRetry(PHONE, SID, VARS, 'order');
    assert.equal(res.ok, true);
    assert.equal((await rows()).length, 0);
});
// --- enqueueWhatsAppRetry directly -----------------------------------------
test('enqueueWhatsAppRetry schedules the first retry one base interval out', async () => {
    const now = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: VARS, event: 'delivery', now });
    const [row] = await rows();
    assert.equal(row.attempts, 1);
    assert.equal(row.nextAttemptAt.getTime(), now.getTime() + backoffDelayMs(1));
});
// --- runDueWhatsAppRetries -------------------------------------------------
test('a due retry that now succeeds is sent and removed', async () => {
    const now = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: VARS, now });
    sendImpl = () => ({ ok: true, channel: 'whatsapp' });
    const later = new Date(now.getTime() + backoffDelayMs(1) + 1000);
    const result = await runDueWhatsAppRetries(later);
    assert.deepEqual(result, { sent: 1, retried: 0, gaveUp: 0 });
    assert.equal(sendCalls.length, 1);
    assert.equal(sendCalls[0].toPhone, PHONE);
    assert.deepEqual(sendCalls[0].variables, VARS);
    assert.equal((await rows()).length, 0);
});
test('a due retry that fails transiently again is rescheduled with backoff', async () => {
    const now = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: VARS, now });
    sendImpl = () => ({ ok: false, channel: 'whatsapp', retryable: true, error: 'still down' });
    const later = new Date(now.getTime() + backoffDelayMs(1) + 1000);
    const result = await runDueWhatsAppRetries(later);
    assert.deepEqual(result, { sent: 0, retried: 1, gaveUp: 0 });
    const [row] = await rows();
    assert.equal(row.attempts, 2);
    assert.equal(row.lastError, 'still down');
    // next attempt scheduled a (longer) backoff out from `later`
    assert.equal(row.nextAttemptAt.getTime(), later.getTime() + backoffDelayMs(2));
});
test('a due retry that fails permanently is dropped (gives up)', async () => {
    const now = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: VARS, now });
    sendImpl = () => ({ ok: false, channel: 'whatsapp', retryable: false, error: 'template removed' });
    const later = new Date(now.getTime() + backoffDelayMs(1) + 1000);
    const result = await runDueWhatsAppRetries(later);
    assert.deepEqual(result, { sent: 0, retried: 0, gaveUp: 1 });
    assert.equal((await rows()).length, 0);
});
test('a row that is not yet due is left untouched', async () => {
    const now = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: VARS, now });
    // Run BEFORE the first retry becomes due.
    const result = await runDueWhatsAppRetries(now);
    assert.deepEqual(result, { sent: 0, retried: 0, gaveUp: 0 });
    assert.equal(sendCalls.length, 0);
    assert.equal((await rows()).length, 1);
});
test('repeated transient failures stop after MAX_ATTEMPTS total sends', async () => {
    // Enqueue (= inline attempt #1 already failed) then keep failing transiently.
    let clock = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: VARS, now: clock });
    sendImpl = () => ({ ok: false, channel: 'whatsapp', retryable: true, error: 'down' });
    let gaveUp = 0;
    let backgroundSends = 0;
    // Advance the clock far past each scheduled time and drain until empty.
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) {
        clock = new Date(clock.getTime() + MAX_BACKOFF_MS + 1000);
        const r = await runDueWhatsAppRetries(clock);
        backgroundSends += r.sent + r.retried + r.gaveUp;
        gaveUp += r.gaveUp;
        if ((await rows()).length === 0)
            break;
    }
    assert.equal((await rows()).length, 0, 'queue is drained');
    assert.equal(gaveUp, 1, 'gave up exactly once');
    // 1 inline + (MAX_ATTEMPTS - 1) background sends.
    assert.equal(sendCalls.length, MAX_ATTEMPTS - 1, 'background made MAX_ATTEMPTS-1 sends');
    assert.equal(backgroundSends, MAX_ATTEMPTS - 1);
});
test('processes multiple due rows in a single run', async () => {
    const now = new Date('2026-06-14T10:00:00Z');
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: { '1': 'A' }, now });
    await enqueueWhatsAppRetry({ toPhone: PHONE, templateSid: SID, variables: { '1': 'B' }, now });
    sendImpl = () => ({ ok: true, channel: 'whatsapp' });
    const later = new Date(now.getTime() + backoffDelayMs(1) + 1000);
    const result = await runDueWhatsAppRetries(later);
    assert.equal(result.sent, 2);
    assert.equal(sendCalls.length, 2);
    assert.equal((await rows()).length, 0);
});
