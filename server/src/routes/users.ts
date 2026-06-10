import { Router } from 'express';
import { eq, asc, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, clients, drivers, auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendPasswordResetNotification, sendWelcomeEmail } from '../lib/email.js';
import { getLockoutInfo, resetAttempts } from '../lib/loginAttempts.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const ROLES = ['admin', 'dispatcher', 'plant_operator', 'client', 'driver'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(ROLES),
  linkedClientId: z.number().int().positive().nullable().optional(),
  linkedDriverId: z.number().int().positive().nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  linkedClientId: z.number().int().positive().nullable().optional(),
  linkedDriverId: z.number().int().positive().nullable().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

function safeUser(u: {
  id: number; name: string; email: string; role: string;
  isActive: boolean; linkedClientId: number | null; linkedDriverId: number | null;
  createdAt: Date;
}) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    isActive: u.isActive,
    linkedClientId: u.linkedClientId,
    linkedDriverId: u.linkedDriverId,
    createdAt: u.createdAt,
  };
}

router.get('/', async (_req, res) => {
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
    isActive: users.isActive,
    linkedClientId: users.linkedClientId,
    linkedDriverId: users.linkedDriverId,
    createdAt: users.createdAt,
  }).from(users).orderBy(asc(users.createdAt));

  const counts = await db.select({
    targetUserId: auditLogs.targetUserId,
    count: sql<number>`count(*)::int`,
  }).from(auditLogs).groupBy(auditLogs.targetUserId);

  const countMap = new Map<number, number>();
  for (const c of counts) {
    if (c.targetUserId !== null) countMap.set(c.targetUserId, c.count);
  }

  res.json(rows.map(r => ({ ...r, auditCount: countMap.get(r.id) ?? 0 })));
});

router.get('/lockout-status', async (_req, res) => {
  const rows = await db.select({ id: users.id, email: users.email }).from(users);
  const result: Record<number, { locked: boolean; lockedUntil: number | null }> = {};
  for (const user of rows) {
    result[user.id] = await getLockoutInfo(`login:${user.email.toLowerCase().trim()}`);
  }
  res.json(result);
});

router.post('/:id/unlock', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id));
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const lockoutKey = `login:${user.email.toLowerCase().trim()}`;
  resetAttempts(lockoutKey);
  res.json({ ok: true, userId: user.id });
});

router.get('/clients-list', async (_req, res) => {
  const rows = await db.select({ id: clients.id, name: clients.name }).from(clients).orderBy(asc(clients.name));
  res.json(rows);
});

router.get('/drivers-list', async (_req, res) => {
  const rows = await db.select({ id: drivers.id, name: drivers.name }).from(drivers).orderBy(asc(drivers.name));
  res.json(rows);
});

router.get('/audit-log', async (req, res) => {
  const select = {
    id: auditLogs.id,
    actorId: auditLogs.actorId,
    actorName: auditLogs.actorName,
    action: auditLogs.action,
    targetUserId: auditLogs.targetUserId,
    targetUserEmail: auditLogs.targetUserEmail,
    emailSent: auditLogs.emailSent,
    createdAt: auditLogs.createdAt,
  };

  const userIdParam = req.query.userId;
  if (userIdParam !== undefined) {
    const userId = parseInt(String(userIdParam), 10);
    if (isNaN(userId)) { res.status(400).json({ error: 'Invalid userId' }); return; }
    const rows = await db.select(select).from(auditLogs)
      .where(eq(auditLogs.targetUserId, userId))
      .orderBy(desc(auditLogs.createdAt)).limit(200);
    res.json(rows);
    return;
  }

  const rows = await db.select(select).from(auditLogs)
    .orderBy(desc(auditLogs.createdAt)).limit(200);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }
  const { name, email, password, role, linkedClientId, linkedDriverId } = parse.data;

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({
    name, email, passwordHash, role,
    linkedClientId: linkedClientId ?? null,
    linkedDriverId: linkedDriverId ?? null,
  }).returning();

  let emailSent: boolean | undefined;
  try {
    emailSent = await sendWelcomeEmail(user.email, user.name, user.role);
  } catch (err) {
    console.error('[email] Failed to send welcome email:', err);
    emailSent = false;
  }

  const actor = req.user!;
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.created',
    targetUserId: user.id,
    targetUserEmail: user.email,
    emailSent: emailSent ?? false,
  });

  res.status(201).json({ ...safeUser(user), emailSent });
});

router.post('/:id/resend-notification', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const [user] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users).where(eq(users.id, id));
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  let emailSent = false;
  try {
    emailSent = await sendPasswordResetNotification(user.email, user.name);
  } catch (err) {
    console.error('[email] Failed to resend password-reset notification:', err);
  }

  res.json({ emailSent });
});

router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }

  const { password, ...rest } = parse.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 10);
  }

  const [user] = await db.update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  let emailSent: boolean | undefined;
  if (password) {
    try {
      emailSent = await sendPasswordResetNotification(user.email, user.name);
    } catch (err) {
      console.error('[email] Failed to send password-reset notification:', err);
      emailSent = false;
    }

    const actor = req.user!;
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'password_reset',
      targetUserId: user.id,
      targetUserEmail: user.email,
      emailSent: emailSent ?? false,
    });
  }

  res.json({ ...safeUser(user), ...(emailSent !== undefined ? { emailSent } : {}) });
});

router.post('/:id/resend-welcome', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const [user] = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
  }).from(users).where(eq(users.id, id));
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  let emailSent = false;
  try {
    emailSent = await sendWelcomeEmail(user.email, user.name, user.role);
  } catch (err) {
    console.error('[email] Failed to resend welcome email:', err);
    emailSent = false;
  }

  res.json({ emailSent });
});

export default router;
