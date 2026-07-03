import { Router } from 'express';
import { randomBytes } from 'crypto';
import { eq, asc, desc, sql, isNull, isNotNull, and, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, plants, auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { createInviteToken } from '../lib/inviteToken.js';
import { sendOwnerInviteEmail, sendPasswordResetNotification } from '../lib/email.js';
import { isPlatformStaff, canCreateRole, roleLimit } from '../lib/roleHierarchy.js';

// ---------------------------------------------------------------------------
// Plant-wise User Management console.
//
// Hierarchy view: plant cards (with staff/customer counts) → the users bound to
// that plant, with the full account lifecycle (add / edit / suspend / resume /
// soft-delete / restore / reset-password / invitation link).
//
// Visibility rules:
//   - authority (Super Admin) and legacy GLOBAL admins (plantId == null) see
//     every plant and every user.
//   - a plant_owner or a plant-scoped admin sees ONLY their own plant.
//   - every other role (incl. customers) is rejected outright.
// ---------------------------------------------------------------------------

const router = Router();
router.use(requireAuth, requireRole('authority', 'admin', 'plant_owner'));

type Actor = { id: number; name: string; role: string; plantId?: number | null; email: string };

/** The single plant id a plant-scoped actor is confined to, or null for platform staff. */
function scopedPlantId(actor: Actor): number | null {
  return isPlatformStaff(actor) ? null : (actor.plantId ?? null);
}

/**
 * A non-platform actor (plant_owner, plant-bound admin) MUST carry a plant
 * binding — an unbound row must never be treated as unrestricted. Returns true
 * (after writing 403) when the actor is unbound and has to be rejected.
 */
function rejectUnboundActor(actor: Actor, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  if (!isPlatformStaff(actor) && actor.plantId == null) {
    res.status(403).json({ error: 'Your account is not bound to a plant.' });
    return true;
  }
  return false;
}

/**
 * Authorize the :plantId path param against the actor's scope. Returns the
 * parsed id, or null after writing the error response.
 */
function resolvePlantParam(req: { params: Record<string, string>; user?: unknown }, res: { status: (n: number) => { json: (b: unknown) => void } }): number | null {
  const id = Number(req.params.plantId);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid plant id' }); return null; }
  const actor = (req as { user?: Actor }).user!;
  if (rejectUnboundActor(actor, res)) return null;
  const scope = scopedPlantId(actor);
  if (scope !== null && scope !== id) {
    res.status(403).json({ error: 'You can only manage users of your own plant.' });
    return null;
  }
  return id;
}

// A plant reads as Suspended when it is manually switched off or its
// subscription is suspended/cancelled — mirroring the login gate.
function plantStatus(p: { isActive: boolean; subscriptionStatus: string }): 'active' | 'suspended' {
  if (!p.isActive) return 'suspended';
  if (p.subscriptionStatus === 'suspended' || p.subscriptionStatus === 'cancelled') return 'suspended';
  return 'active';
}

// ---------------------------------------------------------------------------
// GET /plants — the plant cards.
// ---------------------------------------------------------------------------
router.get('/plants', async (req, res) => {
  const actor = req.user! as Actor;
  const scope = scopedPlantId(actor);

  // A plant-scoped actor with no plant binding manages nothing here.
  if (scope === null && !isPlatformStaff(actor)) { res.json([]); return; }

  const plantWhere = scope !== null ? eq(plants.id, scope) : undefined;
  const rows = await db.select({
    id: plants.id,
    name: plants.name,
    plantCode: plants.plantCode,
    city: plants.city,
    address: plants.address,
    isActive: plants.isActive,
    subscriptionStatus: plants.subscriptionStatus,
  }).from(plants).where(plantWhere).orderBy(asc(plants.name));

  // Per-plant live user counts, split staff vs customers, in one query.
  const counts = await db.select({
    plantId: users.plantId,
    staff: sql<number>`count(*) filter (where ${users.role} not in ('client'))::int`,
    customers: sql<number>`count(*) filter (where ${users.role} = 'client')::int`,
  }).from(users)
    .where(and(isNotNull(users.plantId), isNull(users.deletedAt)))
    .groupBy(users.plantId);

  const countMap = new Map<number, { staff: number; customers: number }>();
  for (const c of counts) {
    if (c.plantId !== null) countMap.set(c.plantId, { staff: c.staff, customers: c.customers });
  }

  res.json(rows.map(p => ({
    id: p.id,
    name: p.name,
    plantCode: p.plantCode,
    city: p.city,
    address: p.address,
    status: plantStatus(p),
    staffCount: countMap.get(p.id)?.staff ?? 0,
    customerCount: countMap.get(p.id)?.customers ?? 0,
  })));
});

// ---------------------------------------------------------------------------
// GET /plants/:plantId/users — users bound to one plant (live or deleted tab).
// ---------------------------------------------------------------------------
router.get('/plants/:plantId/users', async (req, res) => {
  const plantId = resolvePlantParam(req, res);
  if (plantId === null) return;

  const [plant] = await db.select({ id: plants.id }).from(plants).where(eq(plants.id, plantId));
  if (!plant) { res.status(404).json({ error: 'Plant not found' }); return; }

  const deletedOnly = req.query.deleted === 'true';
  const rows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
    isActive: users.isActive,
    suspensionReason: users.suspensionReason,
    createdAt: users.createdAt,
    deletedAt: users.deletedAt,
  }).from(users)
    .where(and(
      eq(users.plantId, plantId),
      deletedOnly ? isNotNull(users.deletedAt) : isNull(users.deletedAt),
    ))
    .orderBy(deletedOnly ? desc(users.deletedAt) : asc(users.createdAt));

  res.json(rows);
});

