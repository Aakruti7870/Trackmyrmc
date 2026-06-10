import { Router } from 'express';
import { sql, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, challans, clients, vehicles, batchRecords } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
router.get('/kpis', async (_req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [[production], [dispatch], [activeOrders], [fleetStats], [outstanding], [totalClients]] = await Promise.all([
        db.select({
            todayQty: sql `coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
            totalBatches: sql `count(*)::int`,
        }).from(batchRecords).where(gte(batchRecords.createdAt, today)),
        db.select({
            todayQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
            todayCount: sql `count(*)::int`,
        }).from(challans).where(gte(challans.createdAt, today)),
        db.select({
            pending: sql `count(*) filter (where ${orders.status} = 'pending')::int`,
            inProgress: sql `count(*) filter (where ${orders.status} = 'in_progress')::int`,
        }).from(orders),
        db.select({
            total: sql `count(*)::int`,
            active: sql `count(*) filter (where ${vehicles.status} = 'active')::int`,
            maintenance: sql `count(*) filter (where ${vehicles.status} = 'maintenance')::int`,
        }).from(vehicles),
        db.select({
            total: sql `coalesce(sum(${clients.outstandingAmount}::numeric), 0)`,
        }).from(clients),
        db.select({ count: sql `count(*)::int` }).from(clients),
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
