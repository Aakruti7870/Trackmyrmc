---
name: RMC order/trip test gate breakages
description: Durable root-cause heuristics for the recurring `pnpm test` gate failures in MyOrders/MyTrips suites and a couple of server suites.
---

# Recurring causes of RMC `pnpm test` gate breakages

Heuristics for the failures that keep recurring in the test gate (server
`pnpm test` then rmc-app `pnpm test`). When the gate is red, check these first.

## Server — STANDING baseline failures (fail even in isolation, NOT yours)
- The gate is NO LONGER fully green. As of the on-duty-location work, two
  server suites fail deterministically in isolation, independent of any
  attendance/notification change:
  - `multitenant.isolation.test.ts` — ~8 fails, order-creation returns `400`
    instead of `201` and a query throws `invalid input syntax for type integer:
    "NaN"` (an order/site id is `NaN` somewhere in the create path).
  - `me.sites.test.ts` — 1 fail, same order-creation `400 != 201` family.
  Prove it's not yours by running the named file ALONE; if it still fails and
  you never touched order/site creation, it's this baseline. Don't fix it from
  an unrelated task.

## Server
- Raw pg error-code assertions are fragile: drizzle-orm (>=0.44) wraps every
  failed query in a `DrizzleQueryError` and hangs the real pg `DatabaseError`
  (with `.code`/`.constraint`) off `.cause`. Top-level `e.code` is `undefined`.
  Any test asserting `23505`/constraint names must unwrap `.cause` first.
- `mock.module('../lib/email.js', {namedExports})` must list EVERY export any
  statically-imported consumer needs (e.g. `deliveryNotify.ts` imports
  `sendDeliveryNotificationEmail`; the plants router imports
  `sendOwnerInviteEmail`). A missing one fails ESM instantiation
  ("does not provide an export named …") only in single-file/mocked runs.
- The OTP send/verify limiters in `auth.ts` are UNNAMED, so both share one
  DB-backed `default:<ip>` counter (`rateLimitHits`), max 5/10min. All tests
  hit it from 127.0.0.1, so any OTP test file MUST `db.delete(rateLimitHits)`
  in `beforeEach` or its own send+verify budget is consumed across cases and
  later requests 429 (assertion shows 400 != 200), order-dependently.
- `plants.directory.test.ts` is a STANDING baseline failure (fails even in
  isolation, ~3 of 4 tests): the `/plants/directory` route filters
  `networkStatus='active' AND showOnNetwork=true`, but the test's `createPlant`
  never sets `networkStatus`, which defaults to `'pending'` → directory comes
  back `[]`. Test/logic drift from the MAPPING PLANT networkStatus-lifecycle
  work (route was gated on `networkStatus` but this test wasn't updated; note
  the route uses a raw filter, NOT the `customerVisible()` verified-partner OR
  branch). Unrelated to reviewer-demo/staffAuth changes — don't blame a
  server-side edit that doesn't touch plants.ts for this red gate.

## Frontend — MyOrders
- MyOrders loads several list endpoints (`/me/orders`, `/me/challans`,
  `/me/sites`, `/me/recurring`, `/positions/mine`) plus the object `/me/ledger`.
  `api.get` mocks must default unhandled paths to `[]` and special-case only
  `/me/ledger`, or list loops throw "not iterable". Mirror `MyOrders.tracking`.
- reorder/cancel live on the Orders tab, not Overview — click `Orders (N)` first.
- The order modal has TWO `<select>` comboboxes (grade + SitePicker); target the
  grade one by its "Select grade…" option, never `getByRole('combobox')` alone.

## Frontend — MyTrips
- The delivery modal has TWO number inputs (delivered-quantity +
  "Vehicle odometer reading"). Never use `getByRole('spinbutton')` — it matches
  both. Target the delivered-qty field by its `Planned: … m³` placeholder.

## Frontend — App.cross-tab (pre-existing, fails even in isolation)
- `App.cross-tab.test.tsx > re-gates routes by the new role …` is a STANDING
  baseline failure (reproduces on a clean `HEAD` checkout of `permissions.ts`,
  not caused by role/permission edits). Pages are `lazy()`-loaded with a
  "Loading…" Suspense fallback; the test fires a SYNC storage event
  (`fireStorage`) then asserts `getByTestId('page-my-trips')` synchronously
  without awaiting, so the redirected MyTrips lazy chunk hasn't resolved →
  "Loading…" shown. Location correctly reaches `/my-trips`; only the leaf render
  is unresolved. Don't blame role/permissions changes for this one.

## Frontend — the full-run failure set ROTATES (environmental, not real)
- In the loaded dev environment the rmc-app `pnpm test` gate fails on a small
  (~3-4 of 180) but DIFFERENT set of files each run — one run blames
  MyOrders/App.cross-tab, the next blames Layout.toast/ClientsDrivers/
  Reports.variance. The rotating set is the tell: these are CPU-starved
  `userEvent`/`waitFor` timeouts (dev servers + other agents loading the box),
  not deterministic bugs. Re-run the named file in ISOLATION to confirm it
  passes before "fixing" it. See rmc-frontend-test-flakiness.md.

## ProfileSettings Storage Usage — nested field on async state (fixed)
- A render that reads a *nested* field of async-loaded API state (e.g.
  `storageUsage.byPlant.length`) must guard the nested field, not just the
  parent (`!storageUsage || !storageUsage.byPlant || …`). When a test mocks the
  parent object but omits the array, the fetch resolves AFTER the test body, so
  every assertion passes (`Tests N passed`) yet vitest still exits 1 with an
  `Uncaught Exception` + `Errors 1`. The blamed test is collateral — the crash
  is the unguarded nested read, reproducible by running that file alone.
- **Why:** the TS type marked `byPlant` as always-present, so the guard trusted
  it; partial test mocks (and a defensive real-API contract) break that
  assumption only at runtime, during an async re-render outside any test.

## MyOrders.quick-actions receipt assertion (fixed)
- `downloadDeliveryReceipt(challan, {freeMin, ratePerHour})` takes a SECOND
  pricing arg since idle-charges landed on the receipt. `toHaveBeenCalledWith`
  matches ALL args, so a single-arg assertion silently went stale and failed.
  Assert the 2nd arg with `expect.anything()` (or update it). The feature was
  never broken — only the test lagged the call signature.

**Why:** every one of these breaks because a single-element query (role,
top-level error field, default mock branch) silently assumed there was only one
match; later UI/library growth added a second, turning the query ambiguous or
the assertion stale — or, for the rotating set, the box was simply too loaded
to meet the default timeout. Prefer specific, intent-revealing selectors and
judge a "failure" by whether it reproduces in isolation.
