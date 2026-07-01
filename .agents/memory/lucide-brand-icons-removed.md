---
name: lucide brand icons removed
description: lucide-react no longer exports brand logos; use inline SVG paths instead.
---

The `lucide-react` version in this repo does NOT export brand-logo icons
(`Instagram`, `Youtube`, `Facebook`, `Linkedin`, `Github`, and similar). Importing
them fails the build with `TS2305: Module '"lucide-react"' has no exported member`.

**Why:** lucide removed its brand/social logo set (trademark reasons); only generic
UI glyphs remain.

**How to apply:** For social/brand marks, render an inline `<svg viewBox="0 0 24 24"
fill="currentColor"><path d=…/></svg>` using simple-icons path data. Non-brand
generic icons (Bell, Zap, Crown, etc.) are still fine from lucide.
