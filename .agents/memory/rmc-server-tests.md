---
name: RMC server test harness
description: How automated backend tests run for the Express/Drizzle server.
---

# RMC server test harness

`cd server && pnpm test` runs `scripts/test.mjs`, which:
1. Creates a uniquely-named **template** database from `DATABASE_URL` (suffixed with runner pid + timestamp) and pushes the Drizzle schema to it once with `drizzle-kit push --force`.
2. Shards all `src/**/*.test.ts` round-robin across N parallel **workers** (N = `min(TEST_WORKERS||cpus, fileCount, 6)`). Each worker gets its OWN database created via `CREATE DATABASE <w> TEMPLATE <tmpl>` (a fast file-level copy — avoids re-pushing the schema N times).
3. Runs each worker's file subset in a separate `node --import tsx --test` process with that worker's `DATABASE_URL` and `NODE_ENV=test`. Workers run **at the same time**; files **within** a worker still run serially (`--test-concurrency=1`). Worker output is buffered and printed as a contiguous block on completion so the parallel spec reporters don't interleave.
4. Drops every created database (workers + template) with `DROP DATABASE ... WITH (FORCE)` in a `finally`.

**Template-copy gotcha:** `CREATE DATABASE ... TEMPLATE x` fails with error `55006` ("source database is being accessed by other users") if any session is still on the template. `drizzle-kit push` runs in its own (already-exited) process but its backend can linger, so the runner first issues `pg_terminate_backend(...) WHERE datname=template` before copying.

**Why isolated DBs (not a single shared `<db>_test`):** the validation gate, the `test` workflow, and parallel task environments can all run `pnpm test` *at the same time*; and now workers within one run also run concurrently. Since every suite TRUNCATEs `audit_logs, users, login_attempts` in `beforeEach`, any shared DB lets concurrent runs/workers clobber each other mid-test → flaky duplicate-email inserts, `actor_id not present` FK errors, spurious 401s, and guard-count assertion failures. Per-worker + per-run DBs isolate completely. **Symptom that this regressed:** intermittent (not deterministic) failures that pass on a clean re-run. Guards like "last remaining admin" depend on the *global* admin count, so tests must own the whole users table. Never point this at the dev DB. **Wall-clock:** parallelizing cut a full run from ~7.4 min serial to ~2 min.

Tests use `supertest` against a minimal app from `src/test/app.ts` (mounts only the routes under test, e.g. `/api/auth`, `/api/users`, `/api/admin`, `/api/audit-logs`), avoiding the production entrypoint which calls `app.listen`. The pool is exported from `src/db/index.ts` so tests can close it in `after()`. New routes exercised by tests must be added to `buildTestApp`.

**Lockout endpoint quirk:** `clearLockout(key)` deletes ANY row matching the key (active OR expired-but-present) and returns true → 200. `POST /api/admin/lockouts/clear` only returns 404 when no row exists for the key. So an "expired key" returns 404 only after the row was cleaned away/reset; a still-present expired row would clear with 200. Test the 404 path with an unknown/absent key, not a present-expired row.

**Files within a single worker MUST still run serially** (`scripts/test.mjs` passes `--test-concurrency=1` to each worker process). **Why:** all files in one worker share that worker's database, and every suite TRUNCATEs `audit_logs, users, login_attempts` in `beforeEach`, so node:test's default cross-file parallelism would make same-worker files clobber each other. Do not remove the flag. Cross-*worker* and cross-*run* concurrency is safe because each worker/run owns a separate database — that is what makes the parallelism safe, NOT the flag.

**Mocking email outcomes:** `lib/email.ts` calls `nodemailer.createTransport` lazily per send. To simulate *sent*/*failed*, set `SMTP_HOST/USER/PASS` env then `mock.method(nodemailer, 'createTransport', …)` returning a fake `{ sendMail }` (resolve = sent, reject = failed). *Skipped* = leave SMTP env unset; `createTransporter()` returns null before touching nodemailer. All three audit as a boolean `emailSent` (failed and skipped both → false).
