---
name: seed.ts is idempotent / re-runnable
description: The server seed is safe to re-run against a populated DB; how the idempotency is built and the constraints it respects.
---

# `server/src/db/seed.ts` is idempotent (safe to re-run)

The full seed can be re-run against an already-populated DB — it is a no-op for
existing rows and additive for genuinely new ones (e.g. adding more marketplace
plants). Just edit the value arrays and re-run `pnpm --filter ... db:seed`; no more
applying deltas via direct `INSERT ... ON CONFLICT` SQL.

**Why:** the old `.returning().onConflictDoNothing()` pattern yielded `[]` on a
populated DB (every row conflicts), so `const homePlant = plantRows[0]` became
`undefined` and corrupted every downstream reference (clients/orders/challans).

**How it works now:** an `ensureSeeded(table, values, match)` helper looks each row
up by a natural key first and only inserts when missing, returning existing-or-new
rows in input order. Match keys: plants=plantCode, clients=(plantId,customerCode),
sites=(clientId,name), drivers=phone, vehicles=vehicleNo, orders=orderNo,
challans=challanNo, batch=batchNo, ledger=referenceNo. Sites/drivers/ledger have NO
DB unique constraint, so they MUST be matched in app code or re-runs duplicate them.

**Constraint to respect:** the demo client/driver `users` link updates can hit the
partial unique indexes (`users_linked_client_unique` / `_driver_`) on a diverged DB
where another live user already owns the target link. The seed guards each update —
skip when the link already points here (self-no-op) or when another non-soft-deleted
user holds it — so never reinstate a bare `UPDATE users SET linked_*` without that
guard.
