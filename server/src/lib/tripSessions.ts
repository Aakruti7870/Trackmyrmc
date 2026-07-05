import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, sites, tripSessions } from '../db/schema.js';

// Trip statuses the DRIVER may advance to via the in-app controls. The terminal
// 'delivered'/'cancelled' states are set by the delivery paths (manual PUT,
// geofence auto-delivery), never by the driver's stage buttons.
export const DRIVER_TRIP_STATUSES = ['in_transit', 'reached_site', 'unloading'] as const;
export type DriverTripStatus = (typeof DRIVER_TRIP_STATUSES)[number];

export type TripSessionRow = typeof tripSessions.$inferSelect;

// The finer trip lifecycle is a strict forward-only ladder; a driver can move
// forward or re-assert the current stage, but never regress. Delivered/cancelled
// are terminal and only reachable through the delivery paths.
const STAGE_ORDER = ['dispatched', 'in_transit', 'reached_site', 'unloading', 'delivered'] as const;

export function tripStageRank(status: string): number {
  const i = STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);
  return i === -1 ? -1 : i;
}

// Create the formal trip-tracking session for a freshly-dispatched challan.
// Idempotent: onConflictDoNothing on the unique challanId, so re-dispatching or
// a retried request never creates a duplicate. Snapshots the delivery
// destination (site coords) at dispatch time. Best-effort — never throws into
// the dispatch flow.
export async function createTripSessionForChallan(challanId: number): Promise<TripSessionRow | null> {
  try {
    const [c] = await db
      .select({
        id: challans.id,
        orderId: challans.orderId,
        clientId: challans.clientId,
        driverId: challans.driverId,
        vehicleId: challans.vehicleId,
        plantId: challans.plantId,
        siteLat: sites.latitude,
        siteLng: sites.longitude,
      })
      .from(challans)
      .leftJoin(sites, eq(challans.siteId, sites.id))
      .where(eq(challans.id, challanId));
    if (!c) return null;

    const [row] = await db
      .insert(tripSessions)
      .values({
        challanId: c.id,
        orderId: c.orderId ?? null,
        clientId: c.clientId ?? null,
        driverId: c.driverId ?? null,
        vehicleId: c.vehicleId ?? null,
        plantId: c.plantId ?? null,
        status: 'dispatched',
        customerTrackingActive: true,
        deliveryLat: c.siteLat ?? null,
        deliveryLng: c.siteLng ?? null,
      })
      .onConflictDoNothing({ target: tripSessions.challanId })
      .returning();
    return row ?? (await getTripByChallan(challanId));
  } catch (err) {
    console.warn('[tripSessions] createTripSessionForChallan failed:', err);
    return null;
  }
}

export async function getTripByChallan(challanId: number): Promise<TripSessionRow | null> {
  const [row] = await db.select().from(tripSessions).where(eq(tripSessions.challanId, challanId));
  return row ?? null;
}

// Fold the latest live GPS fix into the session so staff and the customer page
// can render the last-known position without hitting the in-memory positions
// map. Best-effort; a missing session (legacy challan) is a no-op.
export async function updateTripLocation(
  challanId: number,
  lat: number,
  lng: number,
): Promise<void> {
  try {
    await db
      .update(tripSessions)
      .set({ lastLat: lat.toString(), lastLng: lng.toString(), lastUpdatedAt: new Date() })
      .where(eq(tripSessions.challanId, challanId));
  } catch (err) {
    console.warn('[tripSessions] updateTripLocation failed:', err);
  }
}

// Advance a session to one of the driver stages. Forward-only: rejects a
// regression or a move on an already-terminal (delivered/cancelled) session.
// Returns the updated row, or null when there is nothing to update.
export async function advanceTripStatus(
  challanId: number,
  status: DriverTripStatus,
): Promise<{ ok: true; row: TripSessionRow } | { ok: false; reason: 'not_found' | 'closed' | 'regression' }> {
  const current = await getTripByChallan(challanId);
  if (!current) return { ok: false, reason: 'not_found' };
  if (current.status === 'delivered' || current.status === 'cancelled') {
    return { ok: false, reason: 'closed' };
  }
  if (tripStageRank(status) < tripStageRank(current.status)) {
    return { ok: false, reason: 'regression' };
  }
  const [row] = await db
    .update(tripSessions)
    .set({ status })
    .where(eq(tripSessions.challanId, challanId))
    .returning();
  return { ok: true, row };
}

// Close the trip when the challan is delivered from ANY path (manual PUT,
// geofence auto-delivery, driver "Mark delivered"). Flips the customer link off
// and stamps deliveredAt. Idempotent and best-effort.
export async function closeTripOnDelivery(challanId: number): Promise<TripSessionRow | null> {
  try {
    const [row] = await db
      .update(tripSessions)
      .set({ status: 'delivered', customerTrackingActive: false, deliveredAt: new Date() })
      .where(and(eq(tripSessions.challanId, challanId), isNull(tripSessions.deliveredAt)))
      .returning();
    return row ?? null;
  } catch (err) {
    console.warn('[tripSessions] closeTripOnDelivery failed:', err);
    return null;
  }
}

// The active trip for a driver (used to tag attendance GPS fixes with a tripId).
// Returns the most-relevant open session challanId + id, or null.
export async function activeTripForDriver(
  driverId: number,
): Promise<{ id: number; challanId: number } | null> {
  const rows = await db
    .select({ id: tripSessions.id, challanId: tripSessions.challanId, status: tripSessions.status })
    .from(tripSessions)
    .where(
      and(
        eq(tripSessions.driverId, driverId),
        inArray(tripSessions.status, ['dispatched', 'in_transit', 'reached_site', 'unloading']),
      ),
    )
    .orderBy(tripSessions.startedAt);
  const row = rows[rows.length - 1];
  return row ? { id: row.id, challanId: row.challanId } : null;
}
