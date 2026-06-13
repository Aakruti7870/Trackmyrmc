import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
// Great-circle distance in km between two lat/lng points.
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// Is the plant open right now, given 'HH:MM' open/close in its local (IST) time?
function isOpenNow(openTime, closeTime) {
    if (!openTime || !closeTime)
        return false;
    const now = new Date(Date.now() + 5.5 * 3600000); // shift UTC -> IST
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const toMin = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
    };
    const open = toMin(openTime);
    const close = toMin(closeTime);
    if (close <= open)
        return mins >= open || mins < close; // crosses midnight
    return mins >= open && mins < close;
}
const ADMIN = requireRole('authority', 'admin');
// Customer-facing: approved + active + location-verified plants within radius km,
// nearest first. Never exposes status/verification internals.
router.get('/nearby', async (req, res) => {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radius = req.query.radius != null ? parseFloat(String(req.query.radius)) : 40;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: 'lat and lng are required' });
        return;
    }
    const effRadius = Number.isFinite(radius) && radius > 0 ? radius : 40;
    const rows = await db.select().from(plants);
    const nearby = rows
        .filter(p => p.plantStatus === 'approved' && p.isActive && p.locationVerified)
        .map(p => {
        const pLat = parseFloat(p.latitude);
        const pLng = parseFloat(p.longitude);
        return {
            id: p.id,
            name: p.name,
            address: p.address,
            city: p.city,
            contactNumber: p.contactNumber,
            latitude: pLat,
            longitude: pLng,
            deliveryRadiusKm: p.deliveryRadiusKm,
            grades: p.grades,
            openTime: p.openTime,
            closeTime: p.closeTime,
            openNow: isOpenNow(p.openTime, p.closeTime),
            distanceKm: Math.round(haversineKm(lat, lng, pLat, pLng) * 10) / 10,
        };
    })
        .filter(p => p.distanceKm <= effRadius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    res.json(nearby);
});
// ---- Admin onboarding / management ----
router.get('/', ADMIN, async (_req, res) => {
    const rows = await db.select().from(plants).orderBy(plants.createdAt);
    res.json(rows);
});
function parseBody(body) {
    const out = {};
    if (body.name !== undefined)
        out.name = String(body.name).trim();
    if (body.address !== undefined)
        out.address = body.address === null ? null : String(body.address);
    if (body.city !== undefined)
        out.city = body.city === null ? null : String(body.city);
    if (body.contactNumber !== undefined)
        out.contactNumber = body.contactNumber === null ? null : String(body.contactNumber);
    if (body.latitude !== undefined)
        out.latitude = String(body.latitude);
    if (body.longitude !== undefined)
        out.longitude = String(body.longitude);
    if (body.plantStatus !== undefined)
        out.plantStatus = body.plantStatus;
    if (body.isActive !== undefined)
        out.isActive = Boolean(body.isActive);
    if (body.locationVerified !== undefined)
        out.locationVerified = Boolean(body.locationVerified);
    if (body.deliveryRadiusKm !== undefined)
        out.deliveryRadiusKm = Math.round(Number(body.deliveryRadiusKm)) || 0;
    if (body.grades !== undefined)
        out.grades = Array.isArray(body.grades) ? body.grades.map(String) : [];
    if (body.openTime !== undefined)
        out.openTime = body.openTime === null ? null : String(body.openTime);
    if (body.closeTime !== undefined)
        out.closeTime = body.closeTime === null ? null : String(body.closeTime);
    return out;
}
router.post('/', ADMIN, async (req, res) => {
    const data = parseBody(req.body ?? {});
    if (!data.name || data.latitude === undefined || data.longitude === undefined) {
        res.status(400).json({ error: 'name, latitude and longitude are required' });
        return;
    }
    try {
        const [row] = await db.insert(plants).values(data).returning();
        res.status(201).json(row);
    }
    catch {
        res.status(409).json({ error: 'A plant with this name already exists' });
    }
});
router.put('/:id', ADMIN, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const data = parseBody(req.body ?? {});
    data.updatedAt = new Date();
    const [row] = await db.update(plants).set(data).where(eq(plants.id, id)).returning();
    if (!row) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    res.json(row);
});
router.delete('/:id', ADMIN, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const [row] = await db.delete(plants).where(eq(plants.id, id)).returning();
    if (!row) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    res.json({ ok: true });
});
export default router;
