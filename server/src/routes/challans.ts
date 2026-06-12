import { Router } from 'express';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, challanProofPhotos, clients, sites, vehicles, drivers, orders } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { proofPhotoStore, isObjectStoragePath } from '../lib/proofPhoto.js';
import { notifyChallanStatus } from '../lib/deliveryNotify.js';

const WRITE_ROLES = ['admin', 'dispatcher'];
const DRIVER_ALLOWED_STATUS = ['delivered'];

const router = Router();
router.use(requireAuth);

async function nextChallanNo() {
  const [last] = await db.select({ challanNo: challans.challanNo }).from(challans)
    .orderBy(desc(challans.id)).limit(1);
  if (!last) return 'CH-0001';
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
  hasProofPhoto: sql<boolean>`exists (select 1 from ${challanProofPhotos} where ${challanProofPhotos.challanId} = ${challans.id})`,
};

const challanSelect = {
  ...baseChallanSelect,
  odometerStart: challans.odometerStart, odometerEnd: challans.odometerEnd,
};

// Staff see odometer readings; everyone else gets the same row without them.
function challanSelectFor(role: string) {
  return DIESEL_VIEW_ROLES.includes(role) ? challanSelect : baseChallanSelect;
}

const MAX_PROOF_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PROOF_PHOTOS = 8;

const MAX_OBJECT_PATH_CHARS = 1024;

function validateOneProofPhoto(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Proof photo must be a string');
  // New flow: the phone uploads the photo directly to storage and sends only the
  // resulting entity path. Existence in storage is verified separately on store.
  if (isObjectStoragePath(value)) {
    if (value.length > MAX_OBJECT_PATH_CHARS) throw new Error('Proof photo path is too long');
    return value;
  }
  // Legacy flow: a base64 image data URL routed through the API.
  if (!value.startsWith('data:image/')) throw new Error('Proof photo must be an image data URL');
  if (value.length > MAX_PROOF_PHOTO_BYTES) throw new Error('Proof photo is too large');
  return value;
}

// Normalises the incoming proof-photo payload into a validated list (or
// `undefined` to mean "leave existing photos untouched"). Accepts the new
// `proofPhotos` array as well as the legacy single `proofPhoto` field. A null
// value or empty array clears the photos.
function validateProofPhotos(proofPhotos: unknown, legacyPhoto: unknown): string[] | undefined {
  let raw: unknown;
  if (proofPhotos !== undefined) raw = proofPhotos;
  else if (legacyPhoto !== undefined) raw = legacyPhoto;
  else return undefined;

  if (raw === null) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length > MAX_PROOF_PHOTOS) throw new Error(`At most ${MAX_PROOF_PHOTOS} proof photos are allowed`);
  return list.map(validateOneProofPhoto);
}

async function getProofPhotos(challanId: number): Promise<string[]> {
  const rows = await db.select({ photo: challanProofPhotos.photo })
    .from(challanProofPhotos)
    .where(eq(challanProofPhotos.challanId, challanId))
    .orderBy(challanProofPhotos.id);
  return rows.map(r => r.photo);
}

async function challanHasProofPhoto(challanId: number): Promise<boolean> {
  const [row] = await db.select({ id: challanProofPhotos.id })
    .from(challanProofPhotos)
    .where(eq(challanProofPhotos.challanId, challanId))
    .limit(1);
  return !!row;
}

