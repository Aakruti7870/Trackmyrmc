// Focused tests for the periodic automation jobs in lib/automationJobs.ts:
// runDigests (daily vs weekly weekday gating, IST window keys), runDeliveryFollowUps,
// runFuelAnomalyAlerts, runWinBacks and runIdleVehicleAlerts. All channels are kept
// OFF so each test exercises exactly the data-selection + once-per-window claim path
// (the automation_sends ledger is the observable outcome).
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import {
  plants, clients, orders, challans, vehicles, fuelLogs, automationSends,
} from '../db/schema.js';
import {
  istParts,
  loadAutomationSnapshot,
  periodKey,
  sanitizeConfig,
  saveAutomationSettings,
} from '../lib/automations.js';
import {
  runDigests,
  runDeliveryFollowUps,
  runFuelAnomalyAlerts,
  runWinBacks,
  runIdleVehicleAlerts,
} from '../lib/automationJobs.js';

// A fixed "now": 2026-07-01T05:00:00Z = 10:30 IST on 2026-07-01, so every
// weekday/hour/window computation in these tests is deterministic.
const NOW = new Date('2026-07-01T05:00:00Z');
const IST = istParts(NOW);
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 60 * 60 * 1000);

const OFF_CHANNELS = { email: false, push: false, whatsapp: false };

async function createPlant(name: string) {
  const [p] = await db.insert(plants).values({
    name, latitude: '12.9716000', longitude: '77.5946000', verified: true,
  }).returning();
  return p;
}

async function createClient(name: string, plantId: number | null) {
  const [c] = await db.insert(clients).values({
    name, contactPerson: 'Contact', phone: '9990001111', plantId,
  }).returning();
  return c;
}

async function createVehicle(vehicleNo: string, plantId: number | null, extra: Partial<typeof vehicles.$inferInsert> = {}) {
  const [v] = await db.insert(vehicles).values({
    vehicleNo, capacity: '8', plantId, ...extra,
  }).returning();
  return v;
}

type AutomationName = Parameters<typeof saveAutomationSettings>[0];

async function enable(name: AutomationName, config: Record<string, unknown>, plantId: number | null = null, enabled = true) {
  await saveAutomationSettings(name, plantId, enabled, sanitizeConfig(name, config));
}

