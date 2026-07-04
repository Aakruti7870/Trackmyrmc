---
name: RMC phone→client identity boundary
description: Phone-verified login (Twilio OTP or Clerk SMS) must resolve to client-role accounts only; staff/email is the separate path.
---

Phone identity (a verified mobile number, whether verified by Twilio OTP or by
Clerk's SMS one-time code) maps to **client-role OR driver-role accounts only**.
The shared resolver `resolveCustomerByPhone` must refuse (403) any existing live
account whose role is not `client`, never sign a token for it. Driver login is a
SEPARATE, higher-priority resolver (`resolveDriverByPhone`) that runs BEFORE the
customer resolver in `/auth/otp/verify`.

**Why:** Staff authenticate by email/Google SSO (the staff SSO path only ever
resolves staff roles); the phone path is its dual. `driver` is the lowest-
privilege staff role, so phone login is intentionally allowed for it — but ONLY
by matching the staff-provisioned `drivers` table (active row, last-10-digit
match), never by a role-agnostic phone→user lookup. It must never mint
admin/authority/dispatcher via phone. A phone that maps to BOTH an active driver
and an existing client resolves to the DRIVER (driver-first precedence). Note:
admin-created driver users keep `users.phone` NULL by design, so the driver
resolver matches on the raw `drivers.phone` column, not `users.phone`; the
customer resolver's role filter stays as defense-in-depth.

**How to apply:** Any new phone-based auth entry point (e.g. POST
/auth/clerk/customer, /auth/otp/verify) must go through the shared resolvers and
inherit their guards — do not re-implement an inline phone→user lookup. Order in
`/auth/otp/verify`: `resolveDriverByPhone` first (active-driver, client-priority
override), then `resolveCustomerByPhone` (client-only guard). Clerk customer exchange additionally requires the *verified primary*
phone (cu.primaryPhoneNumberId + verification.status==='verified') and signs out
the Clerk session if the server exchange fails, to avoid a half-authenticated
state. Clerk dashboard prereq (user-side): enable Phone for both sign-in AND
sign-up.
