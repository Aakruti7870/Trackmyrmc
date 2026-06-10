import { Router } from 'express';
import { sql, gte, lte, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, clients, batchRecords } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
function dateRange(req) {
    const { from, to } = req.query;
    const filters = [];
    if (from)
        filters.push(gte(challans.createdAt, new Date(from)));
    if (to)
        filters.push(lte(challans.createdAt, new Date(to)));
    return filters;
}
// Sum of delivered quantity (treats unrecorded deliveries as 0)
const deliveredQtySql = sql `coalesce(sum(${challans.deliveredQuantity}::numeric), 0)`;
// Planned quantity counted only for challans that have a recorded delivered qty,
// so variance compares like-for-like (delivered subset) and isn't skewed by
// in-flight/pending challans that have no delivered figure yet.
const plannedForDeliveredSql = sql `coalesce(sum(${challans.quantity}::numeric) filter (where ${challans.deliveredQuantity} is not null), 0)`;
const varianceSql = sql `coalesce(sum(${challans.deliveredQuantity}::numeric), 0) - coalesce(sum(${challans.quantity}::numeric) filter (where ${challans.deliveredQuantity} is not null), 0)`;
router.get('/client-wise', async (req, res) => {
    const filters = dateRange(req);
    const rows = await db.select({
        clientId: challans.clientId,
        clientName: clients.name,
        totalQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
        deliveredQty: deliveredQtySql,
        plannedForDelivered: plannedForDeliveredSql,
        variance: varianceSql,
        totalChallans: sql `count(*)::int`,
    }).from(challans)
        .leftJoin(clients, sql `${challans.clientId} = ${clients.id}`)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(challans.clientId, clients.name)
        .orderBy(desc(sql `sum(${challans.quantity}::numeric)`));
    res.json(rows);
});
router.get('/grade-wise', async (req, res) => {
    const filters = dateRange(req);
    const rows = await db.select({
        grade: challans.grade,
        totalQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
        deliveredQty: deliveredQtySql,
        plannedForDelivered: plannedForDeliveredSql,
        variance: varianceSql,
        totalChallans: sql `count(*)::int`,
    }).from(challans)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(challans.grade)
        .orderBy(desc(sql `sum(${challans.quantity}::numeric)`));
    res.json(rows);
});
router.get('/dispatch', async (req, res) => {
    const { from, to } = req.query;
    const filters = [];
    if (from)
        filters.push(gte(challans.createdAt, new Date(from)));
    if (to)
        filters.push(lte(challans.createdAt, new Date(to)));
    const rows = await db.select({
        date: sql `date(${challans.createdAt})`,
        totalQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
        deliveredQty: deliveredQtySql,
        plannedForDelivered: plannedForDeliveredSql,
        variance: varianceSql,
        count: sql `count(*)::int`,
    }).from(challans)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(sql `date(${challans.createdAt})`)
        .orderBy(sql `date(${challans.createdAt})`);
    res.json(rows);
});
router.get('/production', async (req, res) => {
    const { from, to } = req.query;
    const filters = [];
    if (from)
        filters.push(gte(batchRecords.createdAt, new Date(from)));
    if (to)
        filters.push(lte(batchRecords.createdAt, new Date(to)));
    const rows = await db.select({
        date: sql `date(${batchRecords.createdAt})`,
        totalQty: sql `coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
        count: sql `count(*)::int`,
        grade: batchRecords.grade,
    }).from(batchRecords)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(sql `date(${batchRecords.createdAt})`, batchRecords.grade)
        .orderBy(sql `date(${batchRecords.createdAt})`);
    res.json(rows);
});
router.get('/export', async (req, res) => {
    const { report = 'dispatch', from, to } = req.query;
    const filters = [];
    if (from)
        filters.push(gte(challans.createdAt, new Date(from)));
    if (to)
        filters.push(lte(challans.createdAt, new Date(to)));
    let csv = '';
    if (report === 'dispatch') {
        const rows = await db.select({
            challanNo: challans.challanNo,
            clientName: clients.name,
            grade: challans.grade,
            quantity: challans.quantity,
            deliveredQuantity: challans.deliveredQuantity,
            status: challans.status,
            dispatchTime: challans.dispatchTime,
            deliveryTime: challans.deliveryTime,
        }).from(challans)
            .leftJoin(clients, sql `${challans.clientId} = ${clients.id}`)
            .where(filters.length ? and(...filters) : undefined)
            .orderBy(desc(challans.createdAt));
        csv = 'Challan No,Client,Grade,Planned Qty (m³),Delivered Qty (m³),Variance (m³),Status,Dispatch Time,Delivery Time\n';
        csv += rows.map(r => {
            const variance = r.deliveredQuantity != null
                ? (Number(r.deliveredQuantity) - Number(r.quantity)).toFixed(2)
                : '';
            return `${r.challanNo},"${r.clientName}",${r.grade},${r.quantity},${r.deliveredQuantity ?? ''},${variance},${r.status},${r.dispatchTime || ''},${r.deliveryTime || ''}`;
        }).join('\n');
    }
    else if (report === 'production') {
        const bfilters = [];
        if (from)
            bfilters.push(gte(batchRecords.createdAt, new Date(from)));
        if (to)
            bfilters.push(lte(batchRecords.createdAt, new Date(to)));
        const rows = await db.select().from(batchRecords)
            .where(bfilters.length ? and(...bfilters) : undefined)
            .orderBy(desc(batchRecords.createdAt));
        csv = 'Batch No,Grade,Qty (m³),Cement Bags,Water (L),Sand (kg),Aggregate (kg),Operator,Date\n';
        csv += rows.map(r => `${r.batchNo},${r.grade},${r.quantity},${r.cementBags || ''},${r.waterLiters || ''},${r.sandKg || ''},${r.aggregateKg || ''},"${r.operator || ''}",${r.createdAt.toISOString().slice(0, 10)}`).join('\n');
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${report}-report.csv`);
    res.send(csv);
});
export default router;
