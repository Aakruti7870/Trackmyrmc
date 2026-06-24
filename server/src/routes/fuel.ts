import { Router } from 'express';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { fuelLogs, vehicles } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { proofPhotoStore, isObjectStoragePath } from '../lib/proofPhoto.js';
import { plantScope } from '../lib/tenancy.js';
import { registerUploadedFileSafe, unregisterUploadedFilesSafe } from '../lib/uploadedFiles.js';

const router = Router();
router.use(requireAuth);

// Fuel logging is owner/staff-only — never exposed to clients or drivers.
const STAFF_ROLES = ['admin', 'dispatcher', 'authority', 'plant_operator'] as const;
router.use(requireRole(...STAFF_ROLES));

const MAX_OBJECT_PATH_CHARS = 1024;

const fuelSelect = {
  id: fuelLogs.id,
  vehicleId: fuelLogs.vehicleId,
  litres: fuelLogs.litres,
  amount: fuelLogs.amount,
  odometer: fuelLogs.odometer,
  filledAt: fuelLogs.filledAt,
  notes: fuelLogs.notes,
  recordedByName: fuelLogs.recordedByName,
  createdAt: fuelLogs.createdAt,
  vehicleNo: vehicles.vehicleNo,
  // The detail endpoint resolves a signed URL; the list only flags presence.
  hasBillPhoto: fuelLogs.billPhoto,
};

// Whether a fuel log belongs to the actor's plant (via its vehicle's plantId).
// A null-plant legacy global admin is unscoped and always passes.
async function fuelLogInScope(id: number, actorPlantId: number | null | undefined): Promise<boolean> {
  const scope = plantScope(actorPlantId, vehicles.plantId);
  if (!scope) return true;
  const [row] = await db.select({ id: fuelLogs.id }).from(fuelLogs)
    .innerJoin(vehicles, eq(fuelLogs.vehicleId, vehicles.id))
    .where(and(eq(fuelLogs.id, id), scope));
  return !!row;
}

// Validates an optional bill-photo path. Only direct object-storage uploads are
// accepted (the phone/browser uploads straight to storage and sends the path),
// mirroring the proof-of-delivery flow. Existence is verified on store.
function validateBillPhoto(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Bill photo must be a string');
  if (!isObjectStoragePath(value)) throw new Error('Bill photo must be an uploaded object path');
  if (value.length > MAX_OBJECT_PATH_CHARS) throw new Error('Bill photo path is too long');
  return value;
}

function parseLitres(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Litres must be a positive number');
  return n.toString();
}

function parseOptionalAmount(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Amount must be a non-negative number');
  return n.toString();
}

function parseOptionalOdometer(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error('Odometer must be a non-negative whole number');
  return n;
}

function parseFilledAt(value: unknown): Date {
  if (value === undefined || value === null || value === '') return new Date();
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) throw new Error('Filled-at must be a valid date');
  return d;
}

