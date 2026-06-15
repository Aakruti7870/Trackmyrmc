import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, clients, auditLogs } from '../db/schema.js';
import { hashPassword } from './password.js';

type UserRow = typeof users.$inferSelect;

export type CustomerResult =
  | { ok: true; user: UserRow }
  | { ok: false; status: number; error: string };

// Reserved placeholder email for phone-only accounts (the users table requires a
// unique email). Derived deterministically from the number so it never collides
// with a real address and stays stable across re-sends/re-logins.
export function placeholderEmailFor(phone: string): string {
  return `otp_${phone.replace(/\D/g, '')}@otp.local`;
}

/**
 * Find the live customer (client-role) account for a *verified* phone number, or
 * transparently create one on first sign-in. This is the shared mapping used by
 * both phone-OTP login (Twilio dev/Verify) and the Clerk phone token-exchange,
 * so a verified number resolves to exactly the same account regardless of which
 * provider verified it.
 *
 * The caller MUST have already verified ownership of `phone` (an OTP check or a
 * verified Clerk phone identity) — this function does no verification itself.
 * `phone` must already be normalized to E.164.
 */
export async function resolveCustomerByPhone(
  phone: string,
  name?: string,
): Promise<CustomerResult> {
  let [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, phone), isNull(users.deletedAt)));

  // Security boundary: phone identity maps ONLY to customer (client-role)
  // accounts. If a live account already holds this number but is not a client
  // (e.g. a staff or driver account), refuse rather than issue a token for it —
  // staff authenticate by email/Google SSO, never by phone. This is the dual of
  // the staff SSO path, which only ever resolves staff roles.
  if (user && user.role !== 'client') {
    return { ok: false, status: 403, error: 'This number is registered to a staff account. Please sign in with your email.' };
  }

  if (!user) {
    const displayName = name?.trim() || `Customer ${phone.slice(-4)}`;
    const placeholderEmail = placeholderEmailFor(phone);
    // Random, unusable password — these accounts authenticate only by a verified
    // phone number, never by password.
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

    try {
      user = await db.transaction(async (tx) => {
        const [client] = await tx.insert(clients).values({
          name: displayName,
          contactPerson: displayName,
          phone,
        }).returning();

        const [created] = await tx.insert(users).values({
          name: displayName,
          email: placeholderEmail,
          phone,
          passwordHash,
          role: 'client',
          isActive: true,
          linkedClientId: client.id,
        }).returning();

        await tx.insert(auditLogs).values({
          actorId: null,
          actorName: displayName,
          action: 'account_registered',
          targetUserId: created.id,
          targetUserEmail: created.email,
          status: 'success',
          detail: `Phone-verified customer (${phone}) — account active`,
        });

        return created;
      });
    } catch (err: unknown) {
      // A unique violation here means two verifies for the same number raced, or
      // the placeholder email/phone was already taken. Re-read the live account
      // and continue; if there genuinely isn't one, surface a clean error
      // instead of a 500.
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.phone, phone), isNull(users.deletedAt)));
        if (!user) {
          return { ok: false, status: 409, error: 'This number could not be registered. Please contact support.' };
        }
        // Re-apply the client-only boundary: a concurrent insert (or a pre-existing
        // non-client row that caused the conflict) must NOT be issued a token here.
        if (user.role !== 'client') {
          return { ok: false, status: 403, error: 'This number is registered to a staff account. Please sign in with your email.' };
        }
      } else {
        throw err;
      }
    }
  }

  if (!user) {
    return { ok: false, status: 500, error: 'Could not complete sign-in. Please try again.' };
  }
  if (!user.isActive) {
    return { ok: false, status: 403, error: 'This account has been disabled. Please contact support.' };
  }

  return { ok: true, user };
}
