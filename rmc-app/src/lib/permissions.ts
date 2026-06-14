export type Role = 'authority' | 'plant_owner' | 'admin' | 'supervisor' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

// AUTHORITY is a super-admin: it can reach everything an admin can.
const ADMIN_PATHS = ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/plants', '/users', '/activity-log', '/audit-log', '/profile', '/kiosk'];

export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  authority:      ADMIN_PATHS,
  // Plant Owner runs a single plant end-to-end: same surface as an admin.
  plant_owner:    ADMIN_PATHS,
  admin:          ADMIN_PATHS,
  // Supervisor oversees plant operations & dispatch (no user/plant admin).
  supervisor:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/profile', '/kiosk'],
  dispatcher:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/profile', '/kiosk'],
  plant_operator: ['/', '/freshness', '/batch-report', '/mix-design', '/shift-report', '/profile'],
  client:         ['/my-orders', '/nearby-plants', '/challans', '/profile'],
  driver:         ['/my-trips', '/challans', '/profile'],
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  authority: '/plants',
  plant_owner: '/',
  admin: '/',
  supervisor: '/',
  dispatcher: '/',
  plant_operator: '/batch-report',
  client: '/nearby-plants',
  driver: '/my-trips',
};

export function canAccess(role: string, path: string): boolean {
  const allowed = ROLE_ALLOWED_PATHS[role as Role];
  if (!allowed) return false;
  return allowed.some(p => {
    if (p === '/') return path === '/';
    return path === p || path.startsWith(p + '/');
  });
}

export function defaultPath(role: string): string {
  return ROLE_DEFAULT_PATH[role as Role] ?? '/';
}
