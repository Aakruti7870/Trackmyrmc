import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, staffOtpCodes } from '../db/schema.js';
import {
  generateOtpCode, hashOtpCode, isMetaOtpConfigured, sendCodeViaMetaWhatsApp,
} from './otp.js';
import { sendLoginCodeEmail } from './email.js';
import { isAuthorityEmail } from './authority.js';

// Staff/owner passwordless login codes live for 10 minutes (a little longer than
// the customer phone-OTP because email can take a moment to arrive). One live
// code per account; a fresh send replaces the previous one.
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export type StaffUser = typeof users.$inferSelect;

// Roles that authenticate via the passwordless staff OTP door. Excludes
// 'client' (customers use the phone-OTP door) and 'authority' (the Super Admin
// signs in with password + an OTP second factor via /login, never this door).
const STAFF_OTP_ROLES = new Set([
  'admin', 'dispatcher', 'plant_operator', 'plant_owner', 'supervisor', 'accountant', 'driver',
]);

// A Super Admin is an `authority` row whose email is on the (env-controlled)
// authority allow-list — both must hold, so a stray DB role alone is not enough.
export function isSuperAdminUser(u: { role: string; email: string }): boolean {
  return u.role === 'authority' && isAuthorityEmail(u.email);
}

// Resolve a provisioned, active, non-deleted STAFF account by email for the
// passwordless OTP door. Never creates an account (provisioned-only) and returns
// null for unknown / inactive / customer / super-admin emails so the caller can
// answer generically without revealing which emails exist.
export async function resolveStaffForOtp(email: string): Promise<StaffUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [u] = await db.select().from(users).where(eq(users.email, normalized));
  if (!u || u.deletedAt || !u.isActive) return null;
  if (!STAFF_OTP_ROLES.has(u.role)) return null;
  return u;
}

export interface SendCodeResult {
  ok: boolean;
  channel: 'email' | 'whatsapp' | 'dev';
  devCode?: string;
  error?: string;
}

async function clearStaffCode(userId: number): Promise<void> {
  await db.delete(staffOtpCodes).where(eq(staffOtpCodes.userId, userId));
}

// Generate, store (hashed, keyed by user id) and deliver a fresh login code to a
// resolved account. Email is preferred (every staff account has a real mailbox);
// WhatsApp is used when the account has a phone AND Meta is configured. In
// non-production with no channel available the code is returned for local
// testing; in production an undeliverable code is a hard failure (never leaked).
export async function sendStaffLoginCode(user: StaffUser): Promise<SendCodeResult> {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const hasRealEmail = Boolean(user.email) && !user.email.endsWith('@otp.local');
  const canWhatsApp = Boolean(user.phone) && isMetaOtpConfigured();
  const channel: 'email' | 'whatsapp' | 'dev' = hasRealEmail
    ? 'email'
    : (canWhatsApp ? 'whatsapp' : 'dev');

  // Persist BEFORE sending so a delivered code is always verifiable; a failed
  // real send is cleaned up below so a live code can't linger for a message that
  // never arrived.
  await db.insert(staffOtpCodes)
    .values({ userId: user.id, codeHash, channel, expiresAt, attempts: 0 })
    .onConflictDoUpdate({
      target: staffOtpCodes.userId,
      set: { codeHash, channel, expiresAt, attempts: 0, createdAt: new Date() },
    });

  if (channel === 'email') {
    const sent = await sendLoginCodeEmail(user.email, user.name, code, Math.round(OTP_TTL_MS / 60000));
    if (sent) return { ok: true, channel: 'email' };
    // Email failed — try WhatsApp if we can, otherwise give up cleanly.
    if (canWhatsApp) {
      const w = await sendCodeViaMetaWhatsApp(user.phone as string, code);
      if (w.ok) {
        await db.update(staffOtpCodes).set({ channel: 'whatsapp' }).where(eq(staffOtpCodes.userId, user.id));
        return { ok: true, channel: 'whatsapp' };
      }
    }
    await clearStaffCode(user.id);
    return { ok: false, channel: 'email', error: 'Could not send your login code by email. Please contact your administrator.' };
  }

  if (channel === 'whatsapp') {
    const w = await sendCodeViaMetaWhatsApp(user.phone as string, code);
    if (w.ok) return { ok: true, channel: 'whatsapp' };
    await clearStaffCode(user.id);
    return { ok: false, channel: 'whatsapp', error: w.error ?? 'Could not send your login code.' };
  }

  // Dev fallback: no delivery channel configured.
  if (process.env.NODE_ENV === 'production') {
    await clearStaffCode(user.id);
    return { ok: false, channel: 'dev', error: 'Login codes are temporarily unavailable. Please contact your administrator.' };
  }
  return { ok: true, channel: 'dev', devCode: code };
}

// Verify a submitted code against the stored hash. Single generic failure
// message (never distinguishes wrong/expired/too-many) to avoid leaking state.
// On success the code is consumed (deleted) so it can't be replayed.
export async function verifyStaffLoginCode(
  userId: number,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const GENERIC = 'That code is incorrect or has expired. Please request a new one.';
  const [row] = await db.select().from(staffOtpCodes).where(eq(staffOtpCodes.userId, userId));
  if (!row) return { ok: false, error: GENERIC };

  if (row.expiresAt.getTime() < Date.now() || row.attempts >= MAX_VERIFY_ATTEMPTS) {
    await clearStaffCode(userId);
    return { ok: false, error: GENERIC };
  }

  if (row.codeHash !== hashOtpCode(code)) {
    await db.update(staffOtpCodes).set({ attempts: row.attempts + 1 }).where(eq(staffOtpCodes.userId, userId));
    return { ok: false, error: GENERIC };
  }

  await clearStaffCode(userId);
  return { ok: true };
}
