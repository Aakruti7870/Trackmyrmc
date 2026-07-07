import { Router } from 'express';
import { eq, and, desc, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { batchReports, mixDesigns, challans, clients, sites, vehicles, drivers, orders } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { getSetting, setSetting } from '../lib/settings.js';
import {
  computeBatchSizes, generateActuals, computeTotals,
  parseBatches, type RecipeMaterial, type BatchRow,
} from '../lib/batchSheet.js';

const router = Router();
router.use(requireAuth);

// Batch sheets are plant-private production data — same audience as the mix
// design master.
const SHEET_ROLES = ['authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'quality_engineer', 'store_manager'] as const;
router.use(requireRole(...SHEET_ROLES));

// ——— Plant-wise batching settings (plant type, mixer capacity, batch size) ———
// Stored per plant in app_settings so a null-plant global admin keeps its own
// "global" bucket. Material names/tolerances live on each mix design.
interface BatchSettings {
  plantType: string;
  mixerCapacityCum: number;
  batchSizeCum: number;
}
const DEFAULT_SETTINGS: BatchSettings = { plantType: '', mixerCapacityCum: 1, batchSizeCum: 1 };
const settingsKey = (plantId: number | null | undefined) => `batch_settings:${plantId ?? 'global'}`;

router.get('/settings', async (req, res) => {
  const raw = await getSetting(settingsKey(req.user!.plantId));
  if (!raw) { res.json(DEFAULT_SETTINGS); return; }
  try { res.json({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) }); }
  catch { res.json(DEFAULT_SETTINGS); }
});

router.put('/settings', async (req, res) => {
  const { plantType, mixerCapacityCum, batchSizeCum } = req.body;
  const cap = Number(mixerCapacityCum);
  const size = Number(batchSizeCum);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 50) { res.status(400).json({ error: 'Mixer capacity must be 0–50 cum' }); return; }
  if (!Number.isFinite(size) || size <= 0 || size > 50) { res.status(400).json({ error: 'Batch size must be 0–50 cum' }); return; }
  if (size > cap + 1e-9) { res.status(400).json({ error: 'Batch size cannot exceed mixer capacity' }); return; }
  const value: BatchSettings = {
    plantType: typeof plantType === 'string' ? plantType.trim().slice(0, 80) : '',
    mixerCapacityCum: cap,
    batchSizeCum: size,
  };
  await setSetting(settingsKey(req.user!.plantId), JSON.stringify(value));
  res.json(value);
});

// ——— Report numbers: globally sequential like batch/challan numbers ———
async function nextReportNo() {
  const [last] = await db.select({ reportNo: batchReports.reportNo }).from(batchReports)
    .orderBy(desc(batchReports.id)).limit(1);
  if (!last) return 'BSR-001';
  const n = parseInt(last.reportNo.split('-')[1] || '0', 10);
  return `BSR-${String(n + 1).padStart(3, '0')}`;
}

router.get('/', async (req, res) => {
  const scope = plantScope(req.user!.plantId, batchReports.plantId);
  let query = db.select({
    id: batchReports.id, reportNo: batchReports.reportNo, grade: batchReports.grade,
    recipeName: batchReports.recipeName, recipeCode: batchReports.recipeCode,
    productionQty: batchReports.productionQty, batchSize: batchReports.batchSize,
    customer: batchReports.customer, site: batchReports.site, truckNo: batchReports.truckNo,
    batchDate: batchReports.batchDate, challanId: batchReports.challanId,
    challanNo: challans.challanNo,
    createdAt: batchReports.createdAt,
    batchCount: sql<number>`jsonb_array_length(${batchReports.batches})`,
  }).from(batchReports)
    .leftJoin(challans, eq(batchReports.challanId, challans.id))
    .$dynamic();
  if (scope) query = query.where(scope);
  const rows = await query.orderBy(desc(batchReports.createdAt)).limit(200);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, batchReports.plantId);
  const idEq = eq(batchReports.id, +req.params.id);
  const [row] = await db.select({
    report: batchReports,
    challanNo: challans.challanNo,
  }).from(batchReports)
    .leftJoin(challans, eq(batchReports.challanId, challans.id))
    .where(scope ? and(idEq, scope) : idEq);
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const materials = row.report.materials as unknown as RecipeMaterial[];
  const batches = row.report.batches as unknown as BatchRow[];
  res.json({ ...row.report, challanNo: row.challanNo, totals: computeTotals(materials, batches) });
});

