---
name: RMC test baseline failures
description: Known pre-existing test failures in `pnpm test` (server + frontend) unrelated to feature work — don't chase them.
---

# Pre-existing failing tests (baseline)

Running the `test` validation (server `pnpm test` then rmc-app `pnpm test`) currently
has failures that exist independent of feature work. Do NOT assume your change caused
them — verify they touch your changed surface first.

## Server (7 failures)
- `src/test/users.linkUnique.db.test.ts` — 6 tests expect a 23505 unique-violation that the DB no longer raises (partial-index expectations drifted from schema).
- `src/test/users.welcome-email.test.ts` — module load fails: `email.js` does not export `sendDeliveryNotificationEmail` (imported by `deliveryNotify.ts`).

## Frontend (6 failures, 2 files)
- `src/pages/MyOrders.place-order.test.tsx` and `src/pages/MyOrders.quick-actions.test.tsx`.
- Root cause: `MyOrders.tsx` seeds live positions via `api.get('/positions/mine')` then `for (const p of list)`. These tests' default `api.get` mock branch returns a non-array `{entries:[],...}` for unhandled paths, so the loop throws `list is not iterable`.
- Fix when in scope: make those mocks return `[]` for `/positions/mine` (mirror `MyOrders.tracking.test.tsx`, which handles it).

**Why:** a type-only change (e.g. editing a TS interface in `api.ts`) can never cause a
runtime "not iterable" error — types are erased. If you see these exact failures after a
type/UI change that doesn't touch MyOrders or those users tests, they're baseline, not yours.
