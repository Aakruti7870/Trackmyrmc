---
name: RMC plant-request notification audience
description: How the new-plant-request (plant.invite) notify audience resolves — roles + extra recipients, SSE timing.
---

The new-plant-request notification (`plant.invite`) audience is config-driven via
`server/src/lib/plantInviteNotify.ts` (settings keys `plant_invite_email_enabled`,
`plant_invite_notify_roles`, `plant_invite_email_recipients`).

**Resolution rule (email):** audience = active users in the chosen `roles`
UNION the explicit `recipients` list. Recipients AUGMENT the role audience, they
do NOT replace it (this changed from the older "recipients replace all-admins"
behaviour). Selectable roles = admin, authority, dispatcher, plant_operator
(client/driver excluded).

**Roles default vs explicit-empty:** the roles setting stored as `null`
(never configured) → defaults to `['admin','authority']`. Stored as `''`
(admin unchecked everything) → `[]` = no role-based audience. `parseRoles`
returns `null` vs `[]` to distinguish; `serializeRoles` writes `''` for empty so
the explicit "none" choice persists instead of reverting to the default.

**Why:** keeps the audience correct as staff come and go without a hand-typed
list; extra recipients cover shared inboxes / external addresses with no account.

**SSE toast is now async + role-scoped.** The `plant.invite` SSE emit moved
INSIDE the fire-and-forget IIFE (it needs the config from a DB read), so it no
longer fires synchronously with the response. Tests must `await flush()` before
asserting on `plant.invite` toast events. The toast targets the chosen roles, but
falls back to admin+authority when roles is empty (so the in-app heads-up is never
silently lost even when email goes only to explicit recipients).
