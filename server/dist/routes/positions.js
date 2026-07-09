import { Router } from 'express';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, sites, vehicles, drivers, clients, vehicleAlerts } from '../db/schema.js';
import { plantScope } from '../lib/tenancy.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { notifyChallanStatus } from '../lib/deliveryNotify.js';
import { updateTripLocation, closeTripOnDelivery } from '../lib/tripSessions.js';
import { getFreshnessConfig, computeFreshness } from '../lib/freshness.js';
import { getFuelConfig } from '../lib/fuelConfig.js';
const router = Router();
router.use(requireAuth);
// Geofence tuning. A delivery auto-completes only after the driver reports
// REQUIRED_FIXES consecutive fixes inside GEOFENCE_RADIUS_M with an accuracy
// no worse than MAX_ACCURACY_M — this debounces noisy/low-quality GPS so a
// single bad fix near the site can't falsely mark a challan delivered.
const GEOFENCE_RADIUS_M = 150;
const MAX_ACCURACY_M = 100;
const REQUIRED_FIXES = 3;
// Site release uses an outward hysteresis ring: the truck must be clearly beyond
// this (wider than the arrival geofence) for REQUIRED_FIXES consecutive fixes
// before we record that it has left the site, so GPS jitter at the boundary
// can't toggle a false departure.
const RELEASE_RADIUS_M = 300;
// Latest known position per challan. In-memory by design (single-process dev
// + small deployment); positions are ephemeral and rebuilt as drivers report.
const livePositions = new Map();
// Read-only accessor for the latest live fix of one challan. Used by the public
// tracking endpoint (which must not import the in-memory Map directly).
export function getLivePosition(challanId) {
    return livePositions.get(challanId) ?? null;
}
function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
function numOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
// --- Theft / route-deviation alert tuning ----------------------------------
// A truck that moves more than this from its "stopped" anchor is considered to
// be on the move again, resetting the stationary timer (debounces GPS jitter so
// a parked truck isn't repeatedly re-anchored, and a moving truck never trips
// the stop alert).
const STOP_MOVE_RADIUS_M = 80;
// Within this distance of the plant counts as "at the plant" — idling at base is
// not an unscheduled stop.
const PLANT_RADIUS_M = 200;
// Settings rarely change but the GPS path is hit every few seconds per truck, so
// cache the fuel/theft config briefly to avoid a DB read on every fix.
let fuelCfgCache = null;
const FUEL_CFG_TTL_MS = 60_000;
async function getFuelConfigCached() {
    const now = Date.now();
    if (fuelCfgCache && now - fuelCfgCache.at < FUEL_CFG_TTL_MS)
        return fuelCfgCache.cfg;
    const cfg = await getFuelConfig();
    fuelCfgCache = { cfg, at: now };
    return cfg;
}
// Shortest distance (metres) from point P to the plant→site segment A→B, using a
// local equirectangular projection anchored at the plant. Accurate enough at the
// city scale these trips run at, and cheap to compute per fix.
function pointToSegmentM(plat, plng, alat, alng, blat, blng) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const lat0 = toRad(alat);
    const proj = (lat, lng) => ({
        x: R * toRad(lng - alng) * Math.cos(lat0),
        y: R * toRad(lat - alat),
    });
    const p = proj(plat, plng);
    const b = proj(blat, blng);
    const abx = b.x, aby = b.y; // A is the projection origin (0,0)
    const ab2 = abx * abx + aby * aby;
    let t = ab2 === 0 ? 0 : (p.x * abx + p.y * aby) / ab2;
    t = Math.max(0, Math.min(1, t));
    const cx = t * abx, cy = t * aby;
    const dx = p.x - cx, dy = p.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
}
// Persists a detected alert (positions are ephemeral, so the alert must be
// stored when first seen) and fans it out to staff over SSE. The empty audience
// reaches staff connections only — clients and drivers never receive it.
async function persistVehicleAlert(a) {
    const [alert] = await db.insert(vehicleAlerts).values({
        challanId: a.challanId,
        vehicleId: a.vehicleId,
        driverId: a.driverId,
        type: a.type,
        lat: a.lat.toString(),
        lng: a.lng.toString(),
        distanceM: a.distanceM,
        detail: a.detail,
    }).returning();
    emitSSEEvent('vehicle.alert', alert, { plantId: a.plantId ?? undefined });
}
// Driver streams a live GPS fix for one of their assigned challans.
router.post('/', requireRole('driver'), async (req, res) => {
    const driverId = req.user.linkedDriverId ?? null;
    if (!driverId) {
        res.status(403).json({ error: 'No driver profile linked to this account' });
        return;
    }
    const { challanId, lat, lng, accuracy, speed, heading } = req.body ?? {};
    const cid = Number(challanId);
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(cid) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        res.status(400).json({ error: 'challanId, lat and lng must be valid numbers' });
        return;
    }
    const [row] = await db
        .select({
        id: challans.id,
        challanNo: challans.challanNo,
        status: challans.status,
        notes: challans.notes,
        plantId: challans.plantId,
        clientId: challans.clientId,
        driverId: challans.driverId,
        siteId: challans.siteId,
        vehicleId: challans.vehicleId,
        siteArrivalTime: challans.siteArrivalTime,
        siteReleaseTime: challans.siteReleaseTime,
        siteName: sites.name,
        siteLat: sites.latitude,
        siteLng: sites.longitude,
        vehicleNo: vehicles.vehicleNo,
        driverName: drivers.name,
    })
        .from(challans)
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .where(eq(challans.id, cid));
    if (!row) {
        res.status(404).json({ error: 'Challan not found' });
        return;
    }
    if (row.driverId !== driverId) {
        res.status(403).json({ error: 'Not assigned to this challan' });
        return;
    }
    const acc = numOrNull(accuracy);
    const spd = numOrNull(speed);
    const hdg = numOrNull(heading);
    let distanceM = null;
    if (row.siteLat != null && row.siteLng != null) {
        distanceM = Math.round(haversineM(latitude, longitude, Number(row.siteLat), Number(row.siteLng)));
    }
    const prev = livePositions.get(cid);
    const withinRadius = distanceM != null && distanceM <= GEOFENCE_RADIUS_M && (acc == null || acc <= MAX_ACCURACY_M);
    let inRadiusCount = withinRadius ? (prev?.inRadiusCount ?? 0) + 1 : 0;
    let delivered = false;
    let released = false;
    let status = row.status;
    // Both timestamps are persisted on the challan; in-memory state only debounces
    // the GPS fixes that trigger them.
    let arrivalTime = row.siteArrivalTime;
    let releaseTime = row.siteReleaseTime;
    // Arrival = the geofence confirmation that also auto-completes the delivery.
    // Site arrival time is stamped once, the first time we confirm the truck on
    // site, alongside the existing auto-delivery.
    if (row.status === 'dispatched' && inRadiusCount >= REQUIRED_FIXES) {
        const now = new Date();
        arrivalTime = row.siteArrivalTime ?? now;
        const autoNote = 'Auto-delivered by GPS geofence';
        const mergedNotes = [row.notes, autoNote].filter(Boolean).join(' · ');
        const [updated] = await db
            .update(challans)
            .set({ status: 'delivered', deliveryTime: now, siteArrivalTime: arrivalTime, notes: mergedNotes })
            .where(eq(challans.id, cid))
            .returning();
        delivered = true;
        status = 'delivered';
        inRadiusCount = 0;
        emitSSEEvent('challan.updated', updated, { clientId: updated.clientId, driverId: updated.driverId });
        // Geofence auto-delivery closes the trip session (customer link off).
        const closedTrip = await closeTripOnDelivery(cid);
        if (closedTrip)
            emitSSEEvent('trip.updated', closedTrip, { clientId: closedTrip.clientId, driverId: closedTrip.driverId, plantId: closedTrip.plantId });
        // GPS geofence auto-completed the delivery — notify the customer (best-effort).
        void notifyChallanStatus(cid, 'delivered');
    }
    // Release (auto) — once the truck has an arrival but no release yet, watch for
    // it driving clearly beyond the outward hysteresis ring for REQUIRED_FIXES
    // consecutive fixes, then stamp the site release time.
    let outRadiusCount = prev?.outRadiusCount ?? 0;
    if (arrivalTime != null && releaseTime == null) {
        const outsideRelease = distanceM != null && distanceM > RELEASE_RADIUS_M && (acc == null || acc <= MAX_ACCURACY_M);
        outRadiusCount = outsideRelease ? outRadiusCount + 1 : 0;
        if (outRadiusCount >= REQUIRED_FIXES) {
            const now = new Date();
            releaseTime = now;
            outRadiusCount = 0;
            const [updated] = await db
                .update(challans)
                .set({ siteReleaseTime: now })
                .where(eq(challans.id, cid))
                .returning();
            released = true;
            emitSSEEvent('challan.updated', updated, { clientId: updated.clientId, driverId: updated.driverId });
        }
    }
    else {
        outRadiusCount = 0;
    }
    // --- Unscheduled-stop & route-deviation detection ------------------------
    // Carry the stationary anchor + dedupe flags forward from the previous fix.
    let anchorLat = prev?.anchorLat ?? null;
    let anchorLng = prev?.anchorLng ?? null;
    let anchorSince = prev?.anchorSince ?? null;
    let stopAlerted = prev?.stopAlerted ?? false;
    let deviationAlerted = prev?.deviationAlerted ?? false;
    const cfg = await getFuelConfigCached();
    const goodAccuracy = acc == null || acc <= MAX_ACCURACY_M;
    const hasPlant = cfg.plantLat != null && cfg.plantLng != null;
    // Detection only runs on good fixes and only when plant coordinates are
    // configured (needed to exclude "idling at base" and to anchor the corridor).
    if (goodAccuracy && hasPlant) {
        const plantLat = Number(cfg.plantLat);
        const plantLng = Number(cfg.plantLng);
        // Re-anchor when the truck has clearly moved; this also debounces jitter.
        const movedFromAnchor = anchorLat == null || anchorLng == null
            ? Infinity
            : haversineM(latitude, longitude, anchorLat, anchorLng);
        if (movedFromAnchor > STOP_MOVE_RADIUS_M) {
            anchorLat = latitude;
            anchorLng = longitude;
            anchorSince = new Date().toISOString();
            stopAlerted = false;
        }
        const plantDistM = haversineM(latitude, longitude, plantLat, plantLng);
        const atPlant = plantDistM <= PLANT_RADIUS_M;
        const atSite = distanceM != null && distanceM <= GEOFENCE_RADIUS_M;
        // Unscheduled stop: stationary past the threshold, away from plant and site.
        if (!stopAlerted && !atPlant && !atSite && anchorSince) {
            const stoppedMin = (Date.now() - new Date(anchorSince).getTime()) / 60000;
            if (stoppedMin >= cfg.unscheduledStopMin) {
                stopAlerted = true;
                await persistVehicleAlert({
                    challanId: cid,
                    plantId: row.plantId,
                    vehicleId: row.vehicleId,
                    driverId: row.driverId,
                    type: 'unscheduled_stop',
                    lat: latitude,
                    lng: longitude,
                    distanceM: Math.round(plantDistM),
                    detail: `Stopped ~${Math.round(stoppedMin)} min away from plant and site${row.siteName ? ` (en route to ${row.siteName})` : ''}`,
                });
            }
        }
        // Route deviation: too far off the straight plant→site corridor while still
        // heading to site. Requires site coordinates; re-arms once back on corridor.
        if (status === 'dispatched' && row.siteLat != null && row.siteLng != null) {
            const offCorridorM = pointToSegmentM(latitude, longitude, plantLat, plantLng, Number(row.siteLat), Number(row.siteLng));
            if (offCorridorM > cfg.routeDeviationM) {
                if (!deviationAlerted) {
                    deviationAlerted = true;
                    await persistVehicleAlert({
                        challanId: cid,
                        plantId: row.plantId,
                        vehicleId: row.vehicleId,
                        driverId: row.driverId,
                        type: 'route_deviation',
                        lat: latitude,
                        lng: longitude,
                        distanceM: Math.round(offCorridorM),
                        detail: `~${Math.round(offCorridorM)} m off the expected route to ${row.siteName ?? 'site'}`,
                    });
                }
            }
            else {
                deviationAlerted = false;
            }
        }
    }
    const live = {
        challanId: cid,
        challanNo: row.challanNo,
        plantId: row.plantId,
        clientId: row.clientId,
        driverId: row.driverId,
        driverName: row.driverName,
        vehicleId: row.vehicleId,
        vehicleNo: row.vehicleNo,
        siteId: row.siteId,
        siteName: row.siteName,
        lat: latitude,
        lng: longitude,
        accuracy: acc,
        speed: spd,
        heading: hdg,
        distanceM,
        status,
        inRadiusCount,
        outRadiusCount,
        siteArrivalTime: arrivalTime ? new Date(arrivalTime).toISOString() : null,
        siteReleaseTime: releaseTime ? new Date(releaseTime).toISOString() : null,
        updatedAt: new Date().toISOString(),
        anchorLat,
        anchorLng,
        anchorSince,
        stopAlerted,
        deviationAlerted,
    };
    livePositions.set(cid, live);
    // Fold the latest fix into the formal trip session so the customer page and
    // staff live view can render the last-known position from the DB. Best-effort.
    void updateTripLocation(cid, latitude, longitude);
    // Scope the live GPS stream so a client only sees positions for their own
    // deliveries, a driver only sees their own trips, and plant-bound staff only
    // see their own plant's trucks (platform staff still get all).
    emitSSEEvent('vehicle.position', live, { clientId: row.clientId, driverId: row.driverId, plantId: row.plantId ?? undefined });
    // Keep the live position alive after delivery so we can still detect the truck
    // leaving site; only once site release is captured is there nothing left to
    // track for this challan.
    if (releaseTime != null)
        livePositions.delete(cid);
    res.json({
        ok: true,
        distanceM,
        delivered,
        released,
        arrived: arrivalTime != null,
        withinRadius,
        inRadiusCount,
        siteArrivalTime: live.siteArrivalTime,
        siteReleaseTime: live.siteReleaseTime,
    });
});
// Dispatch / control-room view of the latest fix per active challan.
router.get('/', requireRole('admin', 'dispatcher', 'authority'), (req, res) => {
    const actorPlantId = req.user.plantId ?? null;
    const all = Array.from(livePositions.values());
    // Plant-bound staff only see their own plant's trucks; platform staff
    // (plantId null) see the whole network.
    res.json(actorPlantId == null ? all : all.filter(p => p.plantId === actorPlantId));
});
// A customer's view of live positions for their own in-flight deliveries only.
// Backs the initial paint of the tracking map before the SSE stream pushes the
// next fix; live updates thereafter arrive via the client-scoped 'vehicle.position'
// SSE event. Returns [] when the account isn't linked to a client.
router.get('/mine', requireRole('client'), async (req, res) => {
    const clientId = req.user.linkedClientId ?? null;
    if (!clientId) {
        res.json([]);
        return;
    }
    const mine = Array.from(livePositions.values()).filter(p => p.clientId === clientId);
    res.json(mine);
});
// Staff theft/route-deviation alert feed. Persisted (positions are ephemeral),
// most-recent-first. `?open=1` returns only unacknowledged alerts.
router.get('/alerts', requireRole('admin', 'dispatcher', 'authority'), async (req, res) => {
    const onlyOpen = req.query.open === '1' || req.query.unacknowledged === '1';
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await db
        .select({
        id: vehicleAlerts.id,
        type: vehicleAlerts.type,
        challanId: vehicleAlerts.challanId,
        vehicleId: vehicleAlerts.vehicleId,
        driverId: vehicleAlerts.driverId,
        lat: vehicleAlerts.lat,
        lng: vehicleAlerts.lng,
        distanceM: vehicleAlerts.distanceM,
        detail: vehicleAlerts.detail,
        acknowledgedAt: vehicleAlerts.acknowledgedAt,
        createdAt: vehicleAlerts.createdAt,
        challanNo: challans.challanNo,
        vehicleNo: vehicles.vehicleNo,
        driverName: drivers.name,
    })
        .from(vehicleAlerts)
        .leftJoin(challans, eq(vehicleAlerts.challanId, challans.id))
        .leftJoin(vehicles, eq(vehicleAlerts.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(vehicleAlerts.driverId, drivers.id))
        .where(and(onlyOpen ? isNull(vehicleAlerts.acknowledgedAt) : undefined, plantScope(req.user.plantId, challans.plantId)))
        .orderBy(desc(vehicleAlerts.createdAt))
        .limit(limit);
    res.json(rows);
});
// Acknowledge (dismiss) a single alert.
router.post('/alerts/:id/ack', requireRole('admin', 'dispatcher', 'authority'), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid alert id' });
        return;
    }
    // Tenant guard: a plant-bound staffer may only acknowledge alerts belonging
    // to their own plant's challans (same 404 as a missing row — no existence leak).
    const [visible] = await db
        .select({ id: vehicleAlerts.id })
        .from(vehicleAlerts)
        .leftJoin(challans, eq(vehicleAlerts.challanId, challans.id))
        .where(and(eq(vehicleAlerts.id, id), plantScope(req.user.plantId, challans.plantId)));
    if (!visible) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const [row] = await db
        .update(vehicleAlerts)
        .set({ acknowledgedAt: new Date() })
        .where(eq(vehicleAlerts.id, id))
        .returning();
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
// Shared by the freshness endpoint and the background alert ticker: pull every
// currently-dispatched (in-transit) challan, fold in its latest live GPS fix if
// one exists, and classify each load's pour urgency. Sorted most-urgent-first.
export async function getFreshnessLoads(now = new Date(), actorPlantId = null) {
    const config = await getFreshnessConfig();
    const rows = await db
        .select({
        id: challans.id,
        challanNo: challans.challanNo,
        clientId: challans.clientId,
        clientName: clients.name,
        siteId: challans.siteId,
        siteName: sites.name,
        vehicleNo: vehicles.vehicleNo,
        driverName: drivers.name,
        grade: challans.grade,
        quantity: challans.quantity,
        dispatchTime: challans.dispatchTime,
    })
        .from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(sites, eq(challans.siteId, sites.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .leftJoin(drivers, eq(challans.driverId, drivers.id))
        .where(and(eq(challans.status, 'dispatched'), plantScope(actorPlantId, challans.plantId)));
    const loads = rows.map(row => {
        const pos = livePositions.get(row.id);
        const fresh = computeFreshness({
            dispatchTime: row.dispatchTime ? new Date(row.dispatchTime).toISOString() : null,
            config,
            now,
            distanceM: pos?.distanceM ?? null,
            speed: pos?.speed ?? null,
        });
        return {
            challanId: row.id,
            challanNo: row.challanNo,
            clientId: row.clientId,
            clientName: row.clientName,
            siteId: row.siteId,
            siteName: row.siteName,
            vehicleNo: row.vehicleNo,
            driverName: row.driverName,
            grade: row.grade,
            quantity: row.quantity,
            dispatchTime: row.dispatchTime ? new Date(row.dispatchTime).toISOString() : null,
            hasLivePosition: pos != null,
            lat: pos?.lat ?? null,
            lng: pos?.lng ?? null,
            distanceM: pos?.distanceM ?? null,
            speed: pos?.speed ?? null,
            positionUpdatedAt: pos?.updatedAt ?? null,
            ...fresh,
        };
    });
    // Order by urgency: most-overdue / least-remaining first so the dispatch board
    // shows the loads that need pouring now at the top.
    const rank = { expired: 0, critical: 1, warning: 2, fresh: 3 };
    loads.sort((a, b) => {
        if (rank[a.level] !== rank[b.level])
            return rank[a.level] - rank[b.level];
        return (a.remainingMin ?? Infinity) - (b.remainingMin ?? Infinity);
    });
    return { config, loads, generatedAt: now.toISOString() };
}
// Dispatch / plant view of concrete freshness for in-transit loads.
router.get('/freshness', requireRole('admin', 'dispatcher', 'authority', 'plant_operator'), async (req, res) => {
    res.json(await getFreshnessLoads(new Date(), req.user.plantId ?? null));
});
// Lightweight freshness config for clients and drivers, who only need the
// working-life window to render a pour-by countdown on their own loads (they
// must not see the plant-wide freshness list). Any authenticated user may read.
router.get('/freshness-config', async (_req, res) => {
    res.json(await getFreshnessConfig());
});
export default router;
