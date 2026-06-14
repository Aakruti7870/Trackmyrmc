---
name: RMC order/trip test gate breakages
description: Durable root-cause heuristics for the recurring `pnpm test` gate failures in MyOrders/MyTrips suites and a couple of server suites.
---

# Recurring causes of RMC `pnpm test` gate breakages

Heuristics for the failures that keep recurring in the test gate (server
`pnpm test` then rmc-app `pnpm test`). When the gate is red, check these first.

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

**Why:** every one of these breaks because a single-element query (role,
top-level error field, default mock branch) silently assumed there was only one
match; later UI/library growth added a second, turning the query ambiguous or
the assertion stale. Prefer specific, intent-revealing selectors.
