import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { PERMANENT_AUTHORITY_EMAILS } from './authority.js';
import { hashPassword } from './password.js';
/**
 * Idempotently guarantee that the two permanent platform Super Owners exist as
 * active AUTHORITY accounts. Run once at boot. They can sign in via Clerk SSO
 * (mapped by email); if no bootstrap password is configured the seeded password
 * is an un-guessable throwaway. If a row was somehow demoted, suspended, or
 * soft-deleted, this restores it — the master accounts must never be lockable
 * out of the platform.
 *
 * When AUTHORITY_BOOTSTRAP_PASSWORD is set (a secret env var, never hardcoded),
 * these master accounts get password login too: their password is pinned to that
 * secret on every boot. Rotate the master password by changing the secret; the
 * accounts pick it up on the next restart/redeploy.
 */
export async function ensureMasterAccounts() {
    const bootstrapPassword = process.env.AUTHORITY_BOOTSTRAP_PASSWORD?.trim() || null;
    for (const rawEmail of PERMANENT_AUTHORITY_EMAILS) {
        const email = rawEmail.trim().toLowerCase();
        const [existing] = await db
            .select({ id: users.id, role: users.role, isActive: users.isActive, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.email, email));
        if (existing) {
            const restore = existing.role !== 'authority' || !existing.isActive || existing.deletedAt;
            if (restore || bootstrapPassword) {
                await db.update(users)
                    .set({
                    role: 'authority', isActive: true, deletedAt: null, suspendedBy: null, suspensionReason: null,
                    ...(bootstrapPassword ? { passwordHash: await hashPassword(bootstrapPassword) } : {}),
                })
                    .where(eq(users.id, existing.id));
            }
            continue;
        }
        const passwordHash = await hashPassword(bootstrapPassword ?? randomBytes(32).toString('base64url'));
        await db.insert(users).values({
            name: 'Super Owner',
            email,
            passwordHash,
            role: 'authority',
        });
    }
}
