import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { drivers, plants, users } from '../db/schema.js';
import { bumpSessionVersion, signToken, STAFF_TOKEN_TTL } from '../middleware/auth.js';
import { resolveDriverByPhone } from '../lib/driverAccount.js';
import { isLockedOut, recordFailure, resetAttempts } from '../lib/loginAttempts.js';
import { normalizePhone } from '../lib/otp.js';
import { hashPassword } from '../lib/password.js';

/**
 * App-store reviewer access.
 *
 * This router is mounted BEFORE the normal auth router and only handles the exact
 * reviewer identities configured through environment variables. Every unrelated
 * request calls next() and follows the ordinary production login path unchanged.
 *
 * IMPORTANT: credentials never live in source control. Configure these runtime
 * secrets/variables in the deployed environment:
 *   REVIEW_OWNER_EMAIL
 *   REVIEW_OWNER_PASSWORD
 *   REVIEW_OWNER_PLANT_NAME
 *   REVIEW_DRIVER_PHONE
 *   REVIEW_DRIVER_OTP
 *   REVIEW_DRIVER_PLANT_NAME (optional alias; defaults to owner plant name)
 */

const router = Router();

interface ReviewerConfig {
  ownerEmail: string;
  ownerPassword: string;
  ownerPlantName: string;
  driverPhone: string;
  driverOtp: string;
  driverPlantName: string;
}

interface ReviewerAccounts {
  plantId: number;
  owner: typeof users.$inferSelect;
  driverUser: typeof users.$inferSelect;
  driverId: number;
}

let ensurePromise: Promise<ReviewerAccounts> | null = null;

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getReviewerConfig(): ReviewerConfig | null {
  const ownerEmail = process.env.REVIEW_OWNER_EMAIL?.trim().toLowerCase() || '';
  const ownerPassword = process.env.REVIEW_OWNER_PASSWORD || '';
  const ownerPlantName = process.env.REVIEW_OWNER_PLANT_NAME?.trim() || '';
  const driverPhone = normalizePhone(process.env.REVIEW_DRIVER_PHONE || '') || '';
  const driverOtp = process.env.REVIEW_DRIVER_OTP?.trim() || '';
  const driverPlantName = process.env.REVIEW_DRIVER_PLANT_NAME?.trim() || ownerPlantName;

  // Fail closed unless the complete reviewer pair is deliberately configured.
  if (
    !ownerEmail || !ownerEmail.includes('@') ||
    ownerPassword.length < 8 ||
    !ownerPlantName ||
    !driverPhone ||
    driverOtp.length < 6 || driverOtp.length > 10 ||
    !driverPlantName
  ) {
    return null;
  }

  return { ownerEmail, ownerPassword, ownerPlantName, driverPhone, driverOtp, driverPlantName };
}

export function isReviewerOwnerEmail(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  const cfg = getReviewerConfig();
  return Boolean(cfg) && input.trim().toLowerCase() === cfg!.ownerEmail;
}

export function isReviewerDriverPhone(input: unknown): boolean {
  const cfg = getReviewerConfig();
  const phone = normalizePhone(input);
  return Boolean(cfg && phone && phone === cfg.driverPhone);
}

export function verifyReviewerOwnerPassword(password: unknown): boolean {
  if (typeof password !== 'string') return false;
  const cfg = getReviewerConfig();
  return Boolean(cfg) && constantTimeEqual(password, cfg!.ownerPassword);
}

export function verifyReviewerDriverOtp(code: unknown): boolean {
  if (typeof code !== 'string') return false;
  const cfg = getReviewerConfig();
  return Boolean(cfg) && constantTimeEqual(code.trim(), cfg!.driverOtp);
}

async function findReviewerPlant(cfg: ReviewerConfig) {
  const ownerName = cfg.ownerPlantName.toLowerCase();
  let [plant] = await db
    .select()
    .from(plants)
    .where(sql`lower(${plants.name}) = ${ownerName}`)
    .limit(1);

  if (!plant && cfg.driverPlantName.toLowerCase() !== ownerName) {
    const driverName = cfg.driverPlantName.toLowerCase();
    [plant] = await db
      .select()
      .from(plants)
      .where(sql`lower(${plants.name}) = ${driverName}`)
      .limit(1);
  }

  if (plant) return plant;

  // Create a review-only plant only when neither configured name exists. It is
  // intentionally hidden from the public network and cannot appear in customer
  // discovery. Coordinates are a neutral Panvel-area fallback and are irrelevant
  // while showOnNetwork/locationVerified/verified stay false.
  [plant] = await db
    .insert(plants)
    .values({
      name: cfg.ownerPlantName,
      legalName: cfg.ownerPlantName,
      city: 'Panvel',
      latitude: '18.9894000',
      longitude: '73.1175000',
      plantStatus: 'approved',
      subscriptionStatus: 'active',
      subscriptionPlan: 'free',
      isActive: true,
      locationVerified: false,
      verified: false,
      networkStatus: 'pending',
      showOnNetwork: false,
    })
    .returning();
  return plant;
}

