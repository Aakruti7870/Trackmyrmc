---
name: RMC last-admin delete guard
description: Why the "last remaining admin" guard on DELETE /api/users/:id is effectively unreachable via normal API flow, and how to test it.
---

# Last-admin delete guard reachability

The soft-delete route checks guards in this order: self-delete → 404 (missing/already-deleted) → last-admin.

The last-admin branch (`activeAdmins <= 1`) is **practically unreachable through the real API**: the actor must be an active admin (counted), and to avoid the self-delete guard the target must be a *different* active admin — which forces the active-admin count to ≥2. So the guard never fires with realistic data; the sole-admin case is shadowed by the self-delete guard instead.

**How to test it anyway:** make the actor an admin row with `deletedAt` set (excluded from the admin count) but `isActive: true` (so `requireAuth`, which only checks `isActive`, still accepts it). Sign its JWT directly with `signToken` — `/auth/login` rejects `deletedAt` rows so you cannot log in as it. Then have it delete the one remaining counted admin → 400 "last remaining admin".

**Why this matters:** `requireAuth` checks only `isActive`, not `deletedAt`. If that ever changes (also rejecting `deletedAt`), the last-admin test setup breaks and must be reworked.

The purge guard (`DELETE /:id/permanent`) counts admins with `id != target` (any `deletedAt`), so it is also unreachable via a real browser session: blocking needs the target to be the *only* admin record, which can't be both soft-deleted and logged-in. Both guards are server-side defensive checks.

**UI coverage:** because neither guard is reachable through a normal login without destructive global-admin mutations, cover the *UI surfacing* (does the error toast appear / is the row kept?) with a vitest component test that mocks `@/lib/api` to reject `api.delete` with an `ApiError(…, 400)` and asserts the toast + that the admin stays listed — not a Playwright e2e. The guard *logic* stays covered by the server `node:test` suite. See `rmc-app/src/pages/Users.lastAdmin.test.tsx`.
