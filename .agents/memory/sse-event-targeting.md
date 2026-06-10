---
name: SSE event targeting
description: How live SSE events are scoped per-recipient (client/driver/staff) in the RMC app
---
# SSE event targeting

`emitSSEEvent(event, data, audience?)` scopes delivery. Each connection stores an
`SSEIdentity { role, clientId, driverId }` (set in `/api/events` from the user's
linked client/driver). Audience is `{ clientId?, driverId? }`.

Rule (`clientMayReceive` in `server/src/lib/sseEmitter.ts`):
- staff (admin/dispatcher/plant_operator) → receive everything
- role 'client' → only if `audience.clientId === identity.clientId`
- role 'driver' → only if `audience.driverId === identity.driverId`
- **no audience arg → broadcast to all** (backward compat; used by `vehicle.position`)
- **identity-less connection → wildcard receiver** (test capture clients rely on this)

**Why:** order/challan toasts were fanning out to every client/driver, leaking other
companies' activity. Filtering lives server-side so the frontend toast listener needs
no per-event auth check.

**How to apply:** any NEW per-entity SSE event (orders/challans/positions) must pass an
audience or it silently broadcasts to everyone. Order events carry `{ clientId }`;
challan events carry `{ clientId, driverId }`. `vehicle.position` is still an
unscoped broadcast (live-map stream) — scoping it is a known follow-up.
