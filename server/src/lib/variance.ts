import { getSettings } from './settings.js';

export const VARIANCE_KEYS = {
  abs: 'variance_tolerance_abs',
  pct: 'variance_tolerance_pct',
} as const;

// When unset, deliveries within ±0.1 m³ of the planned quantity are treated as
// on-target. The percentage band is disabled (0) by default.
export const DEFAULT_VARIANCE_ABS = 0.1;
export const DEFAULT_VARIANCE_PCT = 0;

export interface VarianceTolerance {
  /** Absolute tolerance in m³ — deltas within this are treated as on-target. */
  abs: number;
  /** Tolerance as a percentage of the planned quantity (0 = disabled). */
  pct: number;
}

function parseNonNegative(value: string | null | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Resolve the effective variance tolerance: persisted database settings take
// precedence, falling back to the built-in defaults when unset.
export async function getVarianceTolerance(): Promise<VarianceTolerance> {
  const persisted = await getSettings(Object.values(VARIANCE_KEYS));
  return {
    abs: parseNonNegative(persisted[VARIANCE_KEYS.abs], DEFAULT_VARIANCE_ABS),
    pct: parseNonNegative(persisted[VARIANCE_KEYS.pct], DEFAULT_VARIANCE_PCT),
  };
}

// The largest acceptable absolute delta for a given planned quantity, combining
// the absolute band with the percentage band (whichever is more generous).
export function toleranceLimit(planned: number, t: VarianceTolerance): number {
  return Math.max(t.abs, (t.pct / 100) * Math.abs(planned));
}

export function isWithinTolerance(variance: number, planned: number, t: VarianceTolerance): boolean {
  return Math.abs(variance) <= toleranceLimit(planned, t);
}
