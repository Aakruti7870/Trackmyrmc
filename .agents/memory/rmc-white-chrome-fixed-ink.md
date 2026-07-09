---
name: White chrome bars need fixed ink
description: Fixed-color surfaces must not use theme CSS vars for text/icons.
---
Rule: if a surface has a hardcoded background (e.g. the always-white mobile
header and bottom nav in the delivery chrome), its letters and icons must use
fixed colors matching that background — never `var(--text)`/`var(--muted)`/
`var(--gold)`.

**Why:** the app auto-flips Day/Night; theme vars turn light at Night, which
washed out the TrackMyRMC logo and tab labels on the white bars. Gold #D6A936
as TEXT on white is also too faint (~2.1:1) — use a darker gold (~#8a6a14) for
letters, keeping bright gold for decorative icons/fills only.

**How to apply:** when adding text to any hardcoded-color surface, pin its
color constants locally; when text sits on theme-var surfaces, use the vars.
