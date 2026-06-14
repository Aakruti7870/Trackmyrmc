---
name: RMC discover shared store
description: Plant-discovery rate limit + Places cache are Postgres-backed (cross-instance), and test-app proxy caveat.
---

The `/api/plants/discover` route's rate limiter and Google Places response cache
are backed by Postgres so they hold across multiple server instances.

- `rate_limit_hits` (key `${name}:${ip}`, count, resetAt) — fixed-window counter,
  atomic upsert. The discover limiter is namespaced `discover`.
- `response_cache` (key, jsonb value, expiresAt) — generic shared cache; Places
  entries use key prefix `places:` with coarse coord+radius.

**Why:** in-memory limiter/cache live per Node process; under horizontal scaling
each instance kept its own count (so the limit was effectively multiplied) and
its own cache (so identical nearby queries re-billed Places on each instance).

**How to apply:** both stores fail OPEN — a DB error logs and lets the request
through rather than 500-ing the optional discovery feature. Cleanup of expired
rows is opportunistic (throttled to once per window/TTL).

**Test caveat:** `buildTestApp()` does NOT set `trust proxy`, so
`X-Forwarded-For` cannot change `req.ip` in tests. To test IP-keyed behaviour,
make a real request first and read the row's key back from the DB rather than
predicting the socket address.
