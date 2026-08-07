import { timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, staffOtpCodes } from '../db/schema.js';
import {
  generateOtpCode, hashOtpCode, isMetaOtpConfigured, sendCodeViaMetaWhatsApp,
} from './otp.js';
import { sendLoginCodeEmail } from './email.js';
import { isAuthorityEmail } from './authority.js';
import { hashPassword } from './password.js';

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
  'admin', 'dispatcher', 'plant_operator', 'plant_owner', 'supervisor', 'accountant',
  'quality_engineer', 'fleet_manager', 'store_manager', 'driver',
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

// --- App-store reviewer demo login -----------------------------------------
// Google Play / App Store reviewers cannot receive our email or SMS codes, so
// EXACTLY ONE staff account (named by REVIEW_DEMO_EMAIL) may log in with the
// FIXED code in REVIEW_DEMO_OTP. Fails closed: disabled unless both are set
// and the code is at least 6 characters. The account still has to be a
// provisioned, active staff account (resolveStaffForOtp), so this can never
// mint access to the Super Admin door or an unknown email.

function reviewDemoConfig(): { email: string; code: string } | null {
  const email = process.env.REVIEW_DEMO_EMAIL?.trim().toLowerCase();
  const code = process.env.REVIEW_DEMO_OTP?.trim();
  if (!email || !code || code.length < 6) return null;
  return { email, code };
}

export function isReviewDemoEmail(email: string): boolean {
  const cfg = reviewDemoConfig();
  return Boolean(cfg) && email.trim().toLowerCase() === cfg!.email;
}

export function isReviewDemoLogin(email: string, code: string): boolean {
  const cfg = reviewDemoConfig();
  if (!cfg || email.trim().toLowerCase() !== cfg.email) return false;
  // Constant-time comparison over fixed-length digests.
  const a = Buffer.from(hashOtpCode(code.trim()));
  const b = Buffer.from(hashOtpCode(cfg.code));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Idempotently guarantee the app-store reviewer demo account exists as an
// ACTIVE, non-deleted PLATFORM authority (Super Admin, plantId null) so the
// fixed demo code can log in in every environment. Run once at boot. Fails
// closed: does nothing unless the demo feature is fully configured (both
// REVIEW_DEMO_EMAIL and a valid REVIEW_DEMO_OTP). The password is set from
// REVIEW_DEMO_PASSWORD (required for the authority /login first factor).
// The prod DB is read-only to tooling, so this boot self-seed is the only way
// the reviewer row lands in production (mirrors ensurePlantDirectory / master
// accounts). If a prior row drifted (soft-deleted, suspended, wrong role, or
// bound to a plant) it is restored to the canonical demo shape.
export async function ensureReviewDemoAccount(): Promise<void> {
  const cfg = reviewDemoConfig();
  if (!cfg) return;
  const email = cfg.email; // already trimmed + lowercased
  const rawPassword = process.env.REVIEW_DEMO_PASSWORD?.trim() ?? '';
  const passwordHash = rawPassword ? await hashPassword(rawPassword) : null;

  const [existing] = await db
    .select({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      plantId: users.plantId,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email));

  if (existing) {
    const needsFix =
      existing.role !== 'authority' ||
      !existing.isActive ||
      existing.deletedAt !== null ||
      existing.plantId !== null ||
      (!existing.passwordHash && passwordHash !== null);
    if (needsFix) {
      await db.update(users)
        .set({
          role: 'authority', isActive: true, deletedAt: null, plantId: null,
          suspendedBy: null, suspensionReason: null,
          ...(passwordHash ? { passwordHash } : {}),
        })
        .where(eq(users.id, existing.id));
    }
    return;
  }

  await db.insert(users).values({
    name: 'App Reviewer',
    email,
    role: 'authority',
    ...(passwordHash ? { passwordHash } : {}),
  });
}

// --- App-store reviewer OWNER demo login ------------------------------------
// A second reviewer account (role plant_owner) lets the reviewer see the owner
// dashboard. Driven by REVIEW_DEMO_OWNER_EMAIL + REVIEW_DEMO_OWNER_PASSWORD.
function reviewDemoOwnerConfig(): { email: string; password: string } | null {
  const email = process.env.REVIEW_DEMO_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.REVIEW_DEMO_OWNER_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}

export function isReviewDemoOwnerEmail(email: string): boolean {
  const cfg = reviewDemoOwnerConfig();
  return Boolean(cfg) && email.trim().toLowerCase() === cfg!.email;
}

export function isReviewDemoOwnerPassword(email: string, password: string): boolean {
  const cfg = reviewDemoOwnerConfig();
  if (!cfg || email.trim().toLowerCase() !== cfg.email) return false;
  return password.trim() === cfg.password;
}

// Idempotently seed the reviewer plant_owner account at boot. If the row
// already exists but drifted (wrong role, inactive, no password) it is repaired.
export async function ensureReviewDemoOwnerAccount(): Promise<void> {
  const cfg = reviewDemoOwnerConfig();
  if (!cfg) return;
  const email = cfg.email;
  const passwordHash = await hashPassword(cfg.password);

  const [existing] = await db
    .select({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email));

  if (existing) {
    const needsFix =
      existing.role !== 'plant_owner' ||
      !existing.isActive ||
      existing.deletedAt !== null ||
      !existing.passwordHash;
    if (needsFix) {
      await db.update(users)
        .set({
          role: 'plant_owner', isActive: true, deletedAt: null,
          suspendedBy: null, suspensionReason: null, passwordHash,
        })
        .where(eq(users.id, existing.id));
    }
    return;
  }

  await db.insert(users).values({
    name: 'Plant Owner Reviewer',
    email,
    role: 'plant_owner',
    passwordHash,
  });
}

// --- App-store reviewer phone (customer) demo login -------------------------
// REVIEW_DEMO_PHONE + REVIEW_DEMO_OTP: a fixed phone/code pair the reviewer
// uses at the customer door. The phone is normalised once to the same
// +91XXXXXXXXXX form that normalizePhone() produces for 10-digit Indian numbers.
function reviewDemoPhoneConfig(): { phone: string; code: string } | null {
  const raw = process.env.REVIEW_DEMO_PHONE?.trim();
  const code = process.env.REVIEW_DEMO_OTP?.trim();
  if (!raw || !code || code.length < 6) return null;
  const digits = raw.replace(/\D/g, '');
  const phone =
    digits.length === 10 ? `+91${digits}` :
    digits.length === 12 && digits.startsWith('91') ? `+${digits}` :
    null;
  if (!phone) return null;
  return { phone, code };
}

export function isReviewDemoPhone(phone: string): boolean {
  const cfg = reviewDemoPhoneConfig();
  return Boolean(cfg) && phone === cfg!.phone;
}

export function isReviewDemoPhoneLogin(phone: string, code: string): boolean {
  const cfg = reviewDemoPhoneConfig();
  if (!cfg || phone !== cfg.phone) return false;
  const a = Buffer.from(hashOtpCode(code.trim()));
  const b = Buffer.from(hashOtpCode(cfg.code));
  return a.length === b.length && timingSafeEqual(a, b);
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
