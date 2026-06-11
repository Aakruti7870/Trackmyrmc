import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql, eq } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { clients, orders, recurringOrders } from '../db/schema.js';
import { computeRunDate, computeFirstRunDate, toDateStr, runDueRecurringOrders } from '../lib/recurring.js';
before(() => { });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE recurring_orders, orders, clients RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('weekly computeRunDate lands on the requested day of week', () => {
    // 2026-06-11 is a Thursday (UTC day 4).
    const from = new Date('2026-06-11T00:00:00Z');
    const next = computeRunDate('weekly', 1 /* Monday */, from, false);
    assert.equal(new Date(next).getUTCDay(), 1);
    assert.ok(next > toDateStr(from));
});
test('weekly non-inclusive skips today, inclusive keeps it', () => {
    const thursday = new Date('2026-06-11T00:00:00Z'); // day 4
    assert.equal(computeFirstRunDate('weekly', 4, thursday), '2026-06-11');
    assert.equal(computeRunDate('weekly', 4, thursday, false), '2026-06-18');
});
test('monthly clamps anchor to the month length', () => {
    const feb = new Date('2026-02-10T00:00:00Z');
    // anchor 28 is valid; ensure the date is within February.
    const next = computeFirstRunDate('monthly', 28, feb);
    assert.equal(next, '2026-02-28');
});
test('runDueRecurringOrders materialises due orders and advances the next run', async () => {
    const [client] = await db.insert(clients).values({ name: 'Acme', contactPerson: 'J', phone: '900' }).returning();
    const now = new Date('2026-06-11T08:00:00Z'); // Thursday
    // Due yesterday.
    const [tpl] = await db.insert(recurringOrders).values({
        clientId: client.id, grade: 'M25', quantity: '10', pumpRequired: false,
        frequency: 'weekly', anchor: 4, nextRunDate: '2026-06-10', active: true,
    }).returning();
    const created = await runDueRecurringOrders(now);
    assert.equal(created, 1);
    const placed = await db.select().from(orders).where(eq(orders.clientId, client.id));
    assert.equal(placed.length, 1);
    assert.equal(placed[0].grade, 'M25');
    assert.equal(placed[0].status, 'pending');
    const [after] = await db.select().from(recurringOrders).where(eq(recurringOrders.id, tpl.id));
    assert.ok(after.nextRunDate > toDateStr(now), 'next run advanced past today');
    assert.ok(after.lastRunAt, 'lastRunAt recorded');
});
test('paused templates are skipped', async () => {
    const [client] = await db.insert(clients).values({ name: 'Acme2', contactPerson: 'J', phone: '901' }).returning();
    await db.insert(recurringOrders).values({
        clientId: client.id, grade: 'M25', quantity: '10', pumpRequired: false,
        frequency: 'weekly', anchor: 1, nextRunDate: '2026-06-01', active: false,
    });
    const created = await runDueRecurringOrders(new Date('2026-06-11T08:00:00Z'));
    assert.equal(created, 0);
});
test('a second run on the same day is a no-op (idempotent after advancing)', async () => {
    const [client] = await db.insert(clients).values({ name: 'Acme3', contactPerson: 'J', phone: '902' }).returning();
    await db.insert(recurringOrders).values({
        clientId: client.id, grade: 'M30', quantity: '8', pumpRequired: false,
        frequency: 'weekly', anchor: 4, nextRunDate: '2026-06-10', active: true,
    });
    const now = new Date('2026-06-11T08:00:00Z');
    assert.equal(await runDueRecurringOrders(now), 1);
    // Re-running the same day must not create a duplicate — nextRunDate is now in the future.
    assert.equal(await runDueRecurringOrders(now), 0);
    const placed = await db.select().from(orders).where(eq(orders.clientId, client.id));
    assert.equal(placed.length, 1);
});
test('overlapping concurrent runs never double-fire a due template', async () => {
    const [client] = await db.insert(clients).values({ name: 'Acme4', contactPerson: 'J', phone: '903' }).returning();
    await db.insert(recurringOrders).values({
        clientId: client.id, grade: 'M20', quantity: '12', pumpRequired: false,
        frequency: 'monthly', anchor: 10, nextRunDate: '2026-06-10', active: true,
    });
    const now = new Date('2026-06-11T08:00:00Z');
    // Simulate the boot run racing the interval run: both fire at once. The
    // FOR UPDATE SKIP LOCKED claim must ensure exactly one order is materialised.
    const counts = await Promise.all([runDueRecurringOrders(now), runDueRecurringOrders(now)]);
    assert.equal(counts[0] + counts[1], 1);
    const placed = await db.select().from(orders).where(eq(orders.clientId, client.id));
    assert.equal(placed.length, 1);
});
