import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, plants, vehicles, drivers, sites } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getLivePosition } from './positions.js';
import { isOpenNow } from './plants.js';
const router = Router();
// Every route here requires an authenticated staff/authority session; the
// per-route requireRole guards below refine which roles may see what. Without
// this, requireRole would run with no req.user and reject everyone (403).
router.use(requireAuth);
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
];
// Live fleet: every in-transit (dispatched) load, scoped to the caller's plant
// unless they are the Super Admin. The latest GPS fix is folded in from the
// in-memory live-position store; a load with no fix yet still appears (so staff
// can see the truck is out) but carries null coordinates.
router.get('/live-fleet-map', requireRole(...FLEET_ROLES), async (req, res) => {
    const actor = req.user;
    const scoped = actor.role !== 'authority';
    if (scoped && actor.plantId == null) {
        res.json([]);
        return;
    }
    const where = scoped
        ? and(eq(challans.status, 'dispatched'), eq(challans.plantId, actor.plantId))
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
    const fleet = rows.map(r => {
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
// Plant network map: the FULL onboarded plant network with online/offline
// (open-now) status — not just customer-visible plants. Super Admin (authority)
// ONLY; plant staff have no cross-plant visibility, so the route rejects
// everyone else at the server. Shape matches the client MapPlant type.
router.get('/plant-network-map', requireRole('authority'), async (_req, res) => {
    const rows = await db.select().from(plants);
    const mapped = rows
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
