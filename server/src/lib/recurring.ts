import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orders, recurringOrders } from '../db/schema.js';
import { nextOrderNo } from './orderNo.js';
import { emitSSEEvent } from './sseEmitter.js';

// Format a Date as a YYYY-MM-DD string in UTC (matches the `date` column shape).
export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// The next calendar date matching the schedule. For weekly, `anchor` is the
// day-of-week (0=Sun..6=Sat); for monthly it's the day-of-month (1..28, clamped
// to the month length). When `inclusive` the returned date may equal `from`.
export function computeRunDate(
  frequency: 'weekly' | 'monthly',
  anchor: number,
  from: Date,
  inclusive: boolean,
): string {
  const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  if (frequency === 'weekly') {
    let delta = (anchor - base.getUTCDay() + 7) % 7;
    if (delta === 0 && !inclusive) delta = 7;
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
export function computeFirstRunDate(frequency: 'weekly' | 'monthly', anchor: number, from = new Date()): string {
  return computeRunDate(frequency, anchor, from, true);
}

// Materialise an order for every active template whose nextRunDate is due
// (<= today), then advance each template to its next occurrence after today so a
// single check never generates a backlog of missed dates. Returns how many
// orders were created. Safe to call repeatedly (idempotent per day per template
// because nextRunDate is advanced past today).
export async function runDueRecurringOrders(now = new Date()): Promise<number> {
  const today = toDateStr(now);

  // Each due template is processed in its own transaction: we claim the row with
  // FOR UPDATE SKIP LOCKED, then insert the order and advance nextRunDate as a
  // single unit of work. This makes the run safe under overlap (boot run racing
  // the interval, or multiple instances) and crash-safe — if the process dies
  // mid-run the transaction rolls back and the template stays due, so we never
  // double-fire or leave an order without advancing the schedule. Emitted SSE
  // rows are collected and dispatched only after each commit succeeds.
  const emitted: Array<{ clientId: number; row: typeof orders.$inferSelect }> = [];

  for (;;) {
    const processed = await db.transaction(async (tx) => {
      const [tpl] = await tx.select().from(recurringOrders)
        .where(and(eq(recurringOrders.active, true), lte(recurringOrders.nextRunDate, today)))
        .orderBy(recurringOrders.id)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!tpl) return null;

      // Recurring generation bypasses the HTTP order route, so it must perform
      // the same live identity authorization itself. Support both the legacy
      // primary-client link and future/per-plant customer links.
      const kyc = await tx.execute(sql`
        SELECT EXISTS (
          SELECT 1
          FROM users u
          LEFT JOIN plant_customers pc ON pc.user_id = u.id
          WHERE (u.linked_client_id = ${tpl.clientId} OR pc.client_id = ${tpl.clientId})
            AND u.deleted_at IS NULL
            AND u.is_active = true
            AND (
              u.kyc_status = 'verified'
              OR EXISTS (
                SELECT 1 FROM kyc_profiles kp
                WHERE kp.user_id = u.id AND kp.status = 'approved'
              )
            )
        ) AS verified
      `);
      const verified = (kyc.rows[0] as { verified?: boolean } | undefined)?.verified === true;
      const next = computeRunDate(tpl.frequency, tpl.anchor, now, false);

      if (!verified) {
        // Pause instead of repeatedly retrying every scheduler tick. Advance past
        // the missed occurrence so reactivation after KYC never creates a stale
        // order for an old delivery date.
        await tx.update(recurringOrders)
          .set({ active: false, nextRunDate: next })
          .where(eq(recurringOrders.id, tpl.id));
        return { kind: 'blocked' as const, templateId: tpl.id };
      }

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

      await tx.update(recurringOrders)
        .set({ nextRunDate: next, lastRunAt: now })
        .where(eq(recurringOrders.id, tpl.id));
      return { kind: 'created' as const, row };
    });

    if (!processed) break;
    if (processed.kind === 'created') {
      emitted.push({ clientId: processed.row.clientId, row: processed.row });
    } else {
      console.warn(`Recurring order template ${processed.templateId} paused because customer KYC is not verified`);
    }
  }

  for (const { clientId, row } of emitted) {
    emitSSEEvent('order.created', row, { clientId });
  }
  return emitted.length;
}
