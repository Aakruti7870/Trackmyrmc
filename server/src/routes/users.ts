import { Router } from 'express';
import { eq, ne, asc, desc, sql, isNull, isNotNull, and, inArray, type SQL } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, clients, drivers, auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAuthorityEmails, isAuthorityEmail } from '../lib/authority.js';
import { sendPasswordResetNotification, sendWelcomeEmail } from '../lib/email.js';
import { getLockoutInfo, resetAttempts } from '../lib/loginAttempts.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';

const router = Router();
router.use(requireAuth, requireRole('admin', 'authority'));

// The global user console is platform-staff territory: an authority, or a legacy
// global admin (no plant binding). Plant-scoped staff (e.g. a plant_owner's own
// admin) must manage their team through the plant owner console
// (POST /api/plants/:id/owner), which enforces own-plant scope, hierarchy and
// per-plant role limits. Without this guard a plant-scoped admin would inherit
// global, cross-tenant user administration. Legacy admins have plantId == null,
// so this is backward-compatible for every pre-existing account.
// (isPlatformStaff is shared from lib/roleHierarchy.)
router.use((req, res, next) => {
  if (!isPlatformStaff(req.user!)) {
    res.status(403).json({
      error: 'The global user console is restricted to platform staff. Manage your plant\u2019s team from the plant owner console.',
    });
    return;
  }
  next();
});

const ROLES = ['authority', 'admin', 'dispatcher', 'plant_operator', 'client', 'driver', 'plant_owner', 'supervisor'] as const;

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
  // Optional human reason captured when an account is suspended (isActive→false).
  // Stored on the row and surfaced on the suspended-login message.
  suspensionReason: z.string().max(500).optional(),
  linkedClientId: z.number().int().positive().nullable().optional(),
  linkedDriverId: z.number().int().positive().nullable().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

/**
 * Ensure a client/driver record isn't already linked to a *different*
 * non-deleted user. Returns an HTTP-409-ready error message, or null when the
 * link is free. `excludeUserId` is the user being edited (skipped in the scan).
 */
type LinkConflict = {
  reason: string;
  conflictUserId: number;
  conflictUserName: string;
  conflictLinkType: 'client' | 'driver';
};

async function findLinkConflict(
  linkedClientId: number | null | undefined,
  linkedDriverId: number | null | undefined,
  excludeUserId?: number,
): Promise<LinkConflict | null> {
  if (linkedClientId != null) {
    const rows = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.linkedClientId, linkedClientId), isNull(users.deletedAt)));
    const conflict = rows.find(r => r.id !== excludeUserId);
    if (conflict) {
      return {
        reason: `This client is already linked to another account (${conflict.name}). Each client can be linked to only one user.`,
        conflictUserId: conflict.id,
        conflictUserName: conflict.name,
        conflictLinkType: 'client',
      };
    }
  }
  if (linkedDriverId != null) {
    const rows = await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.linkedDriverId, linkedDriverId), isNull(users.deletedAt)));
    const conflict = rows.find(r => r.id !== excludeUserId);
    if (conflict) {
      return {
        reason: `This driver is already linked to another account (${conflict.name}). Each driver can be linked to only one user.`,
        conflictUserId: conflict.id,
        conflictUserName: conflict.name,
        conflictLinkType: 'driver',
      };
    }
  }
  return null;
}

/**
 * Map a Postgres unique-violation (23505) on one of the partial link indexes
 * back to the same friendly message findLinkConflict returns, so a race or
 * direct write that slips past the application check still yields a 409 rather
 * than a raw DB error. Returns null for any other error so callers can rethrow.
 */
function linkUniqueViolationMessage(err: unknown): string | null {
  // drizzle-orm wraps a failed query in a DrizzleQueryError and keeps the raw
  // Postgres error (where `code` and `constraint` actually live) on `.cause`.
  // Read both the thrown value and its cause so the 409 fallback still fires
  // whether the caller hands us the wrapped or the unwrapped error.
  type PgFields = { code?: string; constraint?: string; cause?: PgFields };
  const e = err as PgFields;
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  if (code !== '23505') return null;
  if (constraint === 'users_linked_client_unique') {
    return 'This client is already linked to another account. Each client can be linked to only one user.';
  }
  if (constraint === 'users_linked_driver_unique') {
    return 'This driver is already linked to another account. Each driver can be linked to only one user.';
  }
  return null;
}

