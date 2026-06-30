---
name: RMC supplier discovery (Super Admin)
description: Authority-only multi-category Google Places supplier discovery + invite — design decisions & cost rules.
---

# Supplier discovery map (Super Admin / role `authority`)

A Super-Admin-only "Discover suppliers" tab on the /plants hub that surfaces RMC-adjacent
businesses from REAL Google Places data and lets staff invite them to join (WhatsApp deep
link + app link https://trackmyrmc.com), or log them as onboarding leads via /plants/invite.

## Durable decisions (not derivable from code)
- **Display = Leaflet + OSM, DATA = real Google Places.** Deliberately avoid the paid Maps
  JS SDK; we render on the free OSM tile stack but the markers/contact data come from the
  Places Text Search already wired in `places.ts`. **Why:** no new Maps-JS billing.
- **One all-category fetch, client-side chip filtering.** The frontend fetches ALL 6
  categories once per location+radius (server caches it) and the category chips filter the
  result in the browser. **Why:** toggling categories must never re-bill Places. Do NOT
  refetch per category from the client.
- **Multi-category model:** `discoverSuppliers()` runs one Places query per category
  (`Promise.allSettled`), then merges + dedupes by `placeId`, collecting all matched
  category keys into `categories[]`. Cache key includes a category signature.
- **6 category keys are a shared contract:** `ready_mix, concrete_supplier,
  concrete_contractor, cement_supplier, fly_ash, ggbs` — the frontend component's keys MUST
  match `SUPPLIER_CATEGORIES` in `places.ts` or chips silently match nothing.

## Gating
- Server: `/plants/discover-suppliers` is behind router-level `requireAuth` + `requireRole('authority')`.
- Client: gate BOTH the tab button AND the render branch on `user?.role === 'authority'`
  (admin/plant_owner also reach /plants, so a component-level gate is required, not just routing).
- "Already onboarded" dedupe drops discovered suppliers within 0.15km of an approved+active+
  locationVerified plant.

## Design convention
- The Super Admin supplier-discovery screen uses the shared Super Admin tool look:
  a gold-tinted 40x40 rounded-square icon + bold title + muted subtitle header, and
  `card()`-style panels (`var(--glass-border)`, radius 16, padding 18) with bold section
  labels. **Why:** the product owner wants Super Admin tools to look consistent — reuse this
  header + card treatment for any new Super Admin tool rather than inventing a new style.

## Gotchas
- The discovery helper name `locateMe` (geolocation) must NOT be prefixed `use*` or the
  react-hooks/rules-of-hooks lint treats it as a hook called inside a callback (ERROR).
