import { Router } from 'express';
import { and, eq, desc, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { attendanceRecords, users } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';

const router = Router();
router.use(requireAuth);

// Who may view the plant-wide attendance report (vs. just their own status).
const REPORT_ROLES = ['admin', 'plant_owner', 'supervisor', 'authority'];

// Who may record attendance: every staff/driver role, but never customers.
const ATTEND_ROLES = ['authority', 'admin', 'dispatcher', 'plant_operator', 'driver', 'plant_owner', 'supervisor'];

// Current open shift for the calling user, if any.
async function openRecordFor(userId: number) {
  const [row] = await db
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.userId, userId), isNull(attendanceRecords.checkOutAt)))
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(1);
  return row ?? null;
}

// My attendance status + recent history. Available to any authenticated user so
// staff and drivers can see whether they are currently checked in.
router.get('/me', async (req, res) => {
  const userId = req.user!.id;
  const open = await openRecordFor(userId);
  const recent = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.userId, userId))
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(30);
  res.json({ open, checkedIn: open != null, recent });
});

// Start a shift. Rejects if the user already has an open record (also enforced
// by the partial unique index attendance_open_unique as a race backstop).
router.post('/check-in', requireRole(...ATTEND_ROLES), async (req, res) => {
  const userId = req.user!.id;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() || null : null;

  const existing = await openRecordFor(userId);
  if (existing) {
    res.status(409).json({ error: 'You are already checked in.', open: existing });
    return;
  }

  try {
    const [row] = await db
      .insert(attendanceRecords)
      .values({ userId, plantId: req.user!.plantId ?? null, checkInNote: note })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    // Lost the race against the partial unique index — treat as already-in.
    const cause = (err as { cause?: { code?: string } })?.cause;
    if (cause?.code === '23505') {
      res.status(409).json({ error: 'You are already checked in.' });
      return;
    }
    throw err;
  }
});

// End the current shift by closing the latest open record.
router.post('/check-out', requireRole(...ATTEND_ROLES), async (req, res) => {
  const userId = req.user!.id;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() || null : null;

  const open = await openRecordFor(userId);
  if (!open) {
    res.status(409).json({ error: 'You are not checked in.' });
    return;
  }

  const [row] = await db
    .update(attendanceRecords)
    .set({ checkOutAt: new Date(), checkOutNote: note })
    .where(and(eq(attendanceRecords.id, open.id), isNull(attendanceRecords.checkOutAt)))
    .returning();
  res.json(row ?? open);
});

// Plant-scoped attendance report. Restricted to supervisory roles. Optional
// from/to (ISO date) filters on check-in time.
router.get('/', requireRole(...REPORT_ROLES), async (req, res) => {
  const conds = [plantScope(req.user!.plantId, attendanceRecords.plantId)];

  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
  if (from && !Number.isNaN(from.getTime())) conds.push(gte(attendanceRecords.checkInAt, from));
  if (to && !Number.isNaN(to.getTime())) conds.push(lte(attendanceRecords.checkInAt, to));

  const rows = await db
    .select({
      id: attendanceRecords.id,
      userId: attendanceRecords.userId,
      userName: users.name,
      role: users.role,
      checkInAt: attendanceRecords.checkInAt,
      checkOutAt: attendanceRecords.checkOutAt,
      checkInNote: attendanceRecords.checkInNote,
      checkOutNote: attendanceRecords.checkOutNote,
    })
    .from(attendanceRecords)
    .leftJoin(users, eq(attendanceRecords.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(500);

  res.json(rows);
});

export default router;
