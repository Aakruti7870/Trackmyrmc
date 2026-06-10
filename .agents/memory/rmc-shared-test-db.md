---
name: RMC shared test DB concurrency
description: Why the server suite shows spurious FK/duplicate-key/wrong-status failures, and how to avoid them
---

The server test runner (`server/scripts/test.mjs`, run via `pnpm test`) provisions and **reuses a single shared `<db>_test` database** for the whole run. Each suite cleans state in a `beforeEach` TRUNCATE, which only isolates tests *within one sequential run* (`--test-concurrency=1`).

**Rule:** never run `node scripts/test.mjs` / `pnpm test` manually while a validation run (or another test invocation) is also running — they hit the same `<db>_test` DB and clobber each other.

**Why:** two concurrent runs race on TRUNCATE/insert against shared tables. Symptoms are confusing and look like a real defect but are not:
- `duplicate key value violates unique constraint "users_email_unique"` (e.g. `admin@test.com`)
- `insert or update on table "audit_logs" violates foreign key constraint "audit_logs_actor_id_users_id_fk"` / `..._target_user_id_..._fk` (actor/target row truncated out from under the other run)
- assertion mismatches like `403 !== 409` / `403 !== 200` (the actor admin row was wiped, so requireRole/requireAuth rejects)

**How to apply:** if a validation `test` step fails with the above but the same suite passes when you run it once in isolation, suspect concurrent DB access (your own manual run overlapping validation), not the code. Re-run validation alone. Confirmed: full suite is 120/120 when run sequentially with nothing else touching the DB.
