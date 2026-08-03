import { describe, it, expect, afterEach } from 'vitest';
import { canAccess, defaultPath, ROLE_ALLOWED_PATHS, setPermissionOverrides, allowedPaths } from './permissions';

describe('permissions — AUTHORITY super-role', () => {
  it('authority can reach every admin screen', () => {
    for (const path of ['/', '/users', '/audit-log', '/activity-log', '/reports', '/orders', '/dispatch', '/mix-design', '/clients', '/vehicles']) {
      expect(canAccess('authority', path)).toBe(true);
    }
  });

  it('authority reach matches admin reach, plus authority-only control surfaces', () => {
    const probes = ['/', '/users', '/audit-log', '/clients', '/vehicles', '/batch-report', '/my-orders', '/my-trips', '/nope'];
    for (const path of probes) {
      expect(canAccess('authority', path)).toBe(canAccess('admin', path));
    }
    expect(ROLE_ALLOWED_PATHS.authority).toEqual([
      '/command',
      '/whatsapp',
      '/kiosk',
      '/rmc-plant-network',
      '/admin/plant-profiles',
      '/admin/plant-promotions',
      '/admin/account-deletion-requests',
      ...ROLE_ALLOWED_PATHS.admin.filter((p) => p !== '/whatsapp'),
    ]);
    expect(canAccess('authority', '/command')).toBe(true);
    expect(canAccess('admin', '/command')).toBe(false);
    expect(canAccess('authority', '/kiosk')).toBe(true);
    expect(canAccess('admin', '/kiosk')).toBe(false);
    expect(canAccess('authority', '/rmc-plant-network')).toBe(true);
    expect(canAccess('admin', '/rmc-plant-network')).toBe(false);
    expect(canAccess('authority', '/admin/plant-profiles')).toBe(true);
    expect(canAccess('admin', '/admin/plant-profiles')).toBe(false);
    expect(canAccess('authority', '/admin/plant-promotions')).toBe(true);
    expect(canAccess('admin', '/admin/plant-promotions')).toBe(false);
    expect(canAccess('authority', '/admin/account-deletion-requests')).toBe(true);
    expect(canAccess('admin', '/admin/account-deletion-requests')).toBe(false);
  });

  it('authority lands on the Command Center by default', () => {
    expect(defaultPath('authority')).toBe('/command');
  });

  it('lesser roles still cannot reach the admin-only /users screen', () => {
    expect(canAccess('dispatcher', '/users')).toBe(false);
    expect(canAccess('plant_operator', '/users')).toBe(false);
    expect(canAccess('client', '/users')).toBe(false);
    expect(canAccess('driver', '/users')).toBe(false);
  });

  it('an unknown role is denied everywhere', () => {
    expect(canAccess('superuser', '/')).toBe(false);
    expect(defaultPath('superuser')).toBe('/');
  });
});

describe('permissions — DB-backed overrides', () => {
  afterEach(() => setPermissionOverrides(null));

  it('falls back to static defaults when no overrides are loaded', () => {
    setPermissionOverrides(null);
    expect(allowedPaths('dispatcher')).toEqual(ROLE_ALLOWED_PATHS.dispatcher);
    expect(canAccess('dispatcher', '/orders')).toBe(true);
  });

  it('an override replaces the static default for that role only', () => {
    setPermissionOverrides({ dispatcher: ['/orders'] });
    expect(canAccess('dispatcher', '/orders')).toBe(true);
    expect(canAccess('dispatcher', '/reports')).toBe(false);
    expect(canAccess('admin', '/reports')).toBe(true);
  });

  it('an empty-array override revokes all access for that role', () => {
    setPermissionOverrides({ client: [] });
    expect(canAccess('client', '/my-orders')).toBe(false);
  });

  it('ignores unknown roles and non-string paths in overrides', () => {
    setPermissionOverrides({ nope: ['/x'], dispatcher: ['/orders', 123 as unknown as string] });
    expect(canAccess('nope', '/x')).toBe(false);
    expect(allowedPaths('dispatcher')).toEqual(['/orders']);
  });

  it('authority can never lose required control surfaces via an override', () => {
    setPermissionOverrides({ authority: ['/orders'] });
    expect(canAccess('authority', '/command')).toBe(true);
    expect(canAccess('authority', '/profile')).toBe(true);
    expect(canAccess('authority', '/rmc-plant-network')).toBe(true);
    expect(canAccess('authority', '/admin/plant-profiles')).toBe(true);
    expect(canAccess('authority', '/admin/plant-promotions')).toBe(true);
    expect(canAccess('authority', '/admin/account-deletion-requests')).toBe(true);
    expect(canAccess('authority', '/orders')).toBe(true);
    expect(canAccess('authority', '/users')).toBe(false);
  });

  it('an override removing a normal module keeps only mandatory authority controls plus selected paths', () => {
    setPermissionOverrides({ authority: ['/command', '/profile', '/orders'] });
    expect(allowedPaths('authority')).toEqual([
      '/admin/account-deletion-requests',
      '/admin/plant-promotions',
      '/admin/plant-profiles',
      '/rmc-plant-network',
      '/command',
      '/profile',
      '/orders',
    ]);
    expect(canAccess('authority', '/users')).toBe(false);
  });
});
