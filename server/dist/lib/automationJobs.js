import { and, eq, inArray, isNull, isNotNull, lt, max, ne, notLike, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, challans, clients, orders, otpCodes, passwordSetupTokens, plants, pushSubscriptions, rateLimitHits, responseCache, staffOtpCodes, trackingTokens, users, vehicles, whatsappMessages, } from '../db/schema.js';
import { claimSend, istParts, istDayStartUtc, loadAutomationSnapshot, periodKey, recordLastRun, } from './automations.js';
import { sendAutomationEmail } from './automationEmail.js';
import { isPushConfigured, sendPushToClientUsers, sendPushToStaff } from './push.js';
import { emitSSEEvent } from './sseEmitter.js';
import { sendWhatsAppWithRetry } from './whatsappRetry.js';
import { createTrackingToken } from './trackingTokens.js';
import { normalizePhone } from './otp.js';
import { computeFuelReconciliation } from '../routes/reports.js';
// Staff roles that receive operational automation alerts (follow-ups, idle
// vehicles, fuel anomalies). `authority` is the platform super-admin.
const STAFF_ALERT_ROLES = ['admin', 'plant_owner', 'dispatcher', 'authority'];
const DAY_MS = 24 * 60 * 60 * 1000;
// Trusted public origin for links placed in outbound messages. Request headers
// are never consulted (they are forgeable); config only. Exported so the
// Automations API can surface "share links are unconfigured" in the UI.
export function appBaseUrl() {
    const env = (process.env.APP_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
    if (env)
        return env;
    const dev = (process.env.REPLIT_DEV_DOMAIN || '').trim();
    return dev ? `https://${dev}` : null;
}
function num(cfg, key, fallback) {
    const v = cfg[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function bool(cfg, key) {
    return cfg[key] === true;
}
function str(cfg, key) {
    const v = cfg[key];
    return typeof v === 'string' ? v.trim() : '';
}
// Persist an automation WhatsApp attempt in the same message history the
// event-driven notifications use, so staff see automations alongside the rest.
async function recordAutomationWhatsApp(automation, link, toPhone, result) {
    try {
        const status = result.ok ? (result.status ?? (result.channel === 'dev' ? 'dev' : 'queued')) : 'error';
        await db.insert(whatsappMessages).values({
            messageSid: result.sid ?? null,
            event: `automation:${automation}`,
            orderId: link.orderId ?? null,
            challanId: link.challanId ?? null,
            plantId: link.plantId ?? null,
            toPhone: normalizePhone(toPhone) ?? (toPhone ?? ''),
            status,
            errorCode: result.error ? result.error.slice(0, 200) : null,
            channel: result.channel,
        });
    }
    catch (err) {
        console.warn('[automation] failed to record WhatsApp message:', err);
    }
}
// Deliverable staff emails for a plant (admins/owners of that plant plus
// platform-wide staff of the same roles when plantId is null on their account
// is NOT included — global staff are only reached by the authority variant).
async function plantStaffEmails(plantId, roles) {
    const roleVals = [...roles];
    const conds = [
        eq(users.isActive, true),
        isNull(users.deletedAt),
        inArray(users.role, roleVals),
        isNotNull(users.email),
        notLike(users.email, '%@otp.local'),
    ];
    if (plantId != null)
        conds.push(eq(users.plantId, plantId));
    const rows = await db.select({ email: users.email }).from(users).where(and(...conds));
    return [...new Set(rows.map(r => r.email).filter((e) => !!e))];
}
// Deliverable staff phone numbers for a plant — same audience rules as
// plantStaffEmails, but keyed on a stored phone number for WhatsApp sends.
async function plantStaffPhones(plantId, roles) {
    const roleVals = [...roles];
    const conds = [
        eq(users.isActive, true),
        isNull(users.deletedAt),
        inArray(users.role, roleVals),
        isNotNull(users.phone),
    ];
    if (plantId != null)
        conds.push(eq(users.plantId, plantId));
    const rows = await db.select({ phone: users.phone }).from(users).where(and(...conds));
    return [...new Set(rows.map(r => r.phone).filter((p) => !!p))];
}
// ---- 1. Order reminders ------------------------------------------------------
// The evening before an order's delivery date, remind the customer across the
// configured channels. Once per order per delivery date (a rescheduled order
// gets a fresh reminder for its new date).
export async function runOrderReminders(snapshot, now = new Date(), scopePlantId) {
    if (!snapshot.enabledAnywhere('orderReminders'))
        return 0;
    const ist = istParts(now);
    const conds = [eq(orders.deliveryDate, ist.tomorrowStr), inArray(orders.status, ['pending', 'in_progress'])];
    if (scopePlantId !== undefined)
        conds.push(eq(orders.plantId, scopePlantId));
    const rows = await db
        .select({
        id: orders.id,
        orderNo: orders.orderNo,
        plantId: orders.plantId,
        clientId: orders.clientId,
        grade: orders.grade,
        quantity: orders.quantity,
        deliveryDate: orders.deliveryDate,
        deliveryTime: orders.deliveryTime,
        clientName: clients.name,
        email: clients.email,
        phone: clients.phone,
    })
        .from(orders)
        .leftJoin(clients, eq(orders.clientId, clients.id))
        .where(and(...conds));
    let sent = 0;
    for (const o of rows) {
        const eff = snapshot.effective('orderReminders', o.plantId);
        if (!eff.enabled)
            continue;
        if (ist.hour < num(eff.config, 'sendHour', 18))
            continue;
        if (!(await claimSend('orderReminders', 'order', o.id, `d:${o.deliveryDate}`, o.plantId)))
            continue;
        sent += 1;
        const when = o.deliveryTime ? `tomorrow at ${o.deliveryTime}` : 'tomorrow';
        if (bool(eff.config, 'email') && o.email) {
            await sendAutomationEmail({
                to: [o.email],
                subject: `Reminder: your concrete delivery is scheduled for ${o.deliveryDate}`,
                heading: 'Your delivery is coming up',
                lines: [
                    `Hi ${o.clientName ?? 'there'}, this is a reminder that order ${o.orderNo} — ${o.quantity} m³ of ${o.grade} — is scheduled for delivery ${when}.`,
                    'Please make sure the site is ready to receive the pour.',
                ],
            });
        }
        if (bool(eff.config, 'push')) {
            await sendPushToClientUsers(o.clientId, {
                title: 'Delivery reminder',
                body: `Order ${o.orderNo} — ${o.quantity} m³ ${o.grade} is scheduled for ${when}.`,
                url: '/my-orders',
                tag: `order-reminder-${o.id}`,
            }).catch(() => 0);
        }
        const template = str(eff.config, 'whatsappTemplate');
        if (bool(eff.config, 'whatsapp') && template && o.phone) {
            const result = await sendWhatsAppWithRetry(o.phone, template, {
                '1': o.clientName ?? 'Customer',
                '2': o.orderNo,
                '3': `${o.quantity} m³ ${o.grade}`,
                '4': o.deliveryDate ?? 'tomorrow',
            });
            await recordAutomationWhatsApp('orderReminders', { orderId: o.id, plantId: o.plantId }, o.phone, result);
        }
    }
    return sent;
}
// ---- 2. Delivery follow-up -----------------------------------------------------
// A trip still 'dispatched' after the configured delay probably means the driver
// forgot to close it (or something went wrong on site) — nudge the plant staff.
export async function runDeliveryFollowUps(snapshot, now = new Date(), scopePlantId) {
    if (!snapshot.enabledAnywhere('deliveryFollowUp'))
        return 0;
    // Fetch with the minimum possible delay (1h) and apply each plant's own
    // threshold in memory — the fleet's live trip count is small.
    const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
    const conds = [eq(challans.status, 'dispatched'), isNotNull(challans.dispatchTime), lt(challans.dispatchTime, cutoff)];
    if (scopePlantId !== undefined)
        conds.push(eq(challans.plantId, scopePlantId));
    const rows = await db
        .select({
        id: challans.id,
        challanNo: challans.challanNo,
        plantId: challans.plantId,
        dispatchTime: challans.dispatchTime,
        clientName: clients.name,
        vehicleNo: vehicles.vehicleNo,
    })
        .from(challans)
        .leftJoin(clients, eq(challans.clientId, clients.id))
        .leftJoin(vehicles, eq(challans.vehicleId, vehicles.id))
        .where(and(...conds));
    let sent = 0;
    for (const c of rows) {
        const eff = snapshot.effective('deliveryFollowUp', c.plantId);
        if (!eff.enabled)
            continue;
        const delayMs = num(eff.config, 'delayHours', 4) * 60 * 60 * 1000;
        if (!c.dispatchTime || now.getTime() - c.dispatchTime.getTime() < delayMs)
            continue;
        if (!(await claimSend('deliveryFollowUp', 'challan', c.id, 'overdue', c.plantId)))
            continue;
        sent += 1;
        const hours = Math.round((now.getTime() - c.dispatchTime.getTime()) / (60 * 60 * 1000));
        const body = `Challan ${c.challanNo}${c.vehicleNo ? ` (${c.vehicleNo})` : ''} for ${c.clientName ?? 'customer'} was dispatched ~${hours}h ago and is still not marked delivered.`;
        emitSSEEvent('automation.alert', { kind: 'deliveryFollowUp', challanId: c.id, message: body }, { roles: [...STAFF_ALERT_ROLES] });
        if (bool(eff.config, 'push')) {
            await sendPushToStaff(c.plantId, STAFF_ALERT_ROLES, {
                title: 'Trip still open',
                body,
                url: '/dispatch',
                tag: `followup-${c.id}`,
            }).catch(() => 0);
        }
        if (bool(eff.config, 'email')) {
            const to = await plantStaffEmails(c.plantId, ['admin', 'plant_owner', 'dispatcher']);
            if (to.length) {
                await sendAutomationEmail({
                    to,
                    subject: `Trip still open: challan ${c.challanNo}`,
                    heading: 'Delivery follow-up needed',
                    lines: [body, 'Please confirm the delivery status and close the trip.'],
                });
            }
        }
    }
    return sent;
}
// ---- 3. Auto trip-share link (event-driven) --------------------------------------
// Called from the challan dispatch path (fire-and-forget). Sends the customer a
// public live-tracking link for the trip, once per challan.
export async function maybeSendTripShare(challanId) {
    try {
        const snapshot = await loadAutomationSnapshot();
        const [row] = await db
            .select({
            id: challans.id,
            challanNo: challans.challanNo,
            plantId: challans.plantId,
            clientId: challans.clientId,
            grade: challans.grade,
            quantity: challans.quantity,
            clientName: clients.name,
            email: clients.email,
            phone: clients.phone,
        })
            .from(challans)
            .leftJoin(clients, eq(challans.clientId, clients.id))
            .where(eq(challans.id, challanId));
        if (!row)
            return;
        const eff = snapshot.effective('tripShare', row.plantId);
        if (!eff.enabled)
            return;
        const base = appBaseUrl();
        if (!base) {
            console.warn('[automation] tripShare skipped: no trusted base URL (set APP_URL).');
            return;
        }
        if (!(await claimSend('tripShare', 'challan', row.id, 'share', row.plantId)))
            return;
        const ttlMs = num(eff.config, 'ttlHours', 24) * 60 * 60 * 1000;
        const token = await createTrackingToken(row.id, null, ttlMs);
        const url = `${base}/track/${token}`;
        if (bool(eff.config, 'email') && row.email) {
            await sendAutomationEmail({
                to: [row.email],
                subject: `Track your concrete delivery live — challan ${row.challanNo}`,
                heading: 'Your concrete is on the way',
                lines: [
                    `Hi ${row.clientName ?? 'there'}, challan ${row.challanNo} — ${row.quantity} m³ of ${row.grade} — has been dispatched.`,
                    'You can watch the truck live on the map using the link below.',
                ],
                ctaUrl: url,
                ctaLabel: 'Track delivery live',
            });
        }
        if (bool(eff.config, 'push')) {
            await sendPushToClientUsers(row.clientId, {
                title: 'Track your delivery live',
                body: `Challan ${row.challanNo} is on the way — tap to watch it live.`,
                url: `/track/${token}`,
                tag: `tripshare-${row.id}`,
            }).catch(() => 0);
        }
        const template = str(eff.config, 'whatsappTemplate');
        if (bool(eff.config, 'whatsapp') && template && row.phone) {
            const result = await sendWhatsAppWithRetry(row.phone, template, {
                '1': row.clientName ?? 'Customer',
                '2': row.challanNo,
                '3': url,
            });
            await recordAutomationWhatsApp('tripShare', { challanId: row.id, plantId: row.plantId }, row.phone, result);
        }
    }
    catch (err) {
        console.warn('[automation] tripShare failed:', err);
    }
}
// Dispatch-time reachability check for the trip-share automation. Returns
// 'no_email' when tripShare is enabled and would try to reach this customer,
// but no enabled channel can actually deliver the link (no email on file, no
// WhatsApp fallback, no live push subscription). The dispatch route surfaces
// this to staff so the automation can't silently skip the customer. Returns
// null when the link will (or may) be delivered, or when tripShare is off /
// the base URL is missing (the latter is surfaced by the Automations badge).
// Best-effort by design: this is advisory UX, so it never throws — a failure
// here must never turn a successful dispatch into an error response.
export async function tripShareDeliveryWarning(clientId, plantId) {
    try {
        if (clientId == null)
            return null;
        const snapshot = await loadAutomationSnapshot();
        const eff = snapshot.effective('tripShare', plantId);
        if (!eff.enabled)
            return null;
        if (!appBaseUrl())
            return null;
        const [c] = await db
            .select({ email: clients.email, phone: clients.phone })
            .from(clients)
            .where(eq(clients.id, clientId));
        if (!c)
            return null;
        const emailOk = bool(eff.config, 'email') && !!(c.email ?? '').trim();
        const whatsappOk = bool(eff.config, 'whatsapp') && !!str(eff.config, 'whatsappTemplate') && !!(c.phone ?? '').trim();
        if (emailOk || whatsappOk)
            return null;
        if (bool(eff.config, 'push') && isPushConfigured()) {
            // Push only reaches the customer when the server can send pushes AND a
            // live, linked account has at least one registered subscription.
            const [sub] = await db
                .select({ id: pushSubscriptions.id })
                .from(pushSubscriptions)
                .innerJoin(users, eq(pushSubscriptions.userId, users.id))
                .where(and(eq(users.linkedClientId, clientId), eq(users.isActive, true), isNull(users.deletedAt)))
                .limit(1);
            if (sub)
                return null;
        }
        return 'no_email';
    }
    catch (err) {
        console.warn('[automation] tripShare reachability check failed (warning suppressed):', err);
        return null;
    }
}
// ---- 4. Daily / weekly digest -----------------------------------------------------
// Per-plant operations summary emailed to that plant's admins/owners.
export async function runDigests(snapshot, now = new Date(), scopePlantId) {
    if (!snapshot.enabledAnywhere('digest'))
        return 0;
    const ist = istParts(now);
    const plantRows = await db.select({ id: plants.id, name: plants.name }).from(plants)
        .where(scopePlantId === undefined ? undefined : eq(plants.id, scopePlantId));
    let sent = 0;
    for (const plant of plantRows) {
        const eff = snapshot.effective('digest', plant.id);
        if (!eff.enabled)
            continue;
        if (ist.hour < num(eff.config, 'sendHour', 8))
            continue;
        const weekly = eff.config.frequency === 'weekly';
        if (weekly && ist.weekday !== num(eff.config, 'weekday', 1))
            continue;
        // Period = the IST day (or 7 days) ENDING at today's IST midnight, so the
        // digest always covers complete days.
        const periodEnd = istDayStartUtc(ist.dateStr);
        const periodStart = new Date(periodEnd.getTime() - (weekly ? 7 : 1) * DAY_MS);
        const windowKey = `${weekly ? 'w' : 'd'}:${ist.dateStr}`;
        if (!(await claimSend('digest', 'plant', plant.id, windowKey, plant.id)))
            continue;
        const inPeriod = and(eq(challans.plantId, plant.id), sql `${challans.createdAt} >= ${periodStart}`, sql `${challans.createdAt} < ${periodEnd}`);
        const [challanAgg] = await db
            .select({
            trips: sql `count(*)::int`,
            delivered: sql `count(*) filter (where ${challans.status} = 'delivered')::int`,
            volume: sql `coalesce(sum(coalesce(${challans.deliveredQuantity}, ${challans.quantity})::numeric), 0)`,
        })
            .from(challans)
            .where(inPeriod);
        const [orderAgg] = await db
            .select({ count: sql `count(*)::int` })
            .from(orders)
            .where(and(eq(orders.plantId, plant.id), sql `${orders.createdAt} >= ${periodStart}`, sql `${orders.createdAt} < ${periodEnd}`));
        const topClients = await db
            .select({
            name: clients.name,
            volume: sql `coalesce(sum(coalesce(${challans.deliveredQuantity}, ${challans.quantity})::numeric), 0)`,
        })
            .from(challans)
            .leftJoin(clients, eq(challans.clientId, clients.id))
            .where(inPeriod)
            .groupBy(clients.name)
            .orderBy(sql `2 desc`)
            .limit(3);
        let fuelFlags = 0;
        try {
            const recon = await computeFuelReconciliation(periodStart, periodEnd, plant.id);
            fuelFlags = recon.rows.filter(r => r.flagged).length;
        }
        catch (err) {
            console.warn('[automation] digest fuel reconciliation failed:', err);
        }
        sent += 1;
        const label = weekly ? 'Weekly' : 'Daily';
        const periodLabel = weekly
            ? `${periodStart.toISOString().slice(0, 10)} → ${ist.dateStr}`
            : new Date(periodStart.getTime() + IST_SHIFT).toISOString().slice(0, 10);
        const lines = [
            `Period: ${periodLabel}`,
            `Orders received: ${orderAgg?.count ?? 0}`,
            `Trips: ${challanAgg?.trips ?? 0} (${challanAgg?.delivered ?? 0} delivered)`,
            `Volume dispatched: ${Math.round(Number(challanAgg?.volume ?? 0) * 100) / 100} m³`,
        ];
        if (topClients.length && topClients.some(t => Number(t.volume) > 0)) {
            lines.push(`Top clients: ${topClients.map(t => `${t.name ?? 'Unknown'} (${Math.round(Number(t.volume) * 10) / 10} m³)`).join(', ')}`);
        }
        lines.push(fuelFlags > 0
            ? `Fuel flags: ${fuelFlags} vehicle(s) over the diesel variance threshold — check the fuel reconciliation report.`
            : 'Fuel flags: none.');
        if (bool(eff.config, 'email')) {
            const to = await plantStaffEmails(plant.id, ['admin', 'plant_owner']);
            if (to.length > 0) {
                await sendAutomationEmail({
                    to,
                    subject: `${label} digest — ${plant.name}`,
                    heading: `${label} operations digest for ${plant.name}`,
                    lines,
                });
            }
        }
        const template = str(eff.config, 'whatsappTemplate');
        if (bool(eff.config, 'whatsapp') && template) {
            const phones = await plantStaffPhones(plant.id, ['admin', 'plant_owner']);
            for (const phone of phones) {
                const result = await sendWhatsAppWithRetry(phone, template, {
                    '1': plant.name,
                    '2': `${label} · ${periodLabel}`,
                    '3': String(orderAgg?.count ?? 0),
                    '4': `${Math.round(Number(challanAgg?.volume ?? 0) * 100) / 100}`,
                });
                await recordAutomationWhatsApp('digest', { plantId: plant.id }, phone, result);
            }
        }
    }
    return sent;
}
// IST shift used only to label digest period dates in IST.
const IST_SHIFT = 330 * 60 * 1000;
// ---- 5. Fuel anomaly alerts ---------------------------------------------------------
// Re-uses the fuel reconciliation math over a rolling window; a vehicle whose
// actual diesel exceeds expected by more than the threshold raises one alert per
// window.
export async function runFuelAnomalyAlerts(snapshot, now = new Date(), scopePlantId) {
    if (!snapshot.enabledAnywhere('fuelAnomaly'))
        return 0;
    const ist = istParts(now);
    const plantRows = await db.select({ id: plants.id, name: plants.name }).from(plants)
        .where(scopePlantId === undefined ? undefined : eq(plants.id, scopePlantId));
    let sent = 0;
    for (const plant of plantRows) {
        const eff = snapshot.effective('fuelAnomaly', plant.id);
        if (!eff.enabled)
            continue;
        const windowDays = num(eff.config, 'windowDays', 7);
        const thresholdPct = num(eff.config, 'thresholdPct', 15);
        const from = new Date(now.getTime() - windowDays * DAY_MS);
        let rows;
        try {
            rows = (await computeFuelReconciliation(from, now, plant.id)).rows;
        }
        catch (err) {
            console.warn('[automation] fuel reconciliation failed:', err);
            continue;
        }
        for (const r of rows) {
            if (r.variancePct == null || r.variancePct <= thresholdPct)
                continue;
            const key = periodKey(ist.dayIndex, windowDays);
            if (!(await claimSend('fuelAnomaly', 'vehicle', r.vehicleId, key, plant.id, `${r.variancePct}%`)))
                continue;
            sent += 1;
            const body = `${r.vehicleNo ?? `Vehicle #${r.vehicleId}`} burned ${r.actualLitres} L vs ~${r.expectedLitres ?? '?'} L expected over the last ${windowDays} day(s) (+${r.variancePct}%).`;
            emitSSEEvent('automation.alert', { kind: 'fuelAnomaly', vehicleId: r.vehicleId, message: body }, { roles: [...STAFF_ALERT_ROLES] });
            if (bool(eff.config, 'push')) {
                await sendPushToStaff(plant.id, STAFF_ALERT_ROLES, {
                    title: 'Fuel anomaly detected',
                    body,
                    url: '/reports',
                    tag: `fuel-anomaly-${r.vehicleId}`,
                }).catch(() => 0);
            }
            if (bool(eff.config, 'email')) {
                const to = await plantStaffEmails(plant.id, ['admin', 'plant_owner']);
                if (to.length) {
                    await sendAutomationEmail({
                        to,
                        subject: `Fuel anomaly: ${r.vehicleNo ?? `vehicle #${r.vehicleId}`} at ${plant.name}`,
                        heading: 'Possible diesel over-consumption',
                        lines: [body, 'Review the diesel reconciliation report to investigate (possible theft, leak, or a stale mileage baseline).'],
                    });
                }
            }
        }
    }
    return sent;
}
// ---- 6. Inactive customer win-back ---------------------------------------------------
// Customers who HAVE ordered before but not in the last N days get a gentle
// nudge; at most one per client per window.
export async function runWinBacks(snapshot, now = new Date(), scopePlantId) {
    if (!snapshot.enabledAnywhere('winBack'))
        return 0;
    const ist = istParts(now);
    const rows = await db
        .select({
        id: clients.id,
        plantId: clients.plantId,
        name: clients.name,
        email: clients.email,
        phone: clients.phone,
        lastOrderAt: max(orders.createdAt),
    })
        .from(clients)
        .innerJoin(orders, eq(orders.clientId, clients.id))
        .where(scopePlantId === undefined ? undefined : eq(clients.plantId, scopePlantId))
        .groupBy(clients.id);
    let sent = 0;
    for (const c of rows) {
        const eff = snapshot.effective('winBack', c.plantId);
        if (!eff.enabled)
            continue;
        const inactiveDays = num(eff.config, 'inactiveDays', 30);
        if (!c.lastOrderAt || now.getTime() - c.lastOrderAt.getTime() < inactiveDays * DAY_MS)
            continue;
        if (!(await claimSend('winBack', 'client', c.id, periodKey(ist.dayIndex, inactiveDays), c.plantId)))
            continue;
        sent += 1;
        if (bool(eff.config, 'email') && c.email) {
            await sendAutomationEmail({
                to: [c.email],
                subject: 'We miss you — ready for your next pour?',
                heading: `It has been a while, ${c.name}`,
                lines: [
                    `It has been over ${inactiveDays} days since your last concrete order with us.`,
                    'If you have an upcoming pour, we would love to supply it — place an order any time and we will take care of the rest.',
                ],
            });
        }
        const template = str(eff.config, 'whatsappTemplate');
        if (bool(eff.config, 'whatsapp') && template && c.phone) {
            const result = await sendWhatsAppWithRetry(c.phone, template, { '1': c.name });
            await recordAutomationWhatsApp('winBack', { plantId: c.plantId }, c.phone, result);
        }
    }
    return sent;
}
// ---- 7. Idle vehicle alerts -------------------------------------------------------------
// An 'active' vehicle with no trips for N days is either forgotten or broken —
// tell the plant staff. Once per vehicle per window.
export async function runIdleVehicleAlerts(snapshot, now = new Date(), scopePlantId) {
    if (!snapshot.enabledAnywhere('idleVehicle'))
        return 0;
    const ist = istParts(now);
    const vehicleConds = [eq(vehicles.status, 'active')];
    if (scopePlantId !== undefined)
        vehicleConds.push(eq(vehicles.plantId, scopePlantId));
    const rows = await db
        .select({
        id: vehicles.id,
        plantId: vehicles.plantId,
        vehicleNo: vehicles.vehicleNo,
        createdAt: vehicles.createdAt,
        lastTripAt: max(challans.dispatchTime),
    })
        .from(vehicles)
        .leftJoin(challans, eq(challans.vehicleId, vehicles.id))
        .where(and(...vehicleConds))
        .groupBy(vehicles.id);
    let sent = 0;
    for (const v of rows) {
        const eff = snapshot.effective('idleVehicle', v.plantId);
        if (!eff.enabled)
            continue;
        const idleDays = num(eff.config, 'idleDays', 7);
        // A vehicle with no trips at all only counts once it has EXISTED that long.
        const reference = v.lastTripAt ?? v.createdAt;
        if (!reference || now.getTime() - reference.getTime() < idleDays * DAY_MS)
            continue;
        if (!(await claimSend('idleVehicle', 'vehicle', v.id, periodKey(ist.dayIndex, idleDays), v.plantId)))
            continue;
        sent += 1;
        const days = Math.floor((now.getTime() - reference.getTime()) / DAY_MS);
        const body = `${v.vehicleNo} has had no trips for ${days} day(s) but is still marked active.`;
        emitSSEEvent('automation.alert', { kind: 'idleVehicle', vehicleId: v.id, message: body }, { roles: [...STAFF_ALERT_ROLES] });
        if (bool(eff.config, 'push')) {
            await sendPushToStaff(v.plantId, STAFF_ALERT_ROLES, {
                title: 'Idle vehicle',
                body,
                url: '/vehicles',
                tag: `idle-vehicle-${v.id}`,
            }).catch(() => 0);
        }
        if (bool(eff.config, 'email')) {
            const to = await plantStaffEmails(v.plantId, ['admin', 'plant_owner', 'dispatcher']);
            if (to.length) {
                await sendAutomationEmail({
                    to,
                    subject: `Idle vehicle: ${v.vehicleNo}`,
                    heading: 'Vehicle sitting idle',
                    lines: [body, 'Consider assigning it to upcoming trips or updating its status (maintenance / inactive).'],
                });
            }
        }
    }
    return sent;
}
export async function runCleanup(snapshot, now = new Date()) {
    const eff = snapshot.effective('cleanup', null);
    if (!eff.enabled)
        return null;
    const retentionMs = num(eff.config, 'retentionDays', 30) * DAY_MS;
    const retentionCutoff = new Date(now.getTime() - retentionMs);
    const result = {
        otpCodes: 0, staffOtpCodes: 0, passwordTokens: 0,
        trackingTokens: 0, rateLimitHits: 0, responseCache: 0, purgedUsers: 0,
    };
    // Expired short-lived rows can go the moment they lapse.
    result.otpCodes = (await db.delete(otpCodes).where(lt(otpCodes.expiresAt, now)).returning({ id: otpCodes.id })).length;
    result.staffOtpCodes = (await db.delete(staffOtpCodes).where(lt(staffOtpCodes.expiresAt, now)).returning({ id: staffOtpCodes.id })).length;
    result.rateLimitHits = (await db.delete(rateLimitHits).where(lt(rateLimitHits.resetAt, now)).returning({ key: rateLimitHits.key })).length;
    result.responseCache = (await db.delete(responseCache).where(lt(responseCache.expiresAt, now)).returning({ key: responseCache.key })).length;
    // One-time tokens are kept for the retention window after they die (useful
    // when auditing a recent invite/reset), then dropped.
    result.passwordTokens = (await db.delete(passwordSetupTokens).where(sql `coalesce(${passwordSetupTokens.usedAt}, ${passwordSetupTokens.expiresAt}) < ${retentionCutoff}`).returning({ id: passwordSetupTokens.id })).length;
    result.trackingTokens = (await db.delete(trackingTokens).where(sql `coalesce(${trackingTokens.revokedAt}, ${trackingTokens.expiresAt}) < ${retentionCutoff}`).returning({ id: trackingTokens.id })).length;
    // Trashed accounts past retention are purged for real — mirroring the manual
    // "delete forever" route, including its last-admin guard and audit entry.
    const trashed = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(and(isNotNull(users.deletedAt), lt(users.deletedAt, retentionCutoff)));
    for (const u of trashed) {
        if (u.role === 'admin') {
            const [{ count: otherAdmins }] = await db
                .select({ count: sql `count(*)::int` })
                .from(users)
                .where(and(eq(users.role, 'admin'), ne(users.id, u.id)));
            if (otherAdmins <= 0)
                continue;
        }
        // Claim the purge in the once-only ledger so two overlapping instances
        // can never both write the audit entry for the same account.
        if (!(await claimSend('cleanup', 'user', u.id, 'purge')))
            continue;
        await db.insert(auditLogs).values({
            actorId: null,
            actorName: 'Auto-cleanup',
            action: 'user.purged',
            targetUserId: u.id,
            targetUserEmail: u.email,
            detail: `Trashed account purged automatically after retention (${u.email})`,
        });
        await db.delete(users).where(eq(users.id, u.id));
        result.purgedUsers += 1;
    }
    const total = Object.values(result).reduce((a, b) => a + b, 0);
    if (total > 0)
        console.log('[automation] cleanup purged:', JSON.stringify(result));
    return result;
}
// ---- Tick runner ------------------------------------------------------------------------------
// One guarded pass over every polled automation. Settings are re-read fresh on
// every tick so admin changes apply without a restart. Each job is individually
// fenced — one failing automation never blocks the others. Overlap between
// instances/ticks is safe because every send is arbitrated by the claim ledger.
let ticking = false;
async function runTick(now, scopePlantId) {
    if (ticking)
        return;
    ticking = true;
    try {
        const snapshot = await loadAutomationSnapshot();
        const ran = [];
        const jobs = [
            ['orderReminders', () => runOrderReminders(snapshot, now, scopePlantId)],
            ['deliveryFollowUp', () => runDeliveryFollowUps(snapshot, now, scopePlantId)],
            ['digest', () => runDigests(snapshot, now, scopePlantId)],
            ['fuelAnomaly', () => runFuelAnomalyAlerts(snapshot, now, scopePlantId)],
            ['winBack', () => runWinBacks(snapshot, now, scopePlantId)],
            ['idleVehicle', () => runIdleVehicleAlerts(snapshot, now, scopePlantId)],
        ];
        // Cleanup is platform housekeeping (expired tokens, trashed accounts) —
        // it never runs from a plant-scoped tick.
        if (scopePlantId === undefined)
            jobs.push(['cleanup', () => runCleanup(snapshot, now)]);
        for (const [name, job] of jobs) {
            try {
                await job();
                ran.push(name);
            }
            catch (err) {
                console.error(`[automation] ${name} tick failed:`, err);
            }
        }
        // Only a full (platform-wide) tick updates the shared last-run metadata —
        // a single-plant run did not check the other plants, so recording it would
        // make a stalled scheduler look healthy.
        if (ran.length && scopePlantId === undefined)
            await recordLastRun(ran, now);
    }
    finally {
        ticking = false;
    }
}
export async function tickAutomations(now = new Date()) {
    return runTick(now);
}
// On-demand run for one plant's staff: every job's queries are filtered to
// that plant and global work (cleanup, other plants' digests) is skipped.
// Safe to spam — the once-only claim ledger arbitrates every send.
export async function tickAutomationsForPlant(plantId, now = new Date()) {
    return runTick(now, plantId);
}