/**
 * Resolve a client/driver id to a readable "Name (#id)" label for audit
 * details, or "none" when unset. Used by the restore-reassign path to log
 * exactly which record the account moved to.
 */
async function linkLabel(kind: 'client' | 'driver', value: number | null): Promise<string> {
  if (value == null) return 'none';
  const table = kind === 'client' ? clients : drivers;
  const [row] = await db.select({ name: table.name }).from(table).where(eq(table.id, value));
  return row ? `${row.name} (#${value})` : `#${value}`;
}

function safeUser(u: {
  id: number; name: string; email: string; role: string;
  isActive: boolean; linkedClientId: number | null; linkedDriverId: number | null;
  createdAt: Date; deletedAt?: Date | null;
  suspensionReason?: string | null; suspendedBy?: number | null;
}) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    isActive: u.isActive,
    linkedClientId: u.linkedClientId,
    linkedDriverId: u.linkedDriverId,
    createdAt: u.createdAt,
    deletedAt: u.deletedAt ?? null,
    suspensionReason: u.suspensionReason ?? null,
    suspendedBy: u.suspendedBy ?? null,
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
    suspensionReason: users.suspensionReason,
    suspendedBy: users.suspendedBy,
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

// The AUTHORITY allow-list (email addresses) so the UI can offer the AUTHORITY
// role only for eligible accounts. The list is env-controlled; the backend still
// enforces it on create/update regardless of what the client sends.
router.get('/authority-emails', (_req, res) => {
  res.json({ emails: getAuthorityEmails() });
});

router.post('/', async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }
  const { name, email, password, role, linkedClientId, linkedDriverId } = parse.data;

  if (role === 'authority' && !isAuthorityEmail(email)) {
    res.status(403).json({ error: 'This email is not on the AUTHORITY allow-list, so it cannot be granted the AUTHORITY role.' });
    return;
  }

  // The Plant Owner sits directly below the Super Owner in the hierarchy, so only
  // an authority may mint one from the global user console.
  if (role === 'plant_owner' && req.user!.role !== 'authority') {
    res.status(403).json({ error: 'Only a Super Owner can create a Plant Owner account.' });
    return;
  }

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
    res.status(409).json({ error: linkConflict.reason });
    return;
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    [user] = await db.insert(users).values({
      name, email, passwordHash, role,
      linkedClientId: linkedClientId ?? null,
      linkedDriverId: linkedDriverId ?? null,
      createdBy: req.user!.id,
    }).returning();
  } catch (err) {
    const message = linkUniqueViolationMessage(err);
    if (message) { res.status(409).json({ error: message }); return; }
    throw err;
  }

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

  const { password, suspensionReason, ...rest } = parse.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  const [before] = await db.select({
    email: users.email,
    name: users.name, role: users.role, isActive: users.isActive,
    linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
  }).from(users).where(eq(users.id, id));
  if (!before) { res.status(404).json({ error: 'User not found' }); return; }

  if (rest.role === 'authority' && !isAuthorityEmail(before.email)) {
    res.status(403).json({ error: 'This email is not on the AUTHORITY allow-list, so it cannot be granted the AUTHORITY role.' });
    return;
  }

  // Granting the Plant Owner role is reserved for the Super Owner.
  if (rest.role === 'plant_owner' && req.user!.role !== 'authority') {
    res.status(403).json({ error: 'Only a Super Owner can grant the Plant Owner role.' });
    return;
  }

  // Capture who/why on suspension, and clear both on reactivation, so the reason
  // can be surfaced at the suspended-login screen. Only acts on a real
  // active→inactive (or back) transition so unrelated edits don't touch it.
  const trimmedReason = suspensionReason?.trim() || null;
  if (rest.isActive === false && before.isActive === true) {
    updateData.suspendedBy = req.user!.id;
    updateData.suspensionReason = trimmedReason;
  } else if (rest.isActive === true && before.isActive === false) {
    updateData.suspendedBy = null;
    updateData.suspensionReason = null;
  }

  const effectiveClientId = rest.linkedClientId !== undefined ? (rest.linkedClientId ?? null) : before.linkedClientId;
  const effectiveDriverId = rest.linkedDriverId !== undefined ? (rest.linkedDriverId ?? null) : before.linkedDriverId;
  const linkConflict = await findLinkConflict(effectiveClientId, effectiveDriverId, id);
  if (linkConflict) {
    res.status(409).json({ error: linkConflict.reason });
    return;
  }

  let updated;
  try {
    updated = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
  } catch (err) {
    const message = linkUniqueViolationMessage(err);
    if (message) { res.status(409).json({ error: message }); return; }
    throw err;
  }
  const [user] = updated;
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
      detail: rest.isActive
        ? 'Account reactivated'
        : `Account deactivated${trimmedReason ? `: ${trimmedReason}` : ''}`,
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

const purgeSelectionSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).optional(),
});

/**
 * Bulk-purge soft-deleted accounts ("empty trash"). With no body, every
 * soft-deleted account is purged. When an optional `ids` array is supplied, only
 * those soft-deleted accounts are purged ("delete selected forever"). Each
 * removal writes its own 'user.purged' audit entry. The same last-admin guard as
 * the single-purge route applies: an admin record is skipped whenever erasing it
 * would leave the system with no other admin (active or still-soft-deleted) to
 * fall back on.
 */
router.delete('/purge-all', async (req, res) => {
  const actor = req.user!;

  const parsed = purgeSelectionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid selection of accounts to delete.' });
    return;
  }
  const selectedIds = parsed.data.ids;

  const deleted = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
  }).from(users).where(
    selectedIds
      ? and(isNotNull(users.deletedAt), inArray(users.id, selectedIds))
      : isNotNull(users.deletedAt),
  ).orderBy(asc(users.id));

  if (deleted.length === 0) {
    res.json({ purged: 0, skipped: 0, skippedAdmins: [] });
    return;
  }

  // Total admin records still present (active or soft-deleted, not yet purged).
  // We purge soft-deleted admins one at a time only while at least one other
  // admin would remain afterwards.
  const [{ count: totalAdmins }] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(users).where(eq(users.role, 'admin'));

  let remainingAdmins = totalAdmins;
  let purged = 0;
  const skippedAdmins: { id: number; email: string }[] = [];

  for (const u of deleted) {
    if (u.role === 'admin' && remainingAdmins - 1 < 1) {
      skippedAdmins.push({ id: u.id, email: u.email });
      continue;
    }

    // Record the audit entry before the row is removed (targetUserId is
    // ON DELETE SET NULL; the preserved email keeps the entry readable).
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.purged',
      targetUserId: u.id,
      targetUserEmail: u.email,
      detail: `Account permanently deleted (${u.email})`,
    });
    await db.delete(users).where(eq(users.id, u.id));
    if (u.role === 'admin') remainingAdmins -= 1;
    purged += 1;
  }

  res.json({ purged, skipped: skippedAdmins.length, skippedAdmins });
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

const restoreAllSchema = z.object({
  ids: z.array(z.number().int().positive()).optional(),
});

/**
 * Bulk-restore soft-deleted accounts. With no `ids` body, every soft-deleted
 * account is restored ("restore all"); with `ids`, only that subset is.
 * Each restored account writes its own 'user.restored' audit entry (consistent
 * with the single-restore route). Accounts whose client/driver link is already
 * taken by an active user are skipped with a clear reason rather than failing
 * the whole batch. Because restores run sequentially, restoring one account can
 * legitimately make a later account in the batch a conflict.
 */