async function ensureOwner(cfg: ReviewerConfig, plantId: number) {
  let [owner] = await db.select().from(users).where(eq(users.email, cfg.ownerEmail));

  if (owner) {
    const passwordMatches = Boolean(owner.passwordHash) && await bcrypt.compare(cfg.ownerPassword, owner.passwordHash as string);
    const passwordHash = passwordMatches ? owner.passwordHash : await hashPassword(cfg.ownerPassword);
    [owner] = await db
      .update(users)
      .set({
        name: 'App Reviewer Owner',
        passwordHash,
        role: 'plant_owner',
        isActive: true,
        deletedAt: null,
        plantId,
        linkedClientId: null,
        linkedDriverId: null,
        suspendedBy: null,
        suspensionReason: null,
      })
      .where(eq(users.id, owner.id))
      .returning();
    return owner;
  }

  [owner] = await db
    .insert(users)
    .values({
      name: 'App Reviewer Owner',
      email: cfg.ownerEmail,
      passwordHash: await hashPassword(cfg.ownerPassword),
      role: 'plant_owner',
      isActive: true,
      plantId,
    })
    .returning();
  return owner;
}

async function ensureDriver(cfg: ReviewerConfig, plantId: number) {
  const last10 = cfg.driverPhone.replace(/\D/g, '').slice(-10);
  let [driver] = await db
    .select()
    .from(drivers)
    .where(sql`right(regexp_replace(${drivers.phone}, '[^0-9]', '', 'g'), 10) = ${last10}`)
    .orderBy(drivers.id)
    .limit(1);

  if (driver) {
    if (!driver.isActive) {
      [driver] = await db
        .update(drivers)
        .set({ isActive: true })
        .where(eq(drivers.id, driver.id))
        .returning();
    }
  } else {
    [driver] = await db
      .insert(drivers)
      .values({
        name: 'App Reviewer Driver',
        phone: cfg.driverPhone,
        isActive: true,
      })
      .returning();
  }

  let [driverUser] = await db
    .select()
    .from(users)
    .where(eq(users.linkedDriverId, driver.id))
    .orderBy(users.id)
    .limit(1);

  if (!driverUser) {
    const placeholderEmail = `review_driver_${driver.id}@otp.local`;
    [driverUser] = await db.select().from(users).where(eq(users.email, placeholderEmail));

    if (driverUser) {
      [driverUser] = await db
        .update(users)
        .set({
          name: driver.name,
          role: 'driver',
          isActive: true,
          deletedAt: null,
          plantId,
          linkedClientId: null,
          linkedDriverId: driver.id,
          suspendedBy: null,
          suspensionReason: null,
        })
        .where(eq(users.id, driverUser.id))
        .returning();
    } else {
      [driverUser] = await db
        .insert(users)
        .values({
          name: driver.name,
          email: placeholderEmail,
          passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
          role: 'driver',
          isActive: true,
          plantId,
          linkedDriverId: driver.id,
        })
        .returning();
    }
  } else {
    [driverUser] = await db
      .update(users)
      .set({
        name: driver.name,
        role: 'driver',
        isActive: true,
        deletedAt: null,
        plantId,
        linkedClientId: null,
        suspendedBy: null,
        suspensionReason: null,
      })
      .where(eq(users.id, driverUser.id))
      .returning();
  }

  return { driver, driverUser };
}

