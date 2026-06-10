import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { isLockedOut, recordFailure, resetAttempts } from '../lib/loginAttempts.js';
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
    if (!user || !user.isActive) {
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
    res.json(updated);
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
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    res.json({ message: 'Password updated successfully' });
});
export default router;
