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
the demo email without sending anything. The demo account must be bound to a
plant whose subscription is trial/active or the billing gate 403s the
reviewer. Rotate/clear `REVIEW_DEMO_OTP` after each store review.
