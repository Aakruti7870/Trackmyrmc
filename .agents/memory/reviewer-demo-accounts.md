---
name: Reviewer demo accounts
description: Three Play Store reviewer accounts — phone customer, plant owner, super admin — and the bypass patterns for each auth door.
---

# RMC Reviewer Demo Accounts

## Three accounts in production

| Role | Credential | Login door |
|---|---|---|
| authority (Super Admin) | REVIEW_DEMO_EMAIL + REVIEW_DEMO_PASSWORD → OTP REVIEW_DEMO_OTP | /login → /superadmin/verify |
| plant_owner (Owner) | REVIEW_DEMO_OWNER_EMAIL + REVIEW_DEMO_OWNER_PASSWORD | /login (direct, bypasses passwordless gate) |
| client (Customer/phone) | REVIEW_DEMO_PHONE → OTP REVIEW_DEMO_OTP | /otp/send → /otp/verify |

## Env vars (all in `shared` environment)
- `REVIEW_DEMO_EMAIL` — authority reviewer email
- `REVIEW_DEMO_PASSWORD` — authority reviewer password
- `REVIEW_DEMO_OTP` — fixed OTP used by BOTH authority AND phone (currently `123456`)
- `REVIEW_DEMO_OWNER_EMAIL` — plant_owner reviewer email
- `REVIEW_DEMO_OWNER_PASSWORD` — plant_owner reviewer password
- `REVIEW_DEMO_PHONE` — 10-digit Indian phone, normalises to `+91XXXXXXXXXX`

## Boot self-seed
Both `ensureReviewDemoAccount()` (authority) and `ensureReviewDemoOwnerAccount()` (plant_owner) run at boot via `server/src/index.ts`. Phone login auto-creates a client row on first verified OTP.

## Bypass implementation (server/src/lib/staffAuth.ts + routes/auth.ts)
- **`/login`**: authority path skips OTP send for demo email; plant_owner path bypasses `isPasswordLoginEnabledForRole` guard
- **`/superadmin/verify`**: demo bypass runs BEFORE `isSuperAdminUser` allowlist check — allows test emails (e.g. `reviewer@demo.test`) that aren't in PERMANENT_AUTHORITY_EMAILS to still verify
- **`/otp/send`**: demo phone → returns `{ok:true, sent:true}` without hitting Twilio
- **`/otp/verify`**: demo phone + code → skips `verifyOtp()`, proceeds to normal account resolution

**Why:**
- `isReviewDemoLogin` bypass must come BEFORE `isSuperAdminUser` in `/superadmin/verify` or test emails that aren't in the authority allowlist can never authenticate
- `resolveStaffForOtp` excludes `authority` role, so authority demo accounts can ONLY use `/superadmin/verify`, not `/staff/otp/verify`

## Test isolation
`withDemoEnv` in `staffAuth.test.ts` must include `REVIEW_DEMO_PASSWORD` in `DEMO_ENV_KEYS` so the real workspace secret doesn't bleed into `ensureReviewDemoAccount()` tests (otherwise `passwordHash` is unexpectedly set).
