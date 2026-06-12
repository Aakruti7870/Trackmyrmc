import { Router } from 'express';
import { sql, gte, lte, and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, clients, batchRecords, orders, recurringOrders, vehicles } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getVarianceTolerance } from '../lib/variance.js';
import { computeForecast, type DailyHistory, type GradeQty } from '../lib/forecast.js';
import { computeRunDate, toDateStr } from '../lib/recurring.js';
import { getIdleConfig, computeTripTiming } from '../lib/idle.js';

const router = Router();
router.use(requireAuth);

// Effective delivery variance tolerance, readable by any authenticated user so
// the Dispatch board and Reports views flag short/over deliveries consistently.
router.get('/variance-tolerance', async (_req, res) => {
  res.json(await getVarianceTolerance());
});

function dateRange(req: { query: Record<string, unknown> }) {
  const { from, to } = req.query;
  const filters = [];
  if (from) filters.push(gte(challans.createdAt, new Date(from as string)));
  if (to) filters.push(lte(challans.createdAt, new Date(to as string)));
  return filters;
}

// Sum of delivered quantity (treats unrecorded deliveries as 0)
const deliveredQtySql = sql<number>`coalesce(sum(${challans.deliveredQuantity}::numeric), 0)`;
// Planned quantity counted only for challans that have a recorded delivered qty,
// so variance compares like-for-like (delivered subset) and isn't skewed by
// in-flight/pending challans that have no delivered figure yet.
const plannedForDeliveredSql = sql<number>`coalesce(sum(${challans.quantity}::numeric) filter (where ${challans.deliveredQuantity} is not null), 0)`;
const varianceSql = sql<number>`coalesce(sum(${challans.deliveredQuantity}::numeric), 0) - coalesce(sum(${challans.quantity}::numeric) filter (where ${challans.deliveredQuantity} is not null), 0)`;

router.get('/client-wise', async (req, res) => {
  const filters = dateRange(req as never);
  const rows = await db.select({
    clientId: challans.clientId,
    clientName: clients.name,
    totalQty: sql<number>`coalesce(sum(${challans.quantity}::numeric), 0)`,
    deliveredQty: deliveredQtySql,
    plannedForDelivered: plannedForDeliveredSql,
    variance: varianceSql,
    totalChallans: sql<number>`count(*)::int`,
  }).from(challans)
    .leftJoin(clients, sql`${challans.clientId} = ${clients.id}`)
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(challans.clientId, clients.name)
    .orderBy(desc(sql`sum(${challans.quantity}::numeric)`));
  res.json(rows);
});

router.get('/grade-wise', async (req, res) => {
  const filters = dateRange(req as never);
  const rows = await db.select({
    grade: challans.grade,
    totalQty: sql<number>`coalesce(sum(${challans.quantity}::numeric), 0)`,
    deliveredQty: deliveredQtySql,
    plannedForDelivered: plannedForDeliveredSql,
    variance: varianceSql,
    totalChallans: sql<number>`count(*)::int`,
  }).from(challans)
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(challans.grade)
    .orderBy(desc(sql`sum(${challans.quantity}::numeric)`));
  res.json(rows);
});

router.get('/dispatch', async (req, res) => {
  const { from, to } = req.query;
  const filters = [];
  if (from) filters.push(gte(challans.createdAt, new Date(from as string)));
  if (to) filters.push(lte(challans.createdAt, new Date(to as string)));
  const rows = await db.select({
    date: sql<string>`date(${challans.createdAt})`,
    totalQty: sql<number>`coalesce(sum(${challans.quantity}::numeric), 0)`,
    deliveredQty: deliveredQtySql,
    plannedForDelivered: plannedForDeliveredSql,
    variance: varianceSql,
    count: sql<number>`count(*)::int`,
  }).from(challans)
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(sql`date(${challans.createdAt})`)
    .orderBy(sql`date(${challans.createdAt})`);
  res.json(rows);
});