router.get('/', async (req, res) => {
  const { status, from, to, clientId } = req.query;
  let query = db.select(challanSelectFor(req.user!.role)).from(challans)
    .leftJoin(clients, eq(challans.clientId, clients.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .$dynamic();

  const filters = [];
  if (status) filters.push(eq(challans.status, status as 'pending' | 'dispatched' | 'delivered' | 'cancelled'));
  if (clientId) filters.push(eq(challans.clientId, +clientId));
  if (from) filters.push(gte(challans.createdAt, new Date(from as string)));
  if (to) filters.push(lte(challans.createdAt, new Date(to as string)));
  if (filters.length) query = query.where(and(...filters));

  const rows = await query.orderBy(desc(challans.createdAt));
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [row] = await db.select(challanSelectFor(req.user!.role)).from(challans)
    .leftJoin(clients, eq(challans.clientId, clients.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .where(eq(challans.id, +req.params.id));
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  // Detail additionally returns every proof-of-delivery photo. The list select
  // deliberately omits them (only a boolean flag) to keep responses light.
  // Stored values are object-storage entity paths; resolve each to a short-lived
  // signed URL (legacy base64 data URLs pass through unchanged).
  const storedPhotos = await getProofPhotos(+req.params.id);
  const proofPhotos = (await Promise.all(storedPhotos.map(p => proofPhotoStore.resolve(p))))
    .filter((url): url is string => url != null);
  res.json({ ...row, proofPhotos });
});

const PROOF_UPLOAD_ROLES = ['driver', 'admin', 'dispatcher'];

// Mints a presigned URL the client uploads a proof-of-delivery photo straight to
// object storage with, returning the entity path to send back on the challan PUT.
router.post('/proof-upload-url', async (req, res) => {
  if (!PROOF_UPLOAD_ROLES.includes(req.user!.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  try {
    const { uploadURL, objectPath } = await proofPhotoStore.createUploadUrl();
    res.json({ uploadURL, objectPath });
  } catch (e) {
    console.error('Failed to create proof upload URL:', e);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// Parses an optional odometer reading: undefined leaves it untouched, ''/null
// clears it, otherwise it must be a non-negative whole number of kilometres.
function parseOdometer(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error('Odometer must be a non-negative whole number');
  return n;
}

router.post('/', requireRole(...WRITE_ROLES), async (req, res) => {
  const { orderId, clientId, siteId, vehicleId, driverId, grade, quantity, pumpRequired, notes } = req.body;
  let odometerStart: number | null | undefined;
  try {
    odometerStart = parseOdometer(req.body.odometerStart);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid odometer' });
    return;
  }
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
    odometerStart: odometerStart ?? null,
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
  // A new challan is created already 'dispatched', so let the customer know
  // their concrete is on the way. Fire-and-forget: never block the response.
  void notifyChallanStatus(row.id, 'dispatched');
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const role = req.user!.role;
  const challanId = +req.params.id;

  if (role === 'driver') {
    const { status, deliveryTime, notes, deliveredQuantity, proofPhoto, proofPhotos } = req.body;
    if (!DRIVER_ALLOWED_STATUS.includes(status)) {
      res.status(403).json({ error: 'Drivers may only mark challans as delivered' });
      return;
    }
    let validatedPhotos: string[] | undefined;
    let odometerEnd: number | null | undefined;
    try {
      validatedPhotos = validateProofPhotos(proofPhotos, proofPhoto);
      odometerEnd = parseOdometer(req.body.odometerEnd);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid proof photo' });
      return;
    }
    const driver = await db.select({ id: drivers.id })
      .from(drivers).where(eq(drivers.name, req.user!.name)).limit(1);
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
    const updateData: Record<string, unknown> = {
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
    if (odometerEnd !== undefined) updateData.odometerEnd = odometerEnd;
    let storedPhotos: string[] | undefined;
    if (validatedPhotos !== undefined) {
      // Persist only the entity paths, keeping image bytes out of the database.
      // - /objects/... paths come from a direct phone upload; just verify they
      //   exist before linking them so a client can't persist a bogus path.
      // - legacy base64 data URLs are uploaded server-side via store().
      try {
        storedPhotos = await Promise.all(validatedPhotos.map(async (photo) => {
          if (isObjectStoragePath(photo)) {
            const exists = await proofPhotoStore.verifyExists(photo);
            if (!exists) throw new Error('Proof photo upload was not found in storage');
            return photo;
          }
          return proofPhotoStore.store(photo);
        }));
      } catch (e) {
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
    }
    const hasProofPhoto = storedPhotos !== undefined
      ? storedPhotos.length > 0
      : await challanHasProofPhoto(challanId);
    emitSSEEvent('challan.updated', { ...row, hasProofPhoto }, { clientId: row.clientId, driverId: row.driverId });
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
  const updateData: Record<string, unknown> = {};
  if (vehicleId !== undefined) updateData.vehicleId = vehicleId ? +vehicleId : null;
  if (driverId !== undefined) updateData.driverId = driverId ? +driverId : null;
  if (status !== undefined) updateData.status = status;
  // Ignore blank/whitespace-only notes so an accidental empty edit can't wipe
  // an existing dispatcher note (mirrors the driver branch's guard above). An
  // explicit null still clears the note.
  if (notes !== undefined && (typeof notes !== 'string' || notes.trim())) {
    updateData.notes = notes;
  }
  if (deliveredQuantity !== undefined) {
    if (deliveredQuantity === null || deliveredQuantity === '') {
      updateData.deliveredQuantity = null;
    } else {
      const dq = Number(deliveredQuantity);
      if (!Number.isFinite(dq) || dq < 0) {
        res.status(400).json({ error: 'Delivered quantity must be a non-negative number' });
        return;
      }
      updateData.deliveredQuantity = dq.toString();
    }
  }
  if (status === 'delivered') updateData.deliveryTime = deliveryTime ? new Date(deliveryTime) : new Date();

  // Staff may correct the trip timestamps. Each accepts an ISO string to set or
  // null to clear; an invalid date is rejected rather than silently dropped.
  for (const field of ['siteArrivalTime', 'siteReleaseTime'] as const) {
    if (req.body[field] === undefined) continue;
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
    for (const field of ['odometerStart', 'odometerEnd'] as const) {
      const parsed = parseOdometer(req.body[field]);
      if (parsed !== undefined) updateData[field] = parsed;
    }
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid odometer' });
    return;
  }

  const [row] = await db.update(challans).set(updateData)
    .where(eq(challans.id, challanId)).returning();
  const hasProofPhoto = await challanHasProofPhoto(challanId);
  emitSSEEvent('challan.updated', { ...row, hasProofPhoto }, { clientId: row.clientId, driverId: row.driverId });
  // Notify the customer when staff mark the delivery complete (best-effort).
  if (updateData.status === 'delivered') void notifyChallanStatus(challanId, 'delivered');
  res.json({ ...row, hasProofPhoto });
});

// Manual "left site" — the driver (or staff) stamps the site release time when
// the truck leaves, without waiting for the GPS hysteresis to detect departure.
// Requires an arrival first and is idempotent: a second call returns the
// already-recorded release rather than overwriting it.
router.post('/:id/left-site', async (req, res) => {
  const role = req.user!.role;
  const challanId = +req.params.id;

  const [challan] = await db.select({
    driverId: challans.driverId,
    siteArrivalTime: challans.siteArrivalTime,
    siteReleaseTime: challans.siteReleaseTime,
  }).from(challans).where(eq(challans.id, challanId)).limit(1);
  if (!challan) {
    res.status(404).json({ error: 'Challan not found' });
    return;
  }

  if (role === 'driver') {
    const driver = await db.select({ id: drivers.id })
      .from(drivers).where(eq(drivers.name, req.user!.name)).limit(1);
    if (!driver.length || challan.driverId !== driver[0].id) {
      res.status(403).json({ error: 'Not assigned to this challan' });
      return;
    }
  } else if (!WRITE_ROLES.includes(role)) {
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
  let odometerEnd: number | null | undefined;
  try {
    odometerEnd = parseOdometer(req.body?.odometerEnd);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid odometer' });
    return;
  }
  const releaseUpdate: { siteReleaseTime: Date; odometerEnd?: number | null } = { siteReleaseTime: new Date() };
  if (odometerEnd !== undefined) releaseUpdate.odometerEnd = odometerEnd;

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
  await db.delete(challans).where(eq(challans.id, challanId));
  // Best-effort cleanup: remove() is idempotent and skips legacy base64 photos
  // (which have no separate object). A storage failure must not fail the delete.
  await Promise.allSettled(storedPhotos.map(photo => proofPhotoStore.remove(photo)));
  res.json({ ok: true });
});

export default router;
