---
name: RMC reports/dashboard tenant scoping
description: Every analytics aggregate in the RMC server must be plant-scoped; how the escape hatch and helper params work.
---

In the multi-tenant RMC server, any aggregate query over a tenant-bound table
(`challans`, `orders`, `clients`) must append `plantScope(actorPlantId, table.plantId)`
to its `.where(and(...))`. Missing it on even one path is a cross-tenant inference leak
(a plant-bound owner reading another plant's demand/fleet figures).

**Why:** Successive architect reviews kept finding *one more* unscoped aggregate —
`reports.ts dateRange()`, then `/forecast` (history AND booked order queries), then
`computeFuelReconciliation` (challan KM/idle, exposed on both the JSON endpoint and the
`/export?report=fuel-reconciliation` CSV branch), and `dashboard.ts /kpis`. Each looked
independent, so a blanket "scoped the reports" claim was wrong four times.

**How to apply:**
- `plantScope(plantId, col)` returns `undefined` for a null `plantId` (legacy global
  admin / marketplace authority stay global by design), and drizzle `and()` drops
  `undefined`, so the same predicate is a no-op for superusers and a hard filter for
  plant-bound users.
- Helper functions that run aggregates (e.g. `computeFuelReconciliation`) take an explicit
  `actorPlantId?: number | null` param; EVERY caller (endpoint + CSV export) must pass
  `req.user?.plantId`. Don't rely on a route-level guard alone.
- `vehicles`, `fuelLogs`, `batchRecords`, `recurringOrders` carry no `plantId` (documented
  drift) — leave them unscoped; isolation there comes from matching them only against the
  actor's already-scoped challan/order rows.
- Regression pattern: seed the SAME entity for plant A and plant B, assert the plant-A
  actor sees only A's figure, plant-B only B's, and a null-plant admin sees the combined
  total — on both JSON and CSV surfaces.
