import { Router } from 'express';
import { eq, desc, gte, lte, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, orders, challans, sites, vehicles, drivers, ledgerEntries } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

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

router.get('/orders', requireRole('client'), async (req, res) => {
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

router.get('/challans', requireRole('client'), async (req, res) => {
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

router.get('/ledger', requireRole('client'), async (req, res) => {
  const client = await db.select().from(clients)
    .where(eq(clients.email, req.user!.email)).limit(1);
  if (!client.length) { res.json({ entries: [], outstanding: 0, creditLimit: 0 }); return; }

  const rows = await db.select().from(ledgerEntries)
    .where(eq(ledgerEntries.clientId, client[0].id))
    .orderBy(desc(ledgerEntries.createdAt));

  let balance = 0;
  const withBalance = rows.map(e => {
    balance += e.type === 'debit' ? parseFloat(e.amount) : -parseFloat(e.amount);
    return { ...e, runningBalance: balance };
  });

  res.json({
    entries: withBalance,
    outstanding: parseFloat(client[0].outstandingAmount ?? '0'),
    creditLimit: parseFloat(client[0].creditLimit ?? '0'),
  });
});

router.get('/trips', requireRole('driver'), async (req, res) => {
  const driver = await db.select().from(drivers)
    .where(eq(drivers.name, req.user!.name)).limit(1);

  if (!driver.length) {
    res.json([]);
    return;
  }

  const { from, to } = req.query;
  const filters: ReturnType<typeof eq>[] = [eq(challans.driverId, driver[0].id)];

  if (from) {
    filters.push(gte(challans.dispatchTime, new Date(from as string)));
    if (to) {
      filters.push(lte(challans.dispatchTime, new Date(to as string)));
    }
  } else {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    filters.push(gte(challans.dispatchTime, todayStart));
    filters.push(lte(challans.dispatchTime, todayEnd));
  }

  const rows = await db.select(challanSelect).from(challans)
    .leftJoin(clients, eq(challans.clientId, clients.id))
    .leftJoin(sites, eq(challans.siteId, sites.id))
    .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
    .leftJoin(drivers, eq(challans.driverId, drivers.id))
    .where(and(...filters))
    .orderBy(desc(challans.dispatchTime));
  res.json(rows);
});

export default router;
