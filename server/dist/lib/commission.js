import { getSetting, setSetting } from './settings.js';
// Platform commission is the percentage the marketplace takes on each order.
// A single global default lives in app_settings; individual plants may override
// it via plants.commissionPct (NULL = inherit the global default).
export const COMMISSION_KEY = 'platform_commission_pct';
export const DEFAULT_COMMISSION_PCT = 0;
// Clamp + round a percentage into the 0–100 range with 2 decimals. Returns null
// for blank/invalid input so callers can distinguish "clear" from "set".
export function normalizeCommissionPct(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const n = Number(value);
    if (!Number.isFinite(n))
        return null;
    return Math.min(100, Math.max(0, Math.round(n * 100) / 100));
}
export async function getPlatformCommissionPct() {
    const raw = await getSetting(COMMISSION_KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : DEFAULT_COMMISSION_PCT;
}
export async function setPlatformCommissionPct(value) {
    await setSetting(COMMISSION_KEY, value == null ? null : String(value));
}
// Effective commission for a plant: its own override if set, else the global.
export function effectiveCommissionPct(plant, globalPct) {
    if (plant.commissionPct == null || plant.commissionPct === '')
        return globalPct;
    const n = Number(plant.commissionPct);
    return Number.isFinite(n) ? n : globalPct;
}
