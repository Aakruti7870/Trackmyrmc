import { Router } from 'express';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, challanProofPhotos, clients, sites, vehicles, drivers, orders } from '../db/schema.js';
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
    deliveredQuantity: challans.deliveredQuantity,
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
    hasProofPhoto: sql `exists (select 1 from ${challanProofPhotos} where ${challanProofPhotos.challanId} = ${challans.id})`,
};
const MAX_PROOF_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PROOF_PHOTOS = 8;
function validateOneProofPhoto(value) {
    if (typeof value !== 'string')
        throw new Error('Proof photo must be a string');
    if (!value.startsWith('data:image/'))
        throw new Error('Proof photo must be an image data URL');
    if (value.length > MAX_PROOF_PHOTO_BYTES)
        throw new Error('Proof photo is too large');
    return value;
}
// Normalises the incoming proof-photo payload into a validated list (or
// `undefined` to mean "leave existing photos untouched"). Accepts the new
// `proofPhotos` array as well as the legacy single `proofPhoto` field. A null
// value or empty array clears the photos.
function validateProofPhotos(proofPhotos, legacyPhoto) {
    let raw;
    if (proofPhotos !== undefined)
        raw = proofPhotos;
    else if (legacyPhoto !== undefined)
        raw = legacyPhoto;
    else
        return undefined;
    if (raw === null)
        return [];
    const list = Array.isArray(raw) ? raw : [raw];
    if (list.length > MAX_PROOF_PHOTOS)
        throw new Error(`At most ${MAX_PROOF_PHOTOS} proof photos are allowed`);
    return list.map(validateOneProofPhoto);
}
async function getProofPhotos(challanId) {
    const rows = await db.select({ photo: challanProofPhotos.photo })
        .from(challanProofPhotos)
        .where(eq(challanProofPhotos.challanId, challanId))
        .orderBy(challanProofPhotos.id);
    return rows.map(r => r.photo);
}
async function challanHasProofPhoto(challanId) {
    const [row] = await db.select({ id: challanProofPhotos.id })
        .from(challanProofPhotos)
        .where(eq(challanProofPhotos.challanId, challanId))
        .limit(1);
    return !!row;
}
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
    // Detail additionally returns every proof-of-delivery photo. The list select
    // deliberately omits them (only a boolean flag) to keep responses light.
    const proofPhotos = await getProofPhotos(+req.params.id);
    res.json({ ...row, proofPhotos });
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
        const [prevOrder] = await db.select({ status: orders.status })
            .from(orders).where(eq(orders.id, +orderId));
        const [updatedOrder] = await db.update(orders).set({ status: 'in_progress' })
            .where(eq(orders.id, +orderId)).returning();
        if (updatedOrder && prevOrder?.status !== 'in_progress') {
            emitSSEEvent('order.updated', updatedOrder, { clientId: updatedOrder.clientId });
        }
    }
    emitSSEEvent('challan.created', row, { clientId: row.clientId, driverId: row.driverId });
    res.status(201).json(row);
});
router.put('/:id', async (req, res) => {
    const role = req.user.role;
    const challanId = +req.params.id;
    if (role === 'driver') {
        const { status, deliveryTime, notes, deliveredQuantity, proofPhoto, proofPhotos } = req.body;
        if (!DRIVER_ALLOWED_STATUS.includes(status)) {
            res.status(403).json({ error: 'Drivers may only mark challans as delivered' });
            return;
        }
        let validatedPhotos;
        try {
            validatedPhotos = validateProofPhotos(proofPhotos, proofPhoto);
        }
        catch (e) {
            res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid proof photo' });
            return;
        }
        const driver = await db.select({ id: drivers.id })
            .from(drivers).where(eq(drivers.name, req.user.name)).limit(1);
        if (!driver.length) {
            res.status(403).json({ error: 'Driver profile not found' });
            return;
        }
        const [challan] = await db.select({ driverId: challans.driverId, notes: challans.notes })
            .from(challans).where(eq(challans.id, challanId)).limit(1);
        if (!challan || challan.driverId !== driver[0].id) {
            res.status(403).json({ error: 'Not assigned to this challan' });
            return;
        }
        const updateData = {
            status: 'delivered',
            deliveryTime: deliveryTime ? new Date(deliveryTime) : new Date(),
        };
        if (deliveredQuantity !== undefined && deliveredQuantity !== null && deliveredQuantity !== '') {
            const dq = Number(deliveredQuantity);
            if (!Number.isFinite(dq) || dq < 0) {
                res.status(400).json({ error: 'Delivered quantity must be a non-negative number' });
                return;
            }
            updateData.deliveredQuantity = dq.toString();
        }
        if (typeof notes === 'string' && notes.trim()) {
            const deliveryNote = notes.trim();
            const existing = challan.notes?.trim();
            updateData.notes = existing ? `${existing}\n${deliveryNote}` : deliveryNote;
        }
        const [row] = await db.transaction(async (tx) => {
            const updatedRows = await tx.update(challans)
                .set(updateData)
                .where(eq(challans.id, challanId)).returning();
            if (validatedPhotos !== undefined) {
                await tx.delete(challanProofPhotos).where(eq(challanProofPhotos.challanId, challanId));
                if (validatedPhotos.length) {
                    await tx.insert(challanProofPhotos)
                        .values(validatedPhotos.map(photo => ({ challanId, photo })));
                }
            }
            return updatedRows;
        });
        const hasProofPhoto = validatedPhotos !== undefined
            ? validatedPhotos.length > 0
            : await challanHasProofPhoto(challanId);
        emitSSEEvent('challan.updated', { ...row, hasProofPhoto }, { clientId: row.clientId, driverId: row.driverId });
        res.json({ ...row, hasProofPhoto });
        return;
    }
    if (!WRITE_ROLES.includes(role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    const { vehicleId, driverId, status, notes, deliveryTime, deliveredQuantity } = req.body;
    const updateData = {};
    if (vehicleId !== undefined)
        updateData.vehicleId = vehicleId ? +vehicleId : null;
    if (driverId !== undefined)
        updateData.driverId = driverId ? +driverId : null;
    if (status !== undefined)
        updateData.status = status;
    if (notes !== undefined)
        updateData.notes = notes;
    if (deliveredQuantity !== undefined) {
        if (deliveredQuantity === null || deliveredQuantity === '') {
            updateData.deliveredQuantity = null;
        }
        else {
            const dq = Number(deliveredQuantity);
            if (!Number.isFinite(dq) || dq < 0) {
                res.status(400).json({ error: 'Delivered quantity must be a non-negative number' });
                return;
            }
            updateData.deliveredQuantity = dq.toString();
        }
    }
    if (status === 'delivered')
        updateData.deliveryTime = deliveryTime ? new Date(deliveryTime) : new Date();
    const [row] = await db.update(challans).set(updateData)
        .where(eq(challans.id, challanId)).returning();
    const hasProofPhoto = await challanHasProofPhoto(challanId);
    emitSSEEvent('challan.updated', { ...row, hasProofPhoto }, { clientId: row.clientId, driverId: row.driverId });
    res.json({ ...row, hasProofPhoto });
});
router.delete('/:id', async (req, res) => {
    await db.delete(challans).where(eq(challans.id, +req.params.id));
    res.json({ ok: true });
});
export default router;