// Roles that may be provisioned through this console. Authority is minted only
// via the global console; everything else (staff + customer) is plant-bindable.
const MANAGED_ROLES = [
  'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator',
  'accountant', 'quality_engineer', 'fleet_manager', 'store_manager',
  'driver', 'client',
] as const;

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email'),
  phone: z.string().trim().min(5, 'Enter a valid phone number').optional(),
  role: z.enum(MANAGED_ROLES),
});

/** May `actor` manage (create/edit/suspend/delete) an account of `targetRole`? */
function canManageRole(actor: Actor, targetRole: string): boolean {
  if (targetRole === 'authority') return false; // never through this console
  if (targetRole === 'client') return true;     // customers are not in the staff hierarchy
  if (isPlatformStaff(actor)) return true;
  return canCreateRole(actor.role, targetRole);
}

// ---------------------------------------------------------------------------
// POST /plants/:plantId/users — add a user, always bound to the plant.
// ---------------------------------------------------------------------------
router.post('/plants/:plantId/users', async (req, res) => {
  const plantId = resolvePlantParam(req, res);
  if (plantId === null) return;

  const parse = createSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten().fieldErrors }); return; }
  const { name, email, phone, role } = parse.data;
  const actor = req.user! as Actor;

  if (!canManageRole(actor, role)) {
    res.status(403).json({ error: `Your role is not permitted to create a "${role}" account.` });
    return;
  }

  if (phone) {
    const [phoneClash] = await db.select({ id: users.id })
      .from(users).where(and(eq(users.phone, phone), isNull(users.deletedAt)));
    if (phoneClash) { res.status(409).json({ error: 'This phone number is already linked to another account.' }); return; }
  }

  // Accounts provisioned here are passwordless (staff sign in with a one-time
  // code, customers with phone OTP); seed an un-guessable hash.
  const passwordHash = await hashPassword(randomBytes(32).toString('base64url'));

  // Role-cap check + insert must be atomic per plant (see plants.ts /owner).
  const limit = roleLimit(role);
  const result = await db.transaction(async (tx) => {
    const [plant] = await tx.select({ id: plants.id, name: plants.name })
      .from(plants).where(eq(plants.id, plantId)).for('update');
    if (!plant) return { kind: 'not_found' as const };

    if (role !== 'client' && Number.isFinite(limit)) {
      const [{ count: held }] = await tx.select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(eq(users.plantId, plantId), eq(users.role, role), isNull(users.deletedAt)));
      if (held >= limit) return { kind: 'limit' as const };
    }

    const [existing] = await tx.select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
      .from(users).where(eq(users.email, email));
    if (existing) return { kind: 'exists' as const, existing };

    const [created] = await tx.insert(users).values({
      name, email, passwordHash, role,
      phone: phone ?? null,
      plantId,
      createdBy: actor.id,
    }).returning();
    return { kind: 'ok' as const, plant, user: created };
  });

  if (result.kind === 'not_found') { res.status(404).json({ error: 'Plant not found' }); return; }
  if (result.kind === 'limit') {
    res.status(409).json({ error: `This plant already has the maximum number of "${role}" accounts (${limit}).` });
    return;
  }
  if (result.kind === 'exists') {
    if (result.existing.deletedAt) {
      res.status(409).json({ error: `An account with this email was previously deleted (${result.existing.name}). Restore it from the Deleted tab instead.` });
    } else {
      res.status(409).json({ error: 'Email already in use' });
    }
    return;
  }
  const { plant, user } = result;

  // Send the invitation link (sets up their access) — same flow as re-sending it.
  let emailSent = false;
  let inviteUrl: string | undefined;
  try {
    const { token, expiresAt } = await createInviteToken(user.id);
    inviteUrl = `${appBaseUrl(req)}/set-password?token=${token}`;
    emailSent = await sendOwnerInviteEmail(user.email, user.name, user.role, inviteUrl, expiresAt);
  } catch (err) {
    console.error('[email] Failed to send invitation email:', err);
  }

  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.created',
    targetUserId: user.id,
    targetUserEmail: user.email,
    detail: `User added to ${plant.name} via plant user management`,
    emailSent,
  });

  res.status(201).json({
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    role: user.role, plantId: user.plantId, isActive: user.isActive,
    createdAt: user.createdAt, deletedAt: null, suspensionReason: null,
    emailSent,
    ...(emailSent ? {} : { inviteUrl }),
  });
});

