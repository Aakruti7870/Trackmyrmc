---
name: RMC phone→client identity boundary
description: Phone-verified login (Twilio OTP or Clerk SMS) must resolve to client-role accounts only; staff/email is the separate path.
---

Phone identity (a verified mobile number, whether verified by Twilio OTP or by
Clerk's SMS one-time code) maps to **customer/client-role accounts only**. The
shared resolver `resolveCustomerByPhone` must refuse (403) any existing live
account whose role is not `client`, never sign a token for it.

**Why:** Staff authenticate by email/Google SSO (the staff SSO path only ever
resolves staff roles); the phone path is its dual. Driver accounts in particular
*can* carry a number, so a role-agnostic phone→user lookup would let a phone
sign-in mint a driver/staff token — a privilege-boundary bypass. (Staff/driver
users created via the admin /users route never populate `users.phone`; only
client creation + /register set it, so the role filter is safe defense-in-depth.)

**How to apply:** Any new phone-based auth entry point (e.g. POST
/auth/clerk/customer, /auth/otp/verify) must go through `resolveCustomerByPhone`
and inherit its client-only guard — do not re-implement an inline phone→user
lookup. Clerk customer exchange additionally requires the *verified primary*
phone (cu.primaryPhoneNumberId + verification.status==='verified') and signs out
the Clerk session if the server exchange fails, to avoid a half-authenticated
state. Clerk dashboard prereq (user-side): enable Phone for both sign-in AND
sign-up.
