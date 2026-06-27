---
name: RMC staff passwordless + super-admin 2FA
description: How provisioned-only passwordless staff/owner login and super-admin 2FA work, and the billing-gate invariant across both auth doors.
---

# Staff/owner passwordless auth + Super Admin 2FA

Staff/owners (every non-`authority`, non-customer role incl. `accountant`) log in
PASSWORDLESS: `POST /auth/staff/otp/send` then `/auth/staff/otp/verify` (email via
SMTP, or WhatsApp when a phone is on file). The legacy password `/auth/login` for a
non-client staff/owner now returns **403 `{useOtp:true}`** — do not assert a token
there. Accounts are PROVISIONED-ONLY: send/verify resolve EXISTING staff via
`resolveStaffForOtp` and never auto-create.

Super Admin (`authority`) keeps password + a MANDATORY second factor: `/auth/login`
validates password + allow-list, then SENDS a code and returns **502 with no token
if no delivery channel is configured** — the super-admin path has NO dev-code
fallback (the highest-priv account must use a real channel). The 2FA is completed at
`/auth/superadmin/verify {email,code}`.

**Billing-gate invariant (the easy bug):** the subscription/suspended-plant gate
must exist on BOTH the password `/login` path AND `/auth/staff/otp/verify`. The OTP
verify gate sits AFTER code verification (post-identity), so a *wrong* code returns
the generic 401 `That code is incorrect or has expired…` and must NOT leak billing
state (`subscriptionBlocked` only appears once a VALID code proves possession). Miss
the OTP-side gate and suspended-plant staff bypass billing via the code door.

Single active session: every successful login bumps `users.sessionVersion`; the JWT
embeds it and `requireAuth` rejects a stale version → a second login elsewhere 401s
the first. Customer phone-OTP / Clerk auth is UNCHANGED by all of this.

**Why:** these gates and the 502-no-fallback are security boundaries, not UX
choices; tests that "fix" a 502/403 into a 200 are silencing the boundary.

**How to apply:** when touching any staff/super-admin login test, mirror
`staffAuth.test.ts`: seed `staffOtpCodes {userId,codeHash:hashOtpCode(code),...}`
(onConflictDoUpdate target userId) then POST the relevant verify route; expect 502
(not 200) on the super-admin first factor when delivery env is stripped.
