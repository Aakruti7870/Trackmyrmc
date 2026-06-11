---
name: Leaflet markers under Vite
description: Why Leaflet default marker icons break in the bundled rmc-app and how maps are set up
---

# Leaflet + react-leaflet in rmc-app

The customer maps (site pin-picker, live delivery tracking) use **Leaflet + react-leaflet v5 + free OpenStreetMap tiles + Nominatim geocoding** — no API key, user-confirmed free stack.

## Default marker icons break under bundling
Leaflet resolves its default marker PNGs relative to its CSS, which Vite rewrites/hashes, so markers render blank. Fix: build an explicit `L.icon({...})` (or `L.divIcon`) with absolute icon URLs (we point at the `unpkg.com/leaflet@1.9.4/dist/images/*` CDN copies) instead of relying on the default icon.
**Why:** the "missing marker" symptom looks like a data bug but is purely an asset-path bug.
**How to apply:** any new Leaflet map/marker must supply its own `icon=` — never assume the default marker works.

## Other conventions
- Import `'leaflet/dist/leaflet.css'` inside each map component.
- Recenter/fit-bounds via child components using `useMap()` in an effect, not by re-mounting `<MapContainer>` (re-mount tears down tiles and loses zoom).
- Nominatim search is best-effort and rate-limited; always allow manual pin-drop as the fallback.
