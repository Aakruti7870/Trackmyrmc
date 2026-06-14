---
name: RMC plant invites (customer onboarding requests)
description: How customer "Request this plant" invites for discovered Google-Places plants are gated and de-duplicated.
---

# RMC plant invites

Customers can flag a discovered (unverified, Google Places) plant from the live
discovery map to ask the business to onboard it. Backed by the `plant_invites`
table; routes live in `server/src/routes/plants.ts`.

## Access gating (deliberate)
- `POST /api/plants/invite` is intentionally open to **any** signed-in user — it
  sits after `router.use(requireAuth)` with **no** ADMIN/role guard, because
  customers (role `client`) submit it from the discovery map. Do not lock it to
  staff.
- `GET /api/plants/invites` and `PATCH /api/plants/invites/:id` are staff-only
  (`ADMIN`).
- The frontend funnels logged-out users to `/register` before posting.

## De-dup rule
- One row per Google `placeId` (uniqueIndex). Repeat requests
  `onConflictDoUpdate` by placeId: bump `requestCount`, refresh
  name/address/contact + `lastRequestedBy*`, keep `firstRequestedBy*`.
- **Why the status CASE matters:** a re-request reopens a `dismissed` invite to
  `pending` (renewed demand) but an `onboarded` one stays onboarded — a plain
  `SET status='pending'` would wrongly resurrect already-handled plants.
- POST returns `{...row, deduped: requestCount > 1}`.
