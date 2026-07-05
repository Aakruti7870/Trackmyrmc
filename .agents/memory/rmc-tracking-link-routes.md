---
name: RMC customer tracking link route
description: The single public trip-tracking URL convention and the places it must stay in sync
---

The customer live-trip link uses ONE path convention: `/track/:token`, which
renders `TrackTrip` (reads the token via `useParams<{ token }>()`).

Both link generators emit this same path:
- `server/src/lib/automationJobs.ts` (tripShare auto-send — email + web push).
- `server/src/routes/challans.ts` (manual share endpoint).

**Why:** a prior change gratuitously renamed the auto-send link to `/track-trip/`,
which had no App.tsx route (so the no-login link fell through to the login
redirect) AND broke `server/src/test/automations.tripShare.test.ts`, which asserts
the share URL matches `/track/[48-hex]`. That test is the source of truth — keep
the auto-send on `/track/`.

**How to apply:** any change to the public tracking path must move in lockstep
across ALL of:
1. `rmc-app/src/App.tsx` — a `<Route path="/track/:token">` ABOVE `ProtectedRoutes`.
2. `server/src/index.ts` `SPA_PATTERNS` — a regex so prod serves index.html.
3. both link generators (automationJobs + challans).
4. `automations.tripShare.test.ts`'s asserted URL shape.
Do NOT introduce a second alias path without updating every one of these.
