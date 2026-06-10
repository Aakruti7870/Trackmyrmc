export type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  admin:          ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/mix-design', '/reports', '/challans', '/users'],
  dispatcher:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/reports', '/challans'],
  plant_operator: ['/', '/batch-report', '/mix-design'],
  client:         ['/my-orders', '/challans'],
  driver:         ['/my-trips', '/challans'],
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
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
