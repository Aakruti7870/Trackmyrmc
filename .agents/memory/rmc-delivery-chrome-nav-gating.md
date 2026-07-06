---
name: RMC delivery mobile chrome nav gating
description: Why bottom-nav tabs/FAB silently vanish, and the home-screen action-gating rule for the delivery-style mobile UI.
---

# Delivery-style mobile chrome + role homes

The mobile bottom nav (`DeliveryMobileChrome.tsx` `navFor`) filters every tab and
the center FAB through `canAccess(role, basePath(href))`. So any tab/FAB whose
path is NOT in that role's `ROLE_ALLOWED_PATHS` list silently disappears — the
role ends up with fewer tabs than configured and no error.

**Why:** the accountant config once pointed tabs at `/dispatch` and `/expenses`,
but accountant is only allowed `['/reports','/challans','/expense-review','/profile']`,
so those two tabs were dropped at runtime, leaving a broken 3-item bar.

**How to apply:** when adding/editing a role's NAV entry, cross-check every tab
and FAB href against `ROLE_ALLOWED_PATHS[role]` in `permissions.ts`. The FAB is
the whole-app pattern (every role including accountant should have one where a
sensible primary action exists — accountant's is `/expense-review`).

Home screens (`pages/home/*Home.tsx`, `DriverHome.tsx`) follow the same rule:
gate EVERY actionable click, not just section headers. Pass
`onClick={can(path) ? () => go(path) : undefined}` on cards/ListRows so an
informative row without route access shows but does nothing. QuickAction labels
must be honest — don't label a nav shortcut "Download" if it only routes to a
tab (renamed to "Invoices").
