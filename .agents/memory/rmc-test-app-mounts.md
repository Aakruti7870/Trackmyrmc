---
name: RMC test app route mounts
description: Server tests run against a separate minimal Express app that only mounts a subset of routers; new routes need mounting there too.
---

The server test suite (`server/scripts/test.mjs`) builds its app via
`buildTestApp()` in `server/src/test/app.ts`, NOT the production `src/index.ts`.
This avoids `app.listen` and background intervals, but it means the test app
only mounts the routers explicitly listed there.

**Rule:** When you add a route to a router that isn't yet mounted in
`server/src/test/app.ts` (e.g. a new `/api/reports/...` endpoint while only
admin/users/challans/etc. were mounted), any test hitting it gets a 404. Mount
the router in `buildTestApp()` to match production before writing the test.

**Why:** A `/api/reports/variance-tolerance` test failed 404!==200 purely
because `reportRoutes` wasn't mounted in the test app, even though production
mounted it at `/api/reports`.

**Also note:** `pnpm test` is not green on baseline — `challans.driver.test.ts`
(proof-photo assertions expecting base64 but receiving `/objects/` paths) and
`users.audit.test.ts` (`/api/users/audit-log` returning 404) fail independently
of unrelated changes. Don't be alarmed by those 7 failures.
