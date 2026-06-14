import { describe, it, expect } from 'vitest';
import { canAccess, defaultPath, ROLE_ALLOWED_PATHS } from './permissions';

describe('permissions — AUTHORITY super-role', () => {
  it('authority can reach every admin screen', () => {
    for (const path of ['/', '/users', '/audit-log', '/activity-log', '/reports', '/orders', '/dispatch', '/mix-design', '/clients', '/vehicles']) {
      expect(canAccess('authority', path)).toBe(true);
    }
  });

  it('authority reach matches admin reach exactly', () => {
    const probes = ['/', '/users', '/audit-log', '/clients', '/vehicles', '/batch-report', '/my-orders', '/my-trips', '/nope'];
    for (const path of probes) {
      expect(canAccess('authority', path)).toBe(canAccess('admin', path));
    }
    expect(ROLE_ALLOWED_PATHS.authority).toEqual(ROLE_ALLOWED_PATHS.admin);
  });

  it('authority lands on the plant onboarding list by default', () => {
    expect(defaultPath('authority')).toBe('/plants');
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
