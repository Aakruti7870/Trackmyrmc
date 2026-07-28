import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
// Resolve at the point authentication is actually used rather than at module
// import time. This keeps the unauthenticated health endpoint available for
// Cloud Run startup probes when a revision has a broken/missing secret binding,
// while still failing closed for every token issue/verification operation.
function jwtSecret() {
    const secret = process.env.JWT_SECRET?.trim();
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required. Authentication is unavailable.');
    }
    return secret;
}
// Staff/owner/super-admin sessions are short-lived so an idle session lapses
// (the frontend silently renews this token while the user is active and stops
// renewing when idle → it expires → auto sign-out). Customer sessions keep the
// long legacy lifetime so their flow is unchanged.
export const STAFF_TOKEN_TTL = '30m';
export const CUSTOMER_TOKEN_TTL = '7d';
export function signToken(payload, opts) {
    return jwt.sign(payload, jwtSecret(), { expiresIn: opts?.expiresIn ?? CUSTOMER_TOKEN_TTL });
}
export function verifyToken(token) {
    return jwt.verify(token, jwtSecret());
}
// Invalidate every other live session for an account by advancing its
// session_version, then return the new value so the caller can embed it in the
// token it is about to issue. Called on each successful staff/super-admin login
// so the most recent login is the only one that stays valid.
export async function bumpSessionVersion(userId) {
    const [row] = await db
        .update(users)
        .set({ sessionVersion: sql `${users.sessionVersion} + 1` })
        .where(eq(users.id, userId))
        .returning({ v: users.sessionVersion });
    return row?.v ?? 0;
}
export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    let payload;
    try {
        payload = verifyToken(header.slice(7));
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    const [user] = await db.select({
        id: users.id, email: users.email, role: users.role, name: users.name,
        isActive: users.isActive, plantId: users.plantId,
        linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
        sessionVersion: users.sessionVersion,
    }).from(users).where(eq(users.id, payload.id));
    if (!user || !user.isActive) {
        res.status(401).json({ error: 'Account deactivated or not found' });
        return;
    }
    // Single active session: a token that carries a sessionVersion must match the
    // account's current value. A newer login elsewhere advances the version,
    // silently invalidating this (older) token. Tokens minted before this feature
    // (and customer tokens) carry no sessionVersion and are exempt.
    if (payload.sessionVersion !== undefined && payload.sessionVersion !== user.sessionVersion) {
        res.status(401).json({ error: 'Your session has ended because this account signed in elsewhere.', sessionEnded: true });
        return;
    }
    req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        plantId: user.plantId,
        linkedClientId: user.linkedClientId,
        linkedDriverId: user.linkedDriverId,
        sessionVersion: user.sessionVersion,
    };
    next();
}
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        next();
    };
}
