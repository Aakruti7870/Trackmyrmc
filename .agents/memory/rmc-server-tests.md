---
name: RMC server test harness
description: How automated backend tests run for the Express/Drizzle server.
---

# RMC server test harness

`cd server && pnpm test` runs `scripts/test.mjs`, which:
1. Creates a **uniquely-named per-run** database from `DATABASE_URL` (suffixed with the runner pid + timestamp, e.g. `heliumdb_test_<pid>_<ts>`).
2. Pushes the Drizzle schema to it with `drizzle-kit push --force`.
3. Runs every `src/**/*.test.ts` via `node --import tsx --test` with `DATABASE_URL` pointed at the test DB and `NODE_ENV=test`.
4. Drops the database with `DROP DATABASE ... WITH (FORCE)` in a `finally`.

**Why a per-run DB (not a single shared `<db>_test`):** the validation gate, the `test` workflow, and parallel task environments can all run `pnpm test` *at the same time* against the same base server. Since every suite TRUNCATEs `audit_logs, users, login_attempts` in `beforeEach`, a shared test DB lets concurrent *runs* clobber each other mid-test → flaky duplicate-email inserts, `actor_id not present` FK errors, spurious 401s, and guard-count assertion failures. A fresh per-run DB isolates runs completely. **Symptom that this regressed:** intermittent (not deterministic) failures that pass on a clean re-run. Guards like "last remaining admin" depend on the *global* admin count, so tests must own the whole users table. Never point this at the dev DB.

Tests use `supertest` against a minimal app from `src/test/app.ts` (mounts only the routes under test, e.g. `/api/auth`, `/api/users`, `/api/admin`, `/api/audit-logs`), avoiding the production entrypoint which calls `app.listen`. The pool is exported from `src/db/index.ts` so tests can close it in `after()`. New routes exercised by tests must be added to `buildTestApp`.

**Lockout endpoint quirk:** `clearLockout(key)` deletes ANY row matching the key (active OR expired-but-present) and returns true → 200. `POST /api/admin/lockouts/clear` only returns 404 when no row exists for the key. So an "expired key" returns 404 only after the row was cleaned away/reset; a still-present expired row would clear with 200. Test the 404 path with an unknown/absent key, not a present-expired row.

**Test files within a run MUST still run serially** (`scripts/test.mjs` passes `--test-concurrency=1`). **Why:** every suite TRUNCATEs `audit_logs, users, login_attempts` in `beforeEach` against the run's database, so node:test's default cross-file parallelism would make files clobber each other's rows within the run. Do not remove the flag. (Per-run DB isolation handles cross-*run* concurrency; the flag handles cross-*file* concurrency within one run.)

**Mocking email outcomes:** `lib/email.ts` calls `nodemailer.createTransport` lazily per send. To simulate *sent*/*failed*, set `SMTP_HOST/USER/PASS` env then `mock.method(nodemailer, 'createTransport', …)` returning a fake `{ sendMail }` (resolve = sent, reject = failed). *Skipped* = leave SMTP env unset; `createTransporter()` returns null before touching nodemailer. All three audit as a boolean `emailSent` (failed and skipped both → false).
