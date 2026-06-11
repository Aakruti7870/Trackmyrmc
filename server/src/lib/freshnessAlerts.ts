import { getFreshnessLoads } from '../routes/positions.js';
import { emitSSEEvent } from './sseEmitter.js';
import type { FreshnessLevel } from './freshness.js';

// Remembers the last alerted level per challan so each escalation fires once.
// In-memory by design (single-process), matching the live-positions store.
const lastLevel = new Map<number, FreshnessLevel>();

// Recompute freshness for all in-transit loads and push an SSE alert whenever a
// load newly crosses into 'critical' or 'expired'. Emitted with an empty
// audience so only staff connections (admin/dispatcher/plant_operator) receive
// it — customers and drivers never see plant-wide freshness alerts.
export async function tickFreshnessAlerts(now = new Date()): Promise<void> {
  const { loads } = await getFreshnessLoads(now);
  const seen = new Set<number>();

  for (const load of loads) {
    seen.add(load.challanId);
    const prev = lastLevel.get(load.challanId);
    lastLevel.set(load.challanId, load.level);
    const isAlertLevel = load.level === 'critical' || load.level === 'expired';
    // Fire only on a transition into a new alert level (dedupe repeated ticks).
    if (isAlertLevel && prev !== load.level) {
      emitSSEEvent('challan.freshness', load, {});
    }
  }

  // Forget loads that are no longer in transit (delivered/cancelled) so a future
  // re-dispatch of the same challan can alert again.
  for (const id of [...lastLevel.keys()]) {
    if (!seen.has(id)) lastLevel.delete(id);
  }
}
