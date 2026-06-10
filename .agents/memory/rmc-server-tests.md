---
name: RMC server test harness
description: How automated backend tests run for the Express/Drizzle server.
---

# RMC server test harness

`cd server && pnpm test` runs `scripts/test.mjs`, which:
1. Derives a `<db>_test` database name from `DATABASE_URL`, creating it if absent (CREATE DATABASE is permitted on the Replit Postgres).
2. Pushes the Drizzle schema to it with `drizzle-kit push --force`.
3. Runs every `src/**/*.test.ts` via `node --import tsx --test` with `DATABASE_URL` pointed at the test DB and `NODE_ENV=test`.

**Why a dedicated DB:** guards like "last remaining admin" depend on the *global* admin count, so tests must own the whole users table — they truncate `audit_logs, users, login_attempts` in `beforeEach`. Never point this at the dev DB.

Tests use `supertest` against a minimal app from `src/test/app.ts` (mounts only the routes under test, e.g. `/api/auth`, `/api/users`, `/api/admin`, `/api/audit-logs`), avoiding the production entrypoint which calls `app.listen`. The pool is exported from `src/db/index.ts` so tests can close it in `after()`. New routes exercised by tests must be added to `buildTestApp`.

**Test files MUST run serially** (`scripts/test.mjs` passes `--test-concurrency=1`). **Why:** every suite TRUNCATEs the shared `audit_logs, users, login_attempts` tables in `beforeEach` against the *single* shared test DB, so node:test's default cross-file parallelism makes files clobber each other's rows (duplicate-email inserts, spurious 401s, flaky guard-count failures). With one test file this never showed up; adding a second surfaced it. Do not remove the flag.