// Daily trip-timing & idle-charge aggregation. Travel = arrival − dispatch,
// time at site = release − arrival, billable idle = max(0, site − freeMin), and
// the idle charge applies the configured per-hour rate (omitted when unset).
// Negative/out-of-order intervals are excluded so a bad manual edit can't skew
// the numbers. Mirrors the pure computeTripTiming logic in SQL.
router.get('/trip-timing', async (req, res) => {
  const filters = dateRange(req as never);
  const { freeMin, ratePerHour } = await getIdleConfig();

  const travelMin = sql<number>`extract(epoch from (${challans.siteArrivalTime} - ${challans.dispatchTime})) / 60`;
  const siteMin = sql<number>`extract(epoch from (${challans.siteReleaseTime} - ${challans.siteArrivalTime})) / 60`;
  const hasTravel = sql`${challans.dispatchTime} is not null and ${challans.siteArrivalTime} is not null and ${challans.siteArrivalTime} >= ${challans.dispatchTime}`;
  const hasSite = sql`${challans.siteArrivalTime} is not null and ${challans.siteReleaseTime} is not null and ${challans.siteReleaseTime} >= ${challans.siteArrivalTime}`;
  const billableIdleMin = sql<number>`greatest(0, ${siteMin} - ${freeMin})`;

  const rows = await db.select({
    date: sql<string>`date(${challans.createdAt})`,
    tripsWithTravel: sql<number>`count(*) filter (where ${hasTravel})::int`,
    tripsWithSite: sql<number>`count(*) filter (where ${hasSite})::int`,
    avgTravelMin: sql<number>`coalesce(round(avg(${travelMin}) filter (where ${hasTravel})::numeric, 1), 0)`,
    avgSiteMin: sql<number>`coalesce(round(avg(${siteMin}) filter (where ${hasSite})::numeric, 1), 0)`,
    totalBillableIdleMin: sql<number>`coalesce(round(sum(${billableIdleMin}) filter (where ${hasSite})::numeric, 1), 0)`,
    idleTrips: sql<number>`count(*) filter (where ${hasSite} and ${siteMin} > ${freeMin})::int`,
    totalIdleCharge: ratePerHour != null
      ? sql<number>`coalesce(round((sum(${billableIdleMin}) filter (where ${hasSite}) / 60.0 * ${ratePerHour})::numeric, 2), 0)`
      : sql<number>`0`,
  }).from(challans)
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(sql`date(${challans.createdAt})`)
    .orderBy(sql`date(${challans.createdAt})`);

  res.json({ freeMin, ratePerHour, rows });
});

