import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
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
  }).from(users).where(eq(users.id, req.user!.id));
  res.json(user);
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
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (typeof currentPassword !== 'string') {
    res.status(400).json({ error: 'currentPassword must be a string' });
    return;
  }
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
  res.json({ message: 'Password updated successfully' });
});

export default router;
