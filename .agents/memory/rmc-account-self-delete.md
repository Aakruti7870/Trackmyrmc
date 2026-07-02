---
name: Self-service account deletion
description: How the Play-required self-delete flow works and its guard semantics
---

Self-service account deletion (Google Play requirement) is DELETE /api/me/account:
soft-delete (deletedAt + isActive=false, admin-restorable) + sessionVersion bump +
'user.self_deleted' audit action. Public instructions page is /delete-account
(whitelisted in prod SPA_ROUTES, linked from Privacy §7); UI danger zone lives at
the bottom of ProfileSettings with a type-DELETE confirm.

**Guard semantics:** authority can never self-delete (403); the last remaining
admin that is BOTH non-deleted AND isActive=true cannot self-delete (400) — a
suspended admin must NOT satisfy the lockout guard. Note the older admin route
(DELETE /users/:id) still counts by deletedAt only; if its semantics are ever
touched, align them with the self-delete guard.

**Why:** requireAuth rejects !isActive, so isActive=false is what actually kills
outstanding customer tokens (they carry no sessionVersion); the version bump only
covers staff tokens.

**How to apply:** any new "deactivate/delete account" surface must keep both the
isActive flip and the active-admin lockout count, and Play Console's Data Safety
"deletion URL" field should point at https://trackmyrmc.com/delete-account.
