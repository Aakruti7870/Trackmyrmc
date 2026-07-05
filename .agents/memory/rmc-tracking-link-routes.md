---
name: RMC customer tracking link routes
description: Two public trip-tracking URL conventions and the three places a new one must be wired
---

The customer live-trip link has TWO path conventions that both render `TrackTrip`:
- `/track-trip/:token` — the CUSTOMER auto-send link (automationJobs trip-share).
- `/track/:token` — a legacy/manual share alias (challans share endpoint).

**Why:** the two link generators (`server/src/lib/automationJobs.ts` vs
`server/src/routes/challans.ts`) emit different base paths, and only `/track` was
originally routed in the SPA — so the customer auto-send link fell through to the
login redirect, silently breaking the no-login flow.

**How to apply:** any new public no-login tracking path must be wired in ALL THREE
places or it 404s / redirects to login in prod:
1. `rmc-app/src/App.tsx` — a `<Route path="/…/:token">` ABOVE `ProtectedRoutes`.
2. `server/src/index.ts` `SPA_PATTERNS` — a regex so prod serves index.html.
3. the link generator(s) — keep the emitted path in sync with the route.
`TrackTrip` reads the token via `useParams<{ token }>()`, so any `:token` route works.
