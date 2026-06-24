---
name: RMC App Layout Fix
description: Sidebar+main layout pattern that works correctly in the Replit preview pane.
---

## Rule

When building sidebar layouts, the mobile header must NOT be a sibling grid/flex child alongside the sidebar and main content.

**Why:** If mobile header, aside, and main are all direct children of a `display: grid` container with `grid-template-columns: 265px 1fr`, the three children get placed into columns 1, 2, and 3 — pushing the main content off-screen or into wrong columns.

## How to apply

Use a **flex column** wrapper:
1. Mobile header (`display: none`, shown via media query) — first child, full width
2. A flex row containing the desktop sidebar (fixed width) + main (flex: 1) — second child

Mobile drawer sidebar should be `position: fixed` with `transform: translateX(-100%)` and slide in on open.

Use a `<style>` tag inside the component for responsive rules (show mobile header, hide desktop sidebar below 900px breakpoint) rather than relying on Tailwind responsive utility classes, which may not generate in v4 without explicit config.

## Native status-bar overlap + tablet nav fit

The native (Capacitor/PWA-standalone) shell draws edge-to-edge, so any `position: sticky/fixed; top:0` bar (landing `<header>`, app mobile header, mobile drawer) gets the OS status bar painted over it. Fix with `paddingTop: env(safe-area-inset-top, 0px)` — but it only computes once `index.html` viewport has `viewport-fit=cover` (without it, env() insets are 0). Bottom bars likewise need `env(safe-area-inset-bottom)`.

**Tablet fit:** the landing inline nav must collapse to the hamburger at the SAME breakpoint the hero grid stacks (980px), not 720px — at 720–980 the full nav overflows and the root's `overflowX:hidden` silently clips the right-most CTA off-screen.
