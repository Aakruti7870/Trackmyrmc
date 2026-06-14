import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { hashPassword } from '../lib/password.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, clients, auditLogs } from '../db/schema.js';
import { verifyToken as clerkVerifyToken, createClerkClient } from '@clerk/backend';
import { signToken, requireAuth } from '../middleware/auth.js';
import { isAuthorityEmail } from '../lib/authority.js';
import { resolveStaffSsoUser } from '../lib/staffSso.js';
import { isLockedOut, recordFailure, resetAttempts } from '../lib/loginAttempts.js';
import { peekInviteToken, redeemInviteToken } from '../lib/inviteToken.js';
const router = Router();
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
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
    if (!user || !user.isActive || user.deletedAt) {
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
    if (user.role === 'authority' && !isAuthorityEmail(user.email)) {
        res.status(403).json({ error: 'This account is not on the AUTHORITY allow-list.' });
        return;
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
        res.status(400).json({ error: 'This invite link is invalid or has expired.', reason: result.reason });
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
        detail: 'Password set via invite link',
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
    email: z.string().trim().toLowerCase().email('A valid email is required').max(160),
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
export default router;
