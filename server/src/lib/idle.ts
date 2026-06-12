import { getSettings } from './settings.js';

// A transit mixer that reaches the customer's site but is held there waiting to
// pour (queueing, pump setup, site delays) keeps the truck and driver tied up.
// The plant gives a free grace window after arrival, then bills "idle"/standing
// time beyond it. We measure the standing time from the site arrival timestamp
// to the site release timestamp (both persisted on the challan) so the figure
// survives the in-memory, ephemeral live-position state.

export const IDLE_KEYS = {
  freeMin: 'idle_free_min',
  ratePerHour: 'idle_rate_per_hour',
} as const;

// The first 45 minutes at site are free by default; the owner can change this.
// There is no default idle rate — billing the standing time in money is opt-in.
export const DEFAULT_IDLE_FREE_MIN = 45;

export interface IdleConfig {
  /** Minutes after arrival that are NOT billed as idle. */
  freeMin: number;
  /** Idle charge per hour of billable idle, or null when not configured. */
  ratePerHour: number | null;
}

export interface TripTimingInput {
  dispatchTime: string | Date | null;
  siteArrivalTime: string | Date | null;
  siteReleaseTime: string | Date | null;
  config: IdleConfig;
}

export interface TripTiming {
  /** Minutes from dispatch to site arrival, or null when not computable. */
  travelMin: number | null;
  /** Minutes from arrival to release (total time at site), or null. */
  siteMin: number | null;
  /** Billable idle minutes after the free window, or null when not computable. */
  billableIdleMin: number | null;
  /** Idle charge in currency when a rate is set and idle is billable, else null. */
  idleCharge: number | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parseNonNegative(value: string | null | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseRate(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toDate(value: string | Date | null): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Resolve the effective idle configuration, persisted settings overriding the
// built-in defaults.
export async function getIdleConfig(): Promise<IdleConfig> {
  const persisted = await getSettings(Object.values(IDLE_KEYS));
  return {
    freeMin: parseNonNegative(persisted[IDLE_KEYS.freeMin], DEFAULT_IDLE_FREE_MIN),
    ratePerHour: parseRate(persisted[IDLE_KEYS.ratePerHour]),
  };
}

// Pure trip-timing computation from the three persisted timestamps. Negative or
// out-of-order intervals collapse to null/0 so a bad manual edit can't produce a
// nonsensical bill.
export function computeTripTiming(input: TripTimingInput): TripTiming {
  const { config } = input;
  const dispatch = toDate(input.dispatchTime);
  const arrival = toDate(input.siteArrivalTime);
  const release = toDate(input.siteReleaseTime);

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
