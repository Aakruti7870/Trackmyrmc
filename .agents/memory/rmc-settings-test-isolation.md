---
name: app_settings test isolation
description: Why settings-based server tests must truncate app_settings between tests
---
The `app_settings` table backs all admin-panel settings (SMTP, variance, idle,
freshness, fuel, plant-invite notifications) via the key/value store in
`server/src/lib/settings.ts`.

**Rule:** any server test that POSTs to an admin settings route must include
`app_settings` in its `beforeEach` TRUNCATE, e.g.
`TRUNCATE TABLE plant_invites, users, app_settings RESTART IDENTITY CASCADE`.

**Why:** test files normally truncate only the domain tables they touch
(users, plant_invites, …). `app_settings` is not domain data, so it is easy to
forget — but settings persist in the DB across tests in the same file. A test
that disables a toggle or sets a recipient list will silently change the
default-config assumptions of every later test in the file (e.g. a "default
sends to all admins" test fails because an earlier test left the email
disabled).

**How to apply:** when adding tests that exercise a setting, add app_settings
to the truncate list rather than resetting individual keys; it is cheaper and
removes the ordering hazard entirely.

**Same hazard, cross-FILE:** `response_cache` and `rate_limit_hits` (the
Postgres-backed discover cache/rate-limit stores) survive across test files
sharing a worker DB — a file that seeds a cache row (e.g. the shared-store
suite) can poison a later file whose query coords hash to the same
`lat.toFixed(2),lng.toFixed(2),radius` cache key, producing an
order-dependent flake. Any suite exercising /plants/discover must TRUNCATE
both tables in its own beforeEach; never rely on another file's cleanup.
