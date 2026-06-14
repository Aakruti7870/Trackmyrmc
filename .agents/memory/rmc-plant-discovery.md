---
name: RMC live plant discovery
description: How the "Nearby RMC Plants" map surfaces real-world unverified plants via Google Places, and the key/format gotchas.
---

# Live plant discovery (Google Places)

Public endpoint `GET /api/plants/discover?lat&lng&radius` returns real-world concrete
plants from Google **Places API (New)** Text Search (`places:searchText`), distinct from
the onboarded directory served by `/plants/nearby`. Discovered rows carry `source:'discovered'`
and a `placeId`; the client renders them as dimmed "unverified / not yet onboarded" leads
(no Place Order CTA).

**Why it can look broken even when the code is right:**
- The Places call needs `GOOGLE_PLACES_API_KEY` (or `GOOGLE_MAPS_API_KEY`). Missing ⇒ route
  soft-fails `503 {configured:false}` and the client silently hides the section. This is
  intentional — discovery is optional and must never block `/nearby`.
- A wrong/truncated key returns HTTP 400 `API_KEY_INVALID` from `places.googleapis.com`.
  **A valid Google Maps key is ~39 chars and starts with `AIza`** — a 24-char value is the
  classic "user pasted the wrong thing" symptom. Also requires: Places API (New) *enabled*,
  billing on, and the key **not** restricted to HTTP referrers (server-side calls need an
  unrestricted or IP-restricted key).

**Design constraints baked in:**
- Calls are server-side only; key never reaches the browser.
- Per-IP rate limit (`lib/rateLimit.ts`, 20/min) + 5-min in-memory response cache keyed by
  coarse coords+radius, because Places bills per request and per field category (keep the
  `X-Goog-FieldMask` tight).
- Text Search circle `locationBias` caps at 50km; we still post-filter by the caller's true
  radius (up to 250km) with haversine, and drop leads within ~150m of an onboarded approved
  plant to avoid showing a partner twice.

**Testing:** `plants.discover.test.ts` mocks `global.fetch` via `node:test` `mock.method`
(not module mocks) and sets/clears `GOOGLE_PLACES_API_KEY` per case; vary the query coords
between cases or the in-module response cache returns a stale empty list.
