import { Router } from 'express';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, clients, sites } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { plantScope, clientInScope } from '../lib/tenancy.js';
import { notifyOrderPlaced, notifyOrderDecision } from '../lib/deliveryNotify.js';
// The full order projection shared by the list and detail selects. Includes the
// customer approval snapshot fields so staff can review/auto-fill a challan. The
// displayed site name prefers the linked site, falling back to the order's own
// snapshot when the customer ordered without a saved site.
const orderSelect = {
    id: orders.id, orderNo: orders.orderNo, grade: orders.grade,
    quantity: orders.quantity, pumpRequired: orders.pumpRequired,
    pumpLineLength: orders.pumpLineLength,
    deliveryDate: orders.deliveryDate, deliveryTime: orders.deliveryTime,
    status: orders.status, notes: orders.notes, createdAt: orders.createdAt,
    clientId: orders.clientId, siteId: orders.siteId,
    contactPerson: orders.contactPerson, contactNumber: orders.contactNumber,
    siteAddress: orders.siteAddress, latitude: orders.latitude, longitude: orders.longitude,
    paymentType: orders.paymentType, poNumber: orders.poNumber,
    sitePhoto: orders.sitePhoto, rejectionReason: orders.rejectionReason,
    clientName: clients.name,
    siteName: sql `coalesce(${sites.name}, ${orders.siteName})`,
};
const router = Router();
router.use(requireAuth);
// Staff-only surface. Customers read their own cross-plant orders via /api/me/*;
// the marketplace authority never sees customer PII (per the tenancy model). This
// also closes the leak where a null-plantId non-staff account would otherwise be
// treated as "global" by plantScope and see every plant's orders.
router.use(requireRole('admin', 'dispatcher'));
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
    let query = db.select(orderSelect).from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .leftJoin(sites, eq(orders.siteId, sites.id))
        .$dynamic();
    const filters = [];
    // Hard-scope a plant-bound staff/owner to their own plant's orders. A null
    // plantId (legacy global admin) sees everything.
    const scope = plantScope(req.user.plantId, orders.plantId);
    if (scope)
        filters.push(scope);
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
    const [row] = await db.select(orderSelect).from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .leftJoin(sites, eq(orders.siteId, sites.id))
        .where(and(eq(orders.id, +req.params.id), plantScope(req.user.plantId, orders.plantId)));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
router.post('/', async (req, res) => {
    const { clientId, siteId, grade, quantity, pumpRequired, deliveryDate, deliveryTime, notes } = req.body;
    // A plant-bound staff/owner may only order for one of their own plant's
    // customers — never bind to another plant's client row. (404, not 403, so a
    // foreign id is indistinguishable from a missing one.)
    if (!(await clientInScope(req.user.plantId, +clientId))) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }
    // Bind the order to a plant. A plant-scoped staff/owner can only ever create
    // orders for their own plant; a legacy global admin inherits the client's plant
    // so the row is still tenanted.
    let plantId = req.user.plantId ?? null;
    if (plantId == null) {
        const [client] = await db.select({ plantId: clients.plantId }).from(clients).where(eq(clients.id, +clientId));
        plantId = client?.plantId ?? null;
    }
    const orderNo = await nextOrderNo();
    // Staff-placed orders are pre-approved (the staff creating it is the approver),
    // so they are immediately dispatchable — no customer approval round-trip.
    const [row] = await db.insert(orders).values({
        orderNo, clientId: +clientId, siteId: siteId ? +siteId : null,
        plantId,
        grade, quantity: quantity.toString(),
        pumpRequired: !!pumpRequired,
        deliveryDate, deliveryTime, notes,
        status: 'approved',
    }).returning();
    // Confirm the order to the customer over WhatsApp (best-effort).
    void notifyOrderPlaced(row.id);
    res.status(201).json(row);
});
// Staff approve a customer order that is awaiting approval, making it
// dispatchable. Only an order in 'pending_approval' can be approved. Plant-scoped
// so a plant-bound admin can never approve another plant's order.
router.post('/:id/approve', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    const [prev] = await db.select({ status: orders.status })
        .from(orders).where(and(eq(orders.id, id), plantScope(req.user.plantId, orders.plantId)));
    if (!prev) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (prev.status !== 'pending_approval') {
        res.status(409).json({ error: 'Only an order awaiting approval can be approved.' });
        return;
    }
    const [row] = await db.update(orders).set({ status: 'approved', rejectionReason: null })
        .where(and(eq(orders.id, id), plantScope(req.user.plantId, orders.plantId))).returning();
    emitSSEEvent('order.updated', row, { clientId: row.clientId });
    void notifyOrderDecision(row.id, 'approved');
    res.json(row);
});
// Staff reject a customer order awaiting approval, with an optional reason
// surfaced back to the customer. Only a 'pending_approval' order can be rejected.
router.post('/:id/reject', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : null;
    const [prev] = await db.select({ status: orders.status })
        .from(orders).where(and(eq(orders.id, id), plantScope(req.user.plantId, orders.plantId)));
    if (!prev) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (prev.status !== 'pending_approval') {
        res.status(409).json({ error: 'Only an order awaiting approval can be rejected.' });
        return;
    }
    const [row] = await db.update(orders).set({ status: 'rejected', rejectionReason: reason })
        .where(and(eq(orders.id, id), plantScope(req.user.plantId, orders.plantId))).returning();
    emitSSEEvent('order.updated', row, { clientId: row.clientId });
    void notifyOrderDecision(row.id, 'rejected');
    res.json(row);
});
router.put('/:id', async (req, res) => {
    const { clientId, siteId, grade, quantity, pumpRequired, deliveryDate, deliveryTime, notes, status } = req.body;
    const [prev] = await db.select({ status: orders.status })
        .from(orders).where(and(eq(orders.id, +req.params.id), plantScope(req.user.plantId, orders.plantId)));
    if (!prev) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    // Retargeting to a customer must stay within the actor's plant — a plant can't
    // reassign its order to another plant's client row.
    if (clientId !== undefined && clientId && !(await clientInScope(req.user.plantId, +clientId))) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }
    // Ignore blank/whitespace-only notes so an accidental empty edit can't wipe
    // an existing order note (mirrors the challan route's write-role guard). An
    // explicit null still clears the note; undefined leaves it untouched.
    const notesUpdate = notes !== undefined && (typeof notes !== 'string' || notes.trim())
        ? notes
        : undefined;
    // Mirror the notes guard for siteId: omitting it (undefined) leaves the saved
    // site untouched, so a partial edit can't silently clear it. An explicit
    // falsy value (null/0/'') still clears the optional site on purpose.
    const siteIdUpdate = siteId === undefined ? undefined : (siteId ? +siteId : null);
    const [row] = await db.update(orders).set({
        clientId: clientId ? +clientId : undefined,
        siteId: siteIdUpdate,
        grade, quantity: quantity?.toString(),
        pumpRequired: pumpRequired !== undefined ? !!pumpRequired : undefined,
        deliveryDate, deliveryTime, notes: notesUpdate, status,
    }).where(and(eq(orders.id, +req.params.id), plantScope(req.user.plantId, orders.plantId))).returning();
    if (row && status !== undefined && prev?.status !== row.status) {
        emitSSEEvent('order.updated', row, { clientId: row.clientId });
    }
    res.json(row);
});
router.delete('/:id', async (req, res) => {
    await db.delete(orders).where(and(eq(orders.id, +req.params.id), plantScope(req.user.plantId, orders.plantId)));
    res.json({ ok: true });
});
export default router;
