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

// True only for a deliverable, real-world address. Placeholder @otp.local
// mailboxes (phone-only accounts) are NOT real: attempting to email them makes
// the SMTP provider bounce the message back to the sender's inbox.
export function isRealEmail(email: string | null | undefined): email is string {
  const e = (email ?? '').trim();
  return e.length > 0 && !e.toLowerCase().endsWith('@otp.local');
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

/**
 * Find the live customer (client-role) account for a *verified* email address, or
 * transparently create one on first sign-in. This is the email counterpart of
 * resolveCustomerByPhone, used by the Clerk Google (OAuth) customer token
 * exchange so a verified Google identity resolves to a 'client' account.
 *
 * The caller MUST have already verified ownership of `email` (a verified Clerk
 * email identity) — this function does no verification itself.
 *
 * Security boundary: this mirrors resolveCustomerByPhone exactly. An email maps
 * ONLY to a customer (client-role) account here; if a live account already holds
 * this email but is not a client (i.e. a staff/authority account), it refuses
 * rather than issue a token — staff sign in through the staff SSO path, which is
 * the dual that only ever resolves staff roles. The two paths can never
 * cross-issue a token for the other's account.
 */
export async function resolveCustomerByEmail(
  email: string,
  name?: string,
): Promise<CustomerResult> {
  const normalized = email.trim().toLowerCase();

  let [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, normalized), isNull(users.deletedAt)));

  if (user && user.role !== 'client') {
    return { ok: false, status: 403, error: 'This email is registered to a staff account. Please use staff sign-in.' };
  }

  if (!user) {
    const displayName = name?.trim() || normalized.split('@')[0] || 'Customer';
    // Random, unusable password — these accounts authenticate only by a verified
    // Google identity, never by password.
    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

    try {
      user = await db.transaction(async (tx) => {
        const [client] = await tx.insert(clients).values({
          name: displayName,
          contactPerson: displayName,
          // clients.phone is NOT NULL; Google customers have no number yet, so
          // store an empty placeholder they can fill in later from their profile.
          phone: '',
          email: normalized,
        }).returning();

        const [created] = await tx.insert(users).values({
          name: displayName,
          email: normalized,
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
          detail: `Google-verified customer (${normalized}) — account active`,
        });

        return created;
      });
    } catch (err: unknown) {
      // A unique violation means two sign-ins for the same email raced, or the
      // address is already taken (e.g. by a soft-deleted row). Re-read the live
      // account and continue; if there genuinely isn't one, surface a clean
      // error instead of a 500.
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        [user] = await db
          .select()
          .from(users)
          .where(and(eq(users.email, normalized), isNull(users.deletedAt)));
        if (!user) {
          return { ok: false, status: 409, error: 'This email could not be registered. Please contact support.' };
        }
        if (user.role !== 'client') {
          return { ok: false, status: 403, error: 'This email is registered to a staff account. Please use staff sign-in.' };
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
