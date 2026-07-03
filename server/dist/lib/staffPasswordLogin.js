import { getSetting } from './settings.js';
// Roles the Super Owner may exempt from the one-time-code (2FA) step so they
// can sign in with email + password alone. Mirrors the passwordless staff-OTP
// door roles: 'client' (phone OTP) and 'authority' (Super Admin — password +
// mandatory 2FA, never exemptable) are deliberately excluded.
export const STAFF_PASSWORD_LOGIN_ROLES = [
    'admin', 'dispatcher', 'plant_operator', 'plant_owner', 'supervisor', 'accountant',
    'quality_engineer', 'fleet_manager', 'store_manager', 'driver',
];
export const STAFF_PASSWORD_LOGIN_KEY = 'staff_password_login_roles';
const VALID_ROLES = new Set(STAFF_PASSWORD_LOGIN_ROLES);
// Parse the stored comma-separated role list. Missing key or empty string both
// mean "no exemptions" — every staff role keeps the one-time-code requirement,
// which is the safe default and the original behaviour.
export function parseStaffPasswordLoginRoles(value) {
    if (!value)
        return [];
    const seen = new Set();
    for (const raw of value.split(/[\s,;]+/)) {
        const r = raw.trim();
        if (r && VALID_ROLES.has(r))
            seen.add(r);
    }
    return [...seen];
}
export function serializeStaffPasswordLoginRoles(roles) {
    const seen = new Set();
    for (const r of roles)
        if (VALID_ROLES.has(r))
            seen.add(r);
    return [...seen].join(',');
}
/** Roles currently allowed to sign in with email + password (2FA off). */
export async function getStaffPasswordLoginRoles() {
    return parseStaffPasswordLoginRoles(await getSetting(STAFF_PASSWORD_LOGIN_KEY));
}
/** Whether a staff role may skip the one-time code and use password-only login. */
export async function isPasswordLoginEnabledForRole(role) {
    if (!VALID_ROLES.has(role))
        return false;
    const roles = await getStaffPasswordLoginRoles();
    return roles.includes(role);
}
