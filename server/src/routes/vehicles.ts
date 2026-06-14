import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vehicles, drivers } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';

const router = Router();
router.use(requireAuth);

// Fleet reads are plant-private for staff: every query is hard-scoped to the
// actor's plant (a null-plant legacy global admin stays unscoped and sees all).
// Clients and drivers keep their long-standing redacted read access (they never
// see the diesel baselines below and can never write — writes are gated to
// VEHICLE_WRITE_ROLES), so the router itself stays open to any authed role.

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
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  const rows = await db.select(vehicleSelectFor(req.user!.role)).from(vehicles)
    .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
    .where(scope)
    .orderBy(desc(vehicles.createdAt));
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  const idEq = eq(vehicles.id, +req.params.id);
  const [row] = await db.select(vehicleSelectFor(req.user!.role)).from(vehicles)
    .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
    .where(scope ? and(idEq, scope) : idEq);
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

// Vehicle records carry diesel baselines (mileage, idle burn) that feed
// reconciliation, so writes are restricted to the same roles the UI exposes the
// Fleet screen to — never clients, drivers or plant operators.
const VEHICLE_WRITE_ROLES = ['admin', 'dispatcher', 'authority'] as const;

router.post('/', requireRole(...VEHICLE_WRITE_ROLES), async (req, res) => {
  const { vehicleNo, type, capacity, driverId, insuranceExpiry, lastService, status, mileageKmpl, idleBurnLph } = req.body;
  // Stamp the creating staff member's plant so the new truck is private to it.
  // A null-plant global admin creates an unattributed (global) vehicle.
  const [row] = await db.insert(vehicles).values({
    plantId: req.user!.plantId ?? null,
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
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  const idEq = eq(vehicles.id, +req.params.id);
  const [row] = await db.update(vehicles).set({
    vehicleNo, type,
    capacity: capacity?.toString(),
    driverId: driverId ? +driverId : null,
    insuranceExpiry, lastService, status,
    mileageKmpl: optDecimal(mileageKmpl), idleBurnLph: optDecimal(idleBurnLph),
  }).where(scope ? and(idEq, scope) : idEq).returning();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id', requireRole(...VEHICLE_WRITE_ROLES), async (req, res) => {
  const scope = plantScope(req.user!.plantId, vehicles.plantId);
  const idEq = eq(vehicles.id, +req.params.id);
  const deleted = await db.delete(vehicles)
    .where(scope ? and(idEq, scope) : idEq)
    .returning({ id: vehicles.id });
  res.json({ ok: deleted.length > 0 });
});

export default router;