// Loads a challan (scope-checked) with the joined names used to prefill the
// sheet header, plus the order's total for Ordered Qty and the cumulative
// delivered qty including this load for With This Load.
async function loadChallanBrief(actorPlantId: number | null | undefined, challanId: number) {
  const scope = plantScope(actorPlantId, challans.plantId);
  const idEq = eq(challans.id, challanId);
  const [c] = await db.select({
    id: challans.id, challanNo: challans.challanNo, grade: challans.grade,
    quantity: challans.quantity, orderId: challans.orderId,
    dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
    createdAt: challans.createdAt,
    clientName: clients.name, siteName: sites.name,
    vehicleNo: vehicles.vehicleNo, driverName: drivers.name,
    orderQty: orders.quantity,
  }).from(challans)
    .leftJoin(clients, eq(challans.clientId, clients.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .leftJoin(orders, eq(challans.orderId, orders.id))
    .where(scope ? and(idEq, scope) : idEq);
  if (!c) return null;
  let withThisLoad = Number(c.quantity) || 0;
  if (c.orderId) {
    const [sum] = await db.select({
      total: sql<string>`coalesce(sum(${challans.quantity}::numeric), 0)`,
    }).from(challans).where(and(eq(challans.orderId, c.orderId), lte(challans.id, c.id)));
    withThisLoad = Number(sum?.total) || withThisLoad;
  }
  return { ...c, withThisLoad };
}

const str = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
// 'YYYY-MM-DD' | null
const dateStr = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
// 'HH:MM' or 'HH:MM:SS' | null — exact time stamps for batch start/end.
const timeStr = (v: unknown) => (typeof v === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : null);

router.post('/', async (req, res) => {
  const { mixDesignId, challanId } = req.body;

  // Recipe: the plant's mix design master row (scope-checked).
  const mdScope = plantScope(req.user!.plantId, mixDesigns.plantId);
  const mdEq = eq(mixDesigns.id, +mixDesignId);
  const [design] = await db.select().from(mixDesigns).where(mdScope ? and(mdEq, mdScope) : mdEq);
  if (!design) { res.status(400).json({ error: 'Mix design not found' }); return; }
  const materials = design.materials as unknown as RecipeMaterial[];

  const productionQty = num(req.body.productionQty);
  const batchSize = num(req.body.batchSize);
  if (!productionQty) { res.status(400).json({ error: 'Production quantity is required' }); return; }
  if (!batchSize) { res.status(400).json({ error: 'Batch size is required' }); return; }
  const mixerCapacity = num(req.body.mixerCapacity);
  if (mixerCapacity && batchSize > mixerCapacity + 1e-9) {
    res.status(400).json({ error: 'Batch size cannot exceed mixer capacity' }); return;
  }

  let sizes: number[];
  try { sizes = computeBatchSizes(productionQty, batchSize); } catch (e) {
    res.status(400).json({ error: (e as Error).message }); return;
  }
  const batches: BatchRow[] = sizes.map((size) => ({ size, actuals: generateActuals(materials, size) }));

  // Optional challan attachment: prefill header from the challan (any explicit
  // body value still wins so the user can override).
  let challan = null;
  if (challanId != null && challanId !== '') {
    challan = await loadChallanBrief(req.user!.plantId, +challanId);
    if (!challan) { res.status(400).json({ error: 'Challan not found' }); return; }
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const fmtTime = (d: Date | null | undefined) =>
    d ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : null;

  const reportNo = await nextReportNo();
  const [row] = await db.insert(batchReports).values({
    plantId: req.user!.plantId ?? null,
    reportNo,
    challanId: challan?.id ?? null,
    grade: design.grade,
    recipeName: design.recipeName,
    recipeCode: design.recipeCode,
    plantType: str(req.body.plantType, 80),
    mixerCapacity: mixerCapacity != null ? mixerCapacity.toString() : null,
    batchSize: batchSize.toString(),
    productionQty: productionQty.toString(),
    orderedQty: (num(req.body.orderedQty) ?? (challan?.orderQty != null ? Number(challan.orderQty) : null))?.toString() ?? null,
    withThisLoad: (num(req.body.withThisLoad) ?? challan?.withThisLoad ?? null)?.toString() ?? null,
    truckNo: str(req.body.truckNo, 40) ?? challan?.vehicleNo ?? null,
    truckDriver: str(req.body.truckDriver, 80) ?? challan?.driverName ?? null,
    customer: str(req.body.customer) ?? challan?.clientName ?? null,
    site: str(req.body.site) ?? challan?.siteName ?? null,
    // Exact date + time stamps: explicit values win, else the challan's
    // dispatch/delivery times, else "now" at generation.
    batchDate: dateStr(req.body.batchDate) ?? todayDate,
    startTime: timeStr(req.body.startTime) ?? fmtTime(challan?.dispatchTime) ?? nowTime,
    endTime: timeStr(req.body.endTime) ?? fmtTime(challan?.deliveryTime) ?? null,
    materials,
    batches,
    createdBy: req.user!.id,
  }).returning();

  res.status(201).json({ ...row, challanNo: challan?.challanNo ?? null, totals: computeTotals(materials, batches) });
});

router.put('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, batchReports.plantId);
  const idEq = eq(batchReports.id, +req.params.id);
  const [existing] = await db.select().from(batchReports).where(scope ? and(idEq, scope) : idEq);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const materials = existing.materials as unknown as RecipeMaterial[];

  let batches = existing.batches as unknown as BatchRow[];
  if (req.body.regenerate === true) {
    batches = batches.map((b) => ({ size: b.size, actuals: generateActuals(materials, b.size) }));
  } else if (req.body.batches !== undefined) {
    try { batches = parseBatches(req.body.batches, materials); } catch (e) {
      res.status(400).json({ error: (e as Error).message }); return;
    }
    if (batches.length !== (existing.batches as unknown[]).length) {
      res.status(400).json({ error: 'Batch row count cannot change' }); return;
    }
  }

  const patch: Partial<typeof batchReports.$inferInsert> = { batches, updatedAt: new Date() };
  const strFields = ['plantType', 'truckNo', 'truckDriver', 'customer', 'site'] as const;
  for (const f of strFields) if (f in req.body) patch[f] = str(req.body[f], f === 'plantType' ? 80 : 120);
  if ('orderedQty' in req.body) patch.orderedQty = num(req.body.orderedQty)?.toString() ?? null;
  if ('withThisLoad' in req.body) patch.withThisLoad = num(req.body.withThisLoad)?.toString() ?? null;
  if ('batchDate' in req.body) patch.batchDate = dateStr(req.body.batchDate) ?? existing.batchDate;
  if ('startTime' in req.body) patch.startTime = timeStr(req.body.startTime) ?? existing.startTime;
  if ('endTime' in req.body) patch.endTime = timeStr(req.body.endTime);

  const [row] = await db.update(batchReports).set(patch)
    .where(scope ? and(idEq, scope) : idEq).returning();
  res.json({ ...row, totals: computeTotals(materials, row.batches as unknown as BatchRow[]) });
});

router.delete('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, batchReports.plantId);
  const idEq = eq(batchReports.id, +req.params.id);
  const deleted = await db.delete(batchReports)
    .where(scope ? and(idEq, scope) : idEq)
    .returning({ id: batchReports.id });
  res.json({ ok: deleted.length > 0 });
});

export default router;
