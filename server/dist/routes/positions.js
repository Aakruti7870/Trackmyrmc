import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, sites, vehicles, drivers } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
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
    }
    const live = {
        challanId: cid,
        challanNo: row.challanNo,
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
    emitSSEEvent('vehicle.position', live);
    // Once delivered there's nothing left to track for this challan.
    if (delivered)
        livePositions.delete(cid);
    res.json({ ok: true, distanceM, delivered, withinRadius, inRadiusCount });
});
// Dispatch / control-room view of the latest fix per active challan.
router.get('/', requireRole('admin', 'dispatcher'), (_req, res) => {
    res.json(Array.from(livePositions.values()));
});
export default router;
