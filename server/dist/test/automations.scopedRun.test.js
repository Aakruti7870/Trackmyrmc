import { test, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sql, eq } from 'drizzle-orm';
let emails = [];
mock.module('../lib/automationEmail.js', {
    namedExports: {
        sendAutomationEmail: async (msg) => {
            emails.push(msg);
            return true;
        },
    },
});
const { db, pool } = await import('../db/index.js');
const { clients, orders, otpCodes, plants, automationSends } = await import('../db/schema.js');
const { getLastRunMap, istParts, sanitizeConfig, saveAutomationSettings } = await import('../lib/automations.js');
const { tickAutomations, tickAutomationsForPlant } = await import('../lib/automationJobs.js');
async function createPlant(name) {
    const [p] = await db.insert(plants).values({
        name, latitude: '12.9716000', longitude: '77.5946000', verified: true,
    }).returning();
    return p;
}
// A plant with one client and one order due tomorrow (IST) — exactly what the
// order-reminder job looks for once its send hour has passed.
async function seedReminderTarget(plantName, clientEmail) {
    const plant = await createPlant(plantName);
    const [client] = await db.insert(clients).values({
        name: `${plantName} Client`, contactPerson: 'C', phone: '+911111111111',
        email: clientEmail, plantId: plant.id,
    }).returning();
    const ist = istParts(new Date());
    await db.insert(orders).values({
        orderNo: `ORD-${plantName}`, clientId: client.id, plantId: plant.id,
        grade: 'M25', quantity: '10', deliveryDate: ist.tomorrowStr, status: 'pending',
    });
    return plant;
}
async function enableOrderRemindersEverywhere() {
    await saveAutomationSettings('orderReminders', null, true, sanitizeConfig('orderReminders', { sendHour: 0, email: true, push: false, whatsapp: false }));
}
beforeEach(async () => {
    emails = [];
    await db.execute(sql `
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      otp_codes, orders, clients, plants, audit_logs, users
    RESTART IDENTITY CASCADE
  `);
});
after(async () => {
    await pool.end();
});
test('a plant-scoped run only touches that plant; a full tick covers both', async () => {
    const plantA = await seedReminderTarget('PlantA', 'client-a@test.com');
    await seedReminderTarget('PlantB', 'client-b@test.com');
    await enableOrderRemindersEverywhere();
    await tickAutomationsForPlant(plantA.id);
    assert.equal(emails.length, 1, 'only plant A\'s customer is reminded');
    assert.deepEqual(emails[0].to, ['client-a@test.com']);
    const sends = await db.select().from(automationSends);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].plantId, plantA.id);
    // The full tick afterwards picks up plant B — and does NOT double-send A
    // because the ledger already holds A's claim.
    await tickAutomations();
    assert.equal(emails.length, 2);
    assert.deepEqual(emails[1].to, ['client-b@test.com']);
});
test('a scoped run never performs cleanup; the full tick still does', async () => {
    const plant = await createPlant('PlantC');
    await db.insert(otpCodes).values({
        phone: '+919999999999', codeHash: 'x', expiresAt: new Date(Date.now() - 60_000),
    });
    await tickAutomationsForPlant(plant.id);
    assert.equal((await db.select().from(otpCodes)).length, 1, 'scoped run must skip global housekeeping');
    await tickAutomations();
    assert.equal((await db.select().from(otpCodes)).length, 0, 'the full tick purges the expired code');
});
test('a scoped run does not update the shared last-run metadata', async () => {
    const plant = await createPlant('PlantD');
    await tickAutomationsForPlant(plant.id);
    const afterScoped = await getLastRunMap();
    assert.ok(Object.values(afterScoped).every(v => v == null), 'scoped runs must not mask a stalled scheduler');
    await tickAutomations();
    const afterFull = await getLastRunMap();
    assert.ok(afterFull.orderReminders != null, 'the full tick records its pass');
});
test('a scoped run is idempotent: a second run claims nothing new', async () => {
    const plant = await seedReminderTarget('PlantE', 'client-e@test.com');
    await enableOrderRemindersEverywhere();
    await tickAutomationsForPlant(plant.id);
    await tickAutomationsForPlant(plant.id);
    assert.equal(emails.length, 1, 'the once-only ledger stops the repeat send');
    const sends = await db.select().from(automationSends).where(eq(automationSends.plantId, plant.id));
    assert.equal(sends.length, 1);
});
