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
  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', requireAuth, async (req, res) => {
  const [user] = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role
  }).from(users).where(eq(users.id, req.user!.id));
  res.json(user);
});

export default router;
