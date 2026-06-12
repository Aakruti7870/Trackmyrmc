import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vehicles, drivers } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Diesel baselines (mileage, idle burn) are owner/staff-only and must never be
// returned to clients or drivers.
const DIESEL_VIEW_ROLES = ['admin', 'dispatcher', 'authority', 'plant_operator'];

const baseVehicleSelect = {
  id: vehicles.id, vehicleNo: vehicles.vehicleNo, type: vehicles.type,
  capacity: vehicles.capacity, status: vehicles.status,
  insuranceExpiry: vehicles.insuranceExpiry, lastService: vehicles.lastService,
  driverId: vehicles.driverId, createdAt: vehicles.createdAt,
  driverName: drivers.name, driverPhone: drivers.phone,
};

const vehicleSelect = {
  ...baseVehicleSelect,
  mileageKmpl: vehicles.mileageKmpl, idleBurnLph: vehicles.idleBurnLph,
};

// Pick the audience-appropriate column set: staff see diesel baselines, everyone
// else gets the same row without those fields.
function vehicleSelectFor(role: string) {
  return DIESEL_VIEW_ROLES.includes(role) ? vehicleSelect : baseVehicleSelect;
}

// Normalise an optional numeric (decimal) input: blank/undefined -> null,
// otherwise the trimmed string drizzle expects for a numeric column.
function optDecimal(v: unknown): string | null {
  if (v == null || (typeof v === 'string' && v.trim() === '')) return null;
  return String(v).trim();
}

router.get('/', async (req, res) => {
  const rows = await db.select(vehicleSelectFor(req.user!.role)).from(vehicles)
    .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
    .orderBy(desc(vehicles.createdAt));
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [row] = await db.select(vehicleSelectFor(req.user!.role)).from(vehicles)
    .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
    .where(eq(vehicles.id, +req.params.id));
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

// Vehicle records carry diesel baselines (mileage, idle burn) that feed
// reconciliation, so writes are restricted to the same roles the UI exposes the
// Fleet screen to — never clients, drivers or plant operators.
const VEHICLE_WRITE_ROLES = ['admin', 'dispatcher', 'authority'] as const;

router.post('/', requireRole(...VEHICLE_WRITE_ROLES), async (req, res) => {
  const { vehicleNo, type, capacity, driverId, insuranceExpiry, lastService, status, mileageKmpl, idleBurnLph } = req.body;
  const [row] = await db.insert(vehicles).values({
    vehicleNo, type: type || 'Transit Mixer',
    capacity: capacity.toString(),
    driverId: driverId ? +driverId : null,
    insuranceExpiry, lastService,
    mileageKmpl: optDecimal(mileageKmpl), idleBurnLph: optDecimal(idleBurnLph),
    status: status || 'active',
  }).returning();
  res.status(201).json(row);
});

router.put('/:id', requireRole(...VEHICLE_WRITE_ROLES), async (req, res) => {
  const { vehicleNo, type, capacity, driverId, insuranceExpiry, lastService, status, mileageKmpl, idleBurnLph } = req.body;
  const [row] = await db.update(vehicles).set({
    vehicleNo, type,
    capacity: capacity?.toString(),
    driverId: driverId ? +driverId : null,
    insuranceExpiry, lastService, status,
    mileageKmpl: optDecimal(mileageKmpl), idleBurnLph: optDecimal(idleBurnLph),
  }).where(eq(vehicles.id, +req.params.id)).returning();
  res.json(row);
});

router.delete('/:id', requireRole(...VEHICLE_WRITE_ROLES), async (req, res) => {
  await db.delete(vehicles).where(eq(vehicles.id, +req.params.id));
  res.json({ ok: true });
});

export default router;
