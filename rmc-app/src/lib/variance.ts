import { useState, useEffect } from 'react';
import { api } from './api';

export interface VarianceTolerance {
  /** Absolute tolerance in m³ — deltas within this are treated as on-target. */
  abs: number;
  /** Tolerance as a percentage of the planned quantity (0 = disabled). */
  pct: number;
}

// Matches the server default (server/src/lib/variance.ts) used when unset.
export const DEFAULT_VARIANCE_TOLERANCE: VarianceTolerance = { abs: 0.1, pct: 0 };

// The largest acceptable absolute delta for a given planned quantity, combining
// the absolute band with the percentage band (whichever is more generous).
export function toleranceLimit(planned: number, t: VarianceTolerance): number {
  return Math.max(t.abs, (t.pct / 100) * Math.abs(planned));
}

export function isWithinTolerance(variance: number, planned: number, t: VarianceTolerance): boolean {
  return Math.abs(variance) <= toleranceLimit(planned, t);
}

function coerce(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Fetch the plant's configured delivery variance tolerance once. Any authenticated
// user can read it, so the Dispatch board and Reports views stay consistent.
export function useVarianceTolerance(): VarianceTolerance {
  const [tolerance, setTolerance] = useState<VarianceTolerance>(DEFAULT_VARIANCE_TOLERANCE);
  useEffect(() => {
    let cancelled = false;
    api.get<VarianceTolerance>('/reports/variance-tolerance')
      .then(t => {
        if (cancelled) return;
        setTolerance({
          abs: coerce(t.abs, DEFAULT_VARIANCE_TOLERANCE.abs),
          pct: coerce(t.pct, DEFAULT_VARIANCE_TOLERANCE.pct),
        });
      })
      .catch(() => { /* fall back to defaults */ });
    return () => { cancelled = true; };
  }, []);
  return tolerance;
}
