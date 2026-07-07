import { Router } from 'express';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, challanProofPhotos, clients, sites, vehicles, drivers, orders, plants } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { proofPhotoStore, isObjectStoragePath } from '../lib/proofPhoto.js';
import { notifyChallanStatus } from '../lib/deliveryNotify.js';
import { maybeSendTripShare, tripShareDeliveryWarning } from '../lib/automationJobs.js';
import { plantScope, clientInScope } from '../lib/tenancy.js';
import { createTrackingToken } from '../lib/trackingTokens.js';
import { createTripSessionForChallan, closeTripOnDelivery, advanceTripStatus, DRIVER_TRIP_STATUSES } from '../lib/tripSessions.js';
import { registerUploadedFilesSafe, unregisterUploadedFilesSafe } from '../lib/uploadedFiles.js';
const WRITE_ROLES = ['admin', 'dispatcher'];
// Roles allowed to read the staff challan surface. Customers are deliberately
// excluded — they have null plantId (so plantScope would not isolate them) and
// must read their own deliveries through the plant-scoped /api/me/challans
// instead. Drivers legitimately list/inspect their assigned challans; authority
// and plant_operator keep their existing global/owner visibility.
const READ_ROLES = ['admin', 'dispatcher', 'driver', 'authority', 'plant_operator', 'accountant'];
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
// Odometer readings feed diesel reconciliation and are owner/staff-only — they
// must never be returned to clients or drivers.
const DIESEL_VIEW_ROLES = ['admin', 'dispatcher', 'authority', 'plant_operator'];
const baseChallanSelect = {
    id: challans.id, challanNo: challans.challanNo,
    grade: challans.grade, quantity: challans.quantity,
    deliveredQuantity: challans.deliveredQuantity,
    pumpRequired: challans.pumpRequired,
    dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
    siteArrivalTime: challans.siteArrivalTime, siteReleaseTime: challans.siteReleaseTime,
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
const challanSelect = {
    ...baseChallanSelect,
    odometerStart: challans.odometerStart, odometerEnd: challans.odometerEnd,
};
// Staff see odometer readings; everyone else gets the same row without them.
function challanSelectFor(role) {
    return DIESEL_VIEW_ROLES.includes(role) ? challanSelect : baseChallanSelect;
}
const MAX_PROOF_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PROOF_PHOTOS = 8;
const MAX_OBJECT_PATH_CHARS = 1024;
function validateOneProofPhoto(value) {
    if (typeof value !== 'string')
        throw new Error('Proof photo must be a string');
    // New flow: the phone uploads the photo directly to storage and sends only the
    // resulting entity path. Existence in storage is verified separately on store.
    if (isObjectStoragePath(value)) {
        if (value.length > MAX_OBJECT_PATH_CHARS)
            throw new Error('Proof photo path is too long');
        return value;
    }
    // Legacy flow: a base64 image data URL routed through the API.
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
router.get('/', requireRole(...READ_ROLES), async (req, res) => {
    const { status, from, to, clientId } = req.query;
    let query = db.select(challanSelectFor(req.user.role)).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .$dynamic();
    const filters = [];
    // Hard-scope a plant-bound staff/owner to their own plant's challans. A null
    // plantId (legacy global admin) sees everything.
    const scope = plantScope(req.user.plantId, challans.plantId);
    if (scope)
        filters.push(scope);
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
router.get('/:id', requireRole(...READ_ROLES), async (req, res) => {
    // The detail carries the issuing plant's identity (used to brand the printed
    // challan / delivery receipt) and the per-plant customer code. There is no
    // hardcoded company on a challan — branding always comes from its plant.
    const detailSelect = {
        ...challanSelectFor(req.user.role),
        customerCode: clients.customerCode,
        // Delivery brief for the printed challan — the contact + address the
        // customer supplied on the order, falling back to the client/site record.
        // Read-only additions; the row is still plant-scoped below.
        siteName: sql `coalesce(${sites.name}, ${orders.siteName})`,
        siteAddress: sql `coalesce(${orders.siteAddress}, ${sites.address})`,
        contactPerson: sql `coalesce(${orders.contactPerson}, ${clients.contactPerson})`,
        contactNumber: sql `coalesce(${orders.contactNumber}, ${clients.phone})`,
        plantId: challans.plantId,
        plantCode: plants.plantCode,
        plantName: plants.name,
        plantLegalName: plants.legalName,
        plantAddress: plants.address,
        plantCity: plants.city,
        plantContact: plants.contactNumber,
        plantGstNo: plants.gstNo,
        plantEmail: plants.email,
    };
    const [row] = await db.select(detailSelect).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .leftJoin(orders, eq(challans.orderId, orders.id))
        .leftJoin(plants, eq(challans.plantId, plants.id))
        .where(and(eq(challans.id, +req.params.id), plantScope(req.user.plantId, challans.plantId)));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    // Detail additionally returns every proof-of-delivery photo. The list select
    // deliberately omits them (only a boolean flag) to keep responses light.
    // Stored values are object-storage entity paths; resolve each to a short-lived
    // signed URL (legacy base64 data URLs pass through unchanged).
    const storedPhotos = await getProofPhotos(+req.params.id);
    const proofPhotos = (await Promise.all(storedPhotos.map(p => proofPhotoStore.resolve(p))))
        .filter((url) => url != null);
    res.json({ ...row, proofPhotos });
});
const PROOF_UPLOAD_ROLES = ['driver', 'admin', 'dispatcher'];
// Mints a presigned URL the client uploads a proof-of-delivery photo straight to
// object storage with, returning the entity path to send back on the challan PUT.
router.post('/proof-upload-url', async (req, res) => {
    if (!PROOF_UPLOAD_ROLES.includes(req.user.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    try {
        const { uploadURL, objectPath } = await proofPhotoStore.createUploadUrl();
        res.json({ uploadURL, objectPath });
    }
    catch (e) {
        console.error('Failed to create proof upload URL:', e);
        res.status(500).json({ error: 'Failed to create upload URL' });
    }
});
// Parses an optional odometer reading: undefined leaves it untouched, ''/null
// clears it, otherwise it must be a non-negative whole number of kilometres.
function parseOdometer(value) {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0)
        throw new Error('Odometer must be a non-negative whole number');
    return n;
}
router.post('/', requireRole(...WRITE_ROLES), async (req, res) => {
    const { orderId, clientId, siteId, vehicleId, driverId, grade, quantity, pumpRequired, notes } = req.body;
    let odometerStart;
    try {
        odometerStart = parseOdometer(req.body.odometerStart);
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid odometer' });
        return;
    }
    // Bind the challan to a plant so it is tenant-isolated and carries the issuing
    // plant's branding. Prefer the order's plant, then the acting staff's plant,
    // then the client's plant — whichever resolves first.
    let plantId = req.user.plantId ?? null;
    if (orderId) {
        // Scope the order lookup to the acting staff's plant. A plant-bound staff can
        // only ever attach an order from their OWN plant — otherwise they could bind a
        // challan to (and mutate the status of) another plant's order. A null-plant
        // global admin is unscoped and inherits the order's plant as before.
        const [o] = await db.select({ plantId: orders.plantId, status: orders.status }).from(orders)
            .where(and(eq(orders.id, +orderId), plantScope(req.user.plantId, orders.plantId)));
        if (!o) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }
        // A challan can only be generated from a dispatchable order. Orders still
        // awaiting approval, rejected, cancelled, or already completed are blocked;
        // legacy 'pending' and 'in_progress' orders stay dispatchable as before.
        const BLOCKED = ['pending_approval', 'rejected', 'cancelled', 'completed'];
        if (o.status && BLOCKED.includes(o.status)) {
            res.status(409).json({ error: 'This order is not approved for dispatch yet.' });
            return;
        }
        if (o.plantId != null)
            plantId = o.plantId;
    }
    // The challan's customer must belong to the acting staff's plant — a plant can
    // never issue a challan against another plant's client row. (404 hides whether
    // a foreign client id exists at all.)
    if (!(await clientInScope(req.user.plantId, +clientId))) {
        res.status(404).json({ error: 'Client not found' });
        return;
    }
    if (plantId == null) {
        const [c] = await db.select({ plantId: clients.plantId }).from(clients).where(eq(clients.id, +clientId));
        plantId = c?.plantId ?? null;
    }
    const challanNo = await nextChallanNo();
    const [row] = await db.insert(challans).values({
        challanNo,
        orderId: orderId ? +orderId : null,
        clientId: +clientId,
        plantId,
        siteId: siteId ? +siteId : null,
        vehicleId: vehicleId ? +vehicleId : null,
        driverId: driverId ? +driverId : null,
        grade, quantity: quantity.toString(),
        pumpRequired: !!pumpRequired,
        dispatchTime: new Date(),
        odometerStart: odometerStart ?? null,
        status: 'dispatched',
        notes,
    }).returning();
    if (orderId) {
        const [prevOrder] = await db.select({ status: orders.status })
            .from(orders).where(and(eq(orders.id, +orderId), plantScope(req.user.plantId, orders.plantId)));
        const [updatedOrder] = await db.update(orders).set({ status: 'in_progress' })
            .where(and(eq(orders.id, +orderId), plantScope(req.user.plantId, orders.plantId))).returning();
        if (updatedOrder && prevOrder?.status !== 'in_progress') {
            emitSSEEvent('order.updated', updatedOrder, { clientId: updatedOrder.clientId });
        }
    }
    emitSSEEvent('challan.created', row, { clientId: row.clientId, driverId: row.driverId });
    // A new challan is created already 'dispatched' — open the formal trip-tracking
    // session that the customer link, staff live view, and driver stage controls
    // all hang off. Idempotent (unique per challan); never blocks the response.
    const trip = await createTripSessionForChallan(row.id);
    if (trip)
        emitSSEEvent('trip.updated', trip, { clientId: trip.clientId, driverId: trip.driverId, plantId: trip.plantId });
    // A new challan is created already 'dispatched', so let the customer know
    // their concrete is on the way. Fire-and-forget: never block the response.
    void notifyChallanStatus(row.id, 'dispatched');
    // Optional automation: auto-send the customer a live-tracking share link.
    // No-op unless the tripShare automation is enabled; once-only per challan.
    void maybeSendTripShare(row.id);
    // Tell the dispatching staff when the automation is on but this customer is
    // unreachable (no email/WhatsApp/push), so the skip is never silent.
    const tripShareWarning = await tripShareDeliveryWarning(row.clientId, row.plantId);
    res.status(201).json(tripShareWarning ? { ...row, tripShareWarning } : row);
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
        let odometerEnd;
        try {
            validatedPhotos = validateProofPhotos(proofPhotos, proofPhoto);
            odometerEnd = parseOdometer(req.body.odometerEnd);
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
        // Driver enters the return odometer reading when confirming delivery.
        if (odometerEnd !== undefined)
            updateData.odometerEnd = odometerEnd;
        let storedPhotos;
        if (validatedPhotos !== undefined) {
            // Persist only the entity paths, keeping image bytes out of the database.
            // - /objects/... paths come from a direct phone upload; just verify they
            //   exist before linking them so a client can't persist a bogus path.
            // - legacy base64 data URLs are uploaded server-side via store().
            try {
                storedPhotos = await Promise.all(validatedPhotos.map(async (photo) => {
                    if (isObjectStoragePath(photo)) {
                        const exists = await proofPhotoStore.verifyExists(photo);
                        if (!exists)
                            throw new Error('Proof photo upload was not found in storage');
                        return photo;
                    }
                    return proofPhotoStore.store(photo);
                }));
            }
            catch (e) {
                res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid proof photo' });
                return;
            }
        }
        // When proof photos are being replaced or cleared, capture the previously
        // stored entity paths so their backing object-storage files can be cleaned
        // up afterwards — otherwise the old objects are orphaned in the bucket.
        const previousPhotos = storedPhotos !== undefined
            ? await getProofPhotos(challanId)
            : [];
        const [row] = await db.transaction(async (tx) => {
            const updatedRows = await tx.update(challans)
                .set(updateData)
                .where(eq(challans.id, challanId)).returning();
            if (storedPhotos !== undefined) {
                await tx.delete(challanProofPhotos).where(eq(challanProofPhotos.challanId, challanId));
                if (storedPhotos.length) {
                    await tx.insert(challanProofPhotos)
                        .values(storedPhotos.map(photo => ({ challanId, photo })));
                }
            }
            return updatedRows;
        });
        if (storedPhotos !== undefined) {
            // Best-effort cleanup of objects that are no longer referenced. remove()
            // is idempotent and skips legacy base64 photos (which have no separate
            // object); a storage failure must not fail the update. A path that is
            // being re-persisted is kept (skipped) so its object isn't deleted.
            const retained = new Set(storedPhotos);
            const orphaned = previousPhotos.filter(photo => !retained.has(photo));
            await Promise.allSettled(orphaned.map(photo => proofPhotoStore.remove(photo)));
            // Mirror into the unified file vault (additive bookkeeping). Only register
            // object-storage entity paths — legacy base64 photos have no object.
            await unregisterUploadedFilesSafe(orphaned.filter(isObjectStoragePath));
            await registerUploadedFilesSafe(storedPhotos.filter(isObjectStoragePath).map(photo => ({
                storagePath: photo,
                fileType: 'proof_photo',
                plantId: row.plantId,
                orderId: row.orderId,
                challanId,
                userId: req.user.id,
            })));
        }
        const hasProofPhoto = storedPhotos !== undefined
            ? storedPhotos.length > 0
            : await challanHasProofPhoto(challanId);
        emitSSEEvent('challan.updated', { ...row, hasProofPhoto }, { clientId: row.clientId, driverId: row.driverId });
        // Driver-confirmed delivery closes the trip: flip the customer link off and
        // fan the terminal status out to staff/customer.
        const closed = await closeTripOnDelivery(challanId);
        if (closed)
            emitSSEEvent('trip.updated', closed, { clientId: closed.clientId, driverId: closed.driverId, plantId: closed.plantId });
        // Driver-confirmed delivery — notify the customer (best-effort).
        void notifyChallanStatus(challanId, 'delivered');
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
    // Ignore blank/whitespace-only notes so an accidental empty edit can't wipe
    // an existing dispatcher note (mirrors the driver branch's guard above). An
    // explicit null still clears the note.
    if (notes !== undefined && (typeof notes !== 'string' || notes.trim())) {
        updateData.notes = notes;
    }
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
    // Staff may correct the trip timestamps. Each accepts an ISO string to set or
    // null to clear; an invalid date is rejected rather than silently dropped.
    for (const field of ['siteArrivalTime', 'siteReleaseTime']) {
        if (req.body[field] === undefined)
            continue;
        const raw = req.body[field];
        if (raw === null || raw === '') {
            updateData[field] = null;
            continue;
        }
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
            res.status(400).json({ error: `${field} must be a valid date or null` });
            return;
        }
        updateData[field] = d;
    }
    // Staff may correct either odometer reading.
    try {
        for (const field of ['odometerStart', 'odometerEnd']) {
            const parsed = parseOdometer(req.body[field]);
            if (parsed !== undefined)
                updateData[field] = parsed;
        }
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid odometer' });
        return;
    }
    const [row] = await db.update(challans).set(updateData)
        .where(and(eq(challans.id, challanId), plantScope(req.user.plantId, challans.plantId))).returning();
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const hasProofPhoto = await challanHasProofPhoto(challanId);
    emitSSEEvent('challan.updated', { ...row, hasProofPhoto }, { clientId: row.clientId, driverId: row.driverId });
    // Notify the customer when staff mark the delivery complete (best-effort) and
    // close the trip so the public link shows the completed message.
    if (updateData.status === 'delivered') {
        const closed = await closeTripOnDelivery(challanId);
        if (closed)
            emitSSEEvent('trip.updated', closed, { clientId: closed.clientId, driverId: closed.driverId, plantId: closed.plantId });
        void notifyChallanStatus(challanId, 'delivered');
    }
    res.json({ ...row, hasProofPhoto });
});
// Driver advances the finer trip status (In Transit → Reached Site → Unloading)
// from the driver app. The terminal 'delivered' is NOT set here — that stays on
// the PUT delivery flow (proof photos etc.). Forward-only; each change fans out
// to staff and the customer tracking state over SSE.
router.post('/:id/trip-status', requireRole('driver'), async (req, res) => {
    const challanId = +req.params.id;
    if (!Number.isInteger(challanId) || challanId <= 0) {
        res.status(400).json({ error: 'Invalid challan id' });
        return;
    }
    const driverId = req.user.linkedDriverId ?? null;
    if (!driverId) {
        res.status(403).json({ error: 'No driver profile linked to this account' });
        return;
    }
    const status = req.body?.status;
    if (!DRIVER_TRIP_STATUSES.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${DRIVER_TRIP_STATUSES.join(', ')}` });
        return;
    }
    const [challan] = await db
        .select({ driverId: challans.driverId })
        .from(challans)
        .where(eq(challans.id, challanId));
    if (!challan) {
        res.status(404).json({ error: 'Challan not found' });
        return;
    }
    if (challan.driverId !== driverId) {
        res.status(403).json({ error: 'Not assigned to this challan' });
        return;
    }
    const result = await advanceTripStatus(challanId, status);
    if (!result.ok) {
        if (result.reason === 'not_found') {
            res.status(404).json({ error: 'No active trip for this challan' });
            return;
        }
        if (result.reason === 'closed') {
            res.status(409).json({ error: 'This trip is already completed' });
            return;
        }
        res.status(409).json({ error: 'Cannot move the trip status backwards' });
        return;
    }
    // Reaching the site mirrors the geofence arrival: stamp the challan arrival
    // time once so freshness/timing reports stay consistent whether the arrival
    // was detected by GPS or reported by the driver.
    if (status === 'reached_site') {
        await db
            .update(challans)
            .set({ siteArrivalTime: sql `COALESCE(${challans.siteArrivalTime}, now())` })
            .where(eq(challans.id, challanId));
    }
    emitSSEEvent('trip.updated', result.row, {
        clientId: result.row.clientId,
        driverId: result.row.driverId,
        plantId: result.row.plantId,
    });
    res.json(result.row);
});
// Manual "left site" — the driver (or staff) stamps the site release time when
// the truck leaves, without waiting for the GPS hysteresis to detect departure.
// Requires an arrival first and is idempotent: a second call returns the
// already-recorded release rather than overwriting it.
// Gate the role BEFORE any DB lookup. Otherwise a customer (null plantId, hence
// unscoped by plantScope) could distinguish an existing foreign challan (403)
// from a missing one (404) — an existence oracle across plants.
router.post('/:id/left-site', requireRole('driver', ...WRITE_ROLES), async (req, res) => {
    const role = req.user.role;
    const challanId = +req.params.id;
    const [challan] = await db.select({
        driverId: challans.driverId,
        siteArrivalTime: challans.siteArrivalTime,
        siteReleaseTime: challans.siteReleaseTime,
    }).from(challans).where(and(eq(challans.id, challanId), plantScope(req.user.plantId, challans.plantId))).limit(1);
    if (!challan) {
        res.status(404).json({ error: 'Challan not found' });
        return;
    }
    if (role === 'driver') {
        const driver = await db.select({ id: drivers.id })
            .from(drivers).where(eq(drivers.name, req.user.name)).limit(1);
        if (!driver.length || challan.driverId !== driver[0].id) {
            res.status(403).json({ error: 'Not assigned to this challan' });
            return;
        }
    }
    else if (!WRITE_ROLES.includes(role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    if (challan.siteArrivalTime == null) {
        res.status(409).json({ error: 'Site arrival has not been recorded yet' });
        return;
    }
    if (challan.siteReleaseTime != null) {
        const [row] = await db.select(challanSelectFor(role)).from(challans)
            .leftJoin(clients, eq(challans.clientId, clients.id))
            .leftJoin(sites, eq(challans.siteId, sites.id))
            .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
            .leftJoin(drivers, eq(challans.driverId, drivers.id))
            .where(eq(challans.id, challanId)).limit(1);
        res.json(row);
        return;
    }
    // The driver may also record the return odometer reading here — handy when a
    // trip was auto-delivered by the GPS geofence and the delivery form was never
    // opened. Only overwrites when a value is supplied.
    let odometerEnd;
    try {
        odometerEnd = parseOdometer(req.body?.odometerEnd);
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid odometer' });
        return;
    }
    const releaseUpdate = { siteReleaseTime: new Date() };
    if (odometerEnd !== undefined)
        releaseUpdate.odometerEnd = odometerEnd;
    const [row] = await db.update(challans)
        .set(releaseUpdate)
        .where(eq(challans.id, challanId)).returning();
    emitSSEEvent('challan.updated', row, { clientId: row.clientId, driverId: row.driverId });
    res.json(row);
});
router.delete('/:id', requireRole(...WRITE_ROLES), async (req, res) => {
    const challanId = +req.params.id;
    // Collect the proof-photo entity paths before deleting the row. The child
    // rows go away via FK cascade, but the backing object-storage files would
    // otherwise be orphaned, so remove them explicitly afterwards.
    const storedPhotos = await getProofPhotos(challanId);
    const deleted = await db.delete(challans)
        .where(and(eq(challans.id, challanId), plantScope(req.user.plantId, challans.plantId)))
        .returning({ id: challans.id });
    // Only clean up the backing object-storage files when the scoped delete actually
    // removed the row. Otherwise a plant-scoped staff probing another plant's challan
    // id would destroy that plant's proof photos even though the row (correctly)
    // stays put. Best-effort: remove() is idempotent, skips legacy base64 photos, and
    // a storage failure must not fail the delete.
    if (deleted.length) {
        await Promise.allSettled(storedPhotos.map(photo => proofPhotoStore.remove(photo)));
    }
    res.json({ ok: deleted.length > 0 });
});
// Mint a public, no-login tracking link for a single challan. Staff-only and
// plant-scoped: you can only share a trip that belongs to your plant. The token
// is hashed at rest (only the raw value is returned here, once) and resolves to
// a minimal no-PII payload on the PUBLIC GET /api/track/:token route. The link
// origin comes from TRUSTED config (APP_URL / PUBLIC_URL) — never the Host
// header — and falls back to a relative path so dev still works.
router.post('/:id/share', requireRole(...WRITE_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid challan id' });
        return;
    }
    const [row] = await db.select({ id: challans.id }).from(challans)
        .where(and(eq(challans.id, id), plantScope(req.user.plantId, challans.plantId))).limit(1);
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    // Public links carry live logistics data, so they must expire. A single trip
    // is short-lived; 24h comfortably covers a delivery while bounding exposure.
    const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
    const token = await createTrackingToken(id, req.user.id, SHARE_TTL_MS);
    const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
    const url = base ? `${base}/track/${token}` : `/track/${token}`;
    res.status(201).json({ token, url });
});
export default router;
