---
name: RMC lead vs verified plant onboarding
description: How seeded "lead" plants are distinguished from customer-visible partners and how owner logins are provisioned.
---

The plants table has TWO independent flags:
- `locationVerified` — only attests the GPS pin is correct.
- `verified` — the plant is a fully onboarded partner. This is the customer-visibility gate.

**Rule:** customer-facing `/plants/nearby` requires `approved && isActive && locationVerified && verified` AND is login-only (requireAuth). A plant is a "lead" purely when `verified=false`, regardless of approval/active/pin state.

**Product policy change:** the real seeded discovery plants (PLT-012..045) are NOW marked `verified=true` in both seed.ts and the live DB so logged-in customers actually discover them via GPS. They were previously kept as hidden leads, but that left 0 customer-visible plants, which broke the whole discovery flow. Genuine partners (PLT-001..009, 011) are also verified. Their `contactNumber`/`gstNo`/`legalName` stay null until staff finish onboarding — visibility no longer waits on those fields.

**Why:** the `verified` gate was added (Task #294) to hide un-onboarded leads, but the entire seeded dataset defaulted to `verified=false`, so customers saw nothing. The product owner explicitly wants all real nearby plants shown to logged-in customers, so visibility wins over withholding incomplete company details.

**Owner provisioning:** `POST /plants/:id/owner` creates a plant-scoped user (sets `plantId`, default role `admin` = owner; also dispatcher/plant_operator). Tenancy hard-scopes everything by `plantId`. Duplicate email → 409 (distinguishes soft-deleted vs live). Writes a `user.created` audit log and calls sendWelcomeEmail (best-effort; returns `emailSent`).

**ownerCount** on `GET /plants` comes from a grouped count of live (deletedAt IS NULL) users per plantId — soft-deleted owners are excluded.

**How to apply:** when adding any new customer-facing plant query, append the same `verified` filter. When backfilling an existing dev/prod DB after adding the column, set `verified=true` only for the genuine partner rows (seed PLT-001..009 + PLT-011) by plantCode — everything else stays a lead.
