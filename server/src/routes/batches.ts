import { Router } from 'express';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { batchRecords } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';

const router = Router();
router.use(requireAuth);

// Production logs are plant-private staff data — customers and drivers never see
// another plant's (or any) batch records. Every read/write is hard-scoped to the
// actor's plant (a null-plant legacy global admin stays unscoped and sees all).
const PRODUCTION_ROLES = ['authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator'] as const;
router.use(requireRole(...PRODUCTION_ROLES));

// Batch numbers stay GLOBALLY sequential (batch_no is globally unique) so two
// plants can never mint the same number — a plant's own sequence may have gaps,
// which is fine.
async function nextBatchNo() {
  const [last] = await db.select({ batchNo: batchRecords.batchNo }).from(batchRecords)
    .orderBy(desc(batchRecords.id)).limit(1);
  if (!last) return 'BTH-001';
  const n = parseInt(last.batchNo.split('-')[1] || '0', 10);
  return `BTH-${String(n + 1).padStart(3, '0')}`;
}

router.get('/', async (req, res) => {
  const { from, to, grade } = req.query;
  let query = db.select().from(batchRecords).$dynamic();
  const filters = [];
  const scope = plantScope(req.user!.plantId, batchRecords.plantId);
  if (scope) filters.push(scope);
  if (from) filters.push(gte(batchRecords.createdAt, new Date(from as string)));
  if (to) filters.push(lte(batchRecords.createdAt, new Date(to as string)));
  if (grade) filters.push(eq(batchRecords.grade, grade as string));
  if (filters.length) query = query.where(and(...filters));
  const rows = await query.orderBy(desc(batchRecords.createdAt));
  res.json(rows);
});

router.get('/summary', async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scope = plantScope(req.user!.plantId, batchRecords.plantId);
  const todayFilter = gte(batchRecords.createdAt, today);
  const [summary] = await db.select({
    totalBatches: sql<number>`count(*)::int`,
    totalQty: sql<number>`coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
    totalCement: sql<number>`coalesce(sum(${batchRecords.cementBags}), 0)`,
    totalWater: sql<number>`coalesce(sum(${batchRecords.waterLiters}), 0)`,
  }).from(batchRecords).where(scope ? and(todayFilter, scope) : todayFilter);
  res.json(summary);
});

router.get('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, batchRecords.plantId);
  const idEq = eq(batchRecords.id, +req.params.id);
  const [row] = await db.select().from(batchRecords).where(scope ? and(idEq, scope) : idEq);
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.post('/', async (req, res) => {
  const { grade, quantity, cementBags, waterLiters, sandKg, aggregateKg, operator, remarks } = req.body;
  const batchNo = await nextBatchNo();
  // Stamp the producing plant so the record is private to it (null for a global admin).
  const [row] = await db.insert(batchRecords).values({
    plantId: req.user!.plantId ?? null,
    batchNo, grade, quantity: quantity.toString(),
    cementBags: cementBags ? +cementBags : null,
    waterLiters: waterLiters ? +waterLiters : null,
    sandKg: sandKg ? +sandKg : null,
    aggregateKg: aggregateKg ? +aggregateKg : null,
    operator, remarks,
  }).returning();
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const { grade, quantity, cementBags, waterLiters, sandKg, aggregateKg, operator, remarks } = req.body;
  const scope = plantScope(req.user!.plantId, batchRecords.plantId);
  const idEq = eq(batchRecords.id, +req.params.id);
  const [row] = await db.update(batchRecords).set({
    grade, quantity: quantity?.toString(),
    cementBags: cementBags ? +cementBags : null,
    waterLiters: waterLiters ? +waterLiters : null,
    sandKg: sandKg ? +sandKg : null,
    aggregateKg: aggregateKg ? +aggregateKg : null,
    operator, remarks,
  }).where(scope ? and(idEq, scope) : idEq).returning();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, batchRecords.plantId);
  const idEq = eq(batchRecords.id, +req.params.id);
  const deleted = await db.delete(batchRecords)
    .where(scope ? and(idEq, scope) : idEq)
    .returning({ id: batchRecords.id });
  res.json({ ok: deleted.length > 0 });
});

export default router;
