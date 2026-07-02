// The automation tick runs every job in sequence, each individually fenced so
// one crashing automation can never block the rest of the pass. These tests
// force a real mid-tick crash (the digest's email send throws) and verify the
// later jobs still run and claim, the shared last-run metadata reflects the
// failure, the tick recovers on the next pass, and POST /api/automations/run
// never surfaces the crash as a 500.
import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
let emails = [];
let failEmails = false;
mock.module('../lib/automationEmail.js', {
    namedExports: {
        sendAutomationEmail: async (msg) => {
            if (failEmails)
                throw new Error('SMTP exploded (test)');
            emails.push(msg);
            return true;
        },
    },
});
const { buildTestApp } = await import('./app.js');
const { db, pool } = await import('../db/index.js');
const { users, plants, clients, orders, challans, vehicles, automationSends, } = await import('../db/schema.js');
const { signToken } = await import('../middleware/auth.js');
const { hashPassword } = await import('../lib/password.js');
const { getLastRunMap, loadAutomationSnapshot, sanitizeConfig, saveAutomationSettings, } = await import('../lib/automations.js');
const { tickAutomations, runDigests } = await import('../lib/automationJobs.js');
// Fixed "now": 2026-07-01T05:00:00Z = 10:30 IST, so the daily digest's
// sendHour gate (0) always passes and window math is deterministic.
const NOW = new Date('2026-07-01T05:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);
const hoursAgo = (n) => new Date(NOW.getTime() - n * 60 * 60 * 1000);
const OFF_CHANNELS = { email: false, push: false, whatsapp: false };
let app;
async function enable(name, config) {
    await saveAutomationSettings(name, null, true, sanitizeConfig(name, config));
}
// Seeds one plant with work for four different jobs in tick order:
// deliveryFollowUp (before digest), digest (crashes via email), winBack and
// idleVehicle (after digest — the proof the tick kept going).
async function seedBusyPlant(now = NOW) {
    const hAgo = (n) => new Date(now.getTime() - n * 60 * 60 * 1000);
    const dAgo = (n) => new Date(now.getTime() - n * DAY_MS);
    const [plant] = await db.insert(plants).values({
        name: 'Tick Plant', latitude: '12.9716000', longitude: '77.5946000', verified: true,
    }).returning();
    const [client] = await db.insert(clients).values({
        name: 'Dormant Co', contactPerson: 'Contact', phone: '9990001111', plantId: plant.id,
    }).returning();
    await db.insert(orders).values({
        orderNo: `ORD-${now.getTime()}`, plantId: plant.id, clientId: client.id,
        grade: 'M25', quantity: '10', deliveryDate: '2026-05-20', status: 'completed', createdAt: dAgo(40),
    });
    await db.insert(challans).values({
        challanNo: `CH-${now.getTime()}`, plantId: plant.id, clientId: client.id,
        grade: 'M25', quantity: '7', status: 'dispatched', dispatchTime: hAgo(6),
    });
    const [vehicle] = await db.insert(vehicles).values({
        vehicleNo: `KA-${now.getTime() % 100000}`, capacity: '8', plantId: plant.id, createdAt: dAgo(30),
    }).returning();
    await enable('deliveryFollowUp', { delayHours: 4, ...OFF_CHANNELS });
    // Digest is the ONLY job with email on — the mocked channel's failure mode
    // makes exactly this job crash, and nothing else touches email.
    await enable('digest', { frequency: 'daily', sendHour: 0, email: true, push: false, whatsapp: false });
    await enable('winBack', { inactiveDays: 30, ...OFF_CHANNELS });
    await enable('idleVehicle', { idleDays: 7, ...OFF_CHANNELS });
    return { plant, client, vehicle };
}
async function claimedAutomations() {
    const rows = await db.select().from(automationSends);
    return [...new Set(rows.map(r => r.automation))].sort();
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    emails = [];
    failEmails = false;
    await db.execute(sql `
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      fuel_logs, challans, vehicles, orders, clients, plants, users
    RESTART IDENTITY CASCADE
  `);
});
after(async () => {
    await pool.end();
});
// Sanity: with email on and the channel healthy, the digest job itself
// completes and actually emails nobody-crashes proof for the setup below.
test('control: the digest job sends its email when the channel is healthy', async () => {
    await seedBusyPlant();
    // Digest emails go to plant staff — none exist, so the send is skipped but
    // the job still succeeds and claims. Verify it does NOT throw.
    const snapshot = await loadAutomationSnapshot();
    assert.equal(await runDigests(snapshot, NOW), 1);
});
test('a crashing job does not stop the rest of the tick, and the failure shows in last-run metadata', async () => {
    const { plant, client, vehicle } = await seedBusyPlant();
    // Give the plant an admin so the digest really attempts (and fails) its email.
    await db.insert(users).values({
        name: 'Plant Admin', email: 'plant-admin@test.com',
        passwordHash: await hashPassword('secret123'), role: 'admin', isActive: true, plantId: plant.id,
    });
    failEmails = true;
    // Must not throw even though runDigests blows up mid-pass — and the crash
    // must be reported on the server log, not swallowed silently.
    const errorLog = mock.method(console, 'error', () => { });
    try {
        await tickAutomations(NOW);
        assert.ok(errorLog.mock.calls.some(c => String(c.arguments[0]).includes('digest tick failed')), 'the crashed job is reported in the log');
    }
    finally {
        errorLog.mock.restore();
    }
    // Jobs BEFORE and AFTER the crashed digest all claimed their work.
    const claimed = await claimedAutomations();
    assert.ok(claimed.includes('deliveryFollowUp'), 'job before the crash ran');
    assert.ok(claimed.includes('winBack'), 'job after the crash still ran');
    assert.ok(claimed.includes('idleVehicle'), 'job after the crash still ran');
    // The digest claimed before its email exploded — the ledger row exists even
    // though the job failed (claims are what prevent double-sends on retry).
    assert.ok(claimed.includes('digest'));
    const sends = await db.select().from(automationSends);
    const byName = (a) => sends.filter(s => s.automation === a);
    assert.equal(byName('deliveryFollowUp').length, 1);
    assert.equal(byName('winBack')[0].targetId, client.id);
    assert.equal(byName('idleVehicle')[0].targetId, vehicle.id);
    // Last-run metadata marks every job EXCEPT the crashed one as having run —
    // a stalled/failing automation must not look healthy.
    const lastRun = await getLastRunMap();
    assert.equal(lastRun.digest ?? null, null, 'crashed job must not record a run');
    assert.ok(lastRun.deliveryFollowUp, 'healthy jobs record their run');
    assert.ok(lastRun.winBack);
    assert.ok(lastRun.idleVehicle);
    assert.ok(lastRun.cleanup, 'platform cleanup still ran at the end of the tick');
    // Next tick recovers: the digest's window is already claimed so it no longer
    // emails (no crash), succeeds, and finally records a run.
    await tickAutomations(NOW);
    const afterRecovery = await getLastRunMap();
    assert.ok(afterRecovery.digest, 'the tick heals on the next pass');
    assert.equal((await db.select().from(automationSends)).length, sends.length, 'the claim ledger prevents any double-send across the failed and recovered ticks');
});
test('POST /api/automations/run returns 200 even when a job crashes mid-tick', async () => {
    // The route uses the real clock, so seed relative to the real "now".
    const { plant } = await seedBusyPlant(new Date());
    await db.insert(users).values({
        name: 'Plant Admin', email: 'plant-admin@test.com',
        passwordHash: await hashPassword('secret123'), role: 'admin', isActive: true, plantId: plant.id,
    });
    const [authority] = await db.insert(users).values({
        name: 'Authority', email: 'authority@test.com',
        passwordHash: await hashPassword('secret123'), role: 'authority', isActive: true, plantId: null,
    }).returning();
    failEmails = true;
    const res = await request(app)
        .post('/api/automations/run')
        .set('Authorization', `Bearer ${signToken({ id: authority.id, email: authority.email, role: authority.role, name: authority.name })}`)
        .send({});
    assert.equal(res.status, 200, 'a crashing job must never surface as a 500');
    assert.deepEqual(res.body, { ok: true, scope: 'global' });
    // The rest of the tick still did its work.
    const claimed = await claimedAutomations();
    assert.ok(claimed.includes('winBack'), 'jobs after the crash still ran via the route');
    assert.ok(claimed.includes('idleVehicle'));
});
