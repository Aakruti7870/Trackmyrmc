---
name: RMC Nearby remembered location
description: NearbyPlants remembers last confirmed coords + radius in localStorage; bootstrap defers setState.
---
Returning customers skip the GPS prompt: NearbyPlants persists the last confirmed
location + radius under localStorage key `rmc_nearby_location` and reuses it on mount.

**Rule:** the mount bootstrap that loads a saved location must defer its setState
through `Promise.resolve().then(...)` (same as `requestLocation`), never set state
synchronously in the effect — react-hooks set-state-in-effect is an ERROR here.

**Why:** loaders in this app are non-async promise-chains specifically to satisfy
the eslint react-hooks purity rule; a sync `setCoords`/`loadPlants` in the effect
would fail lint/validation.

**How to apply:** `readSavedLocation()` validates lat/lng finite and clamps an
unknown radius back to DEFAULT (only RADIUS_OPTIONS honoured); `saveLocation()` is
called at the START of `loadPlants` (coords are user-confirmed, persist even if the
fetch fails). First-time/corrupt-value visitors fall back to the GPS prompt.
