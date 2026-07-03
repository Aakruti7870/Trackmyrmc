---
name: RMC platform-staff vs plant-scoped guard
description: Why every GLOBAL (cross-tenant) staff endpoint needs a platform-staff filter on top of requireRole, not requireRole alone.
---

# Platform-staff guard for global endpoints

`requireRole('authority','admin')` is NOT a tenant boundary. Once plant-scoped
staff exist (role `admin`/`plant_owner` with `plantId != null`), they satisfy
`requireRole('admin')` and silently inherit every GLOBAL admin endpoint —
cross-tenant escalation.

**Rule:** any endpoint that operates across ALL tenants (the global user console
`/api/users`, and the global plant directory/invite/create/edit/delete routes in
`/api/plants`) must layer an extra `isPlatformStaff` filter:
`actor.role === 'authority' || (actor.role === 'admin' && actor.plantId == null)`.
Plant-scoped staff manage their own team only via `/api/plants/:id/owner`
(own-plant + role-hierarchy + per-plant-cap enforced in-handler).

**Why:** legacy global admins were created before plants existed, so they have
`plantId == null` — the `== null` check keeps them (and authority) working while
locking out newly-provisioned plant-scoped admins. This is the backward-compatible
seam.

**How to apply:** when adding ANY new global/cross-tenant staff route, add the
platform-staff middleware (a 403 RequestHandler) AFTER `requireRole`, not in place
of it. `isPlatformStaff` is currently duplicated in both `routes/users.ts` and
`routes/plants.ts`; keep the two definitions identical if you touch either.

## Per-plant role caps must be atomic
`POST /api/plants/:id/owner` enforces per-plant role limits by count-then-insert.
That is a TOCTOU race: two concurrent provisions both read `held < limit` and
both insert, busting the cap. Wrap the count + email-existence check + insert in a
`db.transaction` that first takes a row lock on the plant
(`select(...).from(plants).where(eq(id)).for('update')`); concurrent provisioners
for the same plant serialize behind it. Hash the password BEFORE the transaction
so the lock isn't held during bcrypt. Regression test: fire two cap=1 provisions
with `Promise.all` and assert statuses sort to `[201, 409]`.

Unbound-actor rule: a null scope has two opposite meanings — "platform staff,
see everything" vs "plant-scoped actor with a missing plant binding". Any
scoping helper that returns `null` for platform staff MUST separately reject
non-platform actors whose `plantId` is null (403), or a misprovisioned
plant_owner/admin row silently becomes globally unrestricted. Regression test:
create a `plant_owner` with `plantId: null` and assert every plant/user
endpoint answers 403 (and list endpoints return empty, never global data).
