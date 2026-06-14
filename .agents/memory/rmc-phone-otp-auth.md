---
name: RMC phone-OTP customer auth
description: How customers sign in by phone (WhatsApp OTP) without an email, and the constraints that keep it safe.
---

# Phone-first OTP login (customers)

Customers in the Indian market often have no email, so they authenticate with a
mobile number verified by a one-time code. Staff keep email/password + Clerk SSO.

## Account model — why placeholder emails
The `users` table has `email notNull().unique()` and `passwordHash notNull()`.
Making those nullable has a huge blast radius (~30 test files + many
`user.email.toLowerCase()` call sites). Instead, OTP-only customers get:
- a reserved-domain placeholder email `otp_<digits>@otp.local` (deterministic
  from the E.164 phone so it's stable across re-sends),
- a random unusable bcrypt password hash (they never log in by password),
- the real login key is a new nullable `users.phone` column with a
  **partial unique index on live rows** (`deletedAt IS NULL AND phone IS NOT NULL`),
  so staff/soft-deleted accounts never collide.

**Why:** avoids the nullable-email migration entirely while still giving a unique
login key.

## Two safety rules that are NOT obvious from the code
1. **Reserved domain must be blocked in self-registration.** `@otp.local` is
   rejected by `registerSchema`. Without that, anyone could self-register the
   deterministic placeholder of a target phone number and permanently block that
   number's OTP signup (unique-email insert would fail). The OTP create path also
   catches `23505` and re-reads the live account as a fallback.
2. **Dev fallback must fail CLOSED in production.** `lib/otp.ts` only generates
   local codes when NODE_ENV !== production AND no Twilio creds. In production
   with no provider, `/otp/send` returns an error — returning ok would silently
   lock real users out (they'd wait for a message that never arrives). The
   plaintext `devCode` is returned to the client ONLY in dev mode.

## Provider
Twilio Verify, WhatsApp channel, called via plain `fetch` (no SDK dependency) —
activates automatically when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
TWILIO_VERIFY_SERVICE_SID are set. Until then the dev fallback (hashed code in
`otp_codes` table, 5 attempts/code, 5-min TTL) makes the whole flow testable.
Both rate-limited per IP (send 5/10min, verify 15/10min). Dev verify returns one
generic error for all failure modes to avoid phone-state enumeration.
