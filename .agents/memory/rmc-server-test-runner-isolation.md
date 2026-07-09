---
name: Server tests must use the isolated runner
description: Running node:test files directly with tsx --test truncates the DEV database; only scripts/test.mjs (pnpm test) provisions an isolated DB.
---

Never run `npx tsx --test src/test/<file>.test.ts` in server/ with the ambient env: `src/db/index.ts` uses `DATABASE_URL` directly, and every suite's `beforeEach` TRUNCATEs users/clients/challans/drivers/audit_logs — this wipes the DEV database (it happened; boot self-seeding restored bootstrap users/plants, but user-created dev rows were lost).

**Why:** only `pnpm test` (scripts/test.mjs) provisions a per-run `<db>_test_<tag>_<pid>_<ts>` database; the raw test files have no such guard.

**How to apply:** for a targeted single-file run, create a scratch DB (`CREATE DATABASE <db>_test_scratch_<pid>`), `DATABASE_URL=<scratch> npx drizzle-kit push --force`, run the file with `DATABASE_URL=<scratch> NODE_ENV=test`, then DROP it. Also: `plants.name` has a global unique constraint — test fixtures must suffix plant names/codes with a per-run tag.
