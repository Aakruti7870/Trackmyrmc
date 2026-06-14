---
name: Resolve Google Maps short-links to exact coordinates (no API key)
description: Turn a maps.app.goo.gl share link into a real place name + exact GPS + address without the Maps Platform API.
---

# Google Maps short-link → exact coords (no API key)

Given a `maps.app.goo.gl/...` share link, recover the real place name, exact GPS, and postal address:

1. Follow the redirect to the canonical `/maps/place/...!1s0x<hex>:0x<hex>...` URL; the second hex after `!1s` is the **CID**.
2. Convert that CID hex → decimal and `webFetch` (JS-rendered) `https://www.google.com/maps?cid=<decimal_cid>`.
3. In the returned markdown, the place's **exact coordinates** are the tile params `!1x<lat×1e7>!2x<lng×1e7>` (e.g. `!1x189500644!2x731519836` → 18.9500644, 73.1519836). Divide each by 1e7.
4. The full postal address is a standalone line containing `<State> <pin>, <Country>` (e.g. "…Maharashtra 410221, India").

**Why:** Google's server-rendered HTML and Nominatim only return a generic city-level fallback for these short-links; only the cid page's `!1x/!2x` tile params carry the precise point. The Google Maps Platform MCP here only retrieves docs — it cannot geocode.

**How to apply:** batch the cid fetches with small concurrency (~5); roughly 1 in 30 pages omits `!1x/!2x` (no coords) — fall back to the address locality. India coords are positive lat/lng so no sign handling is needed. Derive a city as the comma-segment just before the `<State>` token (watch for artifacts like a literal "PIN code" segment).
