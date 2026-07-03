// Central definition of the staff role hierarchy used by owner onboarding.
//
// Chain (high → low):
//   authority (Super Owner) → plant_owner → admin → { supervisor, dispatcher,
//   plant_operator, driver }
//
// This module only describes *who may provision whom* and *how many of each
// role a single plant may have*. It is additive: it does not alter how existing
// global accounts (provisioned via /api/users) behave — it governs the
// plant-scoped onboarding path.

export type StaffRole =
  | 'authority'
  | 'plant_owner'
  | 'admin'
  | 'supervisor'
  | 'dispatcher'
  | 'plant_operator'
  | 'accountant'
  | 'quality_engineer'
  | 'fleet_manager'
  | 'store_manager'
  | 'driver';

// Maximum number of simultaneously-LIVE (non-soft-deleted) accounts of each
// role a single plant may hold. `Infinity` means unlimited (drivers). Roles not
// listed are treated as unlimited.
export const ROLE_LIMITS: Record<string, number> = {
  plant_owner: 1,
  admin: 2,
  plant_operator: 2,
  supervisor: 2,
  dispatcher: 1,
  accountant: 2,
  quality_engineer: 2,
  fleet_manager: 1,
  store_manager: 1,
  driver: Infinity,
};

// Which roles each actor role may create/provision within a plant. An actor may
// never create a peer or a role above them — only the roles explicitly listed.
export const CREATABLE_BY: Record<string, StaffRole[]> = {
  // The Super Owner can seed any plant role, but onboarding starts with owners.
  authority: ['plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'accountant', 'quality_engineer', 'fleet_manager', 'store_manager', 'driver'],
  // A Plant Owner delegates to Admins and may provision any staff below them.
  plant_owner: ['admin', 'supervisor', 'dispatcher', 'plant_operator', 'accountant', 'quality_engineer', 'fleet_manager', 'store_manager', 'driver'],
  // An Admin provisions the operational staff, but not other admins/owners.
  admin: ['supervisor', 'dispatcher', 'plant_operator', 'accountant', 'quality_engineer', 'fleet_manager', 'store_manager', 'driver'],
};

export function roleLimit(role: string): number {
  return ROLE_LIMITS[role] ?? Infinity;
}

/** Whether an actor in `actorRole` is permitted to create an account of `targetRole`. */
export function canCreateRole(actorRole: string, targetRole: string): boolean {
  return (CREATABLE_BY[actorRole] ?? []).includes(targetRole as StaffRole);
}

/** The roles `actorRole` is allowed to provision (empty when none). */
export function creatableRoles(actorRole: string): StaffRole[] {
  return CREATABLE_BY[actorRole] ?? [];
}

// Platform staff sit above any single plant: the Super Owner (authority) or a
// legacy global admin with no plant binding (plantId == null). Plant-scoped
// staff (admin/plant_owner bound to one plant) are NOT platform staff and must
// act through the plant owner console. Used to gate global, cross-tenant
// endpoints (the global user console and global plant administration). Legacy
// global admins have plantId == null, so this stays backward-compatible.
export function isPlatformStaff(actor: { role: string; plantId?: number | null }): boolean {
  return actor.role === 'authority' || (actor.role === 'admin' && actor.plantId == null);
}
