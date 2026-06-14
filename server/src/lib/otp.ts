import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { otpCodes } from '../db/schema.js';

// Phone-OTP provider abstraction.
//
// When Twilio Verify is configured (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN +
// TWILIO_VERIFY_SERVICE_SID) codes are generated, delivered over WhatsApp, and
// verified entirely by Twilio — nothing is stored locally. When it is NOT
// configured we fall back to a local dev flow: a code is generated, its SHA-256
// hash is stored in otp_codes, and (only outside production) the plaintext is
// returned to the caller so the whole login can be exercised without any
// external dependency. The moment real Twilio credentials are added, delivery
// switches to WhatsApp automatically with no code change.

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

export function isOtpProviderConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID,
  );
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Normalize loosely-typed user input to E.164. Defaults a bare 10-digit number
// to India (+91), which is the primary market. Returns null when the input
// can't be a plausible mobile number so callers can 400 cleanly.
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s\-()]/g, '');
  if (!s) return null;

  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`; // bare Indian mobile
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

const twilioAuthHeader = () =>
  'Basic ' +
  Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

export interface SendResult {
  ok: boolean;
  channel: 'whatsapp' | 'dev';
  // Present only in dev mode (no provider configured) and never in production —
  // lets the client show the code so the flow is testable end-to-end.
  devCode?: string;
  error?: string;
}

export async function sendOtp(phone: string): Promise<SendResult> {
  if (isOtpProviderConfigured()) {
    try {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/Verifications`,
        {
          method: 'POST',
          headers: {
            Authorization: twilioAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: phone, Channel: 'whatsapp' }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        return { ok: false, channel: 'whatsapp', error: `Verification provider error (${res.status}). ${detail.slice(0, 200)}` };
      }
      return { ok: true, channel: 'whatsapp' };
    } catch {
      return { ok: false, channel: 'whatsapp', error: 'Could not reach the verification provider. Please try again.' };
    }
  }

  // --- Dev fallback ---------------------------------------------------------
  // Fail CLOSED in production: with no provider there is no way to actually
  // deliver a code, so returning ok would silently lock real users out (they'd
  // wait for a message that never arrives). The dev fallback is for non-prod
  // only; in production a provider MUST be configured.
  if (isProd()) {
    return { ok: false, channel: 'dev', error: 'Phone verification is not available right now. Please contact support.' };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await db
    .insert(otpCodes)
    .values({ phone, codeHash: hashCode(code), expiresAt, attempts: 0 })
    .onConflictDoUpdate({
      target: otpCodes.phone,
      set: { codeHash: hashCode(code), expiresAt, attempts: 0, createdAt: new Date() },
    });

  return { ok: true, channel: 'dev', devCode: isProd() ? undefined : code };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  if (isOtpProviderConfigured()) {
    try {
      const res = await fetch(
        `https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            Authorization: twilioAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: phone, Code: code }),
        },
      );
      if (!res.ok) {
        return { ok: false, error: 'That code is incorrect or has expired. Please request a new one.' };
      }
      const data = (await res.json()) as { status?: string };
      if (data.status === 'approved') return { ok: true };
      return { ok: false, error: 'That code is incorrect or has expired. Please request a new one.' };
    } catch {
      return { ok: false, error: 'Could not reach the verification provider. Please try again.' };
    }
  }

  // --- Dev fallback ---------------------------------------------------------
  // Every failure path returns the SAME generic message so an attacker can't
  // learn from the response whether a code was ever requested for a number, or
  // whether it expired vs. was simply wrong (phone-state enumeration).
  const GENERIC = 'That code is incorrect or has expired. Please request a new one.';
  const [row] = await db.select().from(otpCodes).where(eq(otpCodes.phone, phone));
  if (!row) {
    return { ok: false, error: GENERIC };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
    return { ok: false, error: GENERIC };
  }
  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
    return { ok: false, error: GENERIC };
  }
  if (row.codeHash !== hashCode(code)) {
    await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.phone, phone));
    return { ok: false, error: GENERIC };
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  return { ok: true };
}
