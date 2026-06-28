export type Role = 'authority' | 'plant_owner' | 'admin' | 'supervisor' | 'dispatcher' | 'plant_operator' | 'accountant' | 'client' | 'driver';

// AUTHORITY is a super-admin: it can reach everything an admin can.
const ADMIN_PATHS = ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/attendance', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/plants', '/users', '/activity-log', '/audit-log', '/ai-tasks', '/profile', '/kiosk'];

export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  authority:      ADMIN_PATHS,
  // Plant Owner runs a single plant end-to-end: same surface as an admin.
  plant_owner:    ADMIN_PATHS,
  admin:          ADMIN_PATHS,
  // Supervisor oversees plant operations & dispatch (no user/plant admin).
  supervisor:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/attendance', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/profile', '/kiosk'],
  dispatcher:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/attendance', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/profile', '/kiosk'],
  plant_operator: ['/', '/freshness', '/batch-report', '/attendance', '/mix-design', '/shift-report', '/profile'],
  // Accountant is a read-only finance role: reports/analytics + delivery
  // documents (for billing reconciliation) and their own profile. No writes.
  accountant:     ['/reports', '/challans', '/profile'],
  client:         ['/my-orders', '/nearby-plants', '/challans', '/profile'],
  driver:         ['/my-trips', '/attendance', '/challans', '/profile'],
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  authority: '/plants',
  plant_owner: '/',
  admin: '/',
  supervisor: '/',
  dispatcher: '/',
  plant_operator: '/batch-report',
  accountant: '/reports',
  client: '/nearby-plants',
  driver: '/my-trips',
};

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
  permissionOverrides = next;
}

export function allowedPaths(role: string): string[] {
  return permissionOverrides[role as Role] ?? ROLE_ALLOWED_PATHS[role as Role] ?? [];
}

export function canAccess(role: string, path: string): boolean {
  const allowed = allowedPaths(role);
  if (!allowed.length) return false;
  return allowed.some(p => {
    if (p === '/') return path === '/';
    return path === p || path.startsWith(p + '/');
  });
}

export function defaultPath(role: string): string {
  return ROLE_DEFAULT_PATH[role as Role] ?? '/';
}
