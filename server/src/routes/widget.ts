/**
 * /api/widget — lightweight data endpoints for Android home-screen widgets.
 *
 * Each route is role-gated and returns ONLY the data the calling user is
 * authorised to see. No cross-role or cross-tenant data leaks are possible:
 *   - /customer  → client role only, caller's own active order
 *   - /driver    → driver role only, caller's own active challan
 *   - /plant     → plant staff roles, caller's plant(s) only
 *
 * Security contracts:
 *   - requireAuth + requireRole on every route (401/403 clears widget token)
 *   - plantScope enforced on all aggregates for staff
 *   - No full PII (Aadhaar, token payloads) ever returned
 *   - Suspended accounts: server returns 403; widget provider clears loggedIn flag
 */

import { Router } from 'express';
import { eq, and, desc, gte, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orders, challans, vehicles, plants, users,
  clients, plantCustomers, batchRecords,
} from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { sql } from 'drizzle-orm';

const router = Router();
router.use(requireAuth);

// ── GET /api/widget/customer ─────────────────────────────────────────────────

router.get('/customer', requireRole('client'), async (req, res) => {
  const userId = req.user!.id;

  // Collect all client IDs linked to this user (direct + per-plant).
  const [uRow] = await db.select({ linkedClientId: users.linkedClientId })
    .from(users).where(eq(users.id, userId)).limit(1);
  const directClientId = uRow?.linkedClientId ?? null;

  const pcRows = await db.select({ clientId: plantCustomers.clientId })
    .from(plantCustomers).where(eq(plantCustomers.userId, userId));

  const clientIds = [
    ...new Set([
      ...(directClientId !== null ? [directClientId] : []),
      ...pcRows.map(r => r.clientId),
    ]),
  ];

  if (clientIds.length === 0) {
    res.json({ hasOrder: false, updatedAt: now() });
    return;
  }

  // Most recent non-terminal order.
  const [order] = await db.select({
    id: orders.id, orderNo: orders.orderNo,
    grade: orders.grade, quantity: orders.quantity,
    status: orders.status, plantId: orders.plantId,
    siteName: orders.siteName, createdAt: orders.createdAt,
  }).from(orders)
    .where(and(
      inArray(orders.clientId, clientIds),
      inArray(orders.status, ['pending', 'pending_approval', 'approved', 'in_progress'] as const),
    ))
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) {
    res.json({ hasOrder: false, updatedAt: now() });
    return;
  }

  // Plant name.
  const [plant] = order.plantId
    ? await db.select({ name: plants.name })
        .from(plants).where(eq(plants.id, order.plantId)).limit(1)
    : [];

  // Latest challan for this order.
  const [challan] = await db.select({
    challanNo: challans.challanNo,
    status: challans.status,
    dispatchTime: challans.dispatchTime,
    deliveryTime: challans.deliveryTime,
    vehicleId: challans.vehicleId,
  }).from(challans)
    .where(eq(challans.orderId, order.id))
    .orderBy(desc(challans.createdAt))
    .limit(1);

  // Vehicle number.
  let vehicleNo = '';
  if (challan?.vehicleId) {
    const [veh] = await db.select({ vehicleNo: vehicles.vehicleNo })
      .from(vehicles).where(eq(vehicles.id, challan.vehicleId)).limit(1);
    vehicleNo = veh?.vehicleNo ?? '';
  }

  const loadingStatus  = challan ? (challan.dispatchTime ? 'Loaded' : 'Pending') : 'Pending';
  const dispatchStatus = challan?.dispatchTime ? 'Dispatched' : 'Pending';
  const challanStatus  = challan ? titleCase(challan.status) : 'Pending';

  res.json({
    hasOrder:        true,
    orderNo:         order.orderNo,
    plantName:       plant?.name ?? '—',
    grade:           order.grade,
    quantity:        `${order.quantity} m³`,
    status:          titleCase(order.status),
    loadingStatus,
    dispatchStatus,
    challanStatus,
    vehicleNo,
    deliveryProgress: '',
    updatedAt:        now(),
  });
});

// ── GET /api/widget/driver ───────────────────────────────────────────────────

