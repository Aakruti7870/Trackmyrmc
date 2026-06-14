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
// Maximum number of simultaneously-LIVE (non-soft-deleted) accounts of each
// role a single plant may hold. `Infinity` means unlimited (drivers). Roles not
// listed are treated as unlimited.
export const ROLE_LIMITS = {
    plant_owner: 1,
    admin: 2,
    plant_operator: 2,
    supervisor: 2,
    dispatcher: 1,
    driver: Infinity,
};
// Which roles each actor role may create/provision within a plant. An actor may
// never create a peer or a role above them — only the roles explicitly listed.
export const CREATABLE_BY = {
    // The Super Owner can seed any plant role, but onboarding starts with owners.
    authority: ['plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'driver'],
    // A Plant Owner delegates to Admins and may provision any staff below them.
    plant_owner: ['admin', 'supervisor', 'dispatcher', 'plant_operator', 'driver'],
    // An Admin provisions the operational staff, but not other admins/owners.
    admin: ['supervisor', 'dispatcher', 'plant_operator', 'driver'],
};
export function roleLimit(role) {
    return ROLE_LIMITS[role] ?? Infinity;
}
/** Whether an actor in `actorRole` is permitted to create an account of `targetRole`. */
export function canCreateRole(actorRole, targetRole) {
    return (CREATABLE_BY[actorRole] ?? []).includes(targetRole);
}
/** The roles `actorRole` is allowed to provision (empty when none). */
export function creatableRoles(actorRole) {
    return CREATABLE_BY[actorRole] ?? [];
}
