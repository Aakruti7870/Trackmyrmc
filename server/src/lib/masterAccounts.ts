import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { PERMANENT_AUTHORITY_EMAILS } from './authority.js';
import { hashPassword } from './password.js';

/**
 * Idempotently guarantee that the two permanent platform Super Owners exist as
 * active AUTHORITY accounts. Run once at boot. They sign in via Clerk SSO (mapped
 * by email), so the seeded password is an un-guessable throwaway. If a row was
 * somehow demoted, suspended, or soft-deleted, this restores it — the master
 * accounts must never be lockable out of the platform.
 */
export async function ensureMasterAccounts(): Promise<void> {
  for (const rawEmail of PERMANENT_AUTHORITY_EMAILS) {
    const email = rawEmail.trim().toLowerCase();
    const [existing] = await db
      .select({ id: users.id, role: users.role, isActive: users.isActive, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.email, email));

    if (existing) {
      if (existing.role !== 'authority' || !existing.isActive || existing.deletedAt) {
        await db.update(users)
          .set({ role: 'authority', isActive: true, deletedAt: null, suspendedBy: null, suspensionReason: null })
          .where(eq(users.id, existing.id));
      }
      continue;
    }

    const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
    await db.insert(users).values({
      name: 'Super Owner',
      email,
      passwordHash,
      role: 'authority',
    });
  }
}
