import type { Challan, IdleConfig } from './api';

// Client-side mirror of the server's trip-timing math (server/src/lib/idle.ts).
// Used to render travel time, time-at-site and billable idle/charge on the
// challan detail, print view, dispatch list and reports without an extra
// round-trip. The server remains the source of truth for any persisted value.

export const DEFAULT_IDLE_FREE_MIN = 45;

export interface TripTiming {
  travelMin: number | null;
  siteMin: number | null;
  billableIdleMin: number | null;
  idleCharge: number | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toDate(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeTripTiming(
  challan: Pick<Challan, 'dispatchTime' | 'siteArrivalTime' | 'siteReleaseTime'>,
  config: IdleConfig = { freeMin: DEFAULT_IDLE_FREE_MIN, ratePerHour: null },
): TripTiming {
  const dispatch = toDate(challan.dispatchTime);
  const arrival = toDate(challan.siteArrivalTime);
  const release = toDate(challan.siteReleaseTime);

  let travelMin: number | null = null;
  if (dispatch && arrival) {
    const m = (arrival.getTime() - dispatch.getTime()) / 60000;
    travelMin = m >= 0 ? round1(m) : null;
  }

  let siteMin: number | null = null;
  let billableIdleMin: number | null = null;
  let idleCharge: number | null = null;
  if (arrival && release) {
    const m = (release.getTime() - arrival.getTime()) / 60000;
    if (m >= 0) {
      siteMin = round1(m);
      const billable = Math.max(0, m - config.freeMin);
      billableIdleMin = round1(billable);
      if (config.ratePerHour != null) {
        idleCharge = Math.round((billable / 60) * config.ratePerHour * 100) / 100;
      }
    }
  }

  return { travelMin, siteMin, billableIdleMin, idleCharge };
}

// Render minutes as a compact "1h 05m" / "45m" duration. Returns "—" for null.
export function formatDuration(min: number | null | undefined): string {
  if (min == null) return '—';
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
