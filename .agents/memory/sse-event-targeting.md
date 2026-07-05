---
name: SSE event targeting
description: How live SSE events are scoped per-recipient (client/driver/staff) in the RMC app
---
# SSE event targeting

`emitSSEEvent(event, data, audience?)` scopes delivery. Each connection stores an
`SSEIdentity { role, clientId, driverId }` (set in `/api/events` from the user's
linked client/driver). Audience is `{ clientId?, driverId? }`.

Rule (`clientMayReceive` in `server/src/lib/sseEmitter.ts`):
- **`audience.roles` set → explicit allow-list, overrides everything below**: deliver ONLY to identities whose role is in the list. Use this to reach `authority`, which is NOT in STAFF_ROLES (e.g. admin-only `plant.invite` uses `{ roles: ['admin','authority'] }`).
- staff (admin/dispatcher/plant_operator) → receive everything
- role 'client' → only if `audience.clientId === identity.clientId`
- role 'driver' → only if `audience.driverId === identity.driverId`
- **no audience arg → broadcast to all** (backward compat; used by `vehicle.position`)
- **identity-less connection → wildcard receiver** (test capture clients rely on this)

Gotcha: STAFF_ROLES = {admin, dispatcher, plant_operator} only. `authority` (super-admin) is excluded, so a plain `{}` audience reaches dispatchers/operators but NOT authority — for admin-targeted alerts always use `{ roles: [...] }`.

**Tenant scoping is OPT-IN, not default.** Staff SSE routing is plant-AGNOSTIC by default: any staff-role connection receives every staff-targeted event regardless of plant (REST is plantScope'd, SSE historically is not). To fence a staff event to one plant, pass `audience.plantId`; `clientMayReceive` then drops plant-bound staff of a different plant while a null-plant (platform) staff still receives it. Callers that omit `plantId` keep the legacy broadcast, so only events that opt in are scoped (e.g. `order.pending_approval` from `notifyOrderPendingApproval`). Any NEW staff notification carrying per-plant PII must pass `plantId` or it leaks cross-tenant.

**Why:** order/challan toasts were fanning out to every client/driver, leaking other
companies' activity. Filtering lives server-side so the frontend toast listener needs
no per-event auth check.

**How to apply:** any NEW per-entity SSE event (orders/challans/positions) must pass an
audience or it silently broadcasts to everyone. Order events carry `{ clientId }`;
challan events carry `{ clientId, driverId }`. `vehicle.position` is still an
unscoped broadcast (live-map stream) — scoping it is a known follow-up.
