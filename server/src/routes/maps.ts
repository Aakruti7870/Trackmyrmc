import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, plants, vehicles, drivers, sites } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getLivePosition } from './positions.js';
import { isOpenNow } from './plants.js';

const router = Router();

// NOTE: this router is mounted at the broad '/api' prefix, so a router-level
// `router.use(requireAuth)` would run for EVERY /api/* request (including public
// routes mounted after it, e.g. webhooks) and 401 them before they reach their
// own routers. requireAuth is therefore applied PER-ROUTE below, so it only runs
// when the path actually matches. requireRole still needs it (it reads req.user).

// Roles allowed to see the live fleet map. Super Admin (authority) sees every
// plant's vehicles; the plant-bound staff roles below see only their own plant's
// vehicles (enforced server-side, never by the client). Drivers and customers
// are intentionally excluded.
const FLEET_ROLES = [
  'authority',
  'plant_owner',
  'admin',
  'supervisor',
  'dispatcher',
  'plant_operator',
  'fleet_manager',
  'quality_engineer',
] as const;

export interface FleetTruck {
  challanId: number;
  challanNo: string | null;
  plantId: number | null;
  plantName: string | null;
  vehicleNo: string | null;
  driverName: string | null;
  status: string;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  updatedAt: string | null;
  siteName: string | null;
  siteLat: number | null;
  siteLng: number | null;
}

// Live fleet: every in-transit (dispatched) load, scoped to the caller's plant
// unless they are the Super Admin. The latest GPS fix is folded in from the
// in-memory live-position store; a load with no fix yet still appears (so staff
// can see the truck is out) but carries null coordinates.
router.get('/live-fleet-map', requireAuth, requireRole(...FLEET_ROLES), async (req, res) => {
  const actor = req.user!;
  const scoped = actor.role !== 'authority';
  if (scoped && actor.plantId == null) { res.json([]); return; }

  const where = scoped
    ? and(eq(challans.status, 'dispatched'), eq(challans.plantId, actor.plantId!))
    : eq(challans.status, 'dispatched');

  const rows = await db
    .select({
      id: challans.id,
      challanNo: challans.challanNo,
      status: challans.status,
      plantId: challans.plantId,
      plantName: plants.name,
      vehicleNo: vehicles.vehicleNo,
      driverName: drivers.name,
      siteName: sites.name,
      siteLat: sites.latitude,
      siteLng: sites.longitude,
    })
    .from(challans)
    .leftJoin(plants, eq(challans.plantId, plants.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .where(where);

  const fleet: FleetTruck[] = rows.map(r => {
    const pos = getLivePosition(r.id);
    return {
      challanId: r.id,
      challanNo: r.challanNo,
      plantId: r.plantId,
      plantName: r.plantName,
      vehicleNo: r.vehicleNo,
      driverName: r.driverName,
      status: pos?.status ?? r.status,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      speed: pos?.speed ?? null,
      updatedAt: pos?.updatedAt ?? null,
      siteName: r.siteName,
      siteLat: r.siteLat != null ? Number(r.siteLat) : null,
      siteLng: r.siteLng != null ? Number(r.siteLng) : null,
    };
  });

  res.json(fleet);
});

// A customer's own live fleet: only the in-transit (dispatched) loads that
// belong to the signed-in client, with the latest GPS fix folded in from the
// live-position store. Scoped strictly by the account's linked client id — a
// customer never sees another client's or the plant-wide fleet. Returns [] when
// the account isn't linked to a client. Mirrors the staff /live-fleet-map shape
// so the same UI renders it.
router.get('/me/live-fleet-map', requireAuth, requireRole('client'), async (req, res) => {
  const clientId = req.user!.linkedClientId ?? null;
  if (clientId == null) { res.json([]); return; }

  const rows = await db
    .select({
      id: challans.id,
      challanNo: challans.challanNo,
      status: challans.status,
      plantId: challans.plantId,
      plantName: plants.name,
      vehicleNo: vehicles.vehicleNo,
      driverName: drivers.name,
      siteName: sites.name,
      siteLat: sites.latitude,
      siteLng: sites.longitude,
    })
    .from(challans)
    .leftJoin(plants, eq(challans.plantId, plants.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .where(and(eq(challans.status, 'dispatched'), eq(challans.clientId, clientId)));

  const fleet: FleetTruck[] = rows.map(r => {
    const pos = getLivePosition(r.id);
    return {
      challanId: r.id,
      challanNo: r.challanNo,
      plantId: r.plantId,
      plantName: r.plantName,
      vehicleNo: r.vehicleNo,
      driverName: r.driverName,
      status: pos?.status ?? r.status,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      speed: pos?.speed ?? null,
      updatedAt: pos?.updatedAt ?? null,
      siteName: r.siteName,
      siteLat: r.siteLat != null ? Number(r.siteLat) : null,
      siteLng: r.siteLng != null ? Number(r.siteLng) : null,
    };
  });

  res.json(fleet);
});

export interface NetworkPlant {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  contactNumber: string | null;
  latitude: number;
  longitude: number;
  grades: string[] | null;
  openTime: string | null;
  closeTime: string | null;
  openNow: boolean;
}

// Plant network map: the FULL onboarded plant network with online/offline
// (open-now) status — not just customer-visible plants. Super Admin (authority)
// ONLY; plant staff have no cross-plant visibility, so the route rejects
// everyone else at the server. Shape matches the client MapPlant type.
router.get('/plant-network-map', requireAuth, requireRole('authority'), async (_req, res) => {
  const rows = await db.select().from(plants);
  const mapped: NetworkPlant[] = rows
    .map(p => ({
      id: String(p.id),
      name: p.name,
      address: p.address,
      city: p.city,
      contactNumber: p.contactNumber,
      latitude: parseFloat(p.latitude),
      longitude: parseFloat(p.longitude),
      grades: p.grades,
      openTime: p.openTime,
      closeTime: p.closeTime,
      openNow: isOpenNow(p.openTime, p.closeTime),
    }))
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(mapped);
});

export default router;
