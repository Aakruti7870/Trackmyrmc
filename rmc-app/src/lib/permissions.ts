export type Role = 'authority' | 'plant_owner' | 'admin' | 'supervisor' | 'dispatcher' | 'plant_operator' | 'accountant' | 'quality_engineer' | 'fleet_manager' | 'store_manager' | 'client' | 'driver';

// AUTHORITY is a super-admin: it can reach everything an admin can.
// NOTE: '/kiosk' (Control Room) is intentionally NOT in the shared admin set —
// the big-screen Control Room is Super Admin (authority) only. It is added back
// explicitly to `authority` below.
const ADMIN_PATHS = ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/attendance', '/live-drivers', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/expense-review', '/emergencies', '/plants', '/users', '/user-management', '/activity-log', '/audit-log', '/automations', '/profile'];

export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  // Authority (Super Admin) also owns the /command control center and the
  // platform-wide WhatsApp chat inbox.
  authority:      ['/command', '/whatsapp', '/kiosk', ...ADMIN_PATHS],
  // Plant Owner runs a single plant end-to-end: same surface as an admin.
  plant_owner:    ADMIN_PATHS,
  // The WhatsApp inbox is platform-staff only; the API rejects plant-bound
  // admins, and the sidebar additionally hides it from them (Layout).
  admin:          ['/whatsapp', ...ADMIN_PATHS],
  // Supervisor oversees plant operations & dispatch (no user/plant admin).
  supervisor:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/attendance', '/live-drivers', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/expense-review', '/emergencies', '/profile'],
  dispatcher:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/attendance', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/profile'],
  plant_operator: ['/', '/freshness', '/batch-report', '/attendance', '/mix-design', '/shift-report', '/reports', '/profile'],
  // Accountant is a read-only finance role: reports/analytics + delivery
  // documents (for billing reconciliation) and their own profile. No writes.
  accountant:     ['/reports', '/challans', '/expense-review', '/profile'],
  // Quality Engineer owns concrete quality: mix designs, batch QC, freshness.
  quality_engineer: ['/', '/batch-report', '/mix-design', '/freshness', '/reports', '/attendance', '/profile'],
  // Fleet Manager runs the transit-mixer fleet: vehicles, drivers, fuel, dispatch visibility.
  fleet_manager:  ['/', '/vehicles', '/drivers', '/dispatch', '/challans', '/fuel-log', '/expense-review', '/attendance', '/reports', '/profile'],
  // Store Manager tracks material stock via production/batch usage.
  store_manager:  ['/', '/batch-report', '/mix-design', '/attendance', '/reports', '/profile'],
  client:         ['/my-orders', '/nearby-plants', '/challans', '/profile'],
  driver:         ['/home', '/my-trips', '/expenses', '/sos', '/attendance', '/challans', '/profile'],
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  authority: '/command',
  plant_owner: '/',
  admin: '/',
  supervisor: '/',
  dispatcher: '/',
  plant_operator: '/batch-report',
  accountant: '/reports',
  quality_engineer: '/batch-report',
  fleet_manager: '/vehicles',
  store_manager: '/batch-report',
  client: '/nearby-plants',
  driver: '/home',
};

// Roles that get a dedicated mobile "home" landing screen (post-login) at
// /home. Desktop is unchanged — these roles still land on their original
// default path on wide screens. Driver already used /home as its only home.
export const HOME_ROLES: Role[] = [
  'client', 'driver', 'plant_operator', 'dispatcher', 'supervisor', 'admin', 'plant_owner', 'accountant',
];

// True on phone-width viewports (mirrors the Layout / useIsMobile breakpoint).
// Guarded so it is SSR-safe and returns false under jsdom, keeping unit tests
// on the unchanged desktop routing path.
function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(max-width: 900px)').matches;
  } catch {
    return false;
  }
}

// DB-backed overrides, merged over the static defaults at runtime. Loaded once
// from /api/config at app bootstrap (see config-provider). When a role has no
// override (or none were loaded) the built-in ROLE_ALLOWED_PATHS apply, so the
// app is fully functional even if the config call fails — a non-breaking fallback.
let permissionOverrides: Partial<Record<Role, string[]>> = {};

export function setPermissionOverrides(overrides: Partial<Record<string, string[]>> | null | undefined): void {
  const next: Partial<Record<Role, string[]>> = {};
  if (overrides) {
    for (const role of Object.keys(ROLE_ALLOWED_PATHS) as Role[]) {
      const paths = overrides[role];
      if (Array.isArray(paths)) next[role] = paths.filter(p => typeof p === 'string');
    }
  }
  // Authority is the platform super-admin and owns the Command Center. A stale
  // DB override from before /command existed would otherwise lock authority out
  // of its own default route, so we always guarantee it here. /profile is also
  // guaranteed: it hosts the Role Permissions editor, so authority must never be
  // able to lock itself out of managing access.
  if (next.authority) {
    for (const required of ['/profile', '/command']) {
      if (!next.authority.includes(required)) next.authority = [required, ...next.authority];
    }
  }
  permissionOverrides = next;
}

export function allowedPaths(role: string): string[] {
  return permissionOverrides[role as Role] ?? ROLE_ALLOWED_PATHS[role as Role] ?? [];
}

export function canAccess(role: string, path: string): boolean {
  // The unified mobile home is reachable by any role that has one, independent
  // of DB permission overrides (which never list /home). This prevents a
  // redirect loop when a role's post-login landing is /home on phones.
  if (path === '/home') return (HOME_ROLES as string[]).includes(role);
  const allowed = allowedPaths(role);
  if (!allowed.length) return false;
  return allowed.some(p => {
    if (p === '/') return path === '/';
    return path === p || path.startsWith(p + '/');
  });
}

// The role's landing screen on a desktop/wide viewport (its original behaviour,
// viewport-independent). Kept separate so RoleHome can redirect to it without
// re-triggering the mobile /home rule below (which would loop).
export function desktopDefaultPath(role: string): string {
  const preferred = ROLE_DEFAULT_PATH[role as Role] ?? '/';
  // Guard against a stale DB override whose allow-list omits the role's default
  // path (which would trap the user in a redirect loop): fall back to the first
  // path the role can actually reach.
  if (preferred !== '/home' && canAccess(role, preferred)) return preferred;
  const allowed = allowedPaths(role);
  // A non-driver role's DESKTOP landing must never resolve to /home (the
  // mobile-only screen): a stale override listing /home would otherwise send
  // RoleHome into a redirect loop on desktop. Driver legitimately lands on
  // /home at every width (it renders DriverHome, not a redirect).
  const desktopAllowed = role === 'driver' ? allowed : allowed.filter(p => p !== '/home');
  return desktopAllowed[0] ?? (preferred === '/home' ? '/' : preferred);
}

export function defaultPath(role: string): string {
  // On phones the supported roles land on their unified /home screen; desktop
  // keeps every role on its original default (desktopDefaultPath).
  if (isMobileViewport() && (HOME_ROLES as string[]).includes(role) && canAccess(role, '/home')) {
    return '/home';
  }
  return desktopDefaultPath(role);
}
