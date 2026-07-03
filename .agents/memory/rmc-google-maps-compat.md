---
name: RMC Google Maps compat layer with Leaflet fallback
description: How all 5 map screens render Google Maps with automatic OSM/Leaflet fallback, and the constraints that keep tests/builds green.
---

## Rule
All map screens import primitives from `@/components/map` (MapContainer/TileLayer/Marker/Popup/Polyline/MapClickCapture/FitBounds) — never from `react-leaflet` directly — and use `useMapHandle()` from `@/components/map/handle` instead of `useMap()`.

**Why:** the compat layer branches per-engine: `mapEngine.ts` starts on `leaflet`, and only flips to `google` after `/api/config` supplies `googleMapsKey` (GOOGLE_MAPS_BROWSER_KEY || GOOGLE_MAPS_API_KEY || GOOGLE_PLACES_API_KEY) and the Maps JS script loads. `gm_authFailure` or script `onerror` silently falls back to Leaflet, so a bad/missing key never breaks a map. Because the default engine is `leaflet`, all existing tests that mock `react-leaflet` keep passing untouched.

**How to apply:**
- New map UI: import from `@/components/map`; hooks/handle come from `@/components/map/handle` (react-refresh lint forbids non-component exports in index.tsx — don't merge them).
- Google DOM ownership: in `google.tsx` the map div is a SIBLING of a hidden children div; markers are AdvancedMarkerElement, popups are React portals into an InfoWindow contentDiv. Never let React render inside the map's own div.
- Screens keep building `L.divIcon`/`L.icon`; `iconToContent()` translates html/iconUrl for Google markers.
- Geocoding (LocationPicker): Google Geocoder (`region:'in'`) when engine=google, Nominatim otherwise/on failure.
- Key requirements to tell the user: enable Maps JavaScript API (+ Geocoding API ideally); prefer a domain-restricted browser key in GOOGLE_MAPS_BROWSER_KEY (takes precedence). `googleMapsMapId` optional, defaults DEMO_MAP_ID.
- Regression lock: `rmc-app/src/lib/mapEngine.test.ts` covers no-key, auth-failure, and onerror fallback paths.
