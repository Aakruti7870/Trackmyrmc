import { Router } from 'express';
import { and, eq, desc, gte, lte, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { attendanceRecords, users, drivers, vehicles, tripSessions, driverLocations, plants } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { sendPushToPlantAndPlatformStaff } from '../lib/push.js';
import { activeTripForDriver } from '../lib/tripSessions.js';

const router = Router();
router.use(requireAuth);

// Who may view the plant-wide attendance report (vs. just their own status).
const REPORT_ROLES = ['admin', 'plant_owner', 'supervisor', 'authority'];

// Who may record attendance: every on-duty staff/driver role, but never
// customers. Fleet Manager and Quality Engineer are on-duty roles too, so they
// mark attendance and stream live location like the rest.
const ATTEND_ROLES = ['authority', 'admin', 'dispatcher', 'plant_operator', 'driver', 'plant_owner', 'supervisor', 'fleet_manager', 'quality_engineer'];

// Who may view the Live Duty Map — both the REST GET /live board and the live
// SSE stream. Every on-duty staff role sees their coworkers (the map lives on the
// staff dashboards, not just supervisory ones), but customers and drivers never
// view it. Kept in lockstep with the frontend DUTY_ROLES gate. Plant-scoped so a
// plant-bound viewer only sees their own plant's on-duty people.
const LIVE_VIEW_ROLES = ['admin', 'plant_owner', 'supervisor', 'authority', 'dispatcher', 'plant_operator', 'fleet_manager', 'quality_engineer'];

// SSE audience for a live duty event, scoped to the on-duty user's plant. Mirrors
// the tenant scoping of the REST GET /live query: a plant-bound user's fixes only
// reach staff of the same plant, and a null-plant platform user's fixes reach
// platform staff only (never plant-bound staff of an arbitrary plant). Without
// platformOnly, a null audience.plantId is treated as "unscoped" and would leak a
// platform user's live location to every plant's dispatchers/operators.
function dutyAudience(plantId: number | null) {
  return { roles: LIVE_VIEW_ROLES, plantId, platformOnly: plantId == null };
}

// SSE audience for a "gone dark" supervisor alert. Same plant/platform tenant
// scoping as dutyAudience above, but narrowed to the supervisory roles who act
// on it (REPORT_ROLES) rather than every on-duty coworker: a plant-bound
// staffer's alert reaches their plant's supervisors plus platform supervisors,
// and a null-plant platform staffer's alert reaches platform supervisors only.
function staleAlertAudience(plantId: number | null) {
  return { roles: REPORT_ROLES, plantId, platformOnly: plantId == null };
}

// The trip statuses that count as "still running" for the live view / active-trip
// tagging (anything before the terminal delivered/cancelled).
const OPEN_TRIP_STATUSES = ['dispatched', 'in_transit', 'reached_site', 'unloading'] as const;

// Latest live location per checked-in user, kept in-memory for the instant staff
// view (persisted rows in driver_locations are the history). Cleared on
// check-out. Ephemeral by design, exactly like livePositions in positions.ts.
type DriverLiveLocation = {
  userId: number;
  name: string | null;
  phone: string | null;
  role: string | null;
  driverId: number | null;
  vehicleId: number | null;
  vehicleNo: string | null;
  plantId: number | null;
  tripId: number | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery: number | null;
  updatedAt: string;
};
const driverLiveLocations = new Map<number, DriverLiveLocation>();

// A live GPS fix older than this window is treated as inactive: the driver's
// live location expires from the board and a driver.offline event is fanned out,
// so staff stop tracking a phone that has gone silent (GPS off, app closed, dead
// battery) even though the driver never explicitly checked out. Read lazily so
// tests can shrink the window.
function liveGpsStaleMs(): number {
  const n = Number(process.env.LIVE_GPS_STALE_MS);
  return Number.isFinite(n) && n > 0 ? n : 3 * 60 * 1000;
}
function isFreshFix(updatedAt: string, now = Date.now()): boolean {
  const t = Date.parse(updatedAt);
  return Number.isFinite(t) && now - t <= liveGpsStaleMs();
}

// Periodically expire live locations whose last GPS fix has aged past the stale
// window, emitting driver.offline so connected staff drop the marker in real
// time. A fresh GET /live read applies the same freshness gate. Unref'd so the
// timer never keeps the process (or a test run) alive.
export async function sweepStaleLiveFixes(now = Date.now()): Promise<void> {
  const stale: { userId: number; name: string | null; role: string | null; plantId: number | null }[] = [];
  for (const [userId, live] of driverLiveLocations) {
    if (!isFreshFix(live.updatedAt, now)) {
      driverLiveLocations.delete(userId);
      emitSSEEvent('driver.offline', { userId }, dutyAudience(live.plantId ?? null));
      stale.push({ userId, name: live.name, role: live.role, plantId: live.plantId ?? null });
    }
  }
  if (stale.length) await alertStaleStaff(stale);
}
const liveGpsSweep = setInterval(() => { void sweepStaleLiveFixes(); }, 30 * 1000);
liveGpsSweep.unref?.();

type StaleStaffer = { userId: number; name: string | null; role: string | null; plantId: number | null };

// Alert supervisors that on-duty staffers' live GPS aged out while they were
// still checked in (phone off, app closed, dead battery) — an actionable "gone
// dark" signal, not a normal check-out (check-out clears the map silently and
// never lands here). Fires an in-app toast via SSE plus a best-effort web push
// to same-plant + platform supervisors (matching the SSE audience, so an
// off-app supervisor still gets the push). To avoid an alert storm when many
// fixes age out in the same sweep (shift change, site-wide blackout), staffers
// are grouped by their tenant scope (plantId) and each supervisor audience gets
// ONE grouped alert ("N staffers have gone offline") instead of N; a lone
// drop-off still names the individual as before. Purely a side effect: any
// failure is swallowed so the sweep timer never crashes.
async function alertStaleStaff(stale: StaleStaffer[]): Promise<void> {
  try {
    // Group by tenant scope so one plant's names never bleed into another plant's
    // toast, and each audience is alerted once. Platform supervisors still see
    // one grouped alert per affected plant, bounded by plant count, not staffers.
    const byPlant = new Map<number | null, StaleStaffer[]>();
    for (const s of stale) {
      const list = byPlant.get(s.plantId) ?? [];
      list.push(s);
      byPlant.set(s.plantId, list);
    }
    for (const [plantId, group] of byPlant) {
      // Best-effort, fire-and-forget: the .catch keeps a push/DB failure from
      // escaping as an unhandled rejection (the surrounding try/catch can't see a
      // non-awaited promise) so the sweep timer never crashes.
      const push = (payload: Parameters<typeof sendPushToPlantAndPlatformStaff>[2]) =>
        void sendPushToPlantAndPlatformStaff(plantId, REPORT_ROLES, payload)
          .catch((err) => console.warn('[attendance] stale-GPS push failed:', err));

      if (group.length === 1) {
        const s = group[0];
        const name = s.name ?? 'A staff member';
        emitSSEEvent(
          'duty.stale',
          { userId: s.userId, name, role: s.role, plantId },
          staleAlertAudience(plantId),
        );
        push({
          title: 'On-duty GPS lost',
          body: `${name}'s location has gone dark while on duty — check on them.`,
          url: '/',
          tag: `duty-stale-${s.userId}`,
        });
      } else {
        const count = group.length;
        const staffers = group.map((s) => ({
          userId: s.userId,
          name: s.name ?? 'A staff member',
          role: s.role,
        }));
        emitSSEEvent(
          'duty.stale',
          { plantId, count, staffers },
          staleAlertAudience(plantId),
        );
        push({
          title: 'On-duty GPS lost',
          body: `${count} staffers have gone offline — GPS inactive, check on them.`,
          url: '/',
          tag: `duty-stale-batch-${plantId ?? 'platform'}`,
        });
      }
    }
  } catch (err) {
    console.warn('[attendance] Failed to alert supervisors of stale on-duty GPS:', err);
  }
}

// Test-only: clear the in-memory live-location map so a sweep test isn't polluted
// by fixes streamed in earlier tests sharing this module instance.
export function __resetLiveLocationsForTest(): void {
  driverLiveLocations.clear();
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: unknown): number | null {
  const n = numOrNull(v);
  return n == null ? null : Math.round(n);
}

// Parse a best-effort {lat,lng} pair from a request body. Coordinates are
// optional on check-in/out (GPS may be denied/unavailable), so an invalid or
// missing pair yields nulls rather than an error — attendance still records.
function coordsFromBody(body: unknown): { lat: string | null; lng: string | null } {
  const b = body as { lat?: unknown; lng?: unknown } | null | undefined;
  const lat = numOrNull(b?.lat);
  const lng = numOrNull(b?.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { lat: null, lng: null };
  }
  return { lat: lat.toString(), lng: lng.toString() };
}

// Total shift hours (2dp) between check-in and now/check-out; null if unusable.
function totalHours(checkInAt: Date | string, checkOutAt: Date | string | null): number | null {
  const start = new Date(checkInAt).getTime();
  const end = checkOutAt ? new Date(checkOutAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

// Explicit attendance status derived from the open/closed state.
function attendanceStatus(checkOutAt: Date | string | null): 'CHECKED_IN' | 'CHECKED_OUT' {
  return checkOutAt ? 'CHECKED_OUT' : 'CHECKED_IN';
}

// Decorate a raw attendance row with the derived status + total hours the
// clients render, without persisting redundant columns.
function decorateRecord<T extends { checkInAt: Date | string; checkOutAt: Date | string | null }>(row: T) {
  return { ...row, status: attendanceStatus(row.checkOutAt), totalHours: totalHours(row.checkInAt, row.checkOutAt) };
}

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
  res.json({
    open: open ? decorateRecord(open) : null,
    checkedIn: open != null,
    recent: recent.map(decorateRecord),
  });
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

  const { lat, lng } = coordsFromBody(req.body);

  try {
    const [row] = await db
      .insert(attendanceRecords)
      .values({ userId, plantId: req.user!.plantId ?? null, checkInNote: note, checkInLat: lat, checkInLng: lng })
      .returning();
    res.status(201).json(decorateRecord(row));
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

  const { lat, lng } = coordsFromBody(req.body);

  const [row] = await db
    .update(attendanceRecords)
    .set({ checkOutAt: new Date(), checkOutNote: note, checkOutLat: lat, checkOutLng: lng })
    .where(and(eq(attendanceRecords.id, open.id), isNull(attendanceRecords.checkOutAt)))
    .returning();
  // Tracking stops on check-out: drop the in-memory live fix and tell staff so
  // the user falls off the live duty map immediately.
  driverLiveLocations.delete(userId);
  emitSSEEvent('driver.offline', { userId }, dutyAudience(open.plantId ?? null));
  res.json(decorateRecord(row ?? open));
});

// Driver/staff stream a live GPS fix while checked in. Rejected unless the caller
// has an OPEN attendance record, so location only flows between check-in and
// check-out. Each fix is persisted (history) and cached in-memory (instant live
// view), then fanned out to staff, plant-scoped.
router.post('/location', requireRole(...ATTEND_ROLES), async (req, res) => {
  const userId = req.user!.id;
  const open = await openRecordFor(userId);
  if (!open) {
    res.status(409).json({ error: 'You are not checked in.' });
    return;
  }
  const latitude = Number(req.body?.lat);
  const longitude = Number(req.body?.lng);
  // Reject "undefined", "null", NaN, Infinity and out-of-range coordinates.
  // Android sends location.getLatitude() as a double; a default/unset GPS fix
  // can produce 0,0 (acceptable) but never NaN or values outside range.
  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  ) {
    res.status(400).json({ error: 'lat must be −90…90 and lng must be −180…180' });
    return;
  }
  const accuracy = intOrNull(req.body?.accuracy);
  const speed = numOrNull(req.body?.speed);
  const heading = numOrNull(req.body?.heading);
  const battery = intOrNull(req.body?.battery);

  const driverId = req.user!.linkedDriverId ?? null;
  const plantId = open.plantId ?? req.user!.plantId ?? null;

  // Resolve the driver's assigned truck + any active trip so the live board can
  // show the truck number and on-trip status without extra client lookups.
  let vehicleId: number | null = null;
  let vehicleNo: string | null = null;
  let tripId: number | null = null;
  if (driverId) {
    const [v] = await db
      .select({ id: vehicles.id, vehicleNo: vehicles.vehicleNo })
      .from(vehicles)
      .where(eq(vehicles.driverId, driverId))
      .limit(1);
    vehicleId = v?.id ?? null;
    vehicleNo = v?.vehicleNo ?? null;
    const trip = await activeTripForDriver(driverId);
    tripId = trip?.id ?? null;
  }

  await db.insert(driverLocations).values({
    userId,
    attendanceId: open.id,
    driverId,
    vehicleId,
    plantId,
    tripId,
    lat: latitude.toString(),
    lng: longitude.toString(),
    accuracy,
    speed: speed != null ? speed.toString() : null,
    heading: heading != null ? heading.toString() : null,
    battery,
  });

  const live: DriverLiveLocation = {
    userId,
    name: req.user!.name ?? null,
    phone: null,
    role: req.user!.role ?? null,
    driverId,
    vehicleId,
    vehicleNo,
    plantId,
    tripId,
    lat: latitude,
    lng: longitude,
    accuracy,
    speed,
    heading,
    battery,
    updatedAt: new Date().toISOString(),
  };
  driverLiveLocations.set(userId, live);
  emitSSEEvent('driver.location', live, dutyAudience(plantId));
  res.json({ ok: true });
});

// Staff live view: every currently checked-in user with their identity, truck,
// check-in time, current status, and last-known location. Plant-scoped.
router.get('/live', requireRole(...LIVE_VIEW_ROLES), async (req, res) => {
  const openRows = await db
    .select({
      attendanceId: attendanceRecords.id,
      userId: attendanceRecords.userId,
      checkInAt: attendanceRecords.checkInAt,
      plantId: attendanceRecords.plantId,
      userName: users.name,
      userPhone: users.phone,
      role: users.role,
      linkedDriverId: users.linkedDriverId,
      driverName: drivers.name,
      driverPhone: drivers.phone,
      plantName: plants.name,
    })
    .from(attendanceRecords)
    .leftJoin(users, eq(attendanceRecords.userId, users.id))
    .leftJoin(drivers, eq(users.linkedDriverId, drivers.id))
    .leftJoin(plants, eq(attendanceRecords.plantId, plants.id))
    .where(and(isNull(attendanceRecords.checkOutAt), plantScope(req.user!.plantId, attendanceRecords.plantId)))
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(500);

  const driverIds = openRows
    .map((r) => r.linkedDriverId)
    .filter((x): x is number => x != null);

  const truckByDriver = new Map<number, string>();
  const tripByDriver = new Map<number, { status: string; challanId: number }>();
  if (driverIds.length) {
    const vehRows = await db
      .select({ driverId: vehicles.driverId, vehicleNo: vehicles.vehicleNo })
      .from(vehicles)
      .where(inArray(vehicles.driverId, driverIds));
    for (const v of vehRows) if (v.driverId != null) truckByDriver.set(v.driverId, v.vehicleNo);
    const tripRows = await db
      .select({ driverId: tripSessions.driverId, status: tripSessions.status, challanId: tripSessions.challanId, startedAt: tripSessions.startedAt })
      .from(tripSessions)
      .where(and(inArray(tripSessions.driverId, driverIds), inArray(tripSessions.status, [...OPEN_TRIP_STATUSES])))
      .orderBy(tripSessions.startedAt);
    // Later rows overwrite earlier ones, so each driver keeps their most recent
    // open trip.
    for (const t of tripRows) if (t.driverId != null) tripByDriver.set(t.driverId, { status: t.status, challanId: t.challanId });
  }

  const nowMs = Date.now();
  const drivers_ = openRows.map((r) => {
    const cached = driverLiveLocations.get(r.userId) ?? null;
    // Expose the fix only while it is still fresh; a GPS-inactive driver shows as
    // checked-in with no live location (their marker stops), matching the
    // driver.offline the sweep fans out to already-connected staff.
    const live = cached && isFreshFix(cached.updatedAt, nowMs) ? cached : null;
    const trip = r.linkedDriverId != null ? tripByDriver.get(r.linkedDriverId) ?? null : null;
    return {
      userId: r.userId,
      name: r.userName ?? r.driverName ?? null,
      phone: r.driverPhone ?? r.userPhone ?? null,
      role: r.role,
      plantId: r.plantId,
      plantName: r.plantName ?? null,
      driverId: r.linkedDriverId,
      vehicleNo: r.linkedDriverId != null ? truckByDriver.get(r.linkedDriverId) ?? null : null,
      checkInAt: r.checkInAt,
      status: trip ? trip.status : 'on_duty',
      // Presence for the duty map: a checked-in user with a fresh fix is Online;
      // one whose GPS has gone stale is "gps_inactive" (kept visible, not dropped
      // silently). Checked-out users never appear here (filtered by the query).
      presence: live ? 'online' : 'gps_inactive',
      lastUpdatedAt: live?.updatedAt ?? null,
      tripChallanId: trip?.challanId ?? null,
      location: live
        ? { lat: live.lat, lng: live.lng, speed: live.speed, heading: live.heading, updatedAt: live.updatedAt }
        : null,
    };
  });

  res.json({ drivers: drivers_, generatedAt: new Date().toISOString() });
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
      checkInLat: attendanceRecords.checkInLat,
      checkInLng: attendanceRecords.checkInLng,
      checkOutLat: attendanceRecords.checkOutLat,
      checkOutLng: attendanceRecords.checkOutLng,
    })
    .from(attendanceRecords)
    .leftJoin(users, eq(attendanceRecords.userId, users.id))
    .where(and(...conds))
    .orderBy(desc(attendanceRecords.checkInAt))
    .limit(500);

  res.json(rows.map(decorateRecord));
});

export default router;
