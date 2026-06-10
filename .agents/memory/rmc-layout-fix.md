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