// Public base URL for emailed links (env override first — matches plants.ts).
function appBaseUrl(req: { headers: Record<string, unknown>; protocol: string }): string {
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const fwdProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const proto = fwdProto || req.protocol || 'https';
  const host = String(req.headers['x-forwarded-host'] ?? req.headers['host'] ?? '').trim();
  return `${proto}://${host}`;
}

/**
 * Load a target user and authorize the actor against them:
 *   - target must exist and be bound to a plant inside the actor's scope
 *   - authority accounts are never manageable here
 *   - a non-platform actor may only touch roles below their own
 * Returns the row, or null after writing the response.
 */
async function resolveTarget(
  req: { params: Record<string, string>; user?: unknown },
  res: { status: (n: number) => { json: (b: unknown) => void } },
  opts: { allowDeleted?: boolean } = {},
) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid user id' }); return null; }

  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target || (!opts.allowDeleted && target.deletedAt)) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }

  const actor = (req as { user?: Actor }).user!;
  if (rejectUnboundActor(actor, res)) return null;
  const scope = scopedPlantId(actor);
  if (target.plantId == null || (scope !== null && target.plantId !== scope)) {
    res.status(403).json({ error: 'This user is outside your plant.' });
    return null;
  }
  // Self-targeting skips the hierarchy check (an owner is their own peer) so
  // the explicit self-guards in each handler can answer with a clear message.
  if (actor.id !== target.id && !canManageRole(actor, target.role)) {
    res.status(403).json({ error: 'Your role is not permitted to manage this account.' });
    return null;
  }
  return target;
}

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(5).nullable().optional(),
  role: z.enum(MANAGED_ROLES).optional(),
  isActive: z.boolean().optional(),
  suspensionReason: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// PUT /users/:id — edit / suspend / resume.
// ---------------------------------------------------------------------------
router.put('/users/:id', async (req, res) => {
  const target = await resolveTarget(req, res);
  if (!target) return;
  const actor = req.user! as Actor;

  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten().fieldErrors }); return; }
  const { suspensionReason, ...rest } = parse.data;

  if (actor.id === target.id && rest.isActive === false) {
    res.status(400).json({ error: 'You cannot suspend your own account.' });
    return;
  }
  if (rest.role && rest.role !== target.role && !canManageRole(actor, rest.role)) {
    res.status(403).json({ error: `Your role is not permitted to assign the "${rest.role}" role.` });
    return;
  }

  if (rest.phone) {
    const [phoneClash] = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, rest.phone), isNull(users.deletedAt), ne(users.id, target.id)));
    if (phoneClash) { res.status(409).json({ error: 'This phone number is already linked to another account.' }); return; }
  }

  // Enforce the per-plant role cap on a role CHANGE (same rule as creation).
  if (rest.role && rest.role !== target.role && rest.role !== 'client') {
    const limit = roleLimit(rest.role);
    if (Number.isFinite(limit)) {
      const [{ count: held }] = await db.select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(
          eq(users.plantId, target.plantId!), eq(users.role, rest.role),
          isNull(users.deletedAt), ne(users.id, target.id),
        ));
      if (held >= limit) {
        res.status(409).json({ error: `This plant already has the maximum number of "${rest.role}" accounts (${limit}).` });
        return;
      }
    }
  }

  const updateData: Record<string, unknown> = { ...rest };
  if (rest.phone !== undefined) updateData.phone = rest.phone || null;
  const trimmedReason = suspensionReason?.trim() || null;
  if (rest.isActive === false && target.isActive === true) {
    updateData.suspendedBy = actor.id;
    updateData.suspensionReason = trimmedReason;
  } else if (rest.isActive === true && target.isActive === false) {
    updateData.suspendedBy = null;
    updateData.suspensionReason = null;
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, target.id)).returning();

  const changes: string[] = [];
  if (rest.name && rest.name !== target.name) changes.push('name');
  if (rest.phone !== undefined) changes.push('phone');
  if (rest.role && rest.role !== target.role) changes.push(`role ${target.role}→${rest.role}`);
  if (rest.isActive === false && target.isActive) changes.push('suspended');
  if (rest.isActive === true && !target.isActive) changes.push('resumed');
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: rest.isActive === false && target.isActive ? 'account_deactivated'
      : rest.isActive === true && !target.isActive ? 'account_activated'
      : rest.role && rest.role !== target.role ? 'role_change' : 'name_change',
    targetUserId: target.id,
    targetUserEmail: target.email,
    detail: `Plant user management: ${changes.join(', ') || 'updated'}`,
  });

  res.json({
    id: updated.id, name: updated.name, email: updated.email, phone: updated.phone,
    role: updated.role, plantId: updated.plantId, isActive: updated.isActive,
    suspensionReason: updated.suspensionReason, createdAt: updated.createdAt,
    deletedAt: updated.deletedAt,
  });
});