export async function ensureReviewerAccounts(): Promise<ReviewerAccounts | null> {
  const cfg = getReviewerConfig();
  if (!cfg) return null;

  // In tests the database is truncated between cases, so don't retain a stale
  // promise. Production keeps one idempotent initialization for the process.
  if (process.env.NODE_ENV === 'test') {
    const plant = await findReviewerPlant(cfg);
    const owner = await ensureOwner(cfg, plant.id);
    const { driver, driverUser } = await ensureDriver(cfg, plant.id);
    return { plantId: plant.id, owner, driverUser, driverId: driver.id };
  }

  if (!ensurePromise) {
    ensurePromise = (async () => {
      const plant = await findReviewerPlant(cfg);
      const owner = await ensureOwner(cfg, plant.id);
      const { driver, driverUser } = await ensureDriver(cfg, plant.id);
      return { plantId: plant.id, owner, driverUser, driverId: driver.id };
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

// Staff login-method probe: force the configured reviewer owner onto the
// password form even when ordinary plant_owner accounts are passwordless.
router.post('/staff/login-method', async (req, res, next) => {
  if (!isReviewerOwnerEmail(req.body?.email)) {
    next();
    return;
  }
  try {
    const accounts = await ensureReviewerAccounts();
    if (!accounts) {
      next();
      return;
    }
    res.json({ method: 'password' });
  } catch (error) {
    console.error('[reviewer-auth] login-method provisioning failed', error);
    res.status(503).json({ error: 'Reviewer access is temporarily unavailable.' });
  }
});

// Reviewer owner: password-only sign-in, no secondary OTP. This exception is
// limited to the exact env-configured reviewer email and remains subject to the
// same account/session model used by ordinary staff.
router.post('/login', async (req, res, next) => {
  if (!isReviewerOwnerEmail(req.body?.email)) {
    next();
    return;
  }

  const cfg = getReviewerConfig();
  if (!cfg) {
    next();
    return;
  }
  const lockoutKey = `review-owner:${cfg.ownerEmail}`;
  const { locked, retryAfterMs } = await isLockedOut(lockoutKey);
  if (locked) {
    const minutes = Math.ceil((retryAfterMs ?? 0) / 60000);
    res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.max(1, minutes)} minute(s).` });
    return;
  }

  if (!verifyReviewerOwnerPassword(req.body?.password)) {
    await recordFailure(lockoutKey);
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  try {
    const accounts = await ensureReviewerAccounts();
    if (!accounts) {
      res.status(503).json({ error: 'Reviewer access is not configured.' });
      return;
    }
    await resetAttempts(lockoutKey);
    const { owner } = accounts;
    const sessionVersion = await bumpSessionVersion(owner.id);
    const token = signToken({
      id: owner.id,
      email: owner.email,
      role: owner.role,
      name: owner.name,
      plantId: owner.plantId,
      linkedClientId: owner.linkedClientId,
      linkedDriverId: owner.linkedDriverId,
      sessionVersion,
    }, { expiresIn: STAFF_TOKEN_TTL });

    res.json({
      token,
      user: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: owner.role,
        plantId: owner.plantId,
        linkedClientId: owner.linkedClientId,
        linkedDriverId: owner.linkedDriverId,
      },
    });
  } catch (error) {
    console.error('[reviewer-auth] owner login failed', error);
    res.status(503).json({ error: 'Reviewer access is temporarily unavailable.' });
  }
});

// Legacy/server phone-OTP path: for the configured reviewer driver, never send a
// real SMS/WhatsApp message. The fixed Play Console code is verified below.
router.post('/otp/send', async (req, res, next) => {
  if (!isReviewerDriverPhone(req.body?.phone)) {
    next();
    return;
  }
  try {
    const accounts = await ensureReviewerAccounts();
    if (!accounts) {
      next();
      return;
    }
    res.json({ ok: true, channel: 'review', devMode: false });
  } catch (error) {
    console.error('[reviewer-auth] driver OTP provisioning failed', error);
    res.status(503).json({ error: 'Reviewer access is temporarily unavailable.' });
  }
});

router.post('/otp/verify', async (req, res, next) => {
  if (!isReviewerDriverPhone(req.body?.phone)) {
    next();
    return;
  }

  const cfg = getReviewerConfig();
  if (!cfg) {
    next();
    return;
  }
  const lockoutKey = `review-driver:${cfg.driverPhone}`;
  const { locked, retryAfterMs } = await isLockedOut(lockoutKey);
  if (locked) {
    const minutes = Math.ceil((retryAfterMs ?? 0) / 60000);
    res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.max(1, minutes)} minute(s).` });
    return;
  }

  if (!verifyReviewerDriverOtp(req.body?.code)) {
    await recordFailure(lockoutKey);
    res.status(400).json({ error: 'That code is incorrect or has expired.' });
    return;
  }

  try {
    await ensureReviewerAccounts();
    const driverRes = await resolveDriverByPhone(cfg.driverPhone);
    if (driverRes.kind !== 'match') {
      const error = driverRes.kind === 'error' ? driverRes.error : 'Reviewer driver account is unavailable.';
      const status = driverRes.kind === 'error' ? driverRes.status : 503;
      res.status(status).json({ error });
      return;
    }

    await resetAttempts(lockoutKey);
    const { user } = driverRes;
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      plantId: user.plantId,
      linkedClientId: user.linkedClientId,
      linkedDriverId: user.linkedDriverId,
    });

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: cfg.driverPhone,
        plantId: driverRes.plantId,
        linkedClientId: user.linkedClientId,
        linkedDriverId: driverRes.driverId,
        truckId: driverRes.truckId,
        truckNo: driverRes.truckNo,
      },
    });
  } catch (error) {
    console.error('[reviewer-auth] driver login failed', error);
    res.status(503).json({ error: 'Reviewer access is temporarily unavailable.' });
  }
});

export default router;
