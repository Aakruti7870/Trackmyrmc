---
name: Account deletion public OTP endpoints
description: /account-deletion page and its public phone-based deletion API — no login required
---

## Rule
`/account-deletion` is a **server-rendered** HTML page (Express `app.get('/account-deletion', ...)` at line ~80 of `server/src/index.ts`) that is served BEFORE the SPA catch-all. It is NOT in `SPA_ROUTES` so the SPA never intercepts it on a fresh page load. It must stay that way.

## Public deletion endpoints (no auth required)
- `POST /api/account-deletion-requests/phone-otp` — takes `{ phone }`, normalises, finds client user, sends OTP. Returns `ok:true` even when phone is not found (enumeration guard). Rate-limited by `account-deletion-otp` limiter (5 per 15min).
- `POST /api/account-deletion-requests/phone-complete` — takes `{ phone, otp, confirmed:true }`, verifies OTP, soft-deletes user + clears push subs + bumps session version. Mirrors the auth-based `/complete` endpoint but resolves identity from the phone number instead of the JWT.

## Auth-based deletion endpoints (requireAuth + client role only)
- `POST /api/account-deletion-requests/otp` — same OTP send, but uses actor from JWT
- `POST /api/account-deletion-requests/complete` — same delete, but uses actor from JWT

## SPA DeleteAccount.tsx
- Logged-in client → `AuthDeleteFlow` (uses the auth-based endpoints)
- Not logged in → `PhoneDeleteFlow` (uses the public phone endpoints)
- Both render at `/account-deletion` AND `/delete-account` routes in `App.tsx`

**Why:** Play Console requires a publicly accessible deletion URL at `trackmyrmc.com/account-deletion`. Users hitting it without a session must be able to delete without logging in first.

**How to apply:** Any new deletion-related feature must not add `requireAuth` to the public phone-otp/phone-complete endpoints. The enumeration guard (always return ok:true on unknown phone) must be preserved.
