export type Role = 'authority' | 'plant_owner' | 'admin' | 'supervisor' | 'dispatcher' | 'plant_operator' | 'accountant' | 'quality_engineer' | 'fleet_manager' | 'store_manager' | 'client' | 'driver';

const ADMIN_PATHS = ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/batch-sheets', '/attendance', '/live-drivers', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/expense-review', '/emergencies', '/plants', '/plant/profile-management', '/users', '/user-management', '/activity-log', '/audit-log', '/automations', '/kyc', '/kyc-admin', '/profile'];

export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  authority:      ['/command', '/whatsapp', '/kiosk', '/rmc-plant-network', '/admin/plant-promotions', ...ADMIN_PATHS],
  plant_owner:    ADMIN_PATHS,
  admin:          ['/whatsapp', ...ADMIN_PATHS],
  supervisor:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/batch-sheets', '/attendance', '/live-drivers', '/mix-design', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/expense-review', '/emergencies', '/kyc', '/profile'],
  dispatcher:     ['/', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/batch-sheets', '/attendance', '/reports', '/forecast', '/freshness', '/challans', '/shift-report', '/recurring', '/fuel-log', '/kyc', '/profile'],
  plant_operator: ['/', '/freshness', '/batch-report', '/batch-sheets', '/attendance', '/mix-design', '/shift-report', '/reports', '/kyc', '/profile'],
  accountant:     ['/reports', '/challans', '/expense-review', '/kyc', '/profile'],
  quality_engineer: ['/', '/batch-report', '/batch-sheets', '/mix-design', '/freshness', '/reports', '/attendance', '/kyc', '/profile'],
  fleet_manager:  ['/', '/vehicles', '/drivers', '/dispatch', '/challans', '/fuel-log', '/expense-review', '/attendance', '/reports', '/kyc', '/profile'],
  store_manager:  ['/', '/batch-report', '/batch-sheets', '/mix-design', '/attendance', '/reports', '/kyc', '/profile'],
  client:         ['/my-orders', '/nearby-plants', '/plants', '/challans', '/kyc', '/profile'],
  driver:         ['/home', '/my-trips', '/expenses', '/sos', '/attendance', '/challans', '/kyc', '/profile'],
};

export const ROLE_DEFAULT_PATH: Record<Role, string> = {
  authority: '/command', plant_owner: '/', admin: '/', supervisor: '/', dispatcher: '/', plant_operator: '/batch-report', accountant: '/reports', quality_engineer: '/batch-report', fleet_manager: '/vehicles', store_manager: '/batch-report', client: '/nearby-plants', driver: '/home',
};

export const HOME_ROLES: Role[] = ['client', 'driver', 'plant_operator', 'dispatcher', 'supervisor', 'admin', 'plant_owner', 'accountant'];
function isMobileViewport(): boolean { if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false; try { return window.matchMedia('(max-width: 900px)').matches; } catch { return false; } }
let permissionOverrides: Partial<Record<Role, string[]>> = {};
export function setPermissionOverrides(overrides: Partial<Record<string, string[]>> | null | undefined): void {
  const next: Partial<Record<Role, string[]>> = {};
  if (overrides) for (const role of Object.keys(ROLE_ALLOWED_PATHS) as Role[]) { const paths = overrides[role]; if (Array.isArray(paths)) next[role] = paths.filter(p => typeof p === 'string'); }
  if (next.authority) for (const required of ['/profile', '/command', '/rmc-plant-network']) if (!next.authority.includes(required)) next.authority = [required, ...next.authority];
  permissionOverrides = next;
}
export function allowedPaths(role: string): string[] { return permissionOverrides[role as Role] ?? ROLE_ALLOWED_PATHS[role as Role] ?? []; }
export function canAccess(role: string, path: string): boolean {
  if (path === '/home') return (HOME_ROLES as string[]).includes(role);
  const allowed = allowedPaths(role); if (!allowed.length) return false;
  return allowed.some(p => p === '/' ? path === '/' : path === p || path.startsWith(p + '/'));
}
export function desktopDefaultPath(role: string): string { const preferred = ROLE_DEFAULT_PATH[role as Role] ?? '/'; if (preferred !== '/home' && canAccess(role, preferred)) return preferred; const allowed = allowedPaths(role); const desktopAllowed = role === 'driver' ? allowed : allowed.filter(p => p !== '/home'); return desktopAllowed[0] ?? (preferred === '/home' ? '/' : preferred); }
export function defaultPath(role: string): string { if (isMobileViewport() && (HOME_ROLES as string[]).includes(role) && canAccess(role, '/home')) return '/home'; return desktopDefaultPath(role); }
