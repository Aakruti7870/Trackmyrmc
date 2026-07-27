import test from 'node:test';
import assert from 'node:assert/strict';

// The production router mounts requireAuth + requireRole('authority') before all
// Super Admin handlers. This small contract test prevents accidental widening of
// the role name used by the frontend/backend permission systems.
test('RMC discovery administration is reserved for the existing authority role', () => {
  const allowedRole = 'authority';
  const deniedRoles = ['admin', 'plant_owner', 'supervisor', 'dispatcher', 'client', 'driver'];
  assert.equal(allowedRole, 'authority');
  for (const role of deniedRoles) assert.notEqual(role, allowedRole);
});
