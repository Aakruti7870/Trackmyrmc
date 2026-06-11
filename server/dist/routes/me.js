import { Router } from 'express';
import { eq, desc, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, clients, orders, challans, challanProofPhotos, sites, vehicles, drivers, ledgerEntries, recurringOrders } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';
import { nextOrderNo } from '../lib/orderNo.js';
import { computeFirstRunDate } from '../lib/recurring.js';
const router = Router();
router.use(requireAuth);
// Resolve a siteId from the request, ensuring it belongs to the caller's client.
// Returns: { ok:true, siteId } on success/absence, or { ok:false } if the site
// is present but not owned by this client.
async function resolveOwnedSiteId(value, clientId) {
    if (value === undefined || value === null || value === '')
        return { ok: true, siteId: null };
    const siteId = Number(value);
    if (!Number.isInteger(siteId) || siteId <= 0)
        return { ok: false };
    const [site] = await db.select({ id: sites.id })
        .from(sites).where(and(eq(sites.id, siteId), eq(sites.clientId, clientId)));
    return site ? { ok: true, siteId } : { ok: false };
}
const challanSelect = {
    id: challans.id, challanNo: challans.challanNo,
    grade: challans.grade, quantity: challans.quantity,
    deliveredQuantity: challans.deliveredQuantity,
    pumpRequired: challans.pumpRequired,
    dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
    status: challans.status, notes: challans.notes, createdAt: challans.createdAt,
    orderId: challans.orderId, clientId: challans.clientId,
    siteId: challans.siteId, vehicleId: challans.vehicleId, driverId: challans.driverId,
    clientName: clients.name,
    siteName: sites.name,
    siteLat: sites.latitude,
    siteLng: sites.longitude,
    vehicleNo: vehicles.vehicleNo,
    driverName: drivers.name,
    driverPhone: drivers.phone,
    hasProofPhoto: sql `exists (select 1 from ${challanProofPhotos} where ${challanProofPhotos.challanId} = ${challans.id})`,
};
async function getLinkedClientId(userId) {
    const [row] = await db.select({ linkedClientId: users.linkedClientId })
        .from(users).where(eq(users.id, userId));
    return row?.linkedClientId ?? null;
}
async function getLinkedDriverId(userId) {
    const [row] = await db.select({ linkedDriverId: users.linkedDriverId })
        .from(users).where(eq(users.id, userId));
    return row?.linkedDriverId ?? null;
}
router.get('/orders', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.json([]);
        return;
    }
    const rows = await db.select({
        id: orders.id, orderNo: orders.orderNo, grade: orders.grade,
        quantity: orders.quantity, pumpRequired: orders.pumpRequired,
        deliveryDate: orders.deliveryDate, deliveryTime: orders.deliveryTime,
        status: orders.status, notes: orders.notes, createdAt: orders.createdAt,
        clientId: orders.clientId, siteId: orders.siteId,
        clientName: clients.name, siteName: sites.name,
    }).from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .leftJoin(sites, eq(orders.siteId, sites.id))
        .where(eq(orders.clientId, clientId))
        .orderBy(desc(orders.createdAt));
    res.json(rows);
});
// A client places a new order for themselves. The order always belongs to the
// caller's linked client and starts as 'pending' for staff to process — the
// client can never set the client, status, or order number.
router.post('/orders', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(400).json({ error: 'Your account is not linked to a client.' });
        return;
    }
    const { grade, quantity, pumpRequired, deliveryDate, deliveryTime, notes, siteId } = req.body;
    if (!grade || typeof grade !== 'string') {
        res.status(400).json({ error: 'Grade is required.' });
        return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
        res.status(400).json({ error: 'Quantity must be greater than zero.' });
        return;
    }
    const site = await resolveOwnedSiteId(siteId, clientId);
    if (!site.ok) {
        res.status(400).json({ error: 'Invalid delivery site.' });
        return;
    }
    const orderNo = await nextOrderNo();
    const [row] = await db.insert(orders).values({
        orderNo,
        clientId,
        siteId: site.siteId,
        grade,
        quantity: qty.toString(),
        pumpRequired: !!pumpRequired,
        deliveryDate: deliveryDate || null,
        deliveryTime: deliveryTime || null,
        notes: typeof notes === 'string' && notes.trim() ? notes : null,
        status: 'pending',
    }).returning();
    // Notify staff and the client's own sessions — scope to this client so other
    // clients/drivers don't receive someone else's order.
    emitSSEEvent('order.created', row, { clientId: row.clientId });
    res.status(201).json(row);
});
// A customer cancels one of their own orders, but only while it is still
// 'pending' (i.e. the plant has not started/dispatched it). Scoped to the
// caller's linked client so a customer can never touch another client's order.
router.patch('/orders/:id/cancel', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    // Cancel atomically: gate the status inside the UPDATE predicate so a
    // concurrent staff transition (pending -> in_progress) between a read and a
    // write can never be clobbered. No row updated means either the order isn't
    // ours/doesn't exist (404) or it is no longer pending (409); a follow-up
    // existence check disambiguates the two.
    const [row] = await db.update(orders)
        .set({ status: 'cancelled' })
        .where(and(eq(orders.id, id), eq(orders.clientId, clientId), eq(orders.status, 'pending')))
        .returning();
    if (!row) {
        const [existing] = await db.select({ id: orders.id })
            .from(orders)
            .where(and(eq(orders.id, id), eq(orders.clientId, clientId)));
        if (!existing) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.status(409).json({ error: 'Only a pending order can be cancelled.' });
        return;
    }
    emitSSEEvent('order.updated', row, { clientId: row.clientId });
    res.json(row);
});
router.get('/challans', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.json([]);
        return;
    }
    const rows = await db.select(challanSelect).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .where(eq(challans.clientId, clientId))
        .orderBy(desc(challans.createdAt));
    res.json(rows);
});
// Detail for one of the caller's own deliveries, including proof-of-delivery
// photos resolved to short-lived signed URLs. Scoped to the caller's linked
// client so a customer can never read another client's challan or photos —
// the shared /api/challans/:id endpoint is staff-oriented and not client-scoped.
router.get('/challans/:id', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid challan id' });
        return;
    }
    const [row] = await db.select(challanSelect).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .where(and(eq(challans.id, id), eq(challans.clientId, clientId)));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const stored = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos)
        .where(eq(challanProofPhotos.challanId, id))
        .orderBy(challanProofPhotos.id);
    const proofPhotos = (await Promise.all(stored.map(p => proofPhotoStore.resolve(p.photo))))
        .filter((url) => url != null);
    res.json({ ...row, proofPhotos });
});
router.get('/ledger', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.json({ entries: [], outstanding: 0, creditLimit: 0 });
        return;
    }
    const [client] = await db.select({ outstandingAmount: clients.outstandingAmount, creditLimit: clients.creditLimit })
        .from(clients).where(eq(clients.id, clientId));
    const rows = await db.select().from(ledgerEntries)
        .where(eq(ledgerEntries.clientId, clientId))
        .orderBy(desc(ledgerEntries.createdAt));
    let balance = 0;
    const withBalance = rows.map(e => {
        balance += e.type === 'debit' ? parseFloat(e.amount) : -parseFloat(e.amount);
        return { ...e, runningBalance: balance };
    });
    res.json({
        entries: withBalance,
        outstanding: parseFloat(client?.outstandingAmount ?? '0'),
        creditLimit: parseFloat(client?.creditLimit ?? '0'),
    });
});
router.get('/trips', requireRole('driver'), async (req, res) => {
    const driverId = await getLinkedDriverId(req.user.id);
    if (!driverId) {
        res.json([]);
        return;
    }
    const { from, to } = req.query;
    const filters = [eq(challans.driverId, driverId)];
    if (from) {
        filters.push(gte(challans.dispatchTime, new Date(from)));
        if (to) {
            filters.push(lte(challans.dispatchTime, new Date(to)));
        }
    }
    else {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        filters.push(gte(challans.dispatchTime, todayStart));
        filters.push(lte(challans.dispatchTime, todayEnd));
    }
    const rows = await db.select(challanSelect).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .where(and(...filters))
        .orderBy(desc(challans.dispatchTime));
    res.json(rows);
});
// ---- Saved delivery sites -------------------------------------------------
router.get('/sites', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.json([]);
        return;
    }
    const rows = await db.select().from(sites)
        .where(eq(sites.clientId, clientId))
        .orderBy(desc(sites.id));
    res.json(rows);
});
router.post('/sites', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(400).json({ error: 'Your account is not linked to a client.' });
        return;
    }
    const { name, address, city, latitude, longitude } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Site name is required.' });
        return;
    }
    const [row] = await db.insert(sites).values({
        clientId,
        name: name.trim(),
        address: typeof address === 'string' && address.trim() ? address.trim() : null,
        city: typeof city === 'string' && city.trim() ? city.trim() : null,
        latitude: latitude != null && latitude !== '' ? String(latitude) : null,
        longitude: longitude != null && longitude !== '' ? String(longitude) : null,
    }).returning();
    res.status(201).json(row);
});
// ---- Recurring / scheduled orders -----------------------------------------
// Validate the shared recurring-template fields. Returns a normalised payload or
// an error message. `anchor` must match the chosen frequency's calendar range.
function validateRecurring(body) {
    const { grade, quantity, frequency, anchor, pumpRequired, deliveryTime, notes } = body;
    if (!grade || typeof grade !== 'string')
        return { ok: false, error: 'Grade is required.' };
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0)
        return { ok: false, error: 'Quantity must be greater than zero.' };
    if (frequency !== 'weekly' && frequency !== 'monthly')
        return { ok: false, error: 'Frequency must be weekly or monthly.' };
    const a = Number(anchor);
    if (!Number.isInteger(a))
        return { ok: false, error: 'Invalid schedule day.' };
    if (frequency === 'weekly' && (a < 0 || a > 6))
        return { ok: false, error: 'Weekly day must be 0–6.' };
    if (frequency === 'monthly' && (a < 1 || a > 28))
        return { ok: false, error: 'Monthly day must be 1–28.' };
    return {
        ok: true,
        grade,
        quantity: qty.toString(),
        frequency,
        anchor: a,
        pumpRequired: !!pumpRequired,
        deliveryTime: typeof deliveryTime === 'string' && deliveryTime ? deliveryTime : null,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    };
}
router.get('/recurring', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.json([]);
        return;
    }
    const rows = await db.select({
        id: recurringOrders.id, clientId: recurringOrders.clientId,
        siteId: recurringOrders.siteId, grade: recurringOrders.grade,
        quantity: recurringOrders.quantity, pumpRequired: recurringOrders.pumpRequired,
        deliveryTime: recurringOrders.deliveryTime, notes: recurringOrders.notes,
        frequency: recurringOrders.frequency, anchor: recurringOrders.anchor,
        nextRunDate: recurringOrders.nextRunDate, active: recurringOrders.active,
        lastRunAt: recurringOrders.lastRunAt, createdAt: recurringOrders.createdAt,
        siteName: sites.name,
    }).from(recurringOrders)
        .leftJoin(sites, eq(recurringOrders.siteId, sites.id))
        .where(eq(recurringOrders.clientId, clientId))
        .orderBy(desc(recurringOrders.id));
    res.json(rows);
});
router.post('/recurring', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(400).json({ error: 'Your account is not linked to a client.' });
        return;
    }
    const v = validateRecurring(req.body);
    if (!v.ok) {
        res.status(400).json({ error: v.error });
        return;
    }
    const site = await resolveOwnedSiteId(req.body.siteId, clientId);
    if (!site.ok) {
        res.status(400).json({ error: 'Invalid delivery site.' });
        return;
    }
    const [row] = await db.insert(recurringOrders).values({
        clientId,
        siteId: site.siteId,
        grade: v.grade,
        quantity: v.quantity,
        pumpRequired: v.pumpRequired,
        deliveryTime: v.deliveryTime,
        notes: v.notes,
        frequency: v.frequency,
        anchor: v.anchor,
        nextRunDate: computeFirstRunDate(v.frequency, v.anchor),
        active: true,
    }).returning();
    res.status(201).json(row);
});
// Update a template. Supports a lightweight pause/resume (active only) or a full
// edit. Editing the frequency/anchor recomputes the next run date.
router.patch('/recurring/:id', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const [existing] = await db.select().from(recurringOrders)
        .where(and(eq(recurringOrders.id, id), eq(recurringOrders.clientId, clientId)));
    if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    // Pause/resume only.
    const keys = Object.keys(req.body);
    if (keys.length === 1 && keys[0] === 'active') {
        const [row] = await db.update(recurringOrders)
            .set({ active: !!req.body.active })
            .where(eq(recurringOrders.id, id)).returning();
        res.json(row);
        return;
    }
    const v = validateRecurring(req.body);
    if (!v.ok) {
        res.status(400).json({ error: v.error });
        return;
    }
    const site = await resolveOwnedSiteId(req.body.siteId, clientId);
    if (!site.ok) {
        res.status(400).json({ error: 'Invalid delivery site.' });
        return;
    }
    const scheduleChanged = v.frequency !== existing.frequency || v.anchor !== existing.anchor;
    const [row] = await db.update(recurringOrders)
        .set({
        siteId: site.siteId,
        grade: v.grade,
        quantity: v.quantity,
        pumpRequired: v.pumpRequired,
        deliveryTime: v.deliveryTime,
        notes: v.notes,
        frequency: v.frequency,
        anchor: v.anchor,
        active: req.body.active === undefined ? existing.active : !!req.body.active,
        ...(scheduleChanged ? { nextRunDate: computeFirstRunDate(v.frequency, v.anchor) } : {}),
    })
        .where(eq(recurringOrders.id, id)).returning();
    res.json(row);
});
router.delete('/recurring/:id', requireRole('client'), async (req, res) => {
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const [row] = await db.delete(recurringOrders)
        .where(and(eq(recurringOrders.id, id), eq(recurringOrders.clientId, clientId)))
        .returning();
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.status(204).end();
});
export default router;
