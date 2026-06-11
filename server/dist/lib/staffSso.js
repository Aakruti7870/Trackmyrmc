import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { isAuthorityEmail } from './authority.js';
// Roles permitted to sign in via Clerk single sign-on. Clients and drivers are
// deliberately excluded — they keep the legacy email/password flow — so an
// outsider who authenticates a Google/GitHub identity can never be mapped onto
// a client or driver account.
export const SSO_ROLES = ['admin', 'dispatcher', 'plant_operator', 'authority'];
/**
 * Given the verified primary email of a Clerk identity, find the staff/authority
 * user it maps to and decide whether single sign-on is allowed. This is the
 * security boundary for Clerk login, factored out so it can be unit-tested
 * directly against the database without standing up a real Clerk session.
 */
export async function resolveStaffSsoUser(email) {
    const normalized = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, normalized));
    // Same opaque message for "no such user", "wrong role", and "deactivated" so
    // SSO can't be used to probe which emails are provisioned as staff.
    const notAuthorized = {
        ok: false,
        status: 403,
        error: 'This account is not authorized for staff single sign-on.',
    };
    if (!user || !user.isActive || user.deletedAt)
        return notAuthorized;
    if (!SSO_ROLES.includes(user.role))
        return notAuthorized;
    // Defence-in-depth: an authority row must still be on the env allow-list,
    // mirroring the legacy login guard.
    if (user.role === 'authority' && !isAuthorityEmail(user.email)) {
        return { ok: false, status: 403, error: 'This account is not on the AUTHORITY allow-list.' };
    }
    return { ok: true, user };
}
