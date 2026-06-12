import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vehicles, drivers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
const vehicleSelect = {
    id: vehicles.id, vehicleNo: vehicles.vehicleNo, type: vehicles.type,
    capacity: vehicles.capacity, status: vehicles.status,
    insuranceExpiry: vehicles.insuranceExpiry, lastService: vehicles.lastService,
    mileageKmpl: vehicles.mileageKmpl, idleBurnLph: vehicles.idleBurnLph,
    driverId: vehicles.driverId, createdAt: vehicles.createdAt,
    driverName: drivers.name, driverPhone: drivers.phone,
};
// Normalise an optional numeric (decimal) input: blank/undefined -> null,
// otherwise the trimmed string drizzle expects for a numeric column.
function optDecimal(v) {
    if (v == null || (typeof v === 'string' && v.trim() === ''))
        return null;
    return String(v).trim();
}
router.get('/', async (_req, res) => {
    const rows = await db.select(vehicleSelect).from(vehicles)
        .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
        .orderBy(desc(vehicles.createdAt));
    res.json(rows);
});
router.get('/:id', async (req, res) => {
    const [row] = await db.select(vehicleSelect).from(vehicles)
        .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
        .where(eq(vehicles.id, +req.params.id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
    await db.delete(vehicles).where(eq(vehicles.id, +req.params.id));
    res.json({ ok: true });
});
export default router;
