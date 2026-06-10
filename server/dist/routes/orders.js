import { Router } from 'express';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, clients, sites } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
const router = Router();
router.use(requireAuth);
async function nextOrderNo() {
    const [last] = await db.select({ orderNo: orders.orderNo }).from(orders)
        .orderBy(desc(orders.id)).limit(1);
    if (!last)
        return 'ORD-001';
    const n = parseInt(last.orderNo.split('-')[1] || '0', 10);
    return `ORD-${String(n + 1).padStart(3, '0')}`;
}
router.get('/', async (req, res) => {
    const { status, clientId, from, to } = req.query;
    let query = db.select({
        id: orders.id, orderNo: orders.orderNo, grade: orders.grade,
        quantity: orders.quantity, pumpRequired: orders.pumpRequired,
        deliveryDate: orders.deliveryDate, deliveryTime: orders.deliveryTime,
        status: orders.status, notes: orders.notes, createdAt: orders.createdAt,
        clientId: orders.clientId, siteId: orders.siteId,
        clientName: clients.name, siteName: sites.name,
    }).from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .leftJoin(sites, eq(orders.siteId, sites.id))
        .$dynamic();
    const filters = [];
    if (status)
        filters.push(eq(orders.status, status));
    if (clientId)
        filters.push(eq(orders.clientId, +clientId));
    if (from)
        filters.push(gte(orders.deliveryDate, from));
    if (to)
        filters.push(lte(orders.deliveryDate, to));
    if (filters.length)
        query = query.where(and(...filters));
    const rows = await query.orderBy(desc(orders.createdAt));
    res.json(rows);
});
router.get('/:id', async (req, res) => {
    const [row] = await db.select({
        id: orders.id, orderNo: orders.orderNo, grade: orders.grade,
        quantity: orders.quantity, pumpRequired: orders.pumpRequired,
        deliveryDate: orders.deliveryDate, deliveryTime: orders.deliveryTime,
        status: orders.status, notes: orders.notes, createdAt: orders.createdAt,
        clientId: orders.clientId, siteId: orders.siteId,
        clientName: clients.name, siteName: sites.name,
    }).from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .leftJoin(sites, eq(orders.siteId, sites.id))
        .where(eq(orders.id, +req.params.id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
router.post('/', async (req, res) => {
    const { clientId, siteId, grade, quantity, pumpRequired, deliveryDate, deliveryTime, notes } = req.body;
    const orderNo = await nextOrderNo();
    const [row] = await db.insert(orders).values({
        orderNo, clientId: +clientId, siteId: siteId ? +siteId : null,
        grade, quantity: quantity.toString(),
        pumpRequired: !!pumpRequired,
        deliveryDate, deliveryTime, notes,
    }).returning();
    res.status(201).json(row);
});
router.put('/:id', async (req, res) => {
    const { clientId, siteId, grade, quantity, pumpRequired, deliveryDate, deliveryTime, notes, status } = req.body;
    const [prev] = await db.select({ status: orders.status })
        .from(orders).where(eq(orders.id, +req.params.id));
    const [row] = await db.update(orders).set({
        clientId: clientId ? +clientId : undefined,
        siteId: siteId ? +siteId : null,
        grade, quantity: quantity?.toString(),
        pumpRequired: pumpRequired !== undefined ? !!pumpRequired : undefined,
        deliveryDate, deliveryTime, notes, status,
    }).where(eq(orders.id, +req.params.id)).returning();
    if (row && status !== undefined && prev?.status !== row.status) {
        emitSSEEvent('order.updated', row);
    }
    res.json(row);
});
router.delete('/:id', async (req, res) => {
    await db.delete(orders).where(eq(orders.id, +req.params.id));
    res.json({ ok: true });
});
export default router;
