import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, sites, vehicles, drivers, clients } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { notifyChallanStatus } from '../lib/deliveryNotify.js';
import { getFreshnessConfig, computeFreshness } from '../lib/freshness.js';
const router = Router();
router.use(requireAuth);
// Geofence tuning. A delivery auto-completes only after the driver reports
// REQUIRED_FIXES consecutive fixes inside GEOFENCE_RADIUS_M with an accuracy
// no worse than MAX_ACCURACY_M — this debounces noisy/low-quality GPS so a
// single bad fix near the site can't falsely mark a challan delivered.
const GEOFENCE_RADIUS_M = 150;
const MAX_ACCURACY_M = 100;
const REQUIRED_FIXES = 3;
// Latest known position per challan. In-memory by design (single-process dev
// + small deployment); positions are ephemeral and rebuilt as drivers report.
const livePositions = new Map();
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
        clientId: challans.clientId,
        driverId: challans.driverId,
        siteId: challans.siteId,
        vehicleId: challans.vehicleId,
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
    let status = row.status;
    if (row.status === 'dispatched' && inRadiusCount >= REQUIRED_FIXES) {
        const autoNote = 'Auto-delivered by GPS geofence';
        const mergedNotes = [row.notes, autoNote].filter(Boolean).join(' · ');
        const [updated] = await db
            .update(challans)
            .set({ status: 'delivered', deliveryTime: new Date(), notes: mergedNotes })
            .where(eq(challans.id, cid))
            .returning();
        delivered = true;
        status = 'delivered';
        inRadiusCount = 0;
        emitSSEEvent('challan.updated', updated, { clientId: updated.clientId, driverId: updated.driverId });
        // GPS geofence auto-completed the delivery — notify the customer (best-effort).
        void notifyChallanStatus(cid, 'delivered');
    }
    const live = {
        challanId: cid,
        challanNo: row.challanNo,
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
        updatedAt: new Date().toISOString(),
    };
    livePositions.set(cid, live);
    // Scope the live GPS stream so a client only sees positions for their own
    // deliveries and a driver only sees their own trips; staff still get all.
    emitSSEEvent('vehicle.position', live, { clientId: row.clientId, driverId: row.driverId });
    // Once delivered there's nothing left to track for this challan.
    if (delivered)
        livePositions.delete(cid);
    res.json({ ok: true, distanceM, delivered, withinRadius, inRadiusCount });
});
// Dispatch / control-room view of the latest fix per active challan.
router.get('/', requireRole('admin', 'dispatcher', 'authority'), (_req, res) => {
    res.json(Array.from(livePositions.values()));
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
// Shared by the freshness endpoint and the background alert ticker: pull every
// currently-dispatched (in-transit) challan, fold in its latest live GPS fix if
// one exists, and classify each load's pour urgency. Sorted most-urgent-first.
export async function getFreshnessLoads(now = new Date()) {
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
        .where(eq(challans.status, 'dispatched'));
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
router.get('/freshness', requireRole('admin', 'dispatcher', 'authority', 'plant_operator'), async (_req, res) => {
    res.json(await getFreshnessLoads());
});
// Lightweight freshness config for clients and drivers, who only need the
// working-life window to render a pour-by countdown on their own loads (they
// must not see the plant-wide freshness list). Any authenticated user may read.
router.get('/freshness-config', async (_req, res) => {
    res.json(await getFreshnessConfig());
});
export default router;