async function allSends() {
  return db.select().from(automationSends);
}

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE app_settings, automation_settings, automation_sends,
      fuel_logs, challans, vehicles, orders, clients, plants, users
    RESTART IDENTITY CASCADE
  `);
});

after(async () => {
  await pool.end();
});

// ---- runDigests -------------------------------------------------------------------

test('daily digest sends once per plant per IST day (windowKey d:<date>), then never again', async () => {
  const plant = await createPlant('Digest Plant');
  const client = await createClient('Acme', plant.id);
  // Some activity inside yesterday's completed IST day, for realism.
  await db.insert(challans).values({
    challanNo: 'CH-D1', plantId: plant.id, clientId: client.id,
    grade: 'M25', quantity: '7', status: 'delivered', createdAt: hoursAgo(20),
  });
  await db.insert(orders).values({
    orderNo: 'ORD-D1', plantId: plant.id, clientId: client.id,
    grade: 'M25', quantity: '7', deliveryDate: IST.dateStr, status: 'pending', createdAt: hoursAgo(20),
  });
  await enable('digest', { frequency: 'daily', sendHour: 0, ...OFF_CHANNELS });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot, NOW), 1, 'first run sends the daily digest');
  assert.equal(await runDigests(snapshot, NOW), 0, 'same IST day again is a no-op');

  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].automation, 'digest');
  assert.equal(sends[0].targetType, 'plant');
  assert.equal(sends[0].targetId, plant.id);
  assert.equal(sends[0].plantId, plant.id);
  assert.equal(sends[0].windowKey, `d:${IST.dateStr}`);
});

test('digest respects the sendHour gate', async () => {
  await createPlant('Early Plant');
  // NOW is 10:30 IST — a 23:00 send hour has not arrived yet.
  await enable('digest', { frequency: 'daily', sendHour: 23, ...OFF_CHANNELS });
  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot, NOW), 0);
  assert.equal((await allSends()).length, 0);
});

test('weekly digest fires only on the configured IST weekday, with a w:<date> window key', async () => {
  const plant = await createPlant('Weekly Plant');

  // Wrong weekday first: configured for tomorrow's weekday → nothing.
  await enable('digest', { frequency: 'weekly', weekday: (IST.weekday + 1) % 7, sendHour: 0, ...OFF_CHANNELS });
  let snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot, NOW), 0, 'must not fire on the wrong weekday');

  // Right weekday: fires once with the weekly window key.
  await enable('digest', { frequency: 'weekly', weekday: IST.weekday, sendHour: 0, ...OFF_CHANNELS });
  snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot, NOW), 1);
  assert.equal(await runDigests(snapshot, NOW), 0, 'once per week window');

  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].windowKey, `w:${IST.dateStr}`);
  assert.equal(sends[0].targetId, plant.id);
});

test('digest plant scoping: scoped runs touch only that plant; a plant override can opt out', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const plantC = await createPlant('Plant C');
  await enable('digest', { frequency: 'daily', sendHour: 0, ...OFF_CHANNELS });
  // Plant C explicitly opts out via a plant-scoped override.
  await enable('digest', { frequency: 'daily', sendHour: 0, ...OFF_CHANNELS }, plantC.id, false);

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDigests(snapshot, NOW, plantA.id), 1, 'scoped run covers only plant A');
  let sends = await allSends();
  assert.deepEqual(sends.map(s => s.plantId), [plantA.id]);

  // A full tick then picks up plant B (A already claimed, C disabled).
  assert.equal(await runDigests(snapshot, NOW), 1);
  sends = await allSends();
  assert.deepEqual(sends.map(s => s.plantId).sort(), [plantA.id, plantB.id].sort());
});

// ---- runDeliveryFollowUps -----------------------------------------------------------

test('delivery follow-up nudges once for a trip open past the delay, and skips fresh trips', async () => {
  const plant = await createPlant('FollowUp Plant');
  const client = await createClient('Acme', plant.id);
  await db.insert(challans).values([
    // 5h open with the default 4h delay → overdue.
    {
      challanNo: 'CH-F1', plantId: plant.id, clientId: client.id,
      grade: 'M25', quantity: '7', status: 'dispatched', dispatchTime: hoursAgo(5),
    },
    // Only 2h open → not yet.
    {
      challanNo: 'CH-F2', plantId: plant.id, clientId: client.id,
      grade: 'M25', quantity: '7', status: 'dispatched', dispatchTime: hoursAgo(2),
    },
    // Already delivered → never followed up.
    {
      challanNo: 'CH-F3', plantId: plant.id, clientId: client.id,
      grade: 'M25', quantity: '7', status: 'delivered', dispatchTime: hoursAgo(9),
    },
  ]);
  await enable('deliveryFollowUp', { delayHours: 4, ...OFF_CHANNELS });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runDeliveryFollowUps(snapshot, NOW), 1, 'only the 5h-open trip is flagged');
  assert.equal(await runDeliveryFollowUps(snapshot, NOW), 0, 'a trip is nudged at most once');

  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].automation, 'deliveryFollowUp');
  assert.equal(sends[0].targetType, 'challan');
  assert.equal(sends[0].windowKey, 'overdue');
  assert.equal(sends[0].plantId, plant.id);
});

test('delivery follow-up honors scopePlantId and is a no-op when disabled', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const clientA = await createClient('A Co', plantA.id);
  const clientB = await createClient('B Co', plantB.id);
  await db.insert(challans).values([
    { challanNo: 'CH-A', plantId: plantA.id, clientId: clientA.id, grade: 'M25', quantity: '7', status: 'dispatched', dispatchTime: hoursAgo(6) },
    { challanNo: 'CH-B', plantId: plantB.id, clientId: clientB.id, grade: 'M25', quantity: '7', status: 'dispatched', dispatchTime: hoursAgo(6) },
  ]);

  // Disabled everywhere → nothing, even with overdue trips on the table.
  let snapshot = await loadAutomationSnapshot();
  assert.equal(await runDeliveryFollowUps(snapshot, NOW), 0);
  assert.equal((await allSends()).length, 0);

  await enable('deliveryFollowUp', { delayHours: 4, ...OFF_CHANNELS });
  snapshot = await loadAutomationSnapshot();
  assert.equal(await runDeliveryFollowUps(snapshot, NOW, plantA.id), 1, 'scoped run sees only plant A');
  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].plantId, plantA.id);
});

// ---- runFuelAnomalyAlerts -----------------------------------------------------------

test('fuel anomaly alerts once per vehicle per window when diesel exceeds the threshold', async () => {
  const plant = await createPlant('Fuel Plant');
  const client = await createClient('Acme', plant.id);
  // Expected: 100 km at 5 km/L = 20 L. Actual 40 L → +100% variance (> 15%).
  const hog = await createVehicle('KA-01-HOG', plant.id, { mileageKmpl: '5' });
  // A well-behaved vehicle: 100 km, 21 L → +5%, under the threshold.
  const ok = await createVehicle('KA-02-OK', plant.id, { mileageKmpl: '5' });
  await db.insert(challans).values([
    {
      challanNo: 'CH-FUEL1', plantId: plant.id, clientId: client.id, vehicleId: hog.id,
      grade: 'M25', quantity: '7', status: 'delivered',
      odometerStart: 1000, odometerEnd: 1100, createdAt: daysAgo(1),
    },
    {
      challanNo: 'CH-FUEL2', plantId: plant.id, clientId: client.id, vehicleId: ok.id,
      grade: 'M25', quantity: '7', status: 'delivered',
      odometerStart: 2000, odometerEnd: 2100, createdAt: daysAgo(1),
    },
  ]);
  await db.insert(fuelLogs).values([
    { vehicleId: hog.id, litres: '40', filledAt: daysAgo(1) },
    { vehicleId: ok.id, litres: '21', filledAt: daysAgo(1) },
  ]);
  await enable('fuelAnomaly', { windowDays: 7, thresholdPct: 15, ...OFF_CHANNELS });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runFuelAnomalyAlerts(snapshot, NOW), 1, 'only the over-consuming vehicle is flagged');
  assert.equal(await runFuelAnomalyAlerts(snapshot, NOW), 0, 'one alert per vehicle per window');

  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].automation, 'fuelAnomaly');
  assert.equal(sends[0].targetType, 'vehicle');
  assert.equal(sends[0].targetId, hog.id);
  assert.equal(sends[0].plantId, plant.id);
  assert.equal(sends[0].windowKey, periodKey(IST.dayIndex, 7));
});

test('fuel anomaly honors scopePlantId and plant-level overrides', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const clientA = await createClient('A Co', plantA.id);
  const clientB = await createClient('B Co', plantB.id);
  // Both vehicles over-consume identically: 100 km at 5 km/L = 20 L expected, 40 L actual.
  const va = await createVehicle('KA-04-A', plantA.id, { mileageKmpl: '5' });
  const vb = await createVehicle('KA-05-B', plantB.id, { mileageKmpl: '5' });
  await db.insert(challans).values([
    {
      challanNo: 'CH-SA', plantId: plantA.id, clientId: clientA.id, vehicleId: va.id,
      grade: 'M25', quantity: '7', status: 'delivered',
      odometerStart: 0, odometerEnd: 100, createdAt: daysAgo(1),
    },
    {
      challanNo: 'CH-SB', plantId: plantB.id, clientId: clientB.id, vehicleId: vb.id,
      grade: 'M25', quantity: '7', status: 'delivered',
      odometerStart: 0, odometerEnd: 100, createdAt: daysAgo(1),
    },
  ]);
  await db.insert(fuelLogs).values([
    { vehicleId: va.id, litres: '40', filledAt: daysAgo(1) },
    { vehicleId: vb.id, litres: '40', filledAt: daysAgo(1) },
  ]);
  await enable('fuelAnomaly', { windowDays: 7, thresholdPct: 15, ...OFF_CHANNELS });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runFuelAnomalyAlerts(snapshot, NOW, plantA.id), 1, 'scoped run sees only plant A');
  let sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].targetId, va.id);
  assert.equal(sends[0].plantId, plantA.id);

  // Plant B opts out via a plant override: a full tick must NOT alert its vehicle
  // even though the global setting stays enabled.
  await enable('fuelAnomaly', { windowDays: 7, thresholdPct: 15, ...OFF_CHANNELS }, plantB.id, false);
  const withOverride = await loadAutomationSnapshot();
  assert.equal(await runFuelAnomalyAlerts(withOverride, NOW), 0, 'plant override disables plant B; plant A already claimed');
  sends = await allSends();
  assert.deepEqual(sends.map(s => s.plantId), [plantA.id]);
});

test('fuel anomaly is a no-op when disabled', async () => {
  const plant = await createPlant('Fuel Plant');
  const client = await createClient('Acme', plant.id);
  const v = await createVehicle('KA-03-X', plant.id, { mileageKmpl: '5' });
  await db.insert(challans).values({
    challanNo: 'CH-FUEL3', plantId: plant.id, clientId: client.id, vehicleId: v.id,
    grade: 'M25', quantity: '7', status: 'delivered',
    odometerStart: 0, odometerEnd: 100, createdAt: daysAgo(1),
  });
  await db.insert(fuelLogs).values({ vehicleId: v.id, litres: '80', filledAt: daysAgo(1) });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runFuelAnomalyAlerts(snapshot, NOW), 0);
  assert.equal((await allSends()).length, 0);
});

// ---- runWinBacks --------------------------------------------------------------------

test('win-back nudges an inactive customer once per window, skipping recent and never-ordered clients', async () => {
  const plant = await createPlant('WinBack Plant');
  const dormant = await createClient('Dormant Co', plant.id);
  const active = await createClient('Active Co', plant.id);
  await createClient('Never Ordered Co', plant.id);
  await db.insert(orders).values([
    {
      orderNo: 'ORD-W1', plantId: plant.id, clientId: dormant.id,
      grade: 'M25', quantity: '10', deliveryDate: '2026-05-20', status: 'completed', createdAt: daysAgo(40),
    },
    {
      orderNo: 'ORD-W2', plantId: plant.id, clientId: active.id,
      grade: 'M25', quantity: '10', deliveryDate: IST.dateStr, status: 'pending', createdAt: daysAgo(5),
    },
  ]);
  await enable('winBack', { inactiveDays: 30, ...OFF_CHANNELS });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runWinBacks(snapshot, NOW), 1, 'only the 40-days-quiet client is nudged');
  assert.equal(await runWinBacks(snapshot, NOW), 0, 'at most one nudge per client per window');

  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].automation, 'winBack');
  assert.equal(sends[0].targetType, 'client');
  assert.equal(sends[0].targetId, dormant.id);
  assert.equal(sends[0].plantId, plant.id);
  assert.equal(sends[0].windowKey, periodKey(IST.dayIndex, 30));
});

test('win-back honors scopePlantId and is a no-op when disabled', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  const clientA = await createClient('A Co', plantA.id);
  const clientB = await createClient('B Co', plantB.id);
  await db.insert(orders).values([
    { orderNo: 'ORD-A', plantId: plantA.id, clientId: clientA.id, grade: 'M25', quantity: '10', deliveryDate: '2026-05-01', status: 'completed', createdAt: daysAgo(45) },
    { orderNo: 'ORD-B', plantId: plantB.id, clientId: clientB.id, grade: 'M25', quantity: '10', deliveryDate: '2026-05-01', status: 'completed', createdAt: daysAgo(45) },
  ]);

  let snapshot = await loadAutomationSnapshot();
  assert.equal(await runWinBacks(snapshot, NOW), 0, 'disabled → no nudges');
  assert.equal((await allSends()).length, 0);

  await enable('winBack', { inactiveDays: 30, ...OFF_CHANNELS });
  snapshot = await loadAutomationSnapshot();
  assert.equal(await runWinBacks(snapshot, NOW, plantB.id), 1, 'scoped run sees only plant B clients');
  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].targetId, clientB.id);
  assert.equal(sends[0].plantId, plantB.id);
});

// ---- runIdleVehicleAlerts -------------------------------------------------------------

test('idle vehicle alert fires once per window for long-idle active vehicles only', async () => {
  const plant = await createPlant('Idle Plant');
  const client = await createClient('Acme', plant.id);
  // Idle 10 days (last trip) with idleDays 7 → flagged.
  const idle = await createVehicle('KA-10-IDLE', plant.id);
  // Trip yesterday → busy, not flagged.
  const busy = await createVehicle('KA-11-BUSY', plant.id);
  // Never tripped but only exists 2 days → not old enough to count as idle.
  await createVehicle('KA-12-NEW', plant.id, { createdAt: daysAgo(2) });
  // Long-forgotten but in maintenance → excluded by status.
  await createVehicle('KA-13-SHOP', plant.id, { status: 'maintenance', createdAt: daysAgo(60) });
  await db.insert(challans).values([
    {
      challanNo: 'CH-I1', plantId: plant.id, clientId: client.id, vehicleId: idle.id,
      grade: 'M25', quantity: '7', status: 'delivered', dispatchTime: daysAgo(10),
    },
    {
      challanNo: 'CH-I2', plantId: plant.id, clientId: client.id, vehicleId: busy.id,
      grade: 'M25', quantity: '7', status: 'delivered', dispatchTime: daysAgo(1),
    },
  ]);
  await enable('idleVehicle', { idleDays: 7, ...OFF_CHANNELS });

  const snapshot = await loadAutomationSnapshot();
  assert.equal(await runIdleVehicleAlerts(snapshot, NOW), 1, 'only the 10-days-idle active vehicle is flagged');
  assert.equal(await runIdleVehicleAlerts(snapshot, NOW), 0, 'one alert per vehicle per window');

  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].automation, 'idleVehicle');
  assert.equal(sends[0].targetType, 'vehicle');
  assert.equal(sends[0].targetId, idle.id);
  assert.equal(sends[0].plantId, plant.id);
  assert.equal(sends[0].windowKey, periodKey(IST.dayIndex, 7));
});

test('idle vehicle alert honors scopePlantId and is a no-op when disabled', async () => {
  const plantA = await createPlant('Plant A');
  const plantB = await createPlant('Plant B');
  await createVehicle('KA-20-A', plantA.id, { createdAt: daysAgo(30) });
  const vb = await createVehicle('KA-21-B', plantB.id, { createdAt: daysAgo(30) });

  let snapshot = await loadAutomationSnapshot();
  assert.equal(await runIdleVehicleAlerts(snapshot, NOW), 0, 'disabled → no alerts');
  assert.equal((await allSends()).length, 0);

  await enable('idleVehicle', { idleDays: 7, ...OFF_CHANNELS });
  snapshot = await loadAutomationSnapshot();
  assert.equal(await runIdleVehicleAlerts(snapshot, NOW, plantB.id), 1, 'scoped run sees only plant B fleet');
  const sends = await allSends();
  assert.equal(sends.length, 1);
  assert.equal(sends[0].targetId, vb.id);
  assert.equal(sends[0].plantId, plantB.id);
});
