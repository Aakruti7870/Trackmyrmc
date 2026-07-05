---
name: RMC router requireAuth pattern
description: New Express routers that use requireRole must first apply requireAuth, or every request (including authority) 403s.
---

In this server, `requireRole(...)` only checks `req.user.role`; it does NOT authenticate. `req.user` is populated exclusively by `requireAuth` (which verifies the JWT and re-reads the row — including `plantId`, `role` — from the DB, so tokens need only carry id/email/role/name).

Sibling routers (positions.ts, plants.ts, etc.) apply `router.use(requireAuth)` near the top and rely on it. A new router mounted with a bare `app.use('/api', myRouter)` and only per-route `requireRole` guards will 403 EVERYONE — including the intended role — because `requireRole` runs with `req.user === undefined`.

**Why:** the symptom is deceptive: role-negative tests (client/driver expecting 403) still "pass", masking that the allowed role also gets 403. Only the positive-path test catches it.

**How to apply:** a router using `requireRole` needs requireAuth to run first. HOW you attach it depends on the mount prefix:
- A router mounted at a SPECIFIC prefix (e.g. `/api/positions`) can safely use `router.use(requireAuth)`.
- A router mounted at the BROAD `/api` prefix (maps.ts is `app.use('/api', mapsRoutes)`) must NOT use `router.use(requireAuth)` — it would run for EVERY `/api/*` request and 401 public routes mounted after it (webhooks, whatsapp) before they reach their own routers. Attach requireAuth PER-ROUTE instead: `router.get('/x', requireAuth, requireRole(...), h)`, so it only runs when the path matches.

**Why the broad-mount trap is nasty:** a `/api`-prefixed router intercepts ALL `/api/*` paths; its no-path `router.use` middleware fires before the route-match/next() pass-through, so it breaks unrelated sibling routers. The maps tests stayed green (their own paths still authed); the failures surfaced in whatsapp.webhook/chat suites (401 instead of 204/403).

Plant-scoping uses `req.user.plantId`, which is only present because requireAuth loads it from the DB.