router.post('/restore-all', async (req, res) => {
  const parse = restoreAllSchema.safeParse(req.body ?? {});
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }
  const { ids } = parse.data;

  const conditions: SQL[] = [isNotNull(users.deletedAt)];
  if (ids && ids.length) {
    conditions.push(inArray(users.id, ids));
  }

  const deleted = await db.select({
    id: users.id, name: users.name, email: users.email,
    linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
  }).from(users).where(and(...conditions)).orderBy(asc(users.id));

  if (deleted.length === 0) {
    res.json({ restored: 0, skipped: 0, skippedDetails: [] });
    return;
  }

  const actor = req.user!;
  let restored = 0;
  const skippedDetails: {
    id: number; email: string; reason: string;
    // Conflict metadata is only known when the application-level pre-check
    // (findLinkConflict) identifies the holding account. A row caught by the raw
    // DB 23505 path only knows the friendly message, so these stay optional —
    // matching the frontend's SkippedRestoreItem shape.
    conflictUserId?: number; conflictUserName?: string; conflictLinkType?: 'client' | 'driver';
  }[] = [];

  for (const u of deleted) {
    const linkConflict = await findLinkConflict(u.linkedClientId, u.linkedDriverId, u.id);
    if (linkConflict) {
      skippedDetails.push({
        id: u.id, email: u.email, reason: linkConflict.reason,
        conflictUserId: linkConflict.conflictUserId,
        conflictUserName: linkConflict.conflictUserName,
        conflictLinkType: linkConflict.conflictLinkType,
      });
      continue;
    }

    // Even though findLinkConflict already checked, a race (or another row
    // restored earlier in this same batch) could still trip the partial unique
    // index. Catch the 23505 per row so one conflicting account is skipped with
    // the friendly reason instead of aborting the whole batch with a 500.
    try {
      await db.update(users)
        .set({ deletedAt: null, isActive: true })
        .where(eq(users.id, u.id));
    } catch (err) {
      const message = linkUniqueViolationMessage(err);
      if (message) {
        skippedDetails.push({ id: u.id, email: u.email, reason: message });
        continue;
      }
      throw err;
    }

    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.restored',
      targetUserId: u.id,
      targetUserEmail: u.email,
      detail: 'Account restored and reactivated',
    });
    restored += 1;
  }

  res.json({ restored, skipped: skippedDetails.length, skippedDetails });
});

const restoreSchema = z.object({
  // When true, clear the account's linked client/driver before restoring so a
  // link already taken by an active account no longer blocks the restore. Lets
  // admins resolve a skipped-restore conflict in place instead of hunting down
  // and unlinking the conflicting active account first.
  clearLink: z.boolean().optional(),
  // Reassign the account to a *different*, free client/driver while restoring,
  // so the restored account keeps a meaningful link instead of none. Supplying
  // either field switches the link to the new target (validated like any other
  // link change); pass null to clear that side explicitly.
  linkedClientId: z.number().int().positive().nullable().optional(),
  linkedDriverId: z.number().int().positive().nullable().optional(),
});

