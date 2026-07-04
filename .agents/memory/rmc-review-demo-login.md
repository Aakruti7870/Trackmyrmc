---
name: App-store reviewer demo login
description: Fixed-code login for Google Play/App Store reviewers on the staff OTP door
---

Google Play / App Store reviewers cannot receive email/SMS OTPs, so ONE staff
account may log in with a FIXED code: env vars `REVIEW_DEMO_EMAIL` +
`REVIEW_DEMO_OTP` (both required, code >= 6 chars, fails closed otherwise).

**Why:** the staff door is provisioned-only passwordless OTP and the customer
door is phone-OTP — with neither, review teams get stuck at the login screen
and reject the app.

**How to apply:** the bypass sits ONLY inside `/staff/otp/verify` (skips the
stored-code check via `isReviewDemoLogin`); `resolveStaffForOtp` (provisioned,
active, staff-role-only — never super admin or customers), the billing gate,
and the session bump all still run. `/staff/otp/send` answers generically for
the demo email without sending anything. Rotate/clear `REVIEW_DEMO_OTP` after
each store review.

**The account must actually EXIST in the target DB.** `resolveStaffForOtp`
runs BEFORE the demo-code bypass and returns the SAME generic 401 ("code is
incorrect or has expired") when the row is missing — so a missing reviewer row
is indistinguishable from a wrong code. This bit hard in prod: the reviewer
existed in DEV (preview worked) but never in PROD, so every live demo login
401'd at account-resolution — NOT the OTP env var / secret (that was a red
herring; the value was fine). The prod DB is read-only to tooling, so the fix
is a boot self-seed `ensureReviewDemoAccount()` (in staffAuth.ts, wired into
index.ts boot next to ensureMasterAccounts/ensurePlantDirectory): fail-closed
(no-op unless the demo cfg is valid), seeds/repairs a PASSWORDLESS, active
`admin` with **plantId null**.

**Why plantId null (platform admin), not plant-bound:** the billing gate at
`/staff/otp/verify` only fires for `user.plantId` set — a platform admin is
never billing-gated, so the reviewer can't be blocked by a suspended/expired
plant subscription. (A plant-bound reviewer WOULD 403 on a blocking status.)

**How to verify a fix reached prod:** it needs a REPUBLISH (the boot seed runs
on the new instance); confirm a fresh boot in deployment logs, then
`POST /api/auth/staff/otp/verify {reviewer email, code}` → 200, role=admin,
plantId=null. Don't trust `viewEnvVars` secret/env readouts to diagnose this.
