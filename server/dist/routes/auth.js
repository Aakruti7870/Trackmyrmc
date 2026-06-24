import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { hashPassword } from '../lib/password.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, clients, auditLogs, plants } from '../db/schema.js';
import { verifyToken as clerkVerifyToken, createClerkClient } from '@clerk/backend';
import { signToken, requireAuth } from '../middleware/auth.js';
import { isAuthorityEmail } from '../lib/authority.js';
import { resolveStaffSsoUser } from '../lib/staffSso.js';
import { resolveCustomerByPhone, resolveCustomerByEmail } from '../lib/customerAccount.js';
import { isLockedOut, recordFailure, resetAttempts } from '../lib/loginAttempts.js';
import { peekInviteToken, redeemInviteToken, createInviteToken } from '../lib/inviteToken.js';
import { sendPasswordResetEmail } from '../lib/email.js';
import { rateLimit } from '../lib/rateLimit.js';
import { normalizePhone, isOtpProviderConfigured, sendOtp, verifyOtp } from '../lib/otp.js';
import { isSubscriptionBlocking, subscriptionBlockMessage } from '../lib/subscription.js';
const router = Router();
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const plantCode = typeof req.body.plantCode === 'string' ? req.body.plantCode.trim() : '';
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
    }
    const lockoutKey = `login:${email.toLowerCase().trim()}`;
    const { locked, retryAfterMs } = await isLockedOut(lockoutKey);
    if (locked) {
        const minutes = Math.ceil(retryAfterMs / 60000);
        res.status(429).json({
            error: `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
        });
        return;
    }
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
    // A non-existent or soft-deleted account stays an opaque "invalid credentials"
    // so the endpoint can't be used to enumerate accounts.
    if (!user || user.deletedAt) {
        await recordFailure(lockoutKey);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
        await recordFailure(lockoutKey);
        const { locked: nowLocked, retryAfterMs: retryMs } = await isLockedOut(lockoutKey);
        if (nowLocked) {
            const minutes = Math.ceil(retryMs / 60000);
            res.status(429).json({
                error: `Too many failed attempts. Account locked for ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
            });
            return;
        }
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }
    // The password is correct, so it is safe to tell a suspended user *why* they
    // can't get in (no enumeration risk). Surface the reason captured at
    // suspension time when present, so staff know who to contact.
    if (!user.isActive) {
        await resetAttempts(lockoutKey);
        const reason = user.suspensionReason?.trim();
        res.status(403).json({
            error: reason
                ? `Your account has been suspended: ${reason}. Please contact your administrator.`
                : 'Your account has been suspended. Please contact your administrator.',
            suspended: true,
        });
        return;
    }
    if (user.role === 'authority' && !isAuthorityEmail(user.email)) {
        res.status(403).json({ error: 'This account is not on the AUTHORITY allow-list.' });
        return;
    }
    // Billing gate: a plant-scoped staff account cannot sign in while its plant's
    // subscription is suspended or cancelled. Platform staff (plantId === null)
    // are never gated. trial/active/past_due all pass.
    if (user.plantId) {
        const [plant] = await db
            .select({ status: plants.subscriptionStatus })
            .from(plants)
            .where(eq(plants.id, user.plantId));
        if (plant && isSubscriptionBlocking(plant.status)) {
            await resetAttempts(lockoutKey);
            res.status(403).json({
                error: subscriptionBlockMessage(plant.status),
                subscriptionBlocked: true,
            });
            return;
        }
    }
    // Optional Plant ID: when staff supply their plant code, it must match the
    // plant their account is linked to (defence in depth against signing into the
    // wrong tenant). Left blank, login proceeds as before.
    if (plantCode) {
        const [plant] = user.plantId
            ? await db.select({ code: plants.plantCode }).from(plants).where(eq(plants.id, user.plantId))
            : [];
        if (!plant?.code || plant.code.toLowerCase() !== plantCode.toLowerCase()) {
            await resetAttempts(lockoutKey);
            res.status(403).json({ error: 'This account is not linked to that Plant ID.' });
            return;
        }
    }
    await resetAttempts(lockoutKey);
    const token = signToken({
        id: user.id, email: user.email, role: user.role, name: user.name,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
    });
    res.json({
        token,
        user: {
            id: user.id, name: user.name, email: user.email, role: user.role,
            linkedClientId: user.linkedClientId,
            linkedDriverId: user.linkedDriverId,
        },
    });
});
router.get('/me', requireAuth, async (req, res) => {
    const [user] = await db.select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
    }).from(users).where(eq(users.id, req.user.id));
    res.json(user);
});
router.put('/me', requireAuth, async (req, res) => {
    const { name, email } = req.body;
    if (!name && !email) {
        res.status(400).json({ error: 'At least one of name or email is required' });
        return;
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        res.status(400).json({ error: 'Name must be a non-empty string' });
        return;
    }
    if (email !== undefined) {
        if (typeof email !== 'string' || !email.includes('@')) {
            res.status(400).json({ error: 'A valid email is required' });
            return;
        }
        const [existing] = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.email, email.toLowerCase().trim()));
        if (existing && existing.id !== req.user.id) {
            res.status(409).json({ error: 'Email is already in use by another account' });
            return;
        }
        // Preserve the AUTHORITY allow-list invariant: an authority account may not
        // move itself to an email that isn't on the allow-list.
        if (req.user.role === 'authority' && !isAuthorityEmail(email)) {
            res.status(403).json({ error: 'AUTHORITY accounts must use an allow-listed email address.' });
            return;
        }
    }
    const updates = {};
    if (name !== undefined)
        updates.name = name.trim();
    if (email !== undefined)
        updates.email = email.toLowerCase().trim();
    await db.update(users).set(updates).where(eq(users.id, req.user.id));
    const [updated] = await db.select({
        id: users.id, name: users.name, email: users.email, role: users.role,
        linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
    }).from(users).where(eq(users.id, req.user.id));
    const token = signToken({
        id: updated.id, email: updated.email, role: updated.role, name: updated.name,
        linkedClientId: updated.linkedClientId,
        linkedDriverId: updated.linkedDriverId,
    });
    res.json({ token, user: updated });
});
router.put('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'currentPassword and newPassword are required' });
        return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters' });
        return;
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    if (typeof currentPassword !== 'string') {
        res.status(400).json({ error: 'currentPassword must be a string' });
        return;
    }
    const lockoutKey = `change-password:${user.id}`;
    const { locked, retryAfterMs } = await isLockedOut(lockoutKey);
    if (locked) {
        const minutes = Math.ceil(retryAfterMs / 60000);
        res.status(429).json({
            error: `Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
        });
        return;
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
        await recordFailure(lockoutKey);
        const { locked: nowLocked, retryAfterMs: retryMs } = await isLockedOut(lockoutKey);
        if (nowLocked) {
            const minutes = Math.ceil(retryMs / 60000);
            res.status(429).json({
                error: `Too many failed attempts. Account locked for ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
            });
            return;
        }
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
    }
    await resetAttempts(lockoutKey);
    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    res.json({ message: 'Password updated successfully' });
});
// Token exchange: Clerk authenticates the identity in the browser; the client
// posts its short-lived Clerk session token here, we verify it server-side with
// the Clerk secret key, resolve the verified primary email to a staff/authority
// user, and issue the same legacy JWT the password flow issues. Everything
// downstream (requireAuth, the api.ts Bearer header, SSE) is unchanged.
router.post('/clerk', async (req, res) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
        res.status(503).json({ error: 'Single sign-on is not configured on this server.' });
        return;
    }
    const { token } = req.body ?? {};
    if (!token || typeof token !== 'string') {
        res.status(400).json({ error: 'A Clerk session token is required' });
        return;
    }
    let clerkUserId;
    try {
        const claims = await clerkVerifyToken(token, { secretKey });
        clerkUserId = claims.sub;
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired single sign-on session' });
        return;
    }
    if (!clerkUserId) {
        res.status(401).json({ error: 'Invalid or expired single sign-on session' });
        return;
    }
    // The session token only carries the Clerk user id (sub); fetch the profile
    // to read the *verified* primary email so an unverified address can't be used
    // to impersonate a staff account.
    let email = null;
    try {
        const clerk = createClerkClient({ secretKey });
        const cu = await clerk.users.getUser(clerkUserId);
        // Strictly require the *primary* email and that it is verified — never fall
        // back to an arbitrary address, so an unverified or secondary email can't be
        // used to impersonate a staff/authority account.
        const primary = cu.primaryEmailAddressId
            ? cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
            : undefined;
        if (primary && primary.verification?.status === 'verified') {
            email = primary.emailAddress;
        }
    }
    catch {
        res.status(502).json({ error: 'Could not read your single sign-on profile' });
        return;
    }
    if (!email) {
        res.status(403).json({ error: 'A verified email address is required to sign in.' });
        return;
    }
    const result = await resolveStaffSsoUser(email);
    if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
    }
    const { user } = result;
    const appToken = signToken({
        id: user.id, email: user.email, role: user.role, name: user.name,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
    });
    res.json({
        token: appToken,
        user: {
            id: user.id, name: user.name, email: user.email, role: user.role,
            linkedClientId: user.linkedClientId,
            linkedDriverId: user.linkedDriverId,
        },
    });
});
// Customer token exchange: the mirror of POST /auth/clerk for the *phone* side.
// Clerk verifies the customer's mobile number with an SMS one-time code in the
// browser; the client posts the resulting Clerk session token here. We verify it
// server-side, read the identity's *verified primary phone number*, and resolve
// (or transparently create) the matching 'client' account — exactly the same
// mapping the Twilio OTP flow uses, so a number resolves to the same account no
// matter which provider verified it.
//
// Security boundary: this path keys on the verified PHONE only and always yields
// a client account; it never reads email and never maps onto a staff role. The
// staff /auth/clerk path keys on the verified EMAIL only. The two are kept
// separate so a phone-only identity can't reach a staff account and an
// email/Google identity can't reach a customer account.
const clerkCustomerSchema = z.object({
    token: z.string().min(1, 'A Clerk session token is required'),
    name: z.string().trim().max(120).optional(),
});
router.post('/clerk/customer', async (req, res) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
        res.status(503).json({ error: 'Phone sign-in is not configured on this server.' });
        return;
    }
    const parse = clerkCustomerSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message ?? 'A Clerk session token is required' });
        return;
    }
    let clerkUserId;
    try {
        const claims = await clerkVerifyToken(parse.data.token, { secretKey });
        clerkUserId = claims.sub;
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired sign-in session' });
        return;
    }
    if (!clerkUserId) {
        res.status(401).json({ error: 'Invalid or expired sign-in session' });
        return;
    }
    // The session token only carries the Clerk user id (sub); fetch the profile to
    // read the *verified primary* phone number. Never fall back to an unverified or
    // secondary number, so a customer can only sign into the account for a number
    // they have actually proven they control.
    let rawPhone = null;
    try {
        const clerk = createClerkClient({ secretKey });
        const cu = await clerk.users.getUser(clerkUserId);
        const primary = cu.primaryPhoneNumberId
            ? cu.phoneNumbers.find((p) => p.id === cu.primaryPhoneNumberId)
            : undefined;
        if (primary && primary.verification?.status === 'verified') {
            rawPhone = primary.phoneNumber;
        }
    }
    catch {
        res.status(502).json({ error: 'Could not read your sign-in profile' });
        return;
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
        res.status(403).json({ error: 'A verified mobile number is required to sign in.' });
        return;
    }
    const resolved = await resolveCustomerByPhone(phone, parse.data.name);
    if (!resolved.ok) {
        res.status(resolved.status).json({ error: resolved.error });
        return;
    }
    const { user } = resolved;
    const appToken = signToken({
        id: user.id, email: user.email, role: user.role, name: user.name,
        plantId: user.plantId,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
    });
    res.json({
        token: appToken,
        user: {
            id: user.id, name: user.name, email: user.email, role: user.role,
            phone: user.phone,
            plantId: user.plantId,
            linkedClientId: user.linkedClientId,
            linkedDriverId: user.linkedDriverId,
        },
    });
});
// Customer token exchange via Google (OAuth). The mirror of POST /auth/clerk for
// the *email* side of the customer flow: Clerk verifies the customer's Google
// identity in the browser; the client posts the resulting Clerk session token
// here. We verify it server-side, read the identity's *verified primary email*,
// and resolve (or transparently create) the matching 'client' account.
//
// Security boundary: this path keys on the verified EMAIL only and always yields
// a client account; if the email belongs to a staff/authority account it refuses
// (resolveCustomerByEmail). Staff use POST /auth/clerk, which only ever resolves
// staff roles — the two can never cross-issue a token for the other's account.
router.post('/clerk/customer/google', async (req, res) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
        res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
        return;
    }
    const parse = clerkCustomerSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message ?? 'A Clerk session token is required' });
        return;
    }
    let clerkUserId;
    try {
        const claims = await clerkVerifyToken(parse.data.token, { secretKey });
        clerkUserId = claims.sub;
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired sign-in session' });
        return;
    }
    if (!clerkUserId) {
        res.status(401).json({ error: 'Invalid or expired sign-in session' });
        return;
    }
    // Read the *verified primary* email. Never fall back to an unverified or
    // secondary address, so a customer can only sign into the account for an email
    // they have actually proven they control.
    let rawEmail = null;
    try {
        const clerk = createClerkClient({ secretKey });
        const cu = await clerk.users.getUser(clerkUserId);
        const primary = cu.primaryEmailAddressId
            ? cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)
            : undefined;
        if (primary && primary.verification?.status === 'verified') {
            rawEmail = primary.emailAddress;
        }
    }
    catch {
        res.status(502).json({ error: 'Could not read your sign-in profile' });
        return;
    }
    if (!rawEmail) {
        res.status(403).json({ error: 'A verified email address is required to sign in.' });
        return;
    }
    const resolved = await resolveCustomerByEmail(rawEmail, parse.data.name);
    if (!resolved.ok) {
        res.status(resolved.status).json({ error: resolved.error });
        return;
    }
    const { user } = resolved;
    const appToken = signToken({
        id: user.id, email: user.email, role: user.role, name: user.name,
        plantId: user.plantId,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
    });
    res.json({
        token: appToken,
        user: {
            id: user.id, name: user.name, email: user.email, role: user.role,
            phone: user.phone,
            plantId: user.plantId,
            linkedClientId: user.linkedClientId,
            linkedDriverId: user.linkedDriverId,
        },
    });
});
// --- Forgot password -------------------------------------------------------
// A user who knows their email but not their password can request a single-use
// reset link. We reuse the same password-setup token machinery as the owner
// invite (tagged kind='reset' so redeeming never reactivates a suspended
// account), and the same /set-password page redeems it. Always responds 200 with
// a generic message so the endpoint can't be used to discover which emails have
// accounts. Rate-limited per IP to blunt abuse / email bombing.
// Build the reset-link origin from TRUSTED configuration only — never from the
// request Host / X-Forwarded-Host headers, which an attacker can forge to make
// us email a victim a link pointing at attacker-controlled domain (token
// exfiltration → account takeover). Falls back to the Replit dev domain so the
// flow is testable in development; returns null when no trusted origin exists.
export function trustedResetBaseUrl() {
    const env = (process.env.APP_URL || process.env.PUBLIC_URL || '').trim();
    if (env)
        return env.replace(/\/+$/, '');
    const dev = (process.env.REPLIT_DEV_DOMAIN || '').trim();
    if (dev)
        return `https://${dev.replace(/\/+$/, '')}`;
    return null;
}
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, name: 'forgot-password' });
const forgotPasswordSchema = z.object({
    email: z.string().trim().email('A valid email address is required').max(320),
});
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    const parse = forgotPasswordSchema.safeParse(req.body ?? {});
    // Even on a malformed email we return the same generic success, so the caller
    // learns nothing about which addresses are registered.
    const generic = {
        ok: true,
        message: 'If an account exists for that email, a password reset link has been sent.',
    };
    if (!parse.success) {
        res.json(generic);
        return;
    }
    const email = parse.data.email.toLowerCase();
    // Only real, ACTIVE, non-deleted accounts that sign in with a password (i.e.
    // not phone-OTP placeholder @otp.local users) can reset a password this way.
    // Suspended (isActive=false) accounts are intentionally excluded so reset is
    // never a path back into a disabled account.
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (user && user.isActive && !user.deletedAt && !user.email.endsWith('@otp.local')) {
        try {
            const base = trustedResetBaseUrl();
            if (!base) {
                console.error('[auth] forgot-password: no trusted base URL (set APP_URL); skipping reset email.');
            }
            else {
                const { token, expiresAt } = await createInviteToken(user.id, undefined, 'reset');
                const resetUrl = `${base}/set-password?token=${token}`;
                const sent = await sendPasswordResetEmail(user.email, user.name, resetUrl, expiresAt);
                await db.insert(auditLogs).values({
                    actorId: user.id,
                    actorName: user.name,
                    action: 'password_reset_requested',
                    targetUserId: user.id,
                    targetUserEmail: user.email,
                    status: sent ? 'success' : 'failure',
                    detail: sent
                        ? 'Password reset link emailed'
                        : 'Password reset requested but email could not be sent (SMTP not configured)',
                });
            }
        }
        catch (err) {
            // Never surface internal failures to the caller; just log for operators.
            console.error('[auth] forgot-password failed:', err);
        }
    }
    res.json(generic);
});
// --- Password-setup invite (plant-owner onboarding) ------------------------
// A newly provisioned account is emailed a single-use link; these two public
// endpoints back the "set your password" page. GET validates the token so the
// page can show whose account it is; POST consumes it and sets the password.
router.get('/invite/:token', async (req, res) => {
    const result = await peekInviteToken(req.params.token);
    if (!result.ok) {
        res.status(400).json({ error: 'This invite link is invalid or has expired.', reason: result.reason });
        return;
    }
    res.json({ name: result.user.name, email: result.user.email, role: result.user.role });
});
const setPasswordSchema = z.object({
    token: z.string().min(1, 'A valid invite token is required'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
router.post('/set-password', async (req, res) => {
    const parse = setPasswordSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Invalid request' });
        return;
    }
    const { token, password } = parse.data;
    const passwordHash = await hashPassword(password);
    const result = await redeemInviteToken(token, passwordHash);
    if (!result.ok) {
        // A reset token whose account has since been suspended/deleted is rejected
        // outright — resetting a password must never reactivate a disabled account.
        if (result.reason === 'disabled') {
            res.status(403).json({
                error: 'This account is not active. Please contact an administrator.',
                reason: result.reason,
            });
            return;
        }
        res.status(400).json({ error: 'This link is invalid or has expired.', reason: result.reason });
        return;
    }
    // Reload the full account so the issued session token carries the same fields
    // the login/register flows set (plant scoping etc. are reloaded in requireAuth).
    const [user] = await db.select().from(users).where(eq(users.id, result.user.id));
    await db.insert(auditLogs).values({
        actorId: user.id,
        actorName: user.name,
        action: 'password_set',
        targetUserId: user.id,
        targetUserEmail: user.email,
        status: 'success',
        detail: result.kind === 'reset' ? 'Password changed via reset link' : 'Password set via invite link',
    });
    // Log the owner straight in so they land in their plant dashboard without a
    // second sign-in step. Mirrors the /login response shape.
    const appToken = signToken({
        id: user.id, email: user.email, role: user.role, name: user.name,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
    });
    res.json({
        token: appToken,
        user: {
            id: user.id, name: user.name, email: user.email, role: user.role,
            linkedClientId: user.linkedClientId,
            linkedDriverId: user.linkedDriverId,
        },
    });
});
// --- Self-service customer registration ------------------------------------
// Public endpoint: a prospective customer creates their own company + login.
// Accounts are created ACTIVE so the customer can sign in and place an order
// straight away — a friction-free, self-serve onboarding. Abuse is mitigated by
// the per-IP rate limit below rather than a manual approval queue. The endpoint
// returns a session token so the client app can log the customer in instantly.
const registerSchema = z.object({
    name: z.string().trim().min(2, 'Your name is required').max(120),
    companyName: z.string().trim().min(2, 'Company name is required').max(160),
    email: z.string().trim().toLowerCase().email('A valid email is required').max(160)
        // The @otp.local domain is reserved for placeholder addresses on phone-OTP
        // accounts; blocking it here stops a self-registration from squatting the
        // deterministic placeholder of a target phone number and blocking that
        // number's OTP signup.
        .refine((e) => !e.endsWith('@otp.local'), 'A valid email is required'),
    phone: z.string().trim().min(6, 'A valid phone number is required').max(30),
    password: z.string().min(8, 'Password must be at least 8 characters').max(200),
    gstNo: z.string().trim().max(30).optional().or(z.literal('')),
    city: z.string().trim().max(120).optional().or(z.literal('')),
    address: z.string().trim().max(400).optional().or(z.literal('')),
});
router.post('/register', async (req, res) => {
    // Throttle by client IP so the public endpoint cannot be used to mass-create
    // accounts. Reuses the same lockout store as failed logins.
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket.remoteAddress || 'unknown';
    const rateKey = `register:${ip}`;
    const { locked, retryAfterMs } = await isLockedOut(rateKey);
    if (locked) {
        const minutes = Math.ceil(retryAfterMs / 60000);
        res.status(429).json({ error: `Too many registration attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` });
        return;
    }
    await recordFailure(rateKey);
    const parse = registerSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Invalid registration details' });
        return;
    }
    const data = parse.data;
    // Reject duplicates against any existing account (including soft-deleted) so a
    // self-registration can never collide with or resurrect a managed account.
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
    if (existing) {
        res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
        return;
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const newUser = await db.transaction(async (tx) => {
        const [client] = await tx.insert(clients).values({
            name: data.companyName,
            contactPerson: data.name,
            phone: data.phone,
            email: data.email,
            gstNo: data.gstNo || null,
            city: data.city || null,
            address: data.address || null,
        }).returning();
        const [user] = await tx.insert(users).values({
            name: data.name,
            email: data.email,
            passwordHash,
            role: 'client',
            isActive: true,
            linkedClientId: client.id,
        }).returning();
        await tx.insert(auditLogs).values({
            actorId: null,
            actorName: data.name,
            action: 'account_registered',
            targetUserId: user.id,
            targetUserEmail: user.email,
            status: 'success',
            detail: `Self-registered customer "${data.companyName}" — account active`,
        });
        return user;
    });
    // Log the customer straight in so they can place an order without a second
    // step. Mirrors the /login response shape so the client can reuse it.
    const token = signToken({
        id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name,
        linkedClientId: newUser.linkedClientId,
        linkedDriverId: newUser.linkedDriverId,
    });
    res.status(201).json({
        ok: true,
        token,
        user: {
            id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role,
            linkedClientId: newUser.linkedClientId,
            linkedDriverId: newUser.linkedDriverId,
        },
    });
});
// --- Phone-first WhatsApp OTP (customers) -----------------------------------
// Customers in our market often have no email, so they sign in with a mobile
// number verified by a one-time code (WhatsApp via Twilio Verify in production,
// a local dev fallback otherwise). Verifying a number that has no account yet
// transparently creates a 'client' account — there is no separate register step.
const otpSendSchema = z.object({
    phone: z.string().min(1, 'Phone number is required'),
    name: z.string().trim().max(120).optional(),
});
const otpVerifySchema = z.object({
    phone: z.string().min(1, 'Phone number is required'),
    code: z.string().trim().min(4, 'Enter the code you received').max(10),
    name: z.string().trim().max(120).optional(),
});
// 5 sends per 10 minutes per IP — enough for a fat-fingered retry, not enough to
// run up a WhatsApp bill or enumerate numbers.
const otpSendLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 5 });
// Defense-in-depth on the verify side: cap guesses per IP so the endpoint can't
// be hammered to brute-force a code (the dev fallback also caps attempts per
// issued code, and Twilio caps in provider mode).
const otpVerifyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 15 });
router.post('/otp/send', otpSendLimiter, async (req, res) => {
    const parse = otpSendSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Invalid request' });
        return;
    }
    const phone = normalizePhone(parse.data.phone);
    if (!phone) {
        res.status(400).json({ error: 'Please enter a valid mobile number.' });
        return;
    }
    const result = await sendOtp(phone);
    if (!result.ok) {
        res.status(502).json({ error: result.error ?? 'Could not send the verification code. Please try again.' });
        return;
    }
    res.json({
        ok: true,
        channel: result.channel,
        devMode: !isOtpProviderConfigured(),
        // Only present in dev mode (no provider) and never in production.
        devCode: result.devCode,
    });
});
router.post('/otp/verify', otpVerifyLimiter, async (req, res) => {
    const parse = otpVerifySchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message ?? 'Invalid request' });
        return;
    }
    const phone = normalizePhone(parse.data.phone);
    if (!phone) {
        res.status(400).json({ error: 'Please enter a valid mobile number.' });
        return;
    }
    const check = await verifyOtp(phone, parse.data.code);
    if (!check.ok) {
        res.status(400).json({ error: check.error ?? 'That code is incorrect or has expired.' });
        return;
    }
    // Find the live account for this number, or create one on first verified login.
    const resolved = await resolveCustomerByPhone(phone, parse.data.name);
    if (!resolved.ok) {
        res.status(resolved.status).json({ error: resolved.error });
        return;
    }
    const { user } = resolved;
    const token = signToken({
        id: user.id, email: user.email, role: user.role, name: user.name,
        plantId: user.plantId,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
    });
    res.json({
        ok: true,
        token,
        user: {
            id: user.id, name: user.name, email: user.email, role: user.role,
            phone: user.phone,
            plantId: user.plantId,
            linkedClientId: user.linkedClientId,
            linkedDriverId: user.linkedDriverId,
        },
    });
});
export default router;
