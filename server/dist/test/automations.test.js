import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, clients, orders, plants, otpCodes, automationSends } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { AUTOMATIONS, claimSend, istParts, loadAutomationSnapshot, periodKey, sanitizeConfig, saveAutomationSettings, } from '../lib/automations.js';
import { runOrderReminders, runCleanup } from '../lib/automationJobs.js';
let app;
async function createUser(role, email, plantId) {
    const passwordHash = await hashPassword('secret123');
    const [user] = await db.insert(users).values({
        name: `${role} user`, email, passwordHash, role: role,
        isActive: true, plantId: plantId ?? null,
    }).returning();
    return user;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
async function createPlant(name) {
    const [p] = await db.insert(plants).values({
        name, latitude: '12.9716000', longitude: '77.5946000', verified: true,
    }).returning();
    return p;
}
before(() => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      otp_codes, orders, clients, plants, audit_logs, users, login_attempts
    RESTART IDENTITY CASCADE
  `);
});
after(async () => {
    await pool.end();
});
// ---- API access control -----------------------------------------------------
test('GET /api/automations requires authentication', async () => {
    const res = await request(app).get('/api/automations');
    assert.equal(res.status, 401);
});
test('a client cannot read or edit automations', async () => {
    const client = await createUser('client', 'client@test.com');
    const get = await request(app).get('/api/automations')
        .set('Authorization', `Bearer ${tokenFor(client)}`);
    assert.equal(get.status, 403);
    const put = await request(app).put('/api/automations/digest')
        .set('Authorization', `Bearer ${tokenFor(client)}`)
        .send({ enabled: true });
    assert.equal(put.status, 403);
});
test('GET lists all 8 automations with cleanup ON and everything else OFF by default', async () => {
    const admin = await createUser('admin', 'admin@test.com');
    const res = await request(app).get('/api/automations')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.scope, 'global');
    assert.equal(res.body.items.length, AUTOMATIONS.length);
    for (const item of res.body.items) {
        if (item.name === 'cleanup')
            assert.equal(item.enabled, true, 'cleanup defaults ON');
        else
            assert.equal(item.enabled, false, `${item.name} must default OFF`);
        assert.equal(item.source, 'default');
    }
});
// ---- Scope model --------------------------------------------------------------
test('a plant-scoped admin writes a plant override; the global default is untouched', async () => {
    const plant = await createPlant('Plant A');
    const plantAdmin = await createUser('admin', 'plant-admin@test.com', plant.id);
    const globalAdmin = await createUser('authority', 'authority@test.com', null);
    const put = await request(app).put('/api/automations/orderReminders')
        .set('Authorization', `Bearer ${tokenFor(plantAdmin)}`)
        .send({ enabled: true, config: { sendHour: 17 } });
    assert.equal(put.status, 200);
    assert.equal(put.body.enabled, true);
    assert.equal(put.body.source, 'plant');
    assert.equal(put.body.config.sendHour, 17);
    // The platform-wide view still shows the default (off).
    const globalView = await request(app).get('/api/automations')
        .set('Authorization', `Bearer ${tokenFor(globalAdmin)}`);
    const item = globalView.body.items.find((i) => i.name === 'orderReminders');
    assert.equal(item.enabled, false);
    assert.equal(item.source, 'default');
});
test('a plant override beats the global setting when both exist', async () => {
    const plant = await createPlant('Plant B');
    await saveAutomationSettings('winBack', null, true, sanitizeConfig('winBack', {}));
    await saveAutomationSettings('winBack', plant.id, false, sanitizeConfig('winBack', {}));
    const snapshot = await loadAutomationSnapshot();
    assert.equal(snapshot.effective('winBack', plant.id).enabled, false);
    assert.equal(snapshot.effective('winBack', plant.id).source, 'plant');
    assert.equal(snapshot.effective('winBack', null).enabled, true);
    assert.equal(snapshot.enabledAnywhere('winBack'), true);
});
test('cleanup is platform-managed: plant-scoped staff get 403, platform staff can edit', async () => {
    const plant = await createPlant('Plant C');
    const plantAdmin = await createUser('admin', 'plant-admin@test.com', plant.id);
    const authority = await createUser('authority', 'authority@test.com', null);
    const denied = await request(app).put('/api/automations/cleanup')
        .set('Authorization', `Bearer ${tokenFor(plantAdmin)}`)
        .send({ enabled: false });
    assert.equal(denied.status, 403);
    const ok = await request(app).put('/api/automations/cleanup')
        .set('Authorization', `Bearer ${tokenFor(authority)}`)
        .send({ enabled: false, config: { retentionDays: 60 } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.enabled, false);
    assert.equal(ok.body.config.retentionDays, 60);
});
test('PUT rejects unknown automations and missing enabled flag', async () => {
    const admin = await createUser('admin', 'admin@test.com');
    const unknown = await request(app).put('/api/automations/notAThing')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ enabled: true });
    assert.equal(unknown.status, 404);
    const missing = await request(app).put('/api/automations/digest')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ config: {} });
    assert.equal(missing.status, 400);
});
// ---- Config sanitization ---------------------------------------------------------
test('sanitizeConfig clamps numbers, drops unknown keys, and normalizes digest frequency', () => {
    const digest = sanitizeConfig('digest', { sendHour: 99, weekday: 42, frequency: 'hourly', evil: 'x' });
    assert.equal(digest.sendHour, 23);
    assert.equal(digest.weekday, 6);
    assert.equal(digest.frequency, 'daily');
    assert.equal('evil' in digest, false);
    const reminders = sanitizeConfig('orderReminders', { sendHour: -5, whatsapp: 1, whatsappTemplate: '  tpl_x  ' });
    assert.equal(reminders.sendHour, 0);
    assert.equal(reminders.whatsapp, true);
    assert.equal(reminders.whatsappTemplate, 'tpl_x');
});
// ---- Once-only claim ledger ---------------------------------------------------------
test('claimSend grants exactly one claim per target+window, even under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => claimSend('orderReminders', 'order', 1, 'd:2026-07-03')));
    assert.equal(results.filter(Boolean).length, 1, 'exactly one concurrent claim may win');
    // A different window for the same target is a fresh claim.
    assert.equal(await claimSend('orderReminders', 'order', 1, 'd:2026-07-04'), true);
});
test('periodKey rolls the window so re-alerts only happen after N days', () => {
    assert.equal(periodKey(700, 7), periodKey(706, 7));
    assert.notEqual(periodKey(700, 7), periodKey(707, 7));
});
// ---- Jobs -----------------------------------------------------------------------------
test('runOrderReminders processes tomorrow\'s orders once, then never again for the same date', async () => {
    const plant = await createPlant('Plant D');
    const [client] = await db.insert(clients).values({
        name: 'Acme', contactPerson: 'Jane', phone: '1112223333', plantId: plant.id,
    }).returning();
    const tomorrow = istParts().tomorrowStr;
    await db.insert(orders).values({
        orderNo: 'ORD-1', clientId: client.id, plantId: plant.id,
        grade: 'M25', quantity: '10', deliveryDate: tomorrow, status: 'pending',
    });
    // Enabled globally, sendHour 0 so any hour qualifies; channels off so the run
    // exercises only the claim path (no SMTP/push configured in tests anyway).
    await saveAutomationSettings('orderReminders', null, true, sanitizeConfig('orderReminders', { sendHour: 0, email: false, push: false, whatsapp: false }));
    const snapshot = await loadAutomationSnapshot();
    assert.equal(await runOrderReminders(snapshot), 1, 'first run claims and sends');
    assert.equal(await runOrderReminders(snapshot), 0, 'second run must be a no-op');
    const sends = await db.select().from(automationSends);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].automation, 'orderReminders');
    assert.equal(sends[0].windowKey, `d:${tomorrow}`);
});
test('runOrderReminders does nothing when the automation is disabled', async () => {
    const [client] = await db.insert(clients).values({
        name: 'Acme', contactPerson: 'Jane', phone: '1112223333',
    }).returning();
    await db.insert(orders).values({
        orderNo: 'ORD-2', clientId: client.id,
        grade: 'M25', quantity: '10', deliveryDate: istParts().tomorrowStr, status: 'pending',
    });
    const snapshot = await loadAutomationSnapshot();
    assert.equal(await runOrderReminders(snapshot), 0);
    assert.equal((await db.select().from(automationSends)).length, 0);
});
test('runCleanup purges expired OTP codes and old trashed users, guarding the last admin', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    const longAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    await db.insert(otpCodes).values([
        { phone: '+911111111111', codeHash: 'x', expiresAt: past },
        { phone: '+912222222222', codeHash: 'y', expiresAt: new Date(now.getTime() + 60_000) },
    ]);
    // Only admin in the system, trashed long ago → must be SKIPPED (last-admin guard).
    const lastAdmin = await createUser('admin', 'last-admin@test.com');
    await db.update(users).set({ deletedAt: longAgo }).where(sql `${users.id} = ${lastAdmin.id}`);
    // A trashed dispatcher past retention → purged.
    const dispatcher = await createUser('dispatcher', 'old-dispatcher@test.com');
    await db.update(users).set({ deletedAt: longAgo }).where(sql `${users.id} = ${dispatcher.id}`);
    // A recently-trashed user inside the retention window → kept.
    const recent = await createUser('supervisor', 'recent@test.com');
    await db.update(users).set({ deletedAt: past }).where(sql `${users.id} = ${recent.id}`);
    const snapshot = await loadAutomationSnapshot(); // cleanup is ON by default
    const result = await runCleanup(snapshot, now);
    assert.ok(result, 'cleanup runs by default');
    assert.equal(result.otpCodes, 1, 'only the expired OTP goes');
    assert.equal(result.purgedUsers, 1, 'only the old trashed non-last-admin goes');
    const remaining = await db.select({ id: users.id, email: users.email }).from(users);
    const emails = remaining.map(u => u.email).sort();
    assert.deepEqual(emails, ['last-admin@test.com', 'recent@test.com']);
});
test('runCleanup is a no-op when disabled platform-wide', async () => {
    await saveAutomationSettings('cleanup', null, false, sanitizeConfig('cleanup', {}));
    await db.insert(otpCodes).values({ phone: '+911111111111', codeHash: 'x', expiresAt: new Date(Date.now() - 1000) });
    const snapshot = await loadAutomationSnapshot();
    assert.equal(await runCleanup(snapshot), null);
    assert.equal((await db.select().from(otpCodes)).length, 1);
});
