---
name: RMC freshness for non-staff (client/driver)
description: How client and driver logins show a concrete pour-by countdown without leaking the plant-wide freshness list.
---

Client (MyOrders) and driver (MyTrips) show a live pour-by countdown on
in-transit loads via a shared self-ticking `FreshnessCountdown` component that
computes remaining working life from `challan.dispatchTime` + a config-only
endpoint `GET /api/positions/freshness-config` (authenticated, any role —
returns just workingLifeMin/warnMin/avgSpeedKmh).

**Why:** the plant-wide `GET /api/positions/freshness` is staff-only
(admin/dispatcher/authority/plant_operator) and returns every load's
location/ETA — non-staff must never see it. Exposing only the config lets the
client/driver render their own countdown without any cross-tenant load data.

**How to apply:** never widen `/positions/freshness` roles for client/driver;
add fields to `/freshness-config` only if they are safe, non-load-specific
config. The component mirrors the server's time-threshold classification
(expired/critical≤warnMin/warning≤warnMin*2/fresh) but NOT the live-ETA
`willMakeIt===false ⇒ critical` rule, since non-staff lack the plant ETA feed.
