---
name: RMC plant directory bootstrap
description: How the curated plant directory gets into every database (dev + freshly-published prod) and why a startup bootstrap exists.
---

# RMC plant directory bootstrap

The curated marketplace plant list lives in `server/src/db/plantDirectory.ts` as
`PLANT_DIRECTORY` — the single source of truth. Both the full seed (`seed.ts`)
and the startup bootstrap (`server/src/lib/plantDirectory.ts` → `ensurePlantDirectory()`)
consume it. `ensurePlantDirectory()` runs on boot in `index.ts` right after
`ensureMasterAccounts()` and inserts with `onConflictDoNothing({ target: plants.plantCode })`.

**Why:** A freshly-published production database (and any dev DB that only ever had
user rows created piecemeal) starts with ZERO plants. `seed.ts` is fresh-DB-only
(see seed-fresh-db-only memo) so it can't be re-run to backfill, and the prod DB is
read-only to the agent (executeSql can't write to it). The result was the customer
"Nearby RMC Plants" page correctly showing "No approved plants found" because there
was nothing to show. The bootstrap makes the directory self-heal in every
environment without manual seeding or direct prod writes.

**How to apply:** To change the plant directory, edit `PLANT_DIRECTORY` only.
Dev picks it up on backend restart; production picks it up on the next Publish
(startup runs the bootstrap once). The conflict target is `plantCode`, so the
bootstrap never overwrites or duplicates plants added via onboarding — only
missing plantCodes are inserted. Customer visibility still requires
approved+active+locationVerified+verified (the /plants/nearby filter).
