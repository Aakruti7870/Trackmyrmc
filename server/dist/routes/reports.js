import { Router } from 'express';
import { sql, gte, lte, and, desc, eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, clients, batchRecords, orders, recurringOrders, vehicles, fuelLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getVarianceTolerance } from '../lib/variance.js';
import { computeForecast } from '../lib/forecast.js';
import { computeRunDate, toDateStr } from '../lib/recurring.js';
import { getIdleConfig, computeTripTiming } from '../lib/idle.js';
import { getFuelConfig } from '../lib/fuelConfig.js';
import { plantScope } from '../lib/tenancy.js';
const router = Router();
router.use(requireAuth);
// Effective delivery variance tolerance, readable by any authenticated user so
// the Dispatch board and Reports views flag short/over deliveries consistently.
// This is a plant-agnostic config number (no tenant data), so it stays open.
router.get('/variance-tolerance', async (_req, res) => {
    res.json(await getVarianceTolerance());
});
// Everything below aggregates plant-bound business data (challans/orders/clients).
// Restrict to staff/owner roles — customers use /api/me/* — and every query is
// additionally hard-scoped by the actor's plantId (see dateRange / plantScope)
// so one plant can never read another plant's figures.
router.use(requireRole('admin', 'dispatcher', 'authority', 'plant_operator', 'accountant'));
function dateRange(req) {
    const { from, to } = req.query;
    const filters = [];
    if (from)
        filters.push(gte(challans.createdAt, new Date(from)));
    if (to)
        filters.push(lte(challans.createdAt, new Date(to)));
    const scope = plantScope(req.user?.plantId, challans.plantId);
    if (scope)
        filters.push(scope);
    return filters;
}
// Sum of delivered quantity (treats unrecorded deliveries as 0)
const deliveredQtySql = sql `coalesce(sum(${challans.deliveredQuantity}::numeric), 0)`;
// Planned quantity counted only for challans that have a recorded delivered qty,
// so variance compares like-for-like (delivered subset) and isn't skewed by
// in-flight/pending challans that have no delivered figure yet.
const plannedForDeliveredSql = sql `coalesce(sum(${challans.quantity}::numeric) filter (where ${challans.deliveredQuantity} is not null), 0)`;
const varianceSql = sql `coalesce(sum(${challans.deliveredQuantity}::numeric), 0) - coalesce(sum(${challans.quantity}::numeric) filter (where ${challans.deliveredQuantity} is not null), 0)`;
router.get('/client-wise', async (req, res) => {
    const filters = dateRange(req);
    const rows = await db.select({
        clientId: challans.clientId,
        clientName: clients.name,
        totalQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
        deliveredQty: deliveredQtySql,
        plannedForDelivered: plannedForDeliveredSql,
        variance: varianceSql,
        totalChallans: sql `count(*)::int`,
    }).from(challans)
        .leftJoin(clients, sql `${challans.clientId} = ${clients.id}`)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(challans.clientId, clients.name)
        .orderBy(desc(sql `sum(${challans.quantity}::numeric)`));
    res.json(rows);
});
router.get('/grade-wise', async (req, res) => {
    const filters = dateRange(req);
    const rows = await db.select({
        grade: challans.grade,
        totalQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
        deliveredQty: deliveredQtySql,
        plannedForDelivered: plannedForDeliveredSql,
        variance: varianceSql,
        totalChallans: sql `count(*)::int`,
    }).from(challans)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(challans.grade)
        .orderBy(desc(sql `sum(${challans.quantity}::numeric)`));
    res.json(rows);
});
router.get('/dispatch', async (req, res) => {
    const filters = dateRange(req);
    const rows = await db.select({
        date: sql `date(${challans.createdAt})`,
        totalQty: sql `coalesce(sum(${challans.quantity}::numeric), 0)`,
        deliveredQty: deliveredQtySql,
        plannedForDelivered: plannedForDeliveredSql,
        variance: varianceSql,
        count: sql `count(*)::int`,
    }).from(challans)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(sql `date(${challans.createdAt})`)
        .orderBy(sql `date(${challans.createdAt})`);
    res.json(rows);
});
// Daily trip-timing & idle-charge aggregation. Travel = arrival − dispatch,
// time at site = release − arrival, billable idle = max(0, site − freeMin), and
// the idle charge applies the configured per-hour rate (omitted when unset).
// Negative/out-of-order intervals are excluded so a bad manual edit can't skew
// the numbers. Mirrors the pure computeTripTiming logic in SQL.
router.get('/trip-timing', async (req, res) => {
    const filters = dateRange(req);
    const { freeMin, ratePerHour } = await getIdleConfig();
    const travelMin = sql `extract(epoch from (${challans.siteArrivalTime} - ${challans.dispatchTime})) / 60`;
    const siteMin = sql `extract(epoch from (${challans.siteReleaseTime} - ${challans.siteArrivalTime})) / 60`;
    const hasTravel = sql `${challans.dispatchTime} is not null and ${challans.siteArrivalTime} is not null and ${challans.siteArrivalTime} >= ${challans.dispatchTime}`;
    const hasSite = sql `${challans.siteArrivalTime} is not null and ${challans.siteReleaseTime} is not null and ${challans.siteReleaseTime} >= ${challans.siteArrivalTime}`;
    const billableIdleMin = sql `greatest(0, ${siteMin} - ${freeMin})`;
    const rows = await db.select({
        date: sql `date(${challans.createdAt})`,
        tripsWithTravel: sql `count(*) filter (where ${hasTravel})::int`,
        tripsWithSite: sql `count(*) filter (where ${hasSite})::int`,
        avgTravelMin: sql `coalesce(round(avg(${travelMin}) filter (where ${hasTravel})::numeric, 1), 0)`,
        avgSiteMin: sql `coalesce(round(avg(${siteMin}) filter (where ${hasSite})::numeric, 1), 0)`,
        totalBillableIdleMin: sql `coalesce(round(sum(${billableIdleMin}) filter (where ${hasSite})::numeric, 1), 0)`,
        idleTrips: sql `count(*) filter (where ${hasSite} and ${siteMin} > ${freeMin})::int`,
        totalIdleCharge: ratePerHour != null
            ? sql `coalesce(round((sum(${billableIdleMin}) filter (where ${hasSite}) / 60.0 * ${ratePerHour})::numeric, 2), 0)`
            : sql `0`,
    }).from(challans)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(sql `date(${challans.createdAt})`)
        .orderBy(sql `date(${challans.createdAt})`);
    res.json({ freeMin, ratePerHour, rows });
});
export async function computeFuelReconciliation(from, to, actorPlantId) {
    const config = await getFuelConfig();
    const challanFilters = [];
    if (from)
        challanFilters.push(gte(challans.createdAt, from));
    if (to)
        challanFilters.push(lte(challans.createdAt, to));
    // Hard-scope challan-derived KM/idle aggregates to the actor's plant so a
    // plant-bound owner can't infer another plant's fleet activity (a null-plant
    // legacy admin stays global — plantScope returns undefined there).
    const challanScope = plantScope(actorPlantId, challans.plantId);
    if (challanScope)
        challanFilters.push(challanScope);
    const hasOdo = sql `${challans.odometerStart} is not null and ${challans.odometerEnd} is not null and ${challans.odometerEnd} >= ${challans.odometerStart}`;
    const hasSite = sql `${challans.siteArrivalTime} is not null and ${challans.siteReleaseTime} is not null and ${challans.siteReleaseTime} >= ${challans.siteArrivalTime}`;
    const challanRows = await db.select({
        vehicleId: challans.vehicleId,
        km: sql `coalesce(sum(${challans.odometerEnd} - ${challans.odometerStart}) filter (where ${hasOdo}), 0)`,
        idleHours: sql `coalesce(sum(extract(epoch from (${challans.siteReleaseTime} - ${challans.siteArrivalTime})) / 3600.0) filter (where ${hasSite}), 0)`,
        trips: sql `count(*)::int`,
        tripsWithOdometer: sql `count(*) filter (where ${hasOdo})::int`,
    }).from(challans)
        .where(challanFilters.length ? and(...challanFilters) : undefined)
        .groupBy(challans.vehicleId);
    const fuelFilters = [];
    if (from)
        fuelFilters.push(gte(fuelLogs.filledAt, from));
    if (to)
        fuelFilters.push(lte(fuelLogs.filledAt, to));
    const fuelRows = await db.select({
        vehicleId: fuelLogs.vehicleId,
        litres: sql `coalesce(sum(${fuelLogs.litres}::numeric), 0)`,
        amount: sql `coalesce(sum(${fuelLogs.amount}::numeric), 0)`,
        fills: sql `count(*)::int`,
    }).from(fuelLogs)
        .where(fuelFilters.length ? and(...fuelFilters) : undefined)
        .groupBy(fuelLogs.vehicleId);
    // Only the actor's own vehicles drive the reconciliation table; foreign-plant
    // fuel/challan aggregates are never matched because they aren't iterated here.
    const vehicleRows = await db.select({
        id: vehicles.id,
        vehicleNo: vehicles.vehicleNo,
        mileageKmpl: vehicles.mileageKmpl,
        idleBurnLph: vehicles.idleBurnLph,
    }).from(vehicles).where(plantScope(actorPlantId, vehicles.plantId));
    const challanByVehicle = new Map(challanRows.filter(r => r.vehicleId != null).map(r => [r.vehicleId, r]));
    const fuelByVehicle = new Map(fuelRows.map(r => [r.vehicleId, r]));
    const rows = [];
    for (const v of vehicleRows) {
        const c = challanByVehicle.get(v.id);
        const f = fuelByVehicle.get(v.id);
        const km = Number(c?.km ?? 0);
        const idleHours = Number(c?.idleHours ?? 0);
        const actualLitres = Number(f?.litres ?? 0);
        // Skip vehicles with no activity at all in the window.
        if (km === 0 && idleHours === 0 && actualLitres === 0 && (c?.trips ?? 0) === 0)
            continue;
        const mileage = v.mileageKmpl != null && Number(v.mileageKmpl) > 0 ? Number(v.mileageKmpl) : null;
        const idleBurn = v.idleBurnLph != null ? Number(v.idleBurnLph) : config.idleBurnLph;
        const expectedDrivingLitres = mileage != null ? km / mileage : null;
        const expectedIdleLitres = idleHours * idleBurn;
        const expectedLitres = expectedDrivingLitres != null ? expectedDrivingLitres + expectedIdleLitres : null;
        const variancePct = expectedLitres != null && expectedLitres > 0
            ? ((actualLitres - expectedLitres) / expectedLitres) * 100
            : null;
        const flagged = variancePct != null && variancePct > config.reconVariancePct;
        rows.push({
            vehicleId: v.id,
            vehicleNo: v.vehicleNo,
            km,
            idleHours: Math.round(idleHours * 100) / 100,
            trips: c?.trips ?? 0,
            tripsWithOdometer: c?.tripsWithOdometer ?? 0,
            mileageKmpl: mileage,
            idleBurnLph: idleBurn,
            expectedDrivingLitres: expectedDrivingLitres != null ? Math.round(expectedDrivingLitres * 100) / 100 : null,
            expectedIdleLitres: Math.round(expectedIdleLitres * 100) / 100,
            expectedLitres: expectedLitres != null ? Math.round(expectedLitres * 100) / 100 : null,
            actualLitres: Math.round(actualLitres * 100) / 100,
            amount: Math.round(Number(f?.amount ?? 0) * 100) / 100,
            fills: f?.fills ?? 0,
            variancePct: variancePct != null ? Math.round(variancePct * 10) / 10 : null,
            flagged,
        });
    }
    // Flagged vehicles first, then by most-overconsuming.
    rows.sort((a, b) => {
        if (a.flagged !== b.flagged)
            return a.flagged ? -1 : 1;
        return (b.variancePct ?? -Infinity) - (a.variancePct ?? -Infinity);
    });
    return { config, rows };
}
router.get('/fuel-reconciliation', requireRole('admin', 'dispatcher', 'authority', 'accountant'), async (req, res) => {
    const { from, to } = req.query;
    res.json(await computeFuelReconciliation(from ? new Date(from) : undefined, to ? new Date(to) : undefined, req.user?.plantId));
});
router.get('/production', async (req, res) => {
    const { from, to } = req.query;
    const filters = [];
    const scope = plantScope(req.user?.plantId, batchRecords.plantId);
    if (scope)
        filters.push(scope);
    if (from)
        filters.push(gte(batchRecords.createdAt, new Date(from)));
    if (to)
        filters.push(lte(batchRecords.createdAt, new Date(to)));
    const rows = await db.select({
        date: sql `date(${batchRecords.createdAt})`,
        totalQty: sql `coalesce(sum(${batchRecords.quantity}::numeric), 0)`,
        count: sql `count(*)::int`,
        grade: batchRecords.grade,
    }).from(batchRecords)
        .where(filters.length ? and(...filters) : undefined)
        .groupBy(sql `date(${batchRecords.createdAt})`, batchRecords.grade)
        .orderBy(sql `date(${batchRecords.createdAt})`);
    res.json(rows);
});
router.get('/export', async (req, res) => {
    const { report = 'dispatch', from, to } = req.query;
    const filters = dateRange(req);
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
            .leftJoin(clients, sql `${challans.clientId} = ${clients.id}`)
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
    }
    else if (report === 'production') {
        const bfilters = [];
        const scope = plantScope(req.user?.plantId, batchRecords.plantId);
        if (scope)
            bfilters.push(scope);
        if (from)
            bfilters.push(gte(batchRecords.createdAt, new Date(from)));
        if (to)
            bfilters.push(lte(batchRecords.createdAt, new Date(to)));
        const rows = await db.select().from(batchRecords)
            .where(bfilters.length ? and(...bfilters) : undefined)
            .orderBy(desc(batchRecords.createdAt));
        csv = 'Batch No,Grade,Qty (m³),Cement Bags,Water (L),Sand (kg),Aggregate (kg),Operator,Date\n';
        csv += rows.map(r => `${r.batchNo},${r.grade},${r.quantity},${r.cementBags || ''},${r.waterLiters || ''},${r.sandKg || ''},${r.aggregateKg || ''},"${r.operator || ''}",${r.createdAt.toISOString().slice(0, 10)}`).join('\n');
    }
    else if (report === 'fuel-reconciliation') {
        // Diesel reconciliation is owner/staff-only — mirror the gating on the
        // /fuel-reconciliation endpoint so clients can't pull it via the CSV export.
        if (!['admin', 'dispatcher', 'authority'].includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { config, rows } = await computeFuelReconciliation(from ? new Date(from) : undefined, to ? new Date(to) : undefined, req.user?.plantId);
        csv = `Diesel reconciliation (over-consumption flagged above ${config.reconVariancePct}% variance)\n`;
        csv += 'Vehicle,Km Driven,Idle Hours,Trips,Trips w/ Odometer,Mileage (km/L),Idle Burn (L/h),Expected Driving (L),Expected Idle (L),Expected Total (L),Actual (L),Amount,Fills,Variance %,Flagged\n';
        csv += rows.map(r => `"${r.vehicleNo ?? ''}",${r.km},${r.idleHours},${r.trips},${r.tripsWithOdometer},${r.mileageKmpl ?? ''},${r.idleBurnLph},${r.expectedDrivingLitres ?? ''},${r.expectedIdleLitres},${r.expectedLitres ?? ''},${r.actualLitres},${r.amount},${r.fills},${r.variancePct ?? ''},${r.flagged ? 'YES' : ''}`).join('\n');
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
    let target;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime())) {
        target = raw;
    }
    else {
        const t = new Date();
        t.setUTCDate(t.getUTCDate() + 1);
        target = toDateStr(t);
    }
    // The effective order date is the scheduled delivery date when present, else
    // the day the order was created.
    const orderDate = sql `coalesce(${orders.deliveryDate}, date(${orders.createdAt}))`;
    // Hard-scope demand to the actor's plant so a plant-bound forecaster can't read
    // another plant's order book (a null-plant legacy admin stays global).
    const orderScope = plantScope(req.user?.plantId, orders.plantId);
    // History: every non-cancelled order strictly before the target day, within
    // the training window, grouped by effective date + grade.
    const windowStart = new Date(`${target}T00:00:00Z`);
    windowStart.setUTCDate(windowStart.getUTCDate() - FORECAST_HISTORY_DAYS);
    const historyRows = await db
        .select({
        date: sql `${orderDate}`,
        grade: orders.grade,
        qty: sql `coalesce(sum(${orders.quantity}::numeric), 0)`,
    })
        .from(orders)
        .where(and(ne(orders.status, 'cancelled'), sql `${orderDate} >= ${toDateStr(windowStart)}`, sql `${orderDate} < ${target}`, orderScope))
        .groupBy(sql `${orderDate}`, orders.grade);
    const history = historyRows.map(r => ({
        date: String(r.date).slice(0, 10),
        grade: r.grade,
        qty: Number(r.qty) || 0,
    }));
    // Booked: non-cancelled orders already on the books for the target day.
    const bookedRows = await db
        .select({
        grade: orders.grade,
        qty: sql `coalesce(sum(${orders.quantity}::numeric), 0)`,
    })
        .from(orders)
        .where(and(ne(orders.status, 'cancelled'), sql `${orderDate} = ${target}`, orderScope))
        .groupBy(orders.grade);
    const booked = bookedRows.map(r => ({ grade: r.grade, qty: Number(r.qty) || 0 }));
    // Recurring: active templates whose schedule lands exactly on the target day.
    const templates = await db
        .select({ grade: recurringOrders.grade, quantity: recurringOrders.quantity, frequency: recurringOrders.frequency, anchor: recurringOrders.anchor })
        .from(recurringOrders)
        .where(eq(recurringOrders.active, true));
    const targetDateObj = new Date(`${target}T00:00:00Z`);
    const recurring = templates
        .filter(t => computeRunDate(t.frequency, t.anchor, targetDateObj, true) === target)
        .map(t => ({ grade: t.grade, qty: Number(t.quantity) || 0 }));
    // Average mixer capacity across the active fleet (drives truck-load advice).
    const capScope = plantScope(req.user?.plantId, vehicles.plantId);
    const activeVehicles = eq(vehicles.status, 'active');
    const [cap] = await db
        .select({ avg: sql `coalesce(avg(${vehicles.capacity}::numeric), 0)` })
        .from(vehicles)
        .where(capScope ? and(activeVehicles, capScope) : activeVehicles);
    const avgTruckCapacity = Number(cap?.avg) || 0;
    res.json(computeForecast({ history, targetDate: target, booked, recurring, avgTruckCapacity }));
});
export default router;
