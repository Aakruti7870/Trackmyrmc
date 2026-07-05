import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { emergencies, drivers, users, challans } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { sendPushToPlantAndPlatformStaff } from '../lib/push.js';

const router = Router();
router.use(requireAuth);

// Supervisors who receive SOS alerts — the same roles the on-duty stale-fix
// alert targets, so an SOS lands on exactly the people who oversee drivers.
const SUPERVISOR_ROLES = ['admin', 'plant_owner', 'supervisor', 'authority'] as const;

const TYPES = ['accident', 'breakdown', 'medical', 'safety', 'theft', 'other'] as const;

const emergencySelect = {
  id: emergencies.id,
  driverId: emergencies.driverId,
  userId: emergencies.userId,
  plantId: emergencies.plantId,
  challanId: emergencies.challanId,
  type: emergencies.type,
  message: emergencies.message,
  lat: emergencies.lat,
  lng: emergencies.lng,
  status: emergencies.status,
  acknowledgedByName: emergencies.acknowledgedByName,
  acknowledgedAt: emergencies.acknowledgedAt,
  resolvedAt: emergencies.resolvedAt,
  createdAt: emergencies.createdAt,
};

function parseType(value: unknown): string {
  if (typeof value !== 'string' || !TYPES.includes(value as typeof TYPES[number])) {
    throw new Error('Invalid emergency type');
  }
  return value;
}

function parseCoord(value: unknown, kind: 'lat' | 'lng'): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  const limit = kind === 'lat' ? 90 : 180;
  if (!Number.isFinite(n) || Math.abs(n) > limit) throw new Error(`Invalid ${kind === 'lat' ? 'latitude' : 'longitude'}`);
  return n.toString();
}

// A driver's own raised emergencies (newest first).
router.get('/mine', requireRole('driver'), async (req, res) => {
  const rows = await db
    .select(emergencySelect)
    .from(emergencies)
    .where(eq(emergencies.userId, req.user!.id))
    .orderBy(desc(emergencies.createdAt));
  res.json(rows);
});

// Supervisor view — plant-scoped, optional ?status= filter.
router.get('/', requireRole(...SUPERVISOR_ROLES), async (req, res) => {
  const filters = [];
  const scope = plantScope(req.user!.plantId, emergencies.plantId);
  if (scope) filters.push(scope);
  const status = req.query.status;
  if (status === 'open' || status === 'acknowledged' || status === 'resolved') {
    filters.push(eq(emergencies.status, status));
  }
  const rows = await db
    .select({ ...emergencySelect, driverName: drivers.name })
    .from(emergencies)
    .leftJoin(drivers, eq(emergencies.driverId, drivers.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(emergencies.createdAt));
  res.json(rows);
});

// A driver raises an SOS. Fans out to plant + platform supervisors (SSE + push).
router.post('/', requireRole('driver'), async (req, res) => {
  let type: string, lat: string | null, lng: string | null;
  try {
    type = parseType(req.body.type);
    lat = parseCoord(req.body.lat, 'lat');
    lng = parseCoord(req.body.lng, 'lng');
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid emergency' });
    return;
  }

  const [me] = await db
    .select({ driverId: users.linkedDriverId, plantId: users.plantId, name: users.name })
    .from(users)
    .where(eq(users.id, req.user!.id));
  const plantId = me?.plantId ?? null;
  const driverId = me?.driverId ?? null;

  // Optional trip link, validated to the driver's plant.
  let challanId: number | null = null;
  if (req.body.challanId !== undefined && req.body.challanId !== null && req.body.challanId !== '') {
    const cId = +req.body.challanId;
    const scope = plantScope(plantId, challans.plantId);
    const cEq = eq(challans.id, cId);
    const [c] = await db.select({ id: challans.id }).from(challans).where(scope ? and(cEq, scope) : cEq);
    if (c) challanId = cId;
  }

  const message = typeof req.body.message === 'string' && req.body.message.trim() ? req.body.message.trim() : null;

  const [row] = await db
    .insert(emergencies)
    .values({ driverId, userId: req.user!.id, plantId, challanId, type, message, lat, lng })
    .returning();

  // Notify supervisors: in-app SSE toast + web push (mirrors the stale-fix
  // audience — plant staff PLUS platform staff, or platform-only when unscoped).
  const driverName = me?.name ?? 'A driver';
  const audience = { roles: [...SUPERVISOR_ROLES], plantId, platformOnly: plantId == null };
  emitSSEEvent('emergency.raised', { ...row, driverName }, audience);
  void sendPushToPlantAndPlatformStaff(plantId, SUPERVISOR_ROLES, {
    title: `SOS: ${type}`,
    body: `${driverName} raised an emergency${message ? ` — ${message}` : ''}`,
    url: '/emergencies',
    tag: `emergency-${row.id}`,
  }).catch(() => {});

  res.status(201).json(row);
});

// Supervisor acknowledges or resolves an emergency (plant-scoped).
router.patch('/:id', requireRole(...SUPERVISOR_ROLES), async (req, res) => {
  const id = +req.params.id;
  const scope = plantScope(req.user!.plantId, emergencies.plantId);
  const idEq = eq(emergencies.id, id);
  const [existing] = await db.select({ id: emergencies.id }).from(emergencies).where(scope ? and(idEq, scope) : idEq);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const status = req.body.status;
  if (status !== 'acknowledged' && status !== 'resolved') {
    res.status(400).json({ error: "status must be 'acknowledged' or 'resolved'" });
    return;
  }
  const actor = req.user!;
  const set: Record<string, unknown> = { status };
  if (status === 'acknowledged') {
    set.acknowledgedBy = actor.id;
    set.acknowledgedByName = actor.name;
    set.acknowledgedAt = new Date();
  } else {
    set.resolvedAt = new Date();
  }
  const [row] = await db.update(emergencies).set(set).where(eq(emergencies.id, id)).returning();
  res.json(row);
});

export default router;
