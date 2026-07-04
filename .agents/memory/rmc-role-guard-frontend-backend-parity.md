---
name: RMC role-guard frontend/backend parity
description: Backend requireRole lists must match frontend ROLE_ALLOWED_PATHS, and any plant-scoped route must reject null-plant non-platform actors.
---

Backend `requireRole(...)` on a staff route must include every role that the
frontend `ROLE_ALLOWED_PATHS` (rmc-app/src/lib/permissions.ts) grants that page,
or those staff hit a 403 the UI never anticipates. This bit plant_owner /
supervisor on `/api/clients` (route only listed admin,dispatcher) even though the
UI shows them the Clients page. `batches.ts` (PRODUCTION_ROLES) and
`attendance.ts` already include plant_owner+supervisor — use them as the
canonical staff-set reference; the outliers (clients, orders, recurring, reports,
vehicles-write, challans-write) are the mismatches.

**Why:** plant owners are usually provisioned as role `admin` (plant-scoped) via
POST /plants/:id/owner (default role 'admin'), so the mismatch only surfaces for
accounts provisioned literally as `plant_owner`/`supervisor`. That masks the bug
in normal testing.

**Critical pairing:** widening a plant-scoped route to plant_owner/supervisor is
unsafe unless the route ALSO rejects an unbound actor. `plantScope(plantId, col)`
returns undefined (→ GLOBAL/unscoped) when plantId is null. That is intended only
for platform staff (`isPlatformStaff` = authority, or admin with plantId null).
A plant-scoped role with plantId null would otherwise read/mutate every plant's
data. Guard with: `if (!isPlatformStaff(actor) && actor.plantId == null) 403`
(userManagement.ts calls this `rejectUnboundActor`).

**How to apply:** when a user reports a 403 on a staff page, diff the route's
requireRole against ROLE_ALLOWED_PATHS for that role; if you widen it, add the
unbound-actor 403 guard in the same change and a regression test (bound role 200
+ scoped, unbound role 403, client role still 403).
