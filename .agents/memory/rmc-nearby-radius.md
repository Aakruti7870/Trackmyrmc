---
name: RMC customer plant discovery radius
description: How the "Nearby RMC Plants" customer map decides which plants are reachable, and the radius limits on both ends.
---

# RMC nearby-plant discovery is radius-gated

The customer map (`rmc-app/src/pages/NearbyPlants.tsx`) only shows approved + active +
location-verified plants **within a search radius** of the customer's location. The
radius is a user-facing control (default 40km, options 40/80/150/250). If a customer
expects to see plants that exist but don't appear, the cause is almost always the
radius, not the status filter.

**Why:** the metro plant cluster is dense but spread across ~100km (Navi Mumbai → Pune).
A fixed small radius silently drops farther plants. The selector lets the customer widen.

**How to apply:**
- Backend `GET /api/plants/nearby?lat&lng&radius` (server/src/routes/plants.ts) defaults
  radius to 40 and **clamps to 250km max** — it is a public route, so an unbounded
  radius would enumerate the whole directory.
- The status filter (`approved && isActive && locationVerified`) is intentional and
  should NOT be loosened to "show more plants" — widen the radius instead.
- The geolocation loader is a stable `useCallback`; the radius is mirrored in a ref
  (`radiusRef`) so changing it doesn't recreate the loader and re-prompt for location.

## The discoverable plants are REAL, not fabricated

The discovery dataset (`PLT-012`+ in both the live DB and `server/src/db/seed.ts`) are
**real RMC plants** in the Navi Mumbai / Panvel / Raigad belt, sourced from their Google
Maps listings — exact GPS + real postal addresses, names left verbatim (messy casing,
parens, plus-codes in addresses are intentional). `contactNumber`/`gstNo`/`email` are
NULL on purpose (collected at onboarding); they are still `approved + active +
locationVerified` so customers can discover them. Do NOT "tidy" the names/addresses or
invent phone numbers. See `gmaps-shortlink-coords.md` for how the coords were recovered.
The originals `PLT-001..PLT-011` are kept (PLT-001 is the home hub with linked demo data).
