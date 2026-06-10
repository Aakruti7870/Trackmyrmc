import { Router } from 'express';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { batchRecords } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
async function nextBatchNo() {
    const [last] = await db.select({ batchNo: batchRecords.batchNo }).from(batchRecords)
        .orderBy(desc(batchRecords.id)).limit(1);
    if (!last)
        return 'BTH-001';
    const n = parseInt(last.batchNo.split('-')[1] || '0', 10);
    return `BTH-${String(n + 1).padStart(3, '0')}`;
}
router.get('/', async (req, res) => {
    const { from, to, grade } = req.query;
    let query = db.select().from(batchRecords).$dynamic();
    const filters = [];
    if (from)
        filters.push(gte(batchRecords.createdAt, new Date(from)));
    if (to)
        filters.push(lte(batchRecords.createdAt, new Date(to)));
    if (grade)
        filters.push(eq(batchRecords.grade, grade));
    if (filters.length)
        query = query.where(and(...filters));
    const rows = await query.orderBy(desc(batchRecords.createdAt));
    res.json(rows);
});
router.get('/summary', async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [summary] = await db.select({
        totalBatches: sql `count(*)::int`,
        totalQty: sql `coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
        totalCement: sql `coalesce(sum(${batchRecords.cementBags}), 0)`,
        totalWater: sql `coalesce(sum(${batchRecords.waterLiters}), 0)`,
    }).from(batchRecords).where(gte(batchRecords.createdAt, today));
    res.json(summary);
});
router.get('/:id', async (req, res) => {
    const [row] = await db.select().from(batchRecords).where(eq(batchRecords.id, +req.params.id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
router.post('/', async (req, res) => {
    const { grade, quantity, cementBags, waterLiters, sandKg, aggregateKg, operator, remarks } = req.body;
    const batchNo = await nextBatchNo();
    const [row] = await db.insert(batchRecords).values({
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
    const [row] = await db.update(batchRecords).set({
        grade, quantity: quantity?.toString(),
        cementBags: cementBags ? +cementBags : null,
        waterLiters: waterLiters ? +waterLiters : null,
        sandKg: sandKg ? +sandKg : null,
        aggregateKg: aggregateKg ? +aggregateKg : null,
        operator, remarks,
    }).where(eq(batchRecords.id, +req.params.id)).returning();
    res.json(row);
});
router.delete('/:id', async (req, res) => {
    await db.delete(batchRecords).where(eq(batchRecords.id, +req.params.id));
    res.json({ ok: true });
});
export default router;
