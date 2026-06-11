import { getSettings } from './settings.js';

// Ready-mix concrete starts hydrating the moment it is batched and loaded. Once
// it passes its "working life" it can no longer be poured to spec and the load
// is effectively scrap. We anchor the clock to the challan's dispatchTime (the
// moment the loaded mixer leaves the plant) since that is the per-delivery
// timestamp we reliably have, and pair it with the live GPS ETA to predict
// whether the truck will reach the site before the concrete expires.

export const FRESHNESS_KEYS = {
  workingLifeMin: 'concrete_working_life_min',
  warnMin: 'concrete_warn_min',
  avgSpeedKmh: 'concrete_avg_speed_kmh',
} as const;

// Defaults reflect a typical OPC mix in a transit mixer: ~120 min usable life,
// flag as "running low" inside the last 30 min, and assume ~25 km/h average city
// haul speed when a live GPS speed isn't available.
export const DEFAULT_WORKING_LIFE_MIN = 120;
export const DEFAULT_WARN_MIN = 30;
export const DEFAULT_AVG_SPEED_KMH = 25;

export interface FreshnessConfig {
  /** Total usable life of a load in minutes from dispatch. */
  workingLifeMin: number;
  /** Remaining-minutes threshold below which a load is flagged. */
  warnMin: number;
  /** Fallback average haul speed (km/h) used for ETA when GPS speed is absent. */
  avgSpeedKmh: number;
}

export type FreshnessLevel = 'fresh' | 'warning' | 'critical' | 'expired';

export interface FreshnessInput {
  dispatchTime: string | Date | null;
  config: FreshnessConfig;
  now?: Date;
  /** Straight-line metres from the truck to the site (from the live GPS fix). */
  distanceM?: number | null;
  /** Live GPS speed in metres/second, if reported. */
  speed?: number | null;
}

export interface FreshnessResult {
  elapsedMin: number | null;
  remainingMin: number | null;
  pourByIso: string | null;
  etaMin: number | null;
  /** null when ETA can't be computed (no live position yet). */
  willMakeIt: boolean | null;
  level: FreshnessLevel;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function parsePositive(value: string | null | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Resolve the effective freshness configuration, persisted settings overriding
// the built-in defaults.
export async function getFreshnessConfig(): Promise<FreshnessConfig> {
  const persisted = await getSettings(Object.values(FRESHNESS_KEYS));
  return {
    workingLifeMin: parsePositive(persisted[FRESHNESS_KEYS.workingLifeMin], DEFAULT_WORKING_LIFE_MIN),
    warnMin: parsePositive(persisted[FRESHNESS_KEYS.warnMin], DEFAULT_WARN_MIN),
    avgSpeedKmh: parsePositive(persisted[FRESHNESS_KEYS.avgSpeedKmh], DEFAULT_AVG_SPEED_KMH),
  };
}

// Pure freshness computation. Given when a load left the plant and (optionally)
// how far the truck still is from site, classify how urgent the pour is.
export function computeFreshness(input: FreshnessInput): FreshnessResult {
  const { dispatchTime, config, distanceM } = input;
  const now = input.now ?? new Date();

  if (dispatchTime == null) {
    return { elapsedMin: null, remainingMin: null, pourByIso: null, etaMin: null, willMakeIt: null, level: 'fresh' };
  }

  const dispatch = dispatchTime instanceof Date ? dispatchTime : new Date(dispatchTime);
  if (Number.isNaN(dispatch.getTime())) {
    return { elapsedMin: null, remainingMin: null, pourByIso: null, etaMin: null, willMakeIt: null, level: 'fresh' };
  }

  const elapsedMin = (now.getTime() - dispatch.getTime()) / 60000;
  const remainingMin = config.workingLifeMin - elapsedMin;
  const pourByIso = new Date(dispatch.getTime() + config.workingLifeMin * 60000).toISOString();

  // ETA: prefer the live GPS speed; fall back to the configured average haul
  // speed when the truck is stationary/parked or no speed is reported.
  let etaMin: number | null = null;
  if (distanceM != null && Number.isFinite(distanceM)) {
    const gpsSpeed = input.speed != null && input.speed > 0.5 ? input.speed : null;
    const speedMs = gpsSpeed ?? (config.avgSpeedKmh * 1000) / 3600;
    etaMin = distanceM / speedMs / 60;
  }

  const willMakeIt = etaMin == null ? null : etaMin <= remainingMin;

  let level: FreshnessLevel;
  if (remainingMin <= 0) {
    level = 'expired';
  } else if (remainingMin <= config.warnMin || willMakeIt === false) {
    level = 'critical';
  } else if (remainingMin <= config.warnMin * 2) {
    level = 'warning';
  } else {
    level = 'fresh';
  }

  return {
    elapsedMin: round1(elapsedMin),
    remainingMin: round1(remainingMin),
    pourByIso,
    etaMin: etaMin == null ? null : round1(etaMin),
    willMakeIt,
    level,
  };
}
