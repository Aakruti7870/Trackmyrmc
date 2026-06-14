---
name: RMC lead vs verified plant onboarding
description: How seeded "lead" plants are distinguished from customer-visible partners and how owner logins are provisioned.
---

The plants table has TWO independent flags:
- `locationVerified` — only attests the GPS pin is correct.
- `verified` — the plant is a fully onboarded partner. This is the customer-visibility gate.

**Rule:** customer-facing `/plants/nearby` requires `approved && isActive && locationVerified && verified`. A plant is a "lead" purely when `verified=false`, regardless of approval/active/pin state. Onboarding leads (the ~32 seeded PLT-012..045 rows) must never reach customers even though they are seeded approved+active+locationVerified.

**Why:** seeded leads have real GPS but null contact / no GST / no legal name; showing them would mislead customers into ordering from unconfirmed plants.

**Owner provisioning:** `POST /plants/:id/owner` creates a plant-scoped user (sets `plantId`, default role `admin` = owner; also dispatcher/plant_operator). Tenancy hard-scopes everything by `plantId`. Duplicate email → 409 (distinguishes soft-deleted vs live). Writes a `user.created` audit log and calls sendWelcomeEmail (best-effort; returns `emailSent`).

**ownerCount** on `GET /plants` comes from a grouped count of live (deletedAt IS NULL) users per plantId — soft-deleted owners are excluded.

**How to apply:** when adding any new customer-facing plant query, append the same `verified` filter. When backfilling an existing dev/prod DB after adding the column, set `verified=true` only for the genuine partner rows (seed PLT-001..009 + PLT-011) by plantCode — everything else stays a lead.
