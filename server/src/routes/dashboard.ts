import { Router } from 'express';
import { sql, and, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, challans, clients, vehicles, batchRecords } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';

const router = Router();
router.use(requireAuth);

// KPI tiles aggregate plant-bound business data (challans/orders/clients), so the
// endpoint is staff/owner-only and every tenant-scoped query is hard-filtered by
// the actor's plantId. Fleet/production tiles (vehicles, batch records) have no
// plant column yet and stay plant-agnostic this round (documented drift).
router.get('/kpis', requireRole('admin', 'dispatcher', 'authority', 'plant_operator'), async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const plantId = req.user?.plantId;
  const challanScope = plantScope(plantId, challans.plantId);
  const orderScope = plantScope(plantId, orders.plantId);
  const clientScope = plantScope(plantId, clients.plantId);
  const todayChallans = challanScope ? and(gte(challans.createdAt, today), challanScope) : gte(challans.createdAt, today);

  const [[production], [dispatch], [activeOrders], [fleetStats], [outstanding], [totalClients]] = await Promise.all([
    db.select({
      todayQty: sql<number>`coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
      totalBatches: sql<number>`count(*)::int`,
    }).from(batchRecords).where(gte(batchRecords.createdAt, today)),

    db.select({
      todayQty: sql<number>`coalesce(sum(${challans.quantity}::numeric), 0)`,
      todayCount: sql<number>`count(*)::int`,
    }).from(challans).where(todayChallans),

    db.select({
      pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
      inProgress: sql<number>`count(*) filter (where ${orders.status} = 'in_progress')::int`,
    }).from(orders).where(orderScope),

    db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${vehicles.status} = 'active')::int`,
      maintenance: sql<number>`count(*) filter (where ${vehicles.status} = 'maintenance')::int`,
    }).from(vehicles),

    db.select({
      total: sql<number>`coalesce(sum(${clients.outstandingAmount}::numeric), 0)`,
    }).from(clients).where(clientScope),

    db.select({ count: sql<number>`count(*)::int` }).from(clients).where(clientScope),
  ]);

  res.json({
    todayProduction: production.todayQty,
    todayBatches: production.totalBatches,
    todayDispatch: dispatch.todayQty,
    todayChallans: dispatch.todayCount,
    activeOrders: (activeOrders.pending || 0) + (activeOrders.inProgress || 0),
    pendingOrders: activeOrders.pending,
    inProgressOrders: activeOrders.inProgress,
    totalVehicles: fleetStats.total,
    activeVehicles: fleetStats.active,
    maintenanceVehicles: fleetStats.maintenance,
    outstandingAmount: outstanding.total,
    totalClients: totalClients.count,
  });
});

export default router;