router.get('/production', async (req, res) => {
  const { from, to } = req.query;
  const filters = [];
  if (from) filters.push(gte(batchRecords.createdAt, new Date(from as string)));
  if (to) filters.push(lte(batchRecords.createdAt, new Date(to as string)));
  const rows = await db.select({
    date: sql<string>`date(${batchRecords.createdAt})`,
    totalQty: sql<number>`coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
    count: sql<number>`count(*)::int`,
    grade: batchRecords.grade,
  }).from(batchRecords)
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(sql`date(${batchRecords.createdAt})`, batchRecords.grade)
    .orderBy(sql`date(${batchRecords.createdAt})`);
  res.json(rows);
});

router.get('/export', async (req, res) => {
  const { report = 'dispatch', from, to } = req.query;
  const filters = [];
  if (from) filters.push(gte(challans.createdAt, new Date(from as string)));
  if (to) filters.push(lte(challans.createdAt, new Date(to as string)));

  let csv = '';
  if (report === 'dispatch') {
    const rows = await db.select({
      challanNo: challans.challanNo,
      clientName: clients.name,
      grade: challans.grade,
      quantity: challans.quantity,
      deliveredQuantity: challans.deliveredQuantity,
      status: challans.status,
      dispatchTime: challans.dispatchTime,
      siteArrivalTime: challans.siteArrivalTime,
      siteReleaseTime: challans.siteReleaseTime,
      deliveryTime: challans.deliveryTime,
    }).from(challans)
      .leftJoin(clients, sql`${challans.clientId} = ${clients.id}`)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(challans.createdAt));
    const cfg = await getIdleConfig();
    csv = 'Challan No,Client,Grade,Planned Qty (m³),Delivered Qty (m³),Variance (m³),Status,Dispatch Time,Site Arrival,Site Release,Delivery Time,Travel (min),Time at Site (min),Billable Idle (min),Idle Charge\n';
    csv += rows.map(r => {
      const variance = r.deliveredQuantity != null
        ? (Number(r.deliveredQuantity) - Number(r.quantity)).toFixed(2)
        : '';
      const t = computeTripTiming({
        dispatchTime: r.dispatchTime, siteArrivalTime: r.siteArrivalTime,
        siteReleaseTime: r.siteReleaseTime, config: cfg,
      });
      return `${r.challanNo},"${r.clientName}",${r.grade},${r.quantity},${r.deliveredQuantity ?? ''},${variance},${r.status},${r.dispatchTime || ''},${r.siteArrivalTime || ''},${r.siteReleaseTime || ''},${r.deliveryTime || ''},${t.travelMin ?? ''},${t.siteMin ?? ''},${t.billableIdleMin ?? ''},${t.idleCharge ?? ''}`;
    }).join('\n');
  } else if (report === 'production') {
    const bfilters = [];
    if (from) bfilters.push(gte(batchRecords.createdAt, new Date(from as string)));
    if (to) bfilters.push(lte(batchRecords.createdAt, new Date(to as string)));
    const rows = await db.select().from(batchRecords)
      .where(bfilters.length ? and(...bfilters) : undefined)
      .orderBy(desc(batchRecords.createdAt));
    csv = 'Batch No,Grade,Qty (m³),Cement Bags,Water (L),Sand (kg),Aggregate (kg),Operator,Date\n';
    csv += rows.map(r =>
      `${r.batchNo},${r.grade},${r.quantity},${r.cementBags || ''},${r.waterLiters || ''},${r.sandKg || ''},${r.aggregateKg || ''},"${r.operator || ''}",${r.createdAt.toISOString().slice(0, 10)}`
    ).join('\n');
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${report}-report.csv`);
  res.send(csv);
});

// How many days of order history to train the demand model on.
const FORECAST_HISTORY_DAYS = 84;

// Smart demand forecast for a single day. Blends recency-weighted same-weekday
// order history with the overall daily average, floored by orders already placed
// and recurring templates that fall due on the target date. Staff-only.
router.get('/forecast', requireRole('admin', 'dispatcher', 'authority'), async (req, res) => {
  const raw = typeof req.query.date === 'string' ? req.query.date : '';
  // Default to tomorrow (UTC) when no valid date is supplied.
  let target: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
    target = raw;
  } else {
    const t = new Date();
    t.setUTCDate(t.getUTCDate() + 1);
    target = toDateStr(t);
  }

  // The effective order date is the scheduled delivery date when present, else
  // the day the order was created.
  const orderDate = sql<string>`coalesce(${orders.deliveryDate}, date(${orders.createdAt}))`;

  // History: every non-cancelled order strictly before the target day, within
  // the training window, grouped by effective date + grade.
  const windowStart = new Date(`${target}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - FORECAST_HISTORY_DAYS);
  const historyRows = await db
    .select({
      date: sql<string>`${orderDate}`,
      grade: orders.grade,
      qty: sql<number>`coalesce(sum(${orders.quantity}::numeric), 0)`,
    })
    .from(orders)
    .where(
      and(
        ne(orders.status, 'cancelled'),
        sql`${orderDate} >= ${toDateStr(windowStart)}`,
        sql`${orderDate} < ${target}`,
      ),
    )
    .groupBy(sql`${orderDate}`, orders.grade);

  const history: DailyHistory[] = historyRows.map(r => ({
    date: String(r.date).slice(0, 10),
    grade: r.grade,
    qty: Number(r.qty) || 0,
  }));

  // Booked: non-cancelled orders already on the books for the target day.
  const bookedRows = await db
    .select({
      grade: orders.grade,
      qty: sql<number>`coalesce(sum(${orders.quantity}::numeric), 0)`,
    })
    .from(orders)
    .where(and(ne(orders.status, 'cancelled'), sql`${orderDate} = ${target}`))
    .groupBy(orders.grade);
  const booked: GradeQty[] = bookedRows.map(r => ({ grade: r.grade, qty: Number(r.qty) || 0 }));

  // Recurring: active templates whose schedule lands exactly on the target day.
  const templates = await db
    .select({ grade: recurringOrders.grade, quantity: recurringOrders.quantity, frequency: recurringOrders.frequency, anchor: recurringOrders.anchor })
    .from(recurringOrders)
    .where(eq(recurringOrders.active, true));
  const targetDateObj = new Date(`${target}T00:00:00Z`);
  const recurring: GradeQty[] = templates
    .filter(t => computeRunDate(t.frequency, t.anchor, targetDateObj, true) === target)
    .map(t => ({ grade: t.grade, qty: Number(t.quantity) || 0 }));

  // Average mixer capacity across the active fleet (drives truck-load advice).
  const [cap] = await db
    .select({ avg: sql<number>`coalesce(avg(${vehicles.capacity}::numeric), 0)` })
    .from(vehicles)
    .where(eq(vehicles.status, 'active'));
  const avgTruckCapacity = Number(cap?.avg) || 0;

  res.json(computeForecast({ history, targetDate: target, booked, recurring, avgTruckCapacity }));
});

export default router;
