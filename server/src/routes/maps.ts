import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, plants, vehicles, drivers, sites } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getLivePosition } from './positions.js';
import { isOpenNow } from './plants.js';
import { rmcDiscoveryAdminRoutes, rmcDiscoveryPublicRoutes } from './rmcDiscovery.js';

const router = Router();

// This router is mounted at /api. The discovery subrouters therefore become:
// /api/super-admin/rmc-discovery/* and /api/public/rmc-plants*.
router.use('/super-admin/rmc-discovery', rmcDiscoveryAdminRoutes);
router.use('/public', rmcDiscoveryPublicRoutes);

// NOTE: this router is mounted at the broad '/api' prefix, so a router-level
// `router.use(requireAuth)` would run for EVERY /api/* request. Authentication is
// intentionally attached only to routes/subrouters that require it.
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
