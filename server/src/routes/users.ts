import { Router } from 'express';
import { eq, asc, desc, sql, isNull, isNotNull, and } from 'drizzle-orm';
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

/**
 * Ensure a client/driver record isn't already linked to a *different*
 * non-deleted user. Returns an HTTP-409-ready error message, or null when the
 * link is free. `excludeUserId` is the user being edited (skipped in the scan).
 */
async function findLinkConflict(
  linkedClientId: number | null | undefined,
  linkedDriverId: number | null | undefined,
  excludeUserId?: number,
): Promise<string | null> {
  if (linkedClientId != null) {
    const rows = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.linkedClientId, linkedClientId), isNull(users.deletedAt)));
    const conflict = rows.find(r => r.id !== excludeUserId);
    if (conflict) {
      return `This client is already linked to another account (${conflict.name}). Each client can be linked to only one user.`;
    }
  }
  if (linkedDriverId != null) {
    const rows = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.linkedDriverId, linkedDriverId), isNull(users.deletedAt)));
    const conflict = rows.find(r => r.id !== excludeUserId);
    if (conflict) {
      return `This driver is already linked to another account (${conflict.name}). Each driver can be linked to only one user.`;
    }
  }
  return null;
}

function safeUser(u: {
  id: number; name: string; email: string; role: string;
  isActive: boolean; linkedClientId: number | null; linkedDriverId: number | null;
  createdAt: Date; deletedAt?: Date | null;
}) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    isActive: u.isActive,
    linkedClientId: u.linkedClientId,
    linkedDriverId: u.linkedDriverId,
    createdAt: u.createdAt,
    deletedAt: u.deletedAt ?? null,
  };
}

