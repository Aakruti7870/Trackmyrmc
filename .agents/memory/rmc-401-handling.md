---
name: RMC global 401 handling
description: How the frontend fetch wrapper handles 401s without hijacking login errors
---

# Global 401 handling in the api wrapper

The shared fetch wrapper (`rmc-app/src/lib/api.ts`) treats a 401 as "stored token is
expired/tampered" and clears `rmc_token` + `rmc_user`, then redirects to `/login`.

**Rule:** Only force the logout/redirect when the failed request actually carried a
token (`if (token)`). Otherwise the error message is thrown for the caller to display.

**Why:** The login endpoint itself returns 401 on bad credentials ("Invalid
credentials"). A blanket 401 → clear+redirect handler hijacks that response, masks the
real message, and bounces the user mid-login. Gating on token-presence distinguishes an
authenticated call (real session expiry) from an unauthenticated login attempt.

**How to apply:** Keep the token gate. Also guard the redirect with
`window.location.pathname !== '/login'` to avoid redirect loops. The backend uses 429
(not 401) for lockouts, so those still surface normally.