// ---------------------------------------------------------------------------
// DELETE /users/:id — soft delete (moves to the Deleted tab).
// ---------------------------------------------------------------------------
router.delete('/users/:id', async (req, res) => {
  const target = await resolveTarget(req, res);
  if (!target) return;
  const actor = req.user! as Actor;

  if (actor.id === target.id) {
    res.status(400).json({ error: 'You cannot delete your own account.' });
    return;
  }

  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, target.id));
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.deleted',
    targetUserId: target.id,
    targetUserEmail: target.email,
    detail: 'Moved to Deleted via plant user management',
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /users/:id/restore — bring a soft-deleted user back.
// ---------------------------------------------------------------------------
router.post('/users/:id/restore', async (req, res) => {
  const target = await resolveTarget(req, res, { allowDeleted: true });
  if (!target) return;
  if (!target.deletedAt) { res.status(400).json({ error: 'This account is not deleted.' }); return; }
  const actor = req.user! as Actor;

  // The email must still be free among live accounts (it is globally unique,
  // and soft-deleted rows keep theirs, so only an exact recreate can clash).
  const [emailClash] = await db.select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, target.email), isNull(users.deletedAt), ne(users.id, target.id)));
  if (emailClash) {
    res.status(409).json({ error: 'Another live account now uses this email. Resolve the conflict first.' });
    return;
  }
  if (target.phone) {
    const [phoneClash] = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, target.phone), isNull(users.deletedAt), ne(users.id, target.id)));
    if (phoneClash) {
      res.status(409).json({ error: 'Another live account now uses this phone number. Resolve the conflict first.' });
      return;
    }
  }

  // Respect the per-plant role cap on the way back in.
  if (target.role !== 'client') {
    const limit = roleLimit(target.role);
    if (Number.isFinite(limit)) {
      const [{ count: held }] = await db.select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(and(
          eq(users.plantId, target.plantId!), eq(users.role, target.role), isNull(users.deletedAt),
        ));
      if (held >= limit) {
        res.status(409).json({ error: `This plant already has the maximum number of "${target.role}" accounts (${limit}).` });
        return;
      }
    }
  }

  await db.update(users).set({ deletedAt: null }).where(eq(users.id, target.id));
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'user.restored',
    targetUserId: target.id,
    targetUserEmail: target.email,
    detail: 'Restored via plant user management',
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /users/:id/reset-password — email sign-in/reset instructions.
// ---------------------------------------------------------------------------
router.post('/users/:id/reset-password', async (req, res) => {
  const target = await resolveTarget(req, res);
  if (!target) return;
  const actor = req.user! as Actor;

  let emailSent = false;
  try {
    emailSent = await sendPasswordResetNotification(target.email, target.name);
  } catch (err) {
    console.error('[email] Failed to send reset notification:', err);
  }

  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'password_reset_email',
    targetUserId: target.id,
    targetUserEmail: target.email,
    emailSent,
  });
  res.json({ emailSent });
});

// ---------------------------------------------------------------------------
// POST /users/:id/send-invite — (re)send the single-use invitation link.
// ---------------------------------------------------------------------------
router.post('/users/:id/send-invite', async (req, res) => {
  const target = await resolveTarget(req, res);
  if (!target) return;
  const actor = req.user! as Actor;

  let emailSent = false;
  let inviteUrl: string | undefined;
  try {
    const { token, expiresAt } = await createInviteToken(target.id);
    inviteUrl = `${appBaseUrl(req)}/set-password?token=${token}`;
    emailSent = await sendOwnerInviteEmail(target.email, target.name, target.role, inviteUrl, expiresAt);
  } catch (err) {
    console.error('[email] Failed to send invitation email:', err);
  }

  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action: 'welcome_email',
    targetUserId: target.id,
    targetUserEmail: target.email,
    detail: 'Invitation link sent via plant user management',
    emailSent,
  });
  // Only surface the link when the email failed (e.g. SMTP unconfigured).
  res.json({ emailSent, ...(emailSent ? {} : { inviteUrl }) });
});

export default router;
