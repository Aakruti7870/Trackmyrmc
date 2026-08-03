import { Router } from 'express';
import { resolvedClientNameSql } from '../lib/customerIdentity.js';
import { customerOrderEligibility, isPlantOrderEligible } from '../lib/orderEligibility.js';
import { eq, desc, gte, lte, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, clients, orders, challans, challanProofPhotos, sites, vehicles, drivers, ledgerEntries, recurringOrders, plants, plantCustomers, tripSessions } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';
import { nextOrderNo } from '../lib/orderNo.js';
import { computeFirstRunDate } from '../lib/recurring.js';
import { getIdleConfig } from '../lib/idle.js';
import { resolvePlantCustomer } from '../lib/tenancy.js';
import { isRealEmail } from '../lib/customerAccount.js';
import { notifyOrderPlaced, notifyOrderPendingApproval, notifyBillRequested, notifyOrderCancelled, notifyOrderRescheduled } from '../lib/deliveryNotify.js';
const router = Router();
router.use(requireAuth);
// Major fields whose change on an already-approved order forces re-approval.
const MAJOR_ORDER_FIELDS = ['grade', 'quantity', 'deliveryDate', 'siteAddress', 'latitude', 'longitude'];
// Customers cannot cancel or reschedule an order once it is within this many
// minutes of its scheduled delivery time — by then the plant is batching/loading.
const CANCEL_CUTOFF_MINUTES = 20;
// Resolve the scheduled delivery Date from an order's date + time. Returns null
// unless BOTH a date and a time are set: an order with no concrete delivery
// moment has no cutoff and stays cancellable/reschedulable (a date alone must
// NOT lock against midnight).
function scheduledDeliveryAt(deliveryDate, deliveryTime) {
    if (!deliveryDate || !deliveryTime)
        return null;
    // deliveryTime is 'HH:MM' or 'HH:MM:SS'.
    const dt = new Date(`${deliveryDate}T${deliveryTime.slice(0, 5)}:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
}
// True when "now" is within the cutoff window before the scheduled delivery
// (or already past it). Orders without a full date+time slot are never locked.
function isWithinCancelCutoff(deliveryDate, deliveryTime) {
    const scheduled = scheduledDeliveryAt(deliveryDate, deliveryTime);
    if (!scheduled)
        return false;
    const cutoff = scheduled.getTime() - CANCEL_CUTOFF_MINUTES * 60_000;
    return Date.now() >= cutoff;
}
// Validate + normalise the customer-supplied order payload shared by the create
// and edit routes. To keep placing an order low-friction, only the grade and
// quantity are mandatory (plus the conditional pump-line length). The delivery
// details (contact, address, delivery date, map pin) are all optional — the
// plant confirms them when scheduling the pour. When a map pin IS supplied it
// must still be a valid coordinate. The optional site photo must be an
// object-storage entity path (never inline base64).
function parseCustomerOrderInput(body) {
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const grade = str(body.grade);
    if (!grade)
        return { ok: false, error: 'Grade is required.' };
    const qty = Number(body.quantity);
    if (!Number.isFinite(qty) || qty <= 0)
        return { ok: false, error: 'Quantity must be greater than zero.' };
    const contactPerson = str(body.contactPerson);
    const contactNumber = str(body.contactNumber);
    const siteAddress = str(body.siteAddress);
    const deliveryDate = str(body.deliveryDate);
    // The map pin is optional, but reject a partial/invalid coordinate so we never
    // store a nonsense location that would break live tracking.
    const hasLat = body.latitude != null && str(body.latitude) !== '';
    const hasLng = body.longitude != null && str(body.longitude) !== '';
    let latitude = null;
    let longitude = null;
    if (hasLat || hasLng) {
        const lat = Number(body.latitude);
        const lng = Number(body.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return { ok: false, error: 'The delivery location pin is invalid.' };
        }
        latitude = lat.toString();
        longitude = lng.toString();
    }
    const pumpRequired = !!body.pumpRequired;
    let pumpLineLength = null;
    if (pumpRequired) {
        const pl = Number(body.pumpLineLength);
        if (!Number.isFinite(pl) || pl <= 0)
            return { ok: false, error: 'Pump line length is required when a pump is requested.' };
        pumpLineLength = pl.toString();
    }
    let sitePhoto = null;
    const photo = str(body.sitePhoto);
    if (photo) {
        if (!photo.startsWith('/objects/'))
            return { ok: false, error: 'Invalid site photo.' };
        sitePhoto = photo;
    }
    return {
        ok: true,
        values: {
            grade,
            quantity: qty.toString(),
            pumpRequired,
            pumpLineLength,
            deliveryDate: deliveryDate || null,
            deliveryTime: str(body.deliveryTime) || null,
            notes: str(body.notes) || null,
            contactPerson: contactPerson || null,
            contactNumber: contactNumber || null,
            siteName: str(body.siteName) || null,
            siteAddress: siteAddress || null,
            latitude,
            longitude,
            placeId: str(body.placeId) || null,
            paymentType: str(body.paymentType) || null,
            poNumber: str(body.poNumber) || null,
            sitePhoto,
        },
    };
}
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
// Resolve the delivery site for an order placed at a specific plant. The address
// book lives under the customer's own client rows; a site chosen there is cloned
// (find-or-create by name) under the per-plant client so each plant only ever
// sees a site row it owns — never a row belonging to the customer's other plants.
// Throws Error('INVALID_SITE') if the chosen site isn't one of the customer's.
async function resolvePerPlantOrderSite(tx, perPlantClientId, userClientIds, value) {
    if (value === undefined || value === null || value === '')
        return null;
    const siteId = Number(value);
    if (!Number.isInteger(siteId) || siteId <= 0)
        throw new Error('INVALID_SITE');
    const ownerIds = userClientIds.includes(perPlantClientId) ? userClientIds : [...userClientIds, perPlantClientId];
    const [source] = await tx.select({
        name: sites.name, address: sites.address, city: sites.city,
        latitude: sites.latitude, longitude: sites.longitude, clientId: sites.clientId,
    }).from(sites).where(and(eq(sites.id, siteId), inArray(sites.clientId, ownerIds)));
    if (!source)
        throw new Error('INVALID_SITE');
    if (source.clientId === perPlantClientId)
        return siteId;
    const [twin] = await tx.select({ id: sites.id })
        .from(sites).where(and(eq(sites.clientId, perPlantClientId), eq(sites.name, source.name)));
    if (twin)
        return twin.id;
    const [clone] = await tx.insert(sites).values({
        clientId: perPlantClientId,
        name: source.name, address: source.address, city: source.city,
        latitude: source.latitude, longitude: source.longitude,
    }).returning({ id: sites.id });
    return clone.id;
}
const challanSelect = {
    id: challans.id, challanNo: challans.challanNo,
    grade: challans.grade, quantity: challans.quantity,
    deliveredQuantity: challans.deliveredQuantity,
    pumpRequired: challans.pumpRequired,
    dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
    siteArrivalTime: challans.siteArrivalTime, siteReleaseTime: challans.siteReleaseTime,
    status: challans.status, notes: challans.notes, createdAt: challans.createdAt,
    orderId: challans.orderId, clientId: challans.clientId,
    siteId: challans.siteId, vehicleId: challans.vehicleId, driverId: challans.driverId,
    clientName: resolvedClientNameSql(),
    siteName: sites.name,
    siteLat: sites.latitude,
    siteLng: sites.longitude,
    vehicleNo: vehicles.vehicleNo,
    driverName: drivers.name,
    driverPhone: drivers.phone,
    hasProofPhoto: sql `exists (select 1 from ${challanProofPhotos} where ${challanProofPhotos.challanId} = ${challans.id})`,
};
// Driver trip view also exposes the odometer readings so a driver can see and
// re-confirm what they entered. Deliberately kept out of the client-facing
// challanSelect above — odometer data is staff/driver-only.
const driverChallanSelect = {
    ...challanSelect,
    odometerStart: challans.odometerStart,
    odometerEnd: challans.odometerEnd,
    // Delivery-coordination contact + address the customer supplied on the order
    // (the site delivery contact, not the anonymised customer account). Surfaced
    // to the assigned driver so they can call/WhatsApp and navigate to the drop.
    siteAddress: orders.siteAddress,
    contactPerson: orders.contactPerson,
    contactNumber: orders.contactNumber,
    plantName: plants.name,
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
// Every client row this user owns: their legacy primary client plus one per-plant
// client for each plant they've ordered at. Used to aggregate a customer's orders
// and challans across all the plants they deal with, while still scoping reads to
// only their own rows.
async function getUserClientIds(userId) {
    const ids = new Set();
    const [u] = await db.select({ linkedClientId: users.linkedClientId })
        .from(users).where(eq(users.id, userId));
    if (u?.linkedClientId != null)
        ids.add(u.linkedClientId);
    const pcs = await db.select({ clientId: plantCustomers.clientId })
        .from(plantCustomers).where(eq(plantCustomers.userId, userId));
    for (const pc of pcs)
        ids.add(pc.clientId);
    return [...ids];
}
// The customer's contact details, used when a plant first mints a per-plant
// client for them. Sourced from their primary client (if any) so the plant has
// real delivery-coordination contacts, falling back to the user account.
async function buildCustomerProfile(userId) {
    const [u] = await db.select({ name: users.name, email: users.email, linkedClientId: users.linkedClientId })
        .from(users).where(eq(users.id, userId));
    let primary;
    if (u?.linkedClientId != null) {
        [primary] = await db.select({
            contactPerson: clients.contactPerson, phone: clients.phone, email: clients.email,
            gstNo: clients.gstNo, address: clients.address, city: clients.city,
        }).from(clients).where(eq(clients.id, u.linkedClientId));
    }
    return {
        name: u?.name ?? 'Customer',
        contactPerson: primary?.contactPerson ?? u?.name ?? null,
        phone: primary?.phone ?? null,
        // Never surface the synthetic @otp.local placeholder (phone-only accounts) as
        // a contact email — it is undeliverable and would get copied into per-plant
        // client rows, making every order/delivery email bounce.
        email: isRealEmail(primary?.email) ? primary.email : (isRealEmail(u?.email) ? u.email : null),
        gstNo: primary?.gstNo ?? null,
        address: primary?.address ?? null,
        city: primary?.city ?? null,
    };
}
router.get('/orders', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.json([]);
        return;
    }
    // Aggregate the customer's orders across every plant they've ordered at, each
    // tagged with the issuing plant's public name/code so the customer can tell
    // their plants apart.
    const rows = await db.select({
        id: orders.id, orderNo: orders.orderNo, grade: orders.grade,
        quantity: orders.quantity, pumpRequired: orders.pumpRequired,
        deliveryDate: orders.deliveryDate, deliveryTime: orders.deliveryTime,
        status: orders.status, notes: orders.notes, createdAt: orders.createdAt,
        clientId: orders.clientId, siteId: orders.siteId, plantId: orders.plantId,
        siteAddress: orders.siteAddress, latitude: orders.latitude,
        longitude: orders.longitude, placeId: orders.placeId,
        clientName: resolvedClientNameSql(), siteName: sql `coalesce(${orders.siteName}, ${sites.name})`,
        plantName: plants.name, plantCode: plants.plantCode,
    }).from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .leftJoin(sites, eq(orders.siteId, sites.id))
        .leftJoin(plants, eq(orders.plantId, plants.id))
        .where(inArray(orders.clientId, clientIds))
        .orderBy(desc(orders.createdAt));
    res.json(rows);
});
// A client places a new order for themselves. The order always belongs to the
// caller's linked client and starts as 'pending' for staff to process — the
// client can never set the client, status, or order number.
router.post('/orders', requireRole('client'), async (req, res) => {
    const eligibility = await customerOrderEligibility(req.user.id);
    if (!eligibility.eligible) {
        res.status(403).json({ error: eligibility.reason });
        return;
    }
    const { plantId: bodyPlantId, grade, quantity, pumpRequired, pumpLineLength, deliveryDate, deliveryTime, notes, siteId, contactPerson, contactNumber, siteName, siteAddress, latitude, longitude, placeId, paymentType, poNumber, sitePhoto, } = req.body;
    const parsed = parseCustomerOrderInput({
        grade, quantity, pumpRequired, pumpLineLength, deliveryDate, deliveryTime, notes,
        contactPerson, contactNumber, siteName, siteAddress, latitude, longitude, placeId, paymentType, poNumber, sitePhoto,
    });
    if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
    }
    // New customer orders enter the staff approval queue; a challan can only be
    // generated once an order is approved.
    const orderValues = { ...parsed.values, status: 'pending_approval' };
    // Marketplace path: the customer chose a specific plant to order from. The
    // per-plant client (and customer code) is created lazily on the first order at
    // that plant, and the order is tenant-bound to it.
    if (bodyPlantId !== undefined && bodyPlantId !== null && bodyPlantId !== '') {
        const plantId = Number(bodyPlantId);
        if (!Number.isInteger(plantId) || plantId <= 0) {
            res.status(400).json({ error: 'Invalid plant.' });
            return;
        }
        const [plant] = await db.select({
            id: plants.id, plantStatus: plants.plantStatus, isActive: plants.isActive, locationVerified: plants.locationVerified,
            verified: plants.verified, subscriptionStatus: plants.subscriptionStatus,
            networkStatus: plants.networkStatus, showOnNetwork: plants.showOnNetwork,
        }).from(plants).where(eq(plants.id, plantId));
        if (!plant || !isPlantOrderEligible(plant)) {
            res.status(400).json({ error: 'This plant is not available for orders.' });
            return;
        }
        const profile = await buildCustomerProfile(req.user.id);
        const userClientIds = await getUserClientIds(req.user.id);
        let row;
        try {
            row = await db.transaction(async (tx) => {
                const resolved = await resolvePlantCustomer(tx, plantId, req.user.id, profile);
                const orderNo = await nextOrderNo();
                const orderSiteId = await resolvePerPlantOrderSite(tx, resolved.clientId, userClientIds, siteId);
                const [inserted] = await tx.insert(orders).values({
                    orderNo, clientId: resolved.clientId, plantId, siteId: orderSiteId, ...orderValues,
                }).returning();
                return inserted;
            });
        }
        catch (e) {
            if (e instanceof Error && e.message === 'INVALID_SITE') {
                res.status(400).json({ error: 'Invalid delivery site.' });
                return;
            }
            throw e;
        }
        emitSSEEvent('order.created', row, { clientId: row.clientId });
        // Confirm the order to the customer over WhatsApp (best-effort).
        void notifyOrderPlaced(row.id);
        // Alert the plant's staff that a new order awaits their approval.
        void notifyOrderPendingApproval(row.id);
        res.status(201).json(row);
        return;
    }
    // Legacy path: no plant chosen — order against the caller's primary client and
    // inherit that client's plant so the row is still tenanted.
    const clientId = await getLinkedClientId(req.user.id);
    if (!clientId) {
        res.status(400).json({ error: 'Your account is not linked to a client.' });
        return;
    }
    const site = await resolveOwnedSiteId(siteId, clientId);
    if (!site.ok) {
        res.status(400).json({ error: 'Invalid delivery site.' });
        return;
    }
    const [client] = await db.select({ plantId: clients.plantId }).from(clients).where(eq(clients.id, clientId));
    const orderNo = await nextOrderNo();
    const [row] = await db.insert(orders).values({
        orderNo,
        clientId,
        plantId: client?.plantId ?? null,
        siteId: site.siteId,
        ...orderValues,
    }).returning();
    emitSSEEvent('order.created', row, { clientId: row.clientId });
    // Confirm the order to the customer over WhatsApp (best-effort).
    void notifyOrderPlaced(row.id);
    // Alert the plant's staff that a new order awaits their approval.
    void notifyOrderPendingApproval(row.id);
    res.status(201).json(row);
});
// A customer edits one of their own orders. Editing is allowed while the order
// is still in a customer-controllable state (awaiting approval, approved but not
// yet dispatched, or rejected — an edit resubmits it). Editing a MAJOR field of
// an already-approved order reverts it to 'pending_approval' so staff re-approve
// the changed order; a rejected order always resubmits as pending_approval.
router.put('/orders/:id', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    const [current] = await db.select().from(orders)
        .where(and(eq(orders.id, id), inArray(orders.clientId, clientIds)));
    if (!current) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const EDITABLE = ['pending', 'pending_approval', 'approved', 'rejected'];
    if (!EDITABLE.includes(current.status)) {
        res.status(409).json({ error: 'This order can no longer be edited.' });
        return;
    }
    const parsed = parseCustomerOrderInput(req.body);
    if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
    }
    const values = parsed.values;
    // Decide the resulting status. A rejected order always resubmits for approval.
    // An approved order stays approved unless a major field changed, in which case
    // it goes back to the approval queue. Otherwise the status is untouched.
    const majorChanged = MAJOR_ORDER_FIELDS.some((f) => {
        if (f === 'quantity' || f === 'latitude' || f === 'longitude') {
            return Number(current[f]) !== Number(values[f]);
        }
        return (current[f] ?? null) !== (values[f] ?? null);
    });
    let nextStatus = current.status;
    let reverted = false;
    if (current.status === 'rejected') {
        nextStatus = 'pending_approval';
        reverted = true;
    }
    else if (current.status === 'approved' && majorChanged) {
        nextStatus = 'pending_approval';
        reverted = true;
    }
    const [row] = await db.update(orders)
        .set({ ...values, status: nextStatus, rejectionReason: reverted ? null : current.rejectionReason })
        .where(and(eq(orders.id, id), inArray(orders.clientId, clientIds)))
        .returning();
    emitSSEEvent('order.updated', row, { clientId: row.clientId });
    // Re-entering the approval queue re-alerts the plant's staff.
    if (reverted)
        void notifyOrderPendingApproval(row.id);
    res.json(row);
});
// Mints a presigned URL the customer uploads an optional site photo straight to
// object storage with, returning the entity path to send back on the order.
router.post('/orders/site-photo-upload-url', requireRole('client'), async (_req, res) => {
    try {
        const { uploadURL, objectPath } = await proofPhotoStore.createUploadUrl();
        res.json({ uploadURL, objectPath });
    }
    catch (e) {
        console.error('Failed to create site photo upload URL:', e);
        res.status(500).json({ error: 'Failed to create upload URL' });
    }
});
// A customer cancels one of their own orders, but only while it is still
// customer-controllable (pending/pending_approval/approved, i.e. the plant has
// not started/dispatched it). Scoped to the caller's linked client so a customer
// can never touch another client's order.
router.patch('/orders/:id/cancel', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    // Optional cancellation reason from the fixed picker. "Other" (or any custom
    // string) is stored verbatim; blank is allowed. Trimmed and length-capped so a
    // stray payload can't bloat the row.
    const rawReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const reason = rawReason ? rawReason.slice(0, 500) : null;
    // Pre-read to enforce the "cannot cancel within N minutes of delivery" cutoff.
    // This is a read-then-write, but the cutoff only ever tightens over time, so a
    // race can never let a genuinely-locked order slip through the atomic UPDATE.
    const [existing] = await db.select().from(orders)
        .where(and(eq(orders.id, id), inArray(orders.clientId, clientIds)));
    if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (isWithinCancelCutoff(existing.deliveryDate, existing.deliveryTime)) {
        res.status(409).json({ error: `Orders cannot be cancelled within ${CANCEL_CUTOFF_MINUTES} minutes of the scheduled delivery time. Please contact the plant.` });
        return;
    }
    // Cancel atomically: gate the status inside the UPDATE predicate so a
    // concurrent staff transition (pending -> in_progress) between a read and a
    // write can never be clobbered. No row updated means either the order isn't
    // ours/doesn't exist (404) or it is no longer pending (409); a follow-up
    // existence check disambiguates the two. Scoped to all the customer's clients
    // so they can cancel an order placed at any of their plants.
    const [row] = await db.update(orders)
        .set({ status: 'cancelled', cancellationReason: reason })
        .where(and(eq(orders.id, id), inArray(orders.clientId, clientIds), inArray(orders.status, ['pending', 'pending_approval', 'approved'])))
        .returning();
    if (!row) {
        res.status(409).json({ error: 'This order can no longer be cancelled.' });
        return;
    }
    emitSSEEvent('order.updated', row, { clientId: row.clientId });
    // Best-effort: alert the plant's staff so they can free up the slot.
    void notifyOrderCancelled(row.id, reason);
    res.json(row);
});
// A customer reschedules the delivery date/time of one of their own orders while
// it is still customer-controllable and outside the cutoff window. This is a
// focused alternative to a full edit — only the date/time change. Scoped to the
// caller's linked clients.
router.patch('/orders/:id/reschedule', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    // A reschedule must set a real delivery date; time is optional. Validate the
    // shapes so a malformed payload can't corrupt the slot.
    const rawDate = typeof req.body?.deliveryDate === 'string' ? req.body.deliveryDate.trim() : '';
    const rawTime = typeof req.body?.deliveryTime === 'string' ? req.body.deliveryTime.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        res.status(400).json({ error: 'Please choose a valid delivery date.' });
        return;
    }
    if (rawTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(rawTime)) {
        res.status(400).json({ error: 'Please choose a valid delivery time.' });
        return;
    }
    const newTime = rawTime ? rawTime.slice(0, 5) : null;
    const [existing] = await db.select().from(orders)
        .where(and(eq(orders.id, id), inArray(orders.clientId, clientIds)));
    if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (!['pending', 'pending_approval', 'approved'].includes(existing.status)) {
        res.status(409).json({ error: 'This order can no longer be rescheduled.' });
        return;
    }
    // Block rescheduling an order already inside the cutoff of its CURRENT slot.
    if (isWithinCancelCutoff(existing.deliveryDate, existing.deliveryTime)) {
        res.status(409).json({ error: `Orders cannot be rescheduled within ${CANCEL_CUTOFF_MINUTES} minutes of the scheduled delivery time. Please contact the plant.` });
        return;
    }
    // The NEW slot must be in the future (beyond the cutoff from now).
    if (isWithinCancelCutoff(rawDate, newTime)) {
        res.status(400).json({ error: `Please pick a delivery time at least ${CANCEL_CUTOFF_MINUTES} minutes from now.` });
        return;
    }
    // Changing the delivery date is a major change: an already-approved order goes
    // back to the approval queue so the plant re-confirms the new slot.
    const reverted = existing.status === 'approved' && (existing.deliveryDate ?? null) !== rawDate;
    const nextStatus = reverted ? 'pending_approval' : existing.status;
    const [row] = await db.update(orders)
        .set({ deliveryDate: rawDate, deliveryTime: newTime, status: nextStatus })
        .where(and(eq(orders.id, id), inArray(orders.clientId, clientIds), inArray(orders.status, ['pending', 'pending_approval', 'approved'])))
        .returning();
    if (!row) {
        res.status(409).json({ error: 'This order can no longer be rescheduled.' });
        return;
    }
    emitSSEEvent('order.updated', row, { clientId: row.clientId });
    if (reverted)
        void notifyOrderPendingApproval(row.id);
    else
        void notifyOrderRescheduled(row.id, { deliveryDate: rawDate, deliveryTime: newTime });
    res.json(row);
});
router.get('/challans', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.json([]);
        return;
    }
    // Aggregate the customer's challans across all the plants they deal with, each
    // tagged with the issuing plant's name/code.
    const rows = await db.select({ ...challanSelect, plantName: plants.name, plantCode: plants.plantCode })
        .from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .leftJoin(plants, eq(challans.plantId, plants.id))
        .where(inArray(challans.clientId, clientIds))
        .orderBy(desc(challans.createdAt));
    res.json(rows);
});
// Detail for one of the caller's own deliveries, including proof-of-delivery
// photos resolved to short-lived signed URLs. Scoped to the caller's linked
// client so a customer can never read another client's challan or photos —
// the shared /api/challans/:id endpoint is staff-oriented and not client-scoped.
router.get('/challans/:id', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid challan id' });
        return;
    }
    // The detail carries the issuing plant's identity so the customer's printed
    // delivery receipt is branded by the plant that fulfilled the order — never a
    // hardcoded company.
    const [row] = await db.select({
        ...challanSelect,
        plantCode: plants.plantCode, plantName: plants.name, plantLegalName: plants.legalName,
        plantAddress: plants.address, plantCity: plants.city, plantContact: plants.contactNumber,
        plantGstNo: plants.gstNo, plantEmail: plants.email,
    }).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .leftJoin(plants, eq(challans.plantId, plants.id))
        .where(and(eq(challans.id, id), inArray(challans.clientId, clientIds)));
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
// Client-safe idle configuration (free window + per-hour rate). Read-only and
// config-only so a customer can render the same time-at-site / idle-charge math
// the plant uses, without exposing the staff-only /admin/idle-settings endpoint
// (which also carries the editable defaults). Best-effort on the client.
router.get('/idle-config', requireRole('client'), async (_req, res) => {
    res.json(await getIdleConfig());
});
// ---- Preferred / pinned default plant -------------------------------------
// The customer's explicitly pinned default plant (or null when none is set).
// The Place Order modal pre-selects it ahead of the last-ordered heuristic.
router.get('/preferred-plant', requireRole('client'), async (req, res) => {
    const [row] = await db.select({ preferredPlantId: users.preferredPlantId })
        .from(users).where(eq(users.id, req.user.id));
    res.json({ plantId: row?.preferredPlantId ?? null });
});
// Pin (or clear) the customer's default plant. Sending a null/empty plantId
// clears the pin. A non-null plant must be one the customer may actually order
// from (approved + active + location-verified + verified) — pinning anything
// else is rejected so a saved default can never strand the order modal.
router.put('/preferred-plant', requireRole('client'), async (req, res) => {
    const { plantId } = req.body;
    if (plantId === null || plantId === undefined || plantId === '') {
        await db.update(users).set({ preferredPlantId: null }).where(eq(users.id, req.user.id));
        res.json({ plantId: null });
        return;
    }
    const id = Number(plantId);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid plant.' });
        return;
    }
    const [plant] = await db.select({ id: plants.id }).from(plants).where(and(eq(plants.id, id), eq(plants.plantStatus, 'approved'), eq(plants.isActive, true), eq(plants.locationVerified, true), eq(plants.verified, true)));
    if (!plant) {
        res.status(400).json({ error: 'This plant is not available to set as your default.' });
        return;
    }
    await db.update(users).set({ preferredPlantId: id }).where(eq(users.id, req.user.id));
    res.json({ plantId: id });
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
// A customer requests a formal bill/invoice from the Financial Statement page.
// The statement PDF is generated client-side; this endpoint's job is to alert
// the plant's billing staff so they can raise the invoice. Best-effort notify.
router.post('/bill-request', requireRole('client'), async (req, res) => {
    const clientIds = await getUserClientIds(req.user.id);
    if (clientIds.length === 0) {
        res.status(400).json({ error: 'Your account is not linked to a client.' });
        return;
    }
    const b = (req.body ?? {});
    const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) || null : null;
    const fromDate = typeof b.fromDate === 'string' ? b.fromDate.slice(0, 10) || null : null;
    const toDate = typeof b.toDate === 'string' ? b.toDate.slice(0, 10) || null : null;
    void notifyBillRequested(req.user.id, clientIds, { note, fromDate, toDate });
    res.json({ ok: true });
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
    const rows = await db.select({ ...driverChallanSelect, tripStatus: tripSessions.status }).from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .leftJoin(orders, eq(challans.orderId, orders.id))
        .leftJoin(plants, eq(challans.plantId, plants.id))
        .leftJoin(tripSessions, eq(tripSessions.challanId, challans.id))
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
// Update a saved site (rename / re-address / move its map pin). Scoped to the
// caller's linked client so a customer can never edit another client's site.
// Only the fields present in the body are touched; latitude/longitude may be
// set to null (sent as null) to clear a pin.
router.patch('/sites/:id', requireRole('client'), async (req, res) => {
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
    const { name, address, city, latitude, longitude } = req.body;
    const updateData = {};
    if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'Site name is required.' });
            return;
        }
        updateData.name = name.trim();
    }
    if (address !== undefined)
        updateData.address = typeof address === 'string' && address.trim() ? address.trim() : null;
    if (city !== undefined)
        updateData.city = typeof city === 'string' && city.trim() ? city.trim() : null;
    if (latitude !== undefined)
        updateData.latitude = latitude != null && latitude !== '' ? String(latitude) : null;
    if (longitude !== undefined)
        updateData.longitude = longitude != null && longitude !== '' ? String(longitude) : null;
    if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'No fields to update.' });
        return;
    }
    const [row] = await db.update(sites)
        .set(updateData)
        .where(and(eq(sites.id, id), eq(sites.clientId, clientId)))
        .returning();
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
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
// ── Self-service account deletion ─────────────────────────────────────────
// Retired insecure pre-OTP endpoint. Keep an explicit response rather than a
// 404 so older clients cannot accidentally bypass the verified deletion flow.
router.delete('/account', (_req, res) => {
    res.status(410).json({ error: 'This deletion method has been retired. Update Concrete King and use Account Settings → Delete Account with OTP verification.' });
});
export default router;
