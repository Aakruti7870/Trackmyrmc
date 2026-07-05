---
name: RMC router requireAuth pattern
description: New Express routers that use requireRole must first apply requireAuth, or every request (including authority) 403s.
---

In this server, `requireRole(...)` only checks `req.user.role`; it does NOT authenticate. `req.user` is populated exclusively by `requireAuth` (which verifies the JWT and re-reads the row — including `plantId`, `role` — from the DB, so tokens need only carry id/email/role/name).

Sibling routers (positions.ts, plants.ts, etc.) apply `router.use(requireAuth)` near the top and rely on it. A new router mounted with a bare `app.use('/api', myRouter)` and only per-route `requireRole` guards will 403 EVERYONE — including the intended role — because `requireRole` runs with `req.user === undefined`.

**Why:** the symptom is deceptive: role-negative tests (client/driver expecting 403) still "pass", masking that the allowed role also gets 403. Only the positive-path test catches it.

**How to apply:** any new router using `requireRole` must add `router.use(requireAuth)` before the routes (unless a route is deliberately public, in which case gate that one route individually like plants.ts `/nearby`). Plant-scoping uses `req.user.plantId`, which is only present because requireAuth loads it from the DB.
