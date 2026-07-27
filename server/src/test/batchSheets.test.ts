import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, plants, clients, sites, orders, challans, vehicles, drivers } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { computeBatchSizes, computeTotals, generateActuals, type RecipeMaterial } from '../lib/batchSheet.js';

let app: Express;

const MATERIALS = [
  { label: 'C Sand', perCumKg: 780, tolerancePct: 2 },
  { label: '20mm', perCumKg: 650, tolerancePct: 2 },
  { label: '10mm', perCumKg: 420, tolerancePct: 2 },
  { label: 'Cement', perCumKg: 320, tolerancePct: 1 },
  { label: 'Flyash', perCumKg: 80, tolerancePct: 1 },
  { label: 'Water', perCumKg: 160, tolerancePct: 1 },
  { label: 'Admixture', perCumKg: 3.2, tolerancePct: 2 },
];

type Role = typeof users.$inferInsert.role;

async function createUser(role: Role, plantId: number | null = null, email = `${role}@test.com`) {
  const [row] = await db.insert(users).values({
    name: role as string, email, passwordHash: null, role, isActive: true, plantId,
  }).returning();
  return row;
}

async function createPlant(name: string, code: string) {
  const [row] = await db.insert(plants).values({
    name, plantCode: code, address: 'X', city: 'Y', latitude: '19.0000000', longitude: '73.0000000',
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function createMix(token: string, overrides: Record<string, unknown> = {}) {
  return request(app).post('/api/mix-designs')
    .set('Authorization', `Bearer ${token}`)
    .send({ grade: 'M35', recipeName: 'M35 Standard', recipeCode: 'R-M35', materials: MATERIALS, ...overrides });
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE batch_reports, mix_designs, challans, orders, sites, clients, vehicles, drivers, app_settings, audit_logs, users, plants, login_attempts RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

// ——— pure math ———

test('computeBatchSizes splits production into batches incl. a partial final batch', () => {
  assert.deepEqual(computeBatchSizes(6, 1), [1, 1, 1, 1, 1, 1]);
  assert.equal(computeBatchSizes(6, 0.5).length, 12);
  assert.deepEqual(computeBatchSizes(6.5, 1), [1, 1, 1, 1, 1, 1, 0.5]);
  assert.throws(() => computeBatchSizes(0, 1));
  assert.throws(() => computeBatchSizes(500, 0.5)); // > MAX rows
});

test('generateActuals stays inside the material tolerance band', () => {
  const mats: RecipeMaterial[] = MATERIALS.map((m, i) => ({ ...m, key: `k${i}` }));
  for (let run = 0; run < 50; run++) {
    const actuals = generateActuals(mats, 0.5);
    for (const m of mats) {
      const target = m.perCumKg * 0.5;
      const tol = target * (m.tolerancePct / 100);
      assert.ok(actuals[m.key] >= target - tol - 0.06 && actuals[m.key] <= target + tol + 0.06,
        `${m.label}: ${actuals[m.key]} outside ${target}±${tol}`);
    }
  }
});

test('computeTotals computes set/actual totals and difference percentages', () => {
  const mats: RecipeMaterial[] = [
    { key: 'cement', label: 'Cement', perCumKg: 300, tolerancePct: 1 },
    { key: 'water', label: 'Water', perCumKg: 150, tolerancePct: 1 },
  ];
  const batches = [
    { size: 1, actuals: { cement: 303, water: 150 } },
    { size: 1, actuals: { cement: 297, water: 151.5 } },
  ];
  const t = computeTotals(mats, batches);
  assert.equal(t.perMaterial[0].totalSet, 600);
  assert.equal(t.perMaterial[0].totalActual, 600);
  assert.equal(t.perMaterial[0].diffPct, 0);
  assert.equal(t.perMaterial[1].totalActual, 301.5);
  assert.equal(t.perMaterial[1].diffPct, 0.5);
  assert.equal(t.totalSetMass, 900);
  assert.equal(t.totalActualMass, 901.5);
  assert.ok(Math.abs(t.totalMassDiffPct - 0.17) < 0.02);
});

// ——— mix design CRUD ———

test('mix design create/list/update/delete with grade uniqueness per plant', async () => {
  const admin = await createUser('admin');
  const token = tokenFor(admin);

  const created = await createMix(token);
  assert.equal(created.status, 201);
  assert.equal(created.body.grade, 'M35');
  assert.equal((created.body.materials as unknown[]).length, 7);

  const dup = await createMix(token);
  assert.equal(dup.status, 409, 'duplicate grade for same plant rejected');

  const badGrade = await createMix(token, { grade: 'M99' });
  assert.equal(badGrade.status, 400);

  const badMat = await createMix(token, { grade: 'M40', materials: [{ label: 'Cement', perCumKg: -5, tolerancePct: 1 }] });
  assert.equal(badMat.status, 400);

  const list = await request(app).get('/api/mix-designs').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);

  const upd = await request(app).put(`/api/mix-designs/${created.body.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ grade: 'M35', recipeName: 'M35 Rev2', materials: MATERIALS.slice(0, 5) });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.recipeName, 'M35 Rev2');

  const del = await request(app).delete(`/api/mix-designs/${created.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.ok, true);
});

test('mix designs are plant-scoped; customers are rejected', async () => {
  const p1 = await createPlant('Plant A', 'PLA');
  const p2 = await createPlant('Plant B', 'PLB');
  const a1 = await createUser('admin', p1.id, 'a1@test.com');
  const a2 = await createUser('admin', p2.id, 'a2@test.com');
  const client = await createUser('client', null, 'c@test.com');

  const created = await createMix(tokenFor(a1));
  assert.equal(created.status, 201);

  const otherList = await request(app).get('/api/mix-designs').set('Authorization', `Bearer ${tokenFor(a2)}`);
  assert.equal(otherList.body.length, 0, 'other plant sees nothing');

  const sameGradeOtherPlant = await createMix(tokenFor(a2));
  assert.equal(sameGradeOtherPlant.status, 201, 'same grade allowed on another plant');

  const crossUpdate = await request(app).put(`/api/mix-designs/${created.body.id}`)
    .set('Authorization', `Bearer ${tokenFor(a2)}`)
    .send({ grade: 'M35', recipeName: 'hijack', materials: MATERIALS });
  assert.equal(crossUpdate.status, 404, 'cross-plant update blocked');

  const denied = await request(app).get('/api/mix-designs').set('Authorization', `Bearer ${tokenFor(client)}`);
  assert.equal(denied.status, 403);
});

test('mix design mutation rejects non-integer ids before querying PostgreSQL', async () => {
  const admin = await createUser('admin');
  const token = tokenFor(admin);
  const body = { grade: 'M35', recipeName: 'Invalid id', materials: MATERIALS };

  const update = await request(app).put('/api/mix-designs/not-a-number')
    .set('Authorization', `Bearer ${token}`).send(body);
  assert.equal(update.status, 400);
  assert.match(update.body.error, /invalid mix design id/i);

  const remove = await request(app).delete('/api/mix-designs/not-a-number')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(remove.status, 400);
  assert.match(remove.body.error, /invalid mix design id/i);
});

// ——— settings ———

test('batch settings round-trip per plant and validate inputs', async () => {
  const admin = await createUser('admin');
  const token = tokenFor(admin);

  const defaults = await request(app).get('/api/batch-reports/settings').set('Authorization', `Bearer ${token}`);
  assert.equal(defaults.status, 200);
  assert.equal(defaults.body.batchSizeCum, 1);

  const bad = await request(app).put('/api/batch-reports/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ plantType: 'M1 T Belt', mixerCapacityCum: 0.5, batchSizeCum: 1 });
  assert.equal(bad.status, 400, 'batch size > mixer capacity rejected');

  const ok = await request(app).put('/api/batch-reports/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ plantType: 'M1 T Belt', mixerCapacityCum: 1, batchSizeCum: 0.5 });
  assert.equal(ok.status, 200);

  const readBack = await request(app).get('/api/batch-reports/settings').set('Authorization', `Bearer ${token}`);
  assert.equal(readBack.body.plantType, 'M1 T Belt');
  assert.equal(readBack.body.batchSizeCum, 0.5);
});

// ——— report generation ———

test('generates a batch report: row count, targets, tolerance, totals', async () => {
  const admin = await createUser('admin');
  const token = tokenFor(admin);
  const mix = await createMix(token);

  const res = await request(app).post('/api/batch-reports')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mixDesignId: mix.body.id, productionQty: 6, batchSize: 1, mixerCapacity: 1,
      plantType: 'M1 T Belt', customer: 'Acme', site: 'Site 1',
      batchDate: '2026-07-07', startTime: '10:15', endTime: '11:05',
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.reportNo, 'BSR-001');
  assert.equal(res.body.grade, 'M35');
  assert.equal((res.body.batches as unknown[]).length, 6);
  assert.equal(res.body.startTime, '10:15');
  assert.ok(res.body.totals, 'totals returned');

  const mats = res.body.materials as RecipeMaterial[];
  for (const b of res.body.batches as { size: number; actuals: Record<string, number> }[]) {
    assert.equal(b.size, 1);
    for (const m of mats) {
      const target = m.perCumKg * b.size;
      const tol = target * (m.tolerancePct / 100);
      assert.ok(b.actuals[m.key] >= target - tol - 0.06 && b.actuals[m.key] <= target + tol + 0.06);
    }
  }

  // Half-cum plant: 12 rows, targets halved.
  const half = await request(app).post('/api/batch-reports')
    .set('Authorization', `Bearer ${token}`)
    .send({ mixDesignId: mix.body.id, productionQty: 6, batchSize: 0.5 });
  assert.equal(half.status, 201);
  assert.equal((half.body.batches as unknown[]).length, 12);

  const detail = await request(app).get(`/api/batch-reports/${res.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.totals.perMaterial.length, 7);
  assert.ok(Math.abs(detail.body.totals.totalMassDiffPct) <= 2.1, 'sheet-level diff stays realistic');

  const badSize = await request(app).post('/api/batch-reports')
    .set('Authorization', `Bearer ${token}`)
    .send({ mixDesignId: mix.body.id, productionQty: 6, batchSize: 2, mixerCapacity: 1 });
  assert.equal(badSize.status, 400, 'batch size beyond mixer capacity rejected');
});

test('report attaches to a challan and prefills header + exact times', async () => {
  const admin = await createUser('admin');
  const token = tokenFor(admin);
  const mix = await createMix(token);

  const [client] = await db.insert(clients).values({ name: 'Acme Co', contactPerson: 'CC', phone: '111' }).returning();
  const [site] = await db.insert(sites).values({ clientId: client.id, name: 'Tower Site' }).returning();
  const [driver] = await db.insert(drivers).values({ name: 'Ram', phone: '222' }).returning();
  const [vehicle] = await db.insert(vehicles).values({ vehicleNo: 'MH43-1234', capacity: '7.00', driverId: driver.id }).returning();
  const [order] = await db.insert(orders).values({
    orderNo: 'ORD-1', clientId: client.id, siteId: site.id, grade: 'M35', quantity: '18.00',
  }).returning();
  await db.insert(challans).values({
    challanNo: 'CH-0001', clientId: client.id, siteId: site.id, orderId: order.id,
    grade: 'M35', quantity: '6.00', status: 'delivered', dispatchTime: new Date('2026-07-07T08:10:30'),
  });
  const [ch2] = await db.insert(challans).values({
    challanNo: 'CH-0002', clientId: client.id, siteId: site.id, orderId: order.id,
    vehicleId: vehicle.id, driverId: driver.id,
    grade: 'M35', quantity: '6.00', status: 'dispatched',
    dispatchTime: new Date('2026-07-07T10:20:05'),
  }).returning();

  const res = await request(app).post('/api/batch-reports')
    .set('Authorization', `Bearer ${token}`)
    .send({ mixDesignId: mix.body.id, productionQty: 6, batchSize: 1, challanId: ch2.id });
  assert.equal(res.status, 201);
  assert.equal(res.body.customer, 'Acme Co');
  assert.equal(res.body.site, 'Tower Site');
  assert.equal(res.body.truckNo, 'MH43-1234');
  assert.equal(res.body.truckDriver, 'Ram');
  assert.equal(Number(res.body.orderedQty), 18);
  assert.equal(Number(res.body.withThisLoad), 12, 'cumulative qty incl. this load');
  assert.equal(res.body.startTime, '10:20:05', 'exact challan dispatch time stamp');
  assert.equal(res.body.challanNo, 'CH-0002');

  const list = await request(app).get('/api/batch-reports').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body[0].challanNo, 'CH-0002');
  assert.equal(list.body[0].batchCount, 6);
});

test('editing actuals validates rows; regenerate re-rolls inside tolerance; scoping enforced', async () => {
  const p1 = await createPlant('Plant A', 'PLA');
  const p2 = await createPlant('Plant B', 'PLB');
  const a1 = await createUser('admin', p1.id, 'a1@test.com');
  const a2 = await createUser('admin', p2.id, 'a2@test.com');
  const mix = await createMix(tokenFor(a1));

  const created = await request(app).post('/api/batch-reports')
    .set('Authorization', `Bearer ${tokenFor(a1)}`)
    .send({ mixDesignId: mix.body.id, productionQty: 2, batchSize: 1 });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const batches = created.body.batches as { size: number; actuals: Record<string, number> }[];

  // Edit one actual value.
  const mats = created.body.materials as RecipeMaterial[];
  const key = mats[0].key;
  batches[0].actuals[key] = 999;
  const upd = await request(app).put(`/api/batch-reports/${id}`)
    .set('Authorization', `Bearer ${tokenFor(a1)}`)
    .send({ batches, customer: 'Edited Co' });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.customer, 'Edited Co');
  assert.equal((upd.body.batches as typeof batches)[0].actuals[key], 999);

  const badRows = await request(app).put(`/api/batch-reports/${id}`)
    .set('Authorization', `Bearer ${tokenFor(a1)}`)
    .send({ batches: batches.slice(0, 1) });
  assert.equal(badRows.status, 400, 'row count change rejected');

  const regen = await request(app).put(`/api/batch-reports/${id}`)
    .set('Authorization', `Bearer ${tokenFor(a1)}`)
    .send({ regenerate: true });
  assert.equal(regen.status, 200);
  assert.notEqual((regen.body.batches as typeof batches)[0].actuals[key], 999, 'regenerated');

  // Cross-plant access blocked.
  const cross = await request(app).get(`/api/batch-reports/${id}`).set('Authorization', `Bearer ${tokenFor(a2)}`);
  assert.equal(cross.status, 404);
  const crossDel = await request(app).delete(`/api/batch-reports/${id}`).set('Authorization', `Bearer ${tokenFor(a2)}`);
  assert.equal(crossDel.body.ok, false);

  const del = await request(app).delete(`/api/batch-reports/${id}`).set('Authorization', `Bearer ${tokenFor(a1)}`);
  assert.equal(del.body.ok, true);
});
