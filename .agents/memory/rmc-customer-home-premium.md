---
name: Customer Home premium theme
description: How the client /home screen is re-skinned cream/green/gold without touching the global teal theme
---
The customer role-home is themed page-locally: a wrapper div on the page overrides the shared theme CSS variables (--bg/--text/--muted, the --gold* accent ramp, plus card surface vars --surface/--glass-border/--chip-bg/--shadow-rgb) so all shared kit components re-skin inside it, in BOTH Day and Night modes.

**Why:** the user wants a premium cream+dark-green+gold look on the customer home only; the global teal Day/Night theme (and every other screen) must stay untouched.

**How to apply:**
- Any new CSS variable consumed by a shared component that renders on the customer home must be added to the override map on the page wrapper, or Night-mode values bleed through (this bit the fleet-map card via --surface).
- Mobile edge-to-bleed layout: `#app-main.home-full-bleed { padding: 0 !important }` (index.css mobile media query) + Layout adds that class on the /home route; without it the global mobile `#app-main` padding shows the Night body background as a dark frame.
- Fixed mobile header uses position:fixed + a same-height spacer div toggled by the same media-query CSS; modal stacking order is overlay(More) 40 < More sheet 45 < nav 55 < header 60 < page sheets 70/75 — header above the More sheet is intentional, pre-existing design.
