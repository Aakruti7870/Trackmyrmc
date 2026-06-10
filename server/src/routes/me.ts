import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, orders, challans, sites, vehicles, drivers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const challanSelect = {
  id: challans.id, challanNo: challans.challanNo,
  grade: challans.grade, quantity: challans.quantity,
  pumpRequired: challans.pumpRequired,
  dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
  status: challans.status, notes: challans.notes, createdAt: challans.createdAt,
  orderId: challans.orderId, clientId: challans.clientId,
  siteId: challans.siteId, vehicleId: challans.vehicleId, driverId: challans.driverId,
  clientName: clients.name,
  siteName: sites.name,
  vehicleNo: vehicles.vehicleNo,
  driverName: drivers.name,
  driverPhone: drivers.phone,
};

router.get('/orders', async (req, res) => {
  const client = await db.select().from(clients)
    .where(eq(clients.email, req.user!.email)).limit(1);
  if (!client.length) { res.json([]); return; }

  const rows = await db.select({
    id: orders.id, orderNo: orders.orderNo, grade: orders.grade,
    quantity: orders.quantity, pumpRequired: orders.pumpRequired,
    deliveryDate: orders.deliveryDate, deliveryTime: orders.deliveryTime,
    status: orders.status, notes: orders.notes, createdAt: orders.createdAt,
    clientId: orders.clientId, siteId: orders.siteId,
    clientName: clients.name, siteName: sites.name,
  }).from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .leftJoin(sites, eq(orders.siteId, sites.id))
    .where(eq(orders.clientId, client[0].id))
    .orderBy(desc(orders.createdAt));
  res.json(rows);
});

router.get('/challans', async (req, res) => {
  const client = await db.select().from(clients)
    .where(eq(clients.email, req.user!.email)).limit(1);
  if (!client.length) { res.json([]); return; }

  const rows = await db.select(challanSelect).from(challans)
    .leftJoin(clients, eq(challans.clientId, clients.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .where(eq(challans.clientId, client[0].id))
    .orderBy(desc(challans.createdAt));
  res.json(rows);
});

router.get('/trips', async (req, res) => {
  const driver = await db.select().from(drivers)
    .where(eq(drivers.name, req.user!.name)).limit(1);
  if (!driver.length) {
    const all = await db.select(challanSelect).from(challans)
      .leftJoin(clients, eq(challans.clientId, clients.id))
      .leftJoin(sites, eq(challans.siteId, sites.id))
      .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
      .leftJoin(drivers, eq(challans.driverId, drivers.id))
      .orderBy(desc(challans.createdAt))
      .limit(20);
    res.json(all); return;
  }

  const rows = await db.select(challanSelect).from(challans)
    .leftJoin(clients, eq(challans.clientId, clients.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .where(eq(challans.driverId, driver[0].id))
    .orderBy(desc(challans.createdAt));
  res.json(rows);
});

export default router;