router.get('/', async (req, res) => {
  const deletedOnly = req.query.deleted === 'true';
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
    isActive: users.isActive,
    linkedClientId: users.linkedClientId,
    linkedDriverId: users.linkedDriverId,
    createdAt: users.createdAt,
    deletedAt: users.deletedAt,
  }).from(users)
    .where(deletedOnly ? isNotNull(users.deletedAt) : isNull(users.deletedAt))
    .orderBy(deletedOnly ? desc(users.deletedAt) : asc(users.createdAt));

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
  const rows = await db.select({ id: users.id, email: users.email }).from(users).where(isNull(users.deletedAt));
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
  await resetAttempts(lockoutKey);

  const actor = req.user!;
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'lockout_cleared',
    targetUserId: user.id,
    targetUserEmail: user.email,
    detail: 'Account unlocked',
  });

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
    detail: auditLogs.detail,
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

  const [existing] = await db.select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
    .from(users).where(eq(users.email, email));
  if (existing) {
    if (existing.deletedAt) {
      res.status(409).json({
        error: `An account with this email was previously deleted (${existing.name}). Restore it instead of creating a new one.`,
        code: 'email_soft_deleted',
        deletedUserId: existing.id,
        deletedUserName: existing.name,
      });
    } else {
      res.status(409).json({ error: 'Email already in use' });
    }
    return;
  }

  const linkConflict = await findLinkConflict(linkedClientId, linkedDriverId);
  if (linkConflict) {
    res.status(409).json({ error: linkConflict });
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

  const actor = req.user!;
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'password_reset_email',
    targetUserId: user.id,
    targetUserEmail: user.email,
    emailSent,
  });

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

  const [before] = await db.select({
    name: users.name, role: users.role, isActive: users.isActive,
    linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
  }).from(users).where(eq(users.id, id));
  if (!before) { res.status(404).json({ error: 'User not found' }); return; }

  const effectiveClientId = rest.linkedClientId !== undefined ? (rest.linkedClientId ?? null) : before.linkedClientId;
  const effectiveDriverId = rest.linkedDriverId !== undefined ? (rest.linkedDriverId ?? null) : before.linkedDriverId;
  const linkConflict = await findLinkConflict(effectiveClientId, effectiveDriverId, id);
  if (linkConflict) {
    res.status(409).json({ error: linkConflict });
    return;
  }

  const [user] = await db.update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const actor = req.user!;

  function linkName(kind: 'client' | 'driver', value: number | null) {
    if (value == null) return 'none';
    const list = kind === 'client' ? clientNameCache : driverNameCache;
    const name = list.get(value);
    return name ? `${name} (#${value})` : `#${value}`;
  }

  const changeEntries: {
    action: string; detail: string;
  }[] = [];

  if (rest.name !== undefined && rest.name !== before.name) {
    changeEntries.push({ action: 'name_change', detail: `${before.name} → ${rest.name}` });
  }
  if (rest.role !== undefined && rest.role !== before.role) {
    changeEntries.push({ action: 'role_change', detail: `${before.role} → ${rest.role}` });
  }
  if (rest.isActive !== undefined && rest.isActive !== before.isActive) {
    changeEntries.push({
      action: rest.isActive ? 'account_activated' : 'account_deactivated',
      detail: rest.isActive ? 'Account reactivated' : 'Account deactivated',
    });
  }

  const clientNameCache = new Map<number, string>();
  const driverNameCache = new Map<number, string>();
  const clientLinkChanged = rest.linkedClientId !== undefined && (rest.linkedClientId ?? null) !== before.linkedClientId;
  const driverLinkChanged = rest.linkedDriverId !== undefined && (rest.linkedDriverId ?? null) !== before.linkedDriverId;
  if (clientLinkChanged) {
    const rows = await db.select({ id: clients.id, name: clients.name }).from(clients);
    rows.forEach(r => clientNameCache.set(r.id, r.name));
    changeEntries.push({
      action: 'client_link_change',
      detail: `${linkName('client', before.linkedClientId)} → ${linkName('client', rest.linkedClientId ?? null)}`,
    });
  }
  if (driverLinkChanged) {
    const rows = await db.select({ id: drivers.id, name: drivers.name }).from(drivers);
    rows.forEach(r => driverNameCache.set(r.id, r.name));
    changeEntries.push({
      action: 'driver_link_change',
      detail: `${linkName('driver', before.linkedDriverId)} → ${linkName('driver', rest.linkedDriverId ?? null)}`,
    });
  }

  if (changeEntries.length) {
    await db.insert(auditLogs).values(changeEntries.map(c => ({
      actorId: actor.id,
      actorName: actor.name,
      action: c.action,
      targetUserId: user.id,
      targetUserEmail: user.email,
      detail: c.detail,
      emailSent: null,
    })));
  }

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

  const actor = req.user!;
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'welcome_email',
    targetUserId: user.id,
    targetUserEmail: user.email,
    emailSent,
  });

  res.json({ emailSent });
});

router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const actor = req.user!;
  if (actor.id === id) {
    res.status(400).json({ error: 'You cannot delete your own account.' });
    return;
  }

  const [user] = await db.select({
    id: users.id, email: users.email, role: users.role, deletedAt: users.deletedAt,
  }).from(users).where(eq(users.id, id));
  if (!user || user.deletedAt) { res.status(404).json({ error: 'User not found' }); return; }

  if (user.role === 'admin') {
    const [{ count: activeAdmins }] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(users).where(and(eq(users.role, 'admin'), isNull(users.deletedAt)));
    if (activeAdmins <= 1) {
      res.status(400).json({ error: 'Cannot delete the last remaining admin account.' });
      return;
    }
  }

  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.deleted',
    targetUserId: user.id,
    targetUserEmail: user.email,
  });

  await db.update(users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(users.id, id));

  res.json({ ok: true, userId: user.id });
});

router.post('/:id/restore', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const [user] = await db.select({
    id: users.id, email: users.email, deletedAt: users.deletedAt,
  }).from(users).where(eq(users.id, id));
  if (!user || !user.deletedAt) {
    res.status(404).json({ error: 'Deleted account not found' });
    return;
  }

  const actor = req.user!;
  const [restored] = await db.update(users)
    .set({ deletedAt: null, isActive: true })
    .where(eq(users.id, id))
    .returning();

  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.restored',
    targetUserId: user.id,
    targetUserEmail: user.email,
    detail: 'Account restored and reactivated',
  });

  res.json(safeUser(restored));
});

export default router;
