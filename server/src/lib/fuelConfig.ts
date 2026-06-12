import { getSettings } from './settings.js';

// Plant-wide thresholds for diesel cost control & theft detection. These reuse
// the app-settings key/value store (no parallel mechanism). Per-vehicle mileage
// baselines live on the vehicle row; everything here is a plant default or a
// detection threshold.

export const FUEL_KEYS = {
  // Allowed % by which actual litres may exceed expected before a vehicle is
  // flagged as over-consuming (possible theft / leak / mechanical issue).
  reconVariancePct: 'fuel_recon_variance_pct',
  // Plant default idle fuel burn (litres per hour of standing time), used when a
  // vehicle has no per-vehicle idleBurnLph baseline of its own.
  idleBurnLph: 'fuel_idle_burn_lph',
  // A truck stationary away from plant/site for at least this many minutes
  // raises an unscheduled-stop alert.
  unscheduledStopMin: 'fuel_unscheduled_stop_min',
  // A truck more than this many metres off the straight plant→site corridor
  // raises a route-deviation alert.
  routeDeviationM: 'fuel_route_deviation_m',
  // Plant coordinates (decimal degrees) — needed to know "at the plant" and to
  // anchor the plant→site corridor. Alerts that need these are skipped if unset.
  plantLat: 'fuel_plant_lat',
  plantLng: 'fuel_plant_lng',
} as const;

export const DEFAULT_RECON_VARIANCE_PCT = 15;
export const DEFAULT_IDLE_BURN_LPH = 0;
export const DEFAULT_UNSCHEDULED_STOP_MIN = 20;
export const DEFAULT_ROUTE_DEVIATION_M = 2000;

export interface FuelConfig {
  /** % actual may exceed expected before flagging over-consumption. */
  reconVariancePct: number;
  /** Plant default idle burn (litres/hour). */
  idleBurnLph: number;
  /** Minutes stationary (away from plant/site) before a stop alert. */
  unscheduledStopMin: number;
  /** Metres off the plant→site corridor before a deviation alert. */
  routeDeviationM: number;
  /** Plant latitude, or null when not configured. */
  plantLat: number | null;
  /** Plant longitude, or null when not configured. */
  plantLng: number | null;
}

function parseNonNegative(value: string | null | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseCoord(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Resolve the effective fuel/theft configuration, persisted settings overriding
// the built-in defaults.
export async function getFuelConfig(): Promise<FuelConfig> {
  const persisted = await getSettings(Object.values(FUEL_KEYS));
  return {
    reconVariancePct: parseNonNegative(persisted[FUEL_KEYS.reconVariancePct], DEFAULT_RECON_VARIANCE_PCT),
    idleBurnLph: parseNonNegative(persisted[FUEL_KEYS.idleBurnLph], DEFAULT_IDLE_BURN_LPH),
    unscheduledStopMin: parseNonNegative(persisted[FUEL_KEYS.unscheduledStopMin], DEFAULT_UNSCHEDULED_STOP_MIN),
    routeDeviationM: parseNonNegative(persisted[FUEL_KEYS.routeDeviationM], DEFAULT_ROUTE_DEVIATION_M),
    plantLat: parseCoord(persisted[FUEL_KEYS.plantLat]),
    plantLng: parseCoord(persisted[FUEL_KEYS.plantLng]),
  };
}
