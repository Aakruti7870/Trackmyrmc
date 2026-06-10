import { Router } from 'express';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, clients, sites, vehicles, drivers, orders } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
const WRITE_ROLES = ['admin', 'dispatcher'];
const DRIVER_ALLOWED_STATUS = ['delivered'];
const router = Router();
router.use(requireAuth);
async function nextChallanNo() {
    const [last] = await db.select({ challanNo: challans.challanNo }).from(challans)
        .orderBy(desc(challans.id)).limit(1);
    if (!last)
        return 'CH-0001';
    const n = parseInt(last.challanNo.split('-')[1] || '0', 10);
    return `CH-${String(n + 1).padStart(4, '0')}`;
}
const challanSelect = {
    id: challans.id, challanNo: challans.challanNo,
    grade: challans.grade, quantity: challans.quantity,
    pumpRequired: challans.pumpRequired,
    dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
    status: challans.status, notes: challans.notes, createdAt: challans.createdAt,
    orderId: challans.orderId, clientId: challans.clientId,
    siteId: challans.siteId, vehicleId: challans.vehicleId, driverId: challans.driverId,
    clientName: clients.name,
    siteName: sites.name,
    vehicleNo: vehicles.vehicleNo,
    driverName: drivers.name,
    driverPhone: drivers.phone,
};
router.get('/', async (req, res) => {
    const { status, from, to, clientId } = req.query;
    let query = db.select(challanSelect).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .$dynamic();
    const filters = [];
    if (status)
        filters.push(eq(challans.status, status));
    if (clientId)
        filters.push(eq(challans.clientId, +clientId));
    if (from)
        filters.push(gte(challans.createdAt, new Date(from)));
    if (to)
        filters.push(lte(challans.createdAt, new Date(to)));
    if (filters.length)
        query = query.where(and(...filters));
    const rows = await query.orderBy(desc(challans.createdAt));
    res.json(rows);
});
router.get('/:id', async (req, res) => {
    const [row] = await db.select(challanSelect).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .where(eq(challans.id, +req.params.id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
router.post('/', async (req, res) => {
    const { orderId, clientId, siteId, vehicleId, driverId, grade, quantity, pumpRequired, notes } = req.body;
    const challanNo = await nextChallanNo();
    const [row] = await db.insert(challans).values({
        challanNo,
        orderId: orderId ? +orderId : null,
        clientId: +clientId,
        siteId: siteId ? +siteId : null,
        vehicleId: vehicleId ? +vehicleId : null,
        driverId: driverId ? +driverId : null,
        grade, quantity: quantity.toString(),
        pumpRequired: !!pumpRequired,
        dispatchTime: new Date(),
        status: 'dispatched',
        notes,
    }).returning();
    if (orderId) {
        await db.update(orders).set({ status: 'in_progress' }).where(eq(orders.id, +orderId));
    }
    emitSSEEvent('challan.created', row);
    res.status(201).json(row);
});
router.put('/:id', async (req, res) => {
    const role = req.user.role;
    const challanId = +req.params.id;
    if (role === 'driver') {
        const { status, deliveryTime } = req.body;
        if (!DRIVER_ALLOWED_STATUS.includes(status)) {
            res.status(403).json({ error: 'Drivers may only mark challans as delivered' });
            return;
        }
        const driver = await db.select({ id: drivers.id })
            .from(drivers).where(eq(drivers.name, req.user.name)).limit(1);
        if (!driver.length) {
            res.status(403).json({ error: 'Driver profile not found' });
            return;
        }
        const [challan] = await db.select({ driverId: challans.driverId })
            .from(challans).where(eq(challans.id, challanId)).limit(1);
        if (!challan || challan.driverId !== driver[0].id) {
            res.status(403).json({ error: 'Not assigned to this challan' });
            return;
        }
        const [row] = await db.update(challans)
            .set({ status: 'delivered', deliveryTime: deliveryTime ? new Date(deliveryTime) : new Date() })
            .where(eq(challans.id, challanId)).returning();
        emitSSEEvent('challan.updated', row);
        res.json(row);
        return;
    }
    if (!WRITE_ROLES.includes(role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const { vehicleId, driverId, status, notes, deliveryTime } = req.body;
    const updateData = {};
    if (vehicleId !== undefined)
        updateData.vehicleId = vehicleId ? +vehicleId : null;
    if (driverId !== undefined)
        updateData.driverId = driverId ? +driverId : null;
    if (status !== undefined)
        updateData.status = status;
    if (notes !== undefined)
        updateData.notes = notes;
    if (status === 'delivered')
        updateData.deliveryTime = deliveryTime ? new Date(deliveryTime) : new Date();
    const [row] = await db.update(challans).set(updateData)
        .where(eq(challans.id, challanId)).returning();
    emitSSEEvent('challan.updated', row);
    res.json(row);
});
router.delete('/:id', async (req, res) => {
    await db.delete(challans).where(eq(challans.id, +req.params.id));
    res.json({ ok: true });
});
export default router;