router.get('/driver', requireRole('driver'), async (req, res) => {
  const userId = req.user!.id;

  // Resolve the linked driver record for this user.
  const [uRow] = await db.select({ linkedDriverId: users.linkedDriverId })
    .from(users).where(eq(users.id, userId)).limit(1);

  if (!uRow?.linkedDriverId) {
    res.json({ hasAssignment: false, updatedAt: now() });
    return;
  }

  const driverId = uRow.linkedDriverId;

  // Active challan: pending (assigned, not yet dispatched) or dispatched (in transit).
  const [challan] = await db.select({
    challanNo:    challans.challanNo,
    orderId:      challans.orderId,
    clientId:     challans.clientId,
    vehicleId:    challans.vehicleId,
    grade:        challans.grade,
    quantity:     challans.quantity,
    status:       challans.status,
    dispatchTime: challans.dispatchTime,
  }).from(challans)
    .where(and(
      eq(challans.driverId, driverId),
      inArray(challans.status, ['pending', 'dispatched'] as const),
    ))
    .orderBy(desc(challans.createdAt))
    .limit(1);

  if (!challan) {
    res.json({ hasAssignment: false, updatedAt: now() });
    return;
  }

  // Order for order number + site name (snapshot stored on the order row).
  let orderNo  = '—';
  let siteName = '—';
  if (challan.orderId) {
    const [order] = await db.select({
      orderNo:  orders.orderNo,
      siteName: orders.siteName,
    }).from(orders).where(eq(orders.id, challan.orderId)).limit(1);
    orderNo  = order?.orderNo  ?? '—';
    siteName = order?.siteName ?? '—';
  }

  // Customer display name (use clients.name, not PII).
  let customerName = '—';
  if (challan.clientId) {
    const [client] = await db.select({ name: clients.name })
      .from(clients).where(eq(clients.id, challan.clientId)).limit(1);
    customerName = client?.name ?? '—';
  }

  // Vehicle number.
  let vehicleNo = '—';
  if (challan.vehicleId) {
    const [veh] = await db.select({ vehicleNo: vehicles.vehicleNo })
      .from(vehicles).where(eq(vehicles.id, challan.vehicleId)).limit(1);
    vehicleNo = veh?.vehicleNo ?? '—';
  }

  const tripStatus = challan.dispatchTime ? 'IN TRANSIT' : 'ASSIGNED';

  res.json({
    hasAssignment: true,
    orderNo,
    challanNo:    challan.challanNo,
    customerName,
    siteName,
    grade:        challan.grade,
    quantity:     `${challan.quantity} m³`,
    vehicleNo,
    tripStatus,
    updatedAt:    now(),
  });
});

// ── GET /api/widget/plant ────────────────────────────────────────────────────

router.get('/plant',
  requireRole('admin', 'authority', 'plant_owner', 'supervisor', 'dispatcher'),
  async (req, res) => {
    const plantId = req.user!.plantId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Production from today's dispatched challans (sum of quantities).
    const challanCond = and(
      plantScope(plantId, challans.plantId),
      gte(challans.createdAt, todayStart),
    );
    const [prod] = await db.select({
      todayM3: sql<number>`coalesce(sum(${challans.quantity}::numeric), 0)`,
      tmOnRoute: sql<number>`count(*) filter (
          where ${challans.dispatchTime} is not null
            and ${challans.deliveryTime} is null
        )::int`,
      activeDispatches: sql<number>`count(*) filter (
          where ${challans.status} = 'dispatched'
        )::int`,
    }).from(challans).where(challanCond);

    // Pending/active orders.
    const orderCond = and(
      plantScope(plantId, orders.plantId),
      inArray(orders.status, ['pending', 'pending_approval', 'approved'] as const),
    );
    const [orderAgg] = await db.select({
      pendingOrders: sql<number>`count(*)::int`,
    }).from(orders).where(orderCond);

    // Plant metadata.
    let plantName   = 'Plant';
    let plantStatus = 'ACTIVE';
    if (plantId) {
      const [p] = await db.select({
        name:        plants.name,
        plantStatus: plants.plantStatus,
      }).from(plants).where(eq(plants.id, plantId)).limit(1);
      plantName   = p?.name ?? 'Plant';
      plantStatus = (p?.plantStatus ?? 'active').toUpperCase();
    }

    res.json({
      plantName,
      todayM3:          Number(prod?.todayM3 ?? 0).toFixed(1),
      pendingOrders:    String(orderAgg?.pendingOrders ?? 0),
      tmOnRoute:        String(prod?.tmOnRoute ?? 0),
      activeDispatches: String(prod?.activeDispatches ?? 0),
      plantStatus,
      updatedAt:        now(),
    });
  },
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default router;
