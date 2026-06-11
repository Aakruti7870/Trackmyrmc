import { and, eq, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, recurringOrders } from '../db/schema.js';
import { nextOrderNo } from './orderNo.js';
import { emitSSEEvent } from './sseEmitter.js';
// Format a Date as a YYYY-MM-DD string in UTC (matches the `date` column shape).
export function toDateStr(d) {
    return d.toISOString().slice(0, 10);
}
function daysInMonth(year, month0) {
    return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
// The next calendar date matching the schedule. For weekly, `anchor` is the
// day-of-week (0=Sun..6=Sat); for monthly it's the day-of-month (1..28, clamped
// to the month length). When `inclusive` the returned date may equal `from`.
export function computeRunDate(frequency, anchor, from, inclusive) {
    const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    if (frequency === 'weekly') {
        let delta = (anchor - base.getUTCDay() + 7) % 7;
        if (delta === 0 && !inclusive)
            delta = 7;
        base.setUTCDate(base.getUTCDate() + delta);
        return toDateStr(base);
    }
    // monthly
    const targetThis = Math.min(anchor, daysInMonth(base.getUTCFullYear(), base.getUTCMonth()));
    const day = base.getUTCDate();
    if (day < targetThis || (day === targetThis && inclusive)) {
        return toDateStr(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), targetThis)));
    }
    const nextMonth = base.getUTCMonth() + 1;
    const y = base.getUTCFullYear() + Math.floor(nextMonth / 12);
    const m = nextMonth % 12;
    const target = Math.min(anchor, daysInMonth(y, m));
    return toDateStr(new Date(Date.UTC(y, m, target)));
}
// First scheduled date on or after today, used when a template is created.
export function computeFirstRunDate(frequency, anchor, from = new Date()) {
    return computeRunDate(frequency, anchor, from, true);
}
// Materialise an order for every active template whose nextRunDate is due
// (<= today), then advance each template to its next occurrence after today so a
// single check never generates a backlog of missed dates. Returns how many
// orders were created. Safe to call repeatedly (idempotent per day per template
// because nextRunDate is advanced past today).
export async function runDueRecurringOrders(now = new Date()) {
    const today = toDateStr(now);
    // Each due template is processed in its own transaction: we claim the row with
    // FOR UPDATE SKIP LOCKED, then insert the order and advance nextRunDate as a
    // single unit of work. This makes the run safe under overlap (boot run racing
    // the interval, or multiple instances) and crash-safe — if the process dies
    // mid-run the transaction rolls back and the template stays due, so we never
    // double-fire or leave an order without advancing the schedule. Emitted SSE
    // rows are collected and dispatched only after each commit succeeds.
    const emitted = [];
    for (;;) {
        const inserted = await db.transaction(async (tx) => {
            const [tpl] = await tx.select().from(recurringOrders)
                .where(and(eq(recurringOrders.active, true), lte(recurringOrders.nextRunDate, today)))
                .orderBy(recurringOrders.id)
                .limit(1)
                .for('update', { skipLocked: true });
            if (!tpl)
                return null;
            const orderNo = await nextOrderNo(tx);
            const [row] = await tx.insert(orders).values({
                orderNo,
                clientId: tpl.clientId,
                siteId: tpl.siteId ?? null,
                grade: tpl.grade,
                quantity: tpl.quantity,
                pumpRequired: tpl.pumpRequired,
                deliveryDate: tpl.nextRunDate,
                deliveryTime: tpl.deliveryTime ?? null,
                notes: tpl.notes ?? null,
                status: 'pending',
            }).returning();
            const next = computeRunDate(tpl.frequency, tpl.anchor, now, false);
            await tx.update(recurringOrders)
                .set({ nextRunDate: next, lastRunAt: now })
                .where(eq(recurringOrders.id, tpl.id));
            return row;
        });
        if (!inserted)
            break;
        emitted.push({ clientId: inserted.clientId, row: inserted });
    }
    for (const { clientId, row } of emitted) {
        emitSSEEvent('order.created', row, { clientId });
    }
    return emitted.length;
}