router.post('/:id/restore', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const parse = restoreSchema.safeParse(req.body ?? {});
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }
  const clearLink = parse.data.clearLink === true;
  const reassignClient = parse.data.linkedClientId;
  const reassignDriver = parse.data.linkedDriverId;
  const isReassign = reassignClient !== undefined || reassignDriver !== undefined;

  const [user] = await db.select({
    id: users.id, email: users.email, deletedAt: users.deletedAt,
    linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
  }).from(users).where(eq(users.id, id));
  if (!user || !user.deletedAt) {
    res.status(404).json({ error: 'Deleted account not found' });
    return;
  }

  const hadLink = user.linkedClientId != null || user.linkedDriverId != null;

  // The new link the account will hold after restore. A reassign overrides the
  // affected side; untouched sides keep the account's stored link.
  const effectiveClientId = reassignClient !== undefined ? (reassignClient ?? null) : user.linkedClientId;
  const effectiveDriverId = reassignDriver !== undefined ? (reassignDriver ?? null) : user.linkedDriverId;

  // Don't restore an account whose linked client/driver is already taken by an
  // active account — that would break the one-account-per-link rule. The admin
  // sees the same clear reason as the bulk-restore skip and can retry after
  // unlinking the conflicting account, pass clearLink to restore without it, or
  // reassign to a free client/driver. A reassign is always validated against
  // its new target (clearLink can't waive a freshly chosen conflicting link).
  if (isReassign) {
    const linkConflict = await findLinkConflict(effectiveClientId, effectiveDriverId, user.id);
    if (linkConflict) {
      res.status(409).json({ error: linkConflict.reason });
      return;
    }
  } else if (!clearLink) {
    const linkConflict = await findLinkConflict(user.linkedClientId, user.linkedDriverId, user.id);
    if (linkConflict) {
      res.status(409).json({ error: linkConflict.reason });
      return;
    }
  }

  const actor = req.user!;
  const linkCleared = clearLink && hadLink && !isReassign;
  let restored;
  try {
    [restored] = await db.update(users)
      .set(isReassign
        ? { deletedAt: null, isActive: true, linkedClientId: effectiveClientId, linkedDriverId: effectiveDriverId }
        : linkCleared
          ? { deletedAt: null, isActive: true, linkedClientId: null, linkedDriverId: null }
          : { deletedAt: null, isActive: true })
      .where(eq(users.id, id))
      .returning();
  } catch (err) {
    const message = linkUniqueViolationMessage(err);
    if (message) { res.status(409).json({ error: message }); return; }
    throw err;
  }

  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.restored',
    targetUserId: user.id,
    targetUserEmail: user.email,
    detail: isReassign
      ? 'Account restored and reactivated; linked client/driver reassigned to resolve a conflict'
      : linkCleared
        ? 'Account restored and reactivated; linked client/driver cleared to resolve a conflict'
        : 'Account restored and reactivated',
  });

  // Record the reassignment as its own link-change entry (with names) so the
  // activity log shows exactly which client/driver the account moved to,
  // matching how the edit route logs link changes.
  if (isReassign) {
    const linkChanges: { action: string; detail: string }[] = [];
    if (reassignClient !== undefined && (reassignClient ?? null) !== user.linkedClientId) {
      const from = await linkLabel('client', user.linkedClientId);
      const to = await linkLabel('client', reassignClient ?? null);
      linkChanges.push({ action: 'client_link_change', detail: `${from} → ${to}` });
    }
    if (reassignDriver !== undefined && (reassignDriver ?? null) !== user.linkedDriverId) {
      const from = await linkLabel('driver', user.linkedDriverId);
      const to = await linkLabel('driver', reassignDriver ?? null);
      linkChanges.push({ action: 'driver_link_change', detail: `${from} → ${to}` });
    }
    if (linkChanges.length) {
      await db.insert(auditLogs).values(linkChanges.map(c => ({
        actorId: actor.id,
        actorName: actor.name,
        action: c.action,
        targetUserId: user.id,
        targetUserEmail: user.email,
        detail: c.detail,
        emailSent: null,
      })));
    }
  }

  res.json(safeUser(restored));
});

router.delete('/:id/permanent', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const [user] = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role, deletedAt: users.deletedAt,
  }).from(users).where(eq(users.id, id));
  // Only already soft-deleted accounts can be permanently purged.
  if (!user || !user.deletedAt) {
    res.status(404).json({ error: 'Deleted account not found' });
    return;
  }

  // Never let the system lose its last admin: block purging an admin when no
  // other admin record (active or soft-deleted) remains to restore.
  if (user.role === 'admin') {
    const [{ count: otherAdmins }] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(users).where(and(eq(users.role, 'admin'), ne(users.id, id)));
    if (otherAdmins <= 0) {
      res.status(400).json({ error: 'Cannot permanently delete the last admin account.' });
      return;
    }
  }

  const actor = req.user!;
  // Record the audit entry *before* the row is removed. targetUserId is
  // ON DELETE SET NULL, so it nulls out after the purge, but the preserved
  // email label keeps the entry readable in the activity log.
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.purged',
    targetUserId: user.id,
    targetUserEmail: user.email,
    detail: `Account permanently deleted (${user.email})`,
  });

  await db.delete(users).where(eq(users.id, id));

  res.json({ ok: true, userId: id });
});

export default router;
