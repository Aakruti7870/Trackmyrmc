export type Role = 'authority' | 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

// AUTHORITY is a super-admin: it can reach everything an admin can.
const ADMIN_PATHS = ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/mix-design', '/reports', '/challans', '/shift-report', '/users', '/activity-log', '/audit-log', '/profile', '/kiosk'];

export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  authority:      ADMIN_PATHS,
  admin:          ADMIN_PATHS,
  dispatcher:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/reports', '/challans', '/shift-report', '/profile', '/kiosk'],
  plant_operator: ['/', '/batch-report', '/mix-design', '/shift-report', '/profile'],
  client:         ['/my-orders', '/challans', '/profile'],
  driver:         ['/my-trips', '/challans', '/profile'],
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  authority: '/',
  admin: '/',
  dispatcher: '/',
  plant_operator: '/batch-report',
  client: '/my-orders',
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
