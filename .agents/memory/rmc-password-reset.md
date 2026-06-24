---
name: RMC password reset vs invite tokens
description: Why forgot-password reuses the invite-token machinery but must NOT reuse its reactivation/origin semantics.
---

Self-service password reset (`/api/auth/forgot-password` → emailed `/set-password?token=` → `/auth/set-password`) shares the `password_setup_tokens` table and redeem path with owner invites, distinguished by a `kind` column (`invite` | `reset`).

**Rule 1 — reset link origin is trusted-config-only.**
Build the reset URL from `APP_URL`/`PUBLIC_URL` (dev fallback `REPLIT_DEV_DOMAIN`), NEVER from `Host`/`X-Forwarded-Host`.
**Why:** forgot-password is unauthenticated; an attacker can forge the Host header so the victim's email points at an attacker domain → token exfiltration → account takeover. Owner-invite is staff-triggered so its header-derived origin was lower risk, but reset is not.
**How to apply:** any unauthenticated flow that emails a link to a *third party* must pin origin to config, not request headers.

**Rule 2 — reset must never reactivate.**
Invite redeem sets `isActive=true` (onboarding). Reset redeem must leave `isActive` untouched and reject (`reason:'disabled'`, HTTP 403) a suspended/deleted account. forgot-password also only ISSUES a reset token for already-active, non-deleted, non-`@otp.local` users; redeem re-locks the user row to also catch active→suspended races.
**Why:** reusing invite semantics let a suspended user self-unsuspend by resetting their password — an authz bypass of admin suspension.
**How to apply:** when two flows share a redeem path, branch reactivation/authz on a token `kind`, don't assume one flow's side effects are safe for the other.

Generic anti-enumeration response (same 200 JSON for missing/malformed/suspended emails). Regression tests: `server/src/test/forgot-password.test.ts`.
