---
name: RMC recurring-order scheduler idempotency
description: How the in-process recurring-order scheduler avoids double-firing, and why it claims rows transactionally.
---

The recurring-order scheduler (`runDueRecurringOrders` in `server/src/lib/recurring.ts`)
runs on boot + hourly `setInterval`. An in-memory overlap flag alone is NOT enough —
it only protects one process and not a crash mid-run.

The rule: claim each due template in its own DB transaction with
`.for('update', { skipLocked: true })` (FOR UPDATE SKIP LOCKED), then insert the
order AND advance `nextRunDate`/`lastRunAt` inside the *same* transaction. SSE
`order.created` events are buffered and emitted only after each commit.

**Why:** without this, two overlapping runs (boot vs interval) or a crash between
the order insert and the schedule advance can double-materialise an order or leave
a template stuck "due". Idempotency comes from advancing `nextRunDate` past today
in the same unit of work as the insert.

**How to apply:** any future periodic materialiser in this codebase that "reads due
rows then writes" must use the same claim-in-transaction pattern, not a bare
select-then-update loop. `nextOrderNo(executor)` accepts the active `tx` so the
order-number read participates in the transaction (still non-atomic globally, but
the suffix is derived inside the locked claim so concurrent scheduler runs don't
collide on it).
