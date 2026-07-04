---
name: RMC customer plant visibility gate
description: What makes a plant visible to customers on /nearby, /map, /directory and why the gate has a verified-partner safety net.
---

# RMC customer-facing plant visibility (customerVisible in routes/plants.ts)

A plant appears on the customer network (/plants/nearby, /map, directory) ONLY when
`showOnNetwork === true` AND it is "Active".

"Active" = `networkStatus === 'active'` OR the genuine-partner criteria
(`plantStatus==='approved' && isActive && locationVerified && verified`).

**Why the OR safety net:** networkStatus is a lifecycle column (pending→invited→
verified→active) that is only advanced by the PUT verification flow and the boot
backfill (backfillNetworkStatus). Rows created another way — seed.ts, CSV import,
or a test's direct `db.insert(plants)` — set verified=true but leave networkStatus
at its `'pending'` schema default, so a strict `networkStatus==='active'` gate
silently HIDES real verified partners from customers until the next boot. The
long-standing contract (encoded in plants.onboarding.test.ts "GET /plants/nearby
excludes unverified leads, includes verified partners") is: a verified partner is
visible. The genuine-partner OR keeps that contract even when the lifecycle column
lags.

**How to apply:** if you tighten or refactor customerVisible, keep both the
showOnNetwork toggle (the authority hide switch) AND the verified-partner fallback,
or verified plants inserted outside the PUT route vanish from the marketplace.
customerVisible is called via `.filter(customerVisible)` over full `db.select().from(plants)`
rows, so all the extra fields are available at runtime.
