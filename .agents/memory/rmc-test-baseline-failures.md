---
name: RMC order/trip test gate breakages
description: Durable root-cause heuristics for recurring pnpm test gate failures. All server/frontend files now pass in isolation as of the July 2026 lint-fix cycle.
---

# Recurring causes of RMC `pnpm test` gate breakages

Heuristics for failures that keep recurring in the test gate (server
`pnpm test` then rmc-app `pnpm test`). When the gate is red, check these first.

## Status — all suites pass in isolation (July 2026)

The suites below were formerly listed as standing failures; they now pass:
- `multitenant.isolation.test.ts` ✓ (32 pass)
- `me.sites.test.ts` ✓ (10 pass)
- `plants.directory.test.ts` ✓ (4 pass)
- `kyc.test.ts` ✓ — was asserting the internal DB enum value `'unverified'`
  after the `/kyc/status` route was updated to map it to the spec-aligned API
  value `'not_started'`. Fix: assert `'not_started'` in the test.
- `Landing.test.tsx` ✓ — was testing the old three-tab LandingScreen UI after
  the component was simplified to a SplashScreen→Redirect-to-/login flow. Fix:
  rewrite tests to cover the simplified behavior; mock SplashScreen to avoid
  animation timers.
- `App.cross-tab.test.tsx` ✓ (3 pass) — was failing due to lazy-route async
  resolution; now passes (may be timing-sensitive).

## Watch out for: KYC status API enum vs DB enum

The `/api/kyc/status` route maps the internal DB value `'unverified'` to the
public API value `'not_started'` (see `server/src/routes/kyc.ts` ~line 175).
Any new test asserting KYC status for a fresh (never-started) user must
expect `'not_started'`, not `'unverified'`.

## Watch out for: Landing component was simplified

`rmc-app/src/pages/Landing.tsx` no longer renders the multi-tab LandingScreen.
It only shows SplashScreen (once per session) then redirects to `/login`. Tests
for Landing MUST mock `@/components/SplashScreen` (to avoid animation timers)
and test the two branches: splash-not-seen → SplashScreen; splash-seen →
Redirect.

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

## Frontend — the full-run failure set ROTATES (environmental, not real)

In the loaded dev environment the rmc-app `pnpm test` gate can fail on a small
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
