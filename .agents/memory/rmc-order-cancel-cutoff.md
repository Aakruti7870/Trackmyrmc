---
name: RMC order cancel/reschedule cutoff
description: How the customer order cancel + reschedule 20-min cutoff works and the date-only exemption.
---

Customers cancel/reschedule their own orders from /my-orders. A CANCEL_CUTOFF_MINUTES=20 window before the scheduled delivery blocks both actions (backend 409 on cancel/reschedule of the current slot; 400 on a new reschedule slot inside the cutoff-from-now). The frontend disables the buttons via isCancelLocked so the UI matches the API.

**Rule:** the cutoff only applies when BOTH `deliveryDate` AND `deliveryTime` are set. An order with a date but no time (or neither) has no concrete delivery moment and stays cancellable/reschedulable — do NOT default a missing time to 00:00, that wrongly locks date-only orders against midnight.

**Why:** delivery time is optional on orders; treating absent time as midnight silently locked same-day date-only orders all day. Requirement is "no scheduled time → always cancellable."

**How to apply:** keep `scheduledDeliveryAt` in server/src/routes/me.ts and rmc-app/src/pages/MyOrders.tsx in lockstep — both return null unless date+time present. Cancel reason is optional server-side (UI-required only) to preserve the pre-existing cancel API contract + tests. Approved order whose date changes on reschedule reverts to pending_approval (notified via notifyOrderPendingApproval); otherwise notifyOrderRescheduled fires. Cutoff check is read-then-write (fine for a 20-min low-contention window); timezone is process/browser-local.
