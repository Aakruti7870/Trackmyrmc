import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vehicles, drivers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', async (_req, res) => {
    const rows = await db.select({
        id: vehicles.id, vehicleNo: vehicles.vehicleNo, type: vehicles.type,
        capacity: vehicles.capacity, status: vehicles.status,
        insuranceExpiry: vehicles.insuranceExpiry, lastService: vehicles.lastService,
        driverId: vehicles.driverId, createdAt: vehicles.createdAt,
        driverName: drivers.name, driverPhone: drivers.phone,
    }).from(vehicles)
        .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
        .orderBy(desc(vehicles.createdAt));
    res.json(rows);
});
router.get('/:id', async (req, res) => {
    const [row] = await db.select({
        id: vehicles.id, vehicleNo: vehicles.vehicleNo, type: vehicles.type,
        capacity: vehicles.capacity, status: vehicles.status,
        insuranceExpiry: vehicles.insuranceExpiry, lastService: vehicles.lastService,
        driverId: vehicles.driverId, createdAt: vehicles.createdAt,
        driverName: drivers.name, driverPhone: drivers.phone,
    }).from(vehicles)
        .leftJoin(drivers, eq(vehicles.driverId, drivers.id))
        .where(eq(vehicles.id, +req.params.id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(row);
});
router.post('/', async (req, res) => {
    const { vehicleNo, type, capacity, driverId, insuranceExpiry, lastService, status } = req.body;
    const [row] = await db.insert(vehicles).values({
        vehicleNo, type: type || 'Transit Mixer',
        capacity: capacity.toString(),
        driverId: driverId ? +driverId : null,
        insuranceExpiry, lastService,
        status: status || 'active',
    }).returning();
    res.status(201).json(row);
});
router.put('/:id', async (req, res) => {
    const { vehicleNo, type, capacity, driverId, insuranceExpiry, lastService, status } = req.body;
    const [row] = await db.update(vehicles).set({
        vehicleNo, type,
        capacity: capacity?.toString(),
        driverId: driverId ? +driverId : null,
        insuranceExpiry, lastService, status,
    }).where(eq(vehicles.id, +req.params.id)).returning();
    res.json(row);
});
router.delete('/:id', async (req, res) => {
    await db.delete(vehicles).where(eq(vehicles.id, +req.params.id));
    res.json({ ok: true });
});
export default router;
