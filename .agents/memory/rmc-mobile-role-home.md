---
name: RMC mobile role-home landing
description: How the per-role /home mobile landing screens are wired and why the routing split exists.
---

# RMC mobile role-home landing (/home)

`/home` renders `RoleHome` (pages/RoleHome.tsx), a dispatcher that picks a per-role
home component (pages/home/*.tsx). Driver renders `DriverHome` at ALL widths; every
other `HOME_ROLES` role renders its home ONLY on phones (`useIsMobile()` true), else
`<Redirect to={desktopDefaultPath(role)}>`. This keeps desktop behaviour identical.

**Rule:** mobile role-homes are additive and mobile-only. Desktop routing, the
sidebar, and each role's original desktop landing must stay unchanged.

**Why the routing split (defaultPath vs desktopDefaultPath):**
- `defaultPath()` is viewport-aware: returns `/home` on phones for `HOME_ROLES`,
  else delegates to `desktopDefaultPath()`.
- `desktopDefaultPath()` is the ORIGINAL viewport-independent landing logic. It
  must NEVER resolve to `/home` for a non-driver role, or a stale DB override
  listing `/home` sends `RoleHome` into a desktop redirect loop. (It filters
  `/home` out of the fallback candidates; driver is exempt.)
- `canAccess(role,'/home')` short-circuits to `HOME_ROLES` membership BEFORE the
  override/allow-list check — DB permission overrides never list `/home`, so this
  prevents a GuardedRoute↔defaultPath redirect loop.

**How to apply:** viewport checks (`isMobileViewport()` in permissions.ts and
`useIsMobile.ts`) both guard `window`/`matchMedia` and return false under jsdom,
so unit tests stay on the desktop path (`setup.ts` polyfills matches:false). The
breakpoint is `max-width: 900px`, matching the Layout sidebar↔bottom-nav swap.
Layout adds a mobile-only leading "Home" bottom tab for non-driver `HOME_ROLES`;
the desktop sidebar (`SidebarContent`) is untouched. Home screens fetch via
`Promise.allSettled` and hide any empty/rejected section (no mock data).
