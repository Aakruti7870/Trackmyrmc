---
name: seed.ts is fresh-DB-only
description: Why the server seed must never be re-run against a populated database, and how to add plant/data deltas safely.
---

# `server/src/db/seed.ts` is fresh-DB-only

The full seed is safe to run **only against an empty database**. Re-running it on an
already-seeded DB silently corrupts the run.

**Why:** plants are inserted with `.returning().onConflictDoNothing()`. On a populated
DB every row conflicts, so `.returning()` yields `[]`, and the immediately following
`const homePlant = plantRows[0]` becomes `undefined`. Everything downstream (clients,
orders, challans bound to `homePlant.id`) then breaks or no-ops.

**How to apply:** To add new rows (e.g. more marketplace plants) to a live DB, insert
the delta directly with `INSERT ... ON CONFLICT (plant_code) DO NOTHING` (plant `name`
and `plant_code` both carry unique indexes). Keep `seed.ts` updated in lockstep for
fresh-DB parity, but do NOT execute the full seed to apply the change. If the seed ever
needs to be idempotent on a populated DB, resolve `homePlant` by querying the existing
`PLT-001` row when the insert returns nothing.