// Mints a presigned URL to upload a fuel-bill/odometer photo directly to object
// storage, returning the entity path to send back on create/update.
router.post('/bill-upload-url', async (_req, res) => {
  try {
    const { uploadURL, objectPath } = await proofPhotoStore.createUploadUrl();
    res.json({ uploadURL, objectPath });
  } catch (e) {
    console.error('Failed to create fuel-bill upload URL:', e);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

router.get('/', async (req, res) => {
  const { vehicleId, from, to } = req.query;
  const filters = [];
  // Only fuel logs for the actor's own vehicles (joined below).
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  if (scope) filters.push(scope);
  if (vehicleId) filters.push(eq(fuelLogs.vehicleId, +vehicleId));
  if (from) filters.push(gte(fuelLogs.filledAt, new Date(from as string)));
  if (to) filters.push(lte(fuelLogs.filledAt, new Date(to as string)));

  const rows = await db.select(fuelSelect).from(fuelLogs)
    .leftJoin(vehicles, eq(fuelLogs.vehicleId, vehicles.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(fuelLogs.filledAt));

  res.json(rows.map(r => ({ ...r, hasBillPhoto: !!r.hasBillPhoto })));
});

router.get('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  const idEq = eq(fuelLogs.id, +req.params.id);
  const [row] = await db.select({ ...fuelSelect, billPhoto: fuelLogs.billPhoto }).from(fuelLogs)
    .leftJoin(vehicles, eq(fuelLogs.vehicleId, vehicles.id))
    .where(scope ? and(idEq, scope) : idEq);
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  const billPhotoUrl = await proofPhotoStore.resolve(row.billPhoto);
  res.json({ ...row, hasBillPhoto: !!row.billPhoto, billPhotoUrl });
});

router.post('/', async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId) { res.status(400).json({ error: 'Vehicle is required' }); return; }
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  const vIdEq = eq(vehicles.id, +vehicleId);
  const [vehicle] = await db.select({ id: vehicles.id, plantId: vehicles.plantId }).from(vehicles).where(scope ? and(vIdEq, scope) : vIdEq);
  if (!vehicle) { res.status(400).json({ error: 'Vehicle not found' }); return; }

  let litres: string, amount: string | null, odometer: number | null, filledAt: Date, billPhoto: string | null | undefined;
  try {
    litres = parseLitres(req.body.litres);
    amount = parseOptionalAmount(req.body.amount);
    odometer = parseOptionalOdometer(req.body.odometer);
    filledAt = parseFilledAt(req.body.filledAt);
    billPhoto = validateBillPhoto(req.body.billPhoto);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid fuel log' });
    return;
  }

  let storedBillPhoto: string | null = null;
  if (billPhoto) {
    if (!(await proofPhotoStore.verifyExists(billPhoto))) {
      res.status(400).json({ error: 'Bill photo upload was not found in storage' });
      return;
    }
    storedBillPhoto = billPhoto;
  }

  const actor = req.user!;
  const [row] = await db.insert(fuelLogs).values({
    vehicleId: +vehicleId,
    litres, amount, odometer, filledAt,
    billPhoto: storedBillPhoto,
    notes: typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null,
    recordedBy: actor.id,
    recordedByName: actor.name,
  }).returning();
  // Mirror the fuel bill into the unified vault (additive, best-effort).
  if (storedBillPhoto && isObjectStoragePath(storedBillPhoto)) {
    await registerUploadedFileSafe({
      storagePath: storedBillPhoto,
      fileType: 'fuel_bill',
      plantId: vehicle.plantId,
      userId: actor.id,
    });
  }
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const id = +req.params.id;
  const [existing] = await db.select().from(fuelLogs).where(eq(fuelLogs.id, id));
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  // The log must belong to the actor's plant, and any re-assignment target too.
  if (!(await fuelLogInScope(id, req.user!.plantId))) { res.status(404).json({ error: 'Not found' }); return; }

  const updateData: Record<string, unknown> = {};
  try {
    if (req.body.vehicleId !== undefined) {
      const scope = plantScope(req.user!.plantId, vehicles.plantId);
      const vIdEq = eq(vehicles.id, +req.body.vehicleId);
      const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(scope ? and(vIdEq, scope) : vIdEq);
      if (!vehicle) { res.status(400).json({ error: 'Vehicle not found' }); return; }
      updateData.vehicleId = +req.body.vehicleId;
    }
    if (req.body.litres !== undefined) updateData.litres = parseLitres(req.body.litres);
    if (req.body.amount !== undefined) updateData.amount = parseOptionalAmount(req.body.amount);
    if (req.body.odometer !== undefined) updateData.odometer = parseOptionalOdometer(req.body.odometer);
    if (req.body.filledAt !== undefined) updateData.filledAt = parseFilledAt(req.body.filledAt);
    if (req.body.notes !== undefined) {
      updateData.notes = typeof req.body.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
    }
    const billPhoto = validateBillPhoto(req.body.billPhoto);
    if (billPhoto !== undefined) {
      if (billPhoto && !(await proofPhotoStore.verifyExists(billPhoto))) {
        res.status(400).json({ error: 'Bill photo upload was not found in storage' });
        return;
      }
      updateData.billPhoto = billPhoto;
      // Clean up a replaced/removed photo's backing object (best-effort).
      if (existing.billPhoto && existing.billPhoto !== billPhoto) {
        await proofPhotoStore.remove(existing.billPhoto).catch(() => {});
        await unregisterUploadedFilesSafe([existing.billPhoto]);
      }
    }
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid fuel log' });
    return;
  }

  const [row] = await db.update(fuelLogs).set(updateData).where(eq(fuelLogs.id, id)).returning();
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  if (!(await fuelLogInScope(id, req.user!.plantId))) { res.status(404).json({ error: 'Not found' }); return; }
  const [existing] = await db.select({ billPhoto: fuelLogs.billPhoto }).from(fuelLogs).where(eq(fuelLogs.id, id));
  await db.delete(fuelLogs).where(eq(fuelLogs.id, id));
  if (existing?.billPhoto) {
    await proofPhotoStore.remove(existing.billPhoto).catch(() => {});
    await unregisterUploadedFilesSafe([existing.billPhoto]);
  }
  res.json({ ok: true });
});

export default router;
