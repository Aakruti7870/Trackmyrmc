import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { automationSends, automationSettings } from '../db/schema.js';
import { getSetting, setSetting } from './settings.js';
// ---- Automation catalogue ----------------------------------------------------
// The eight configurable automations. Every one defaults to OFF except cleanup,
// which is safe housekeeping (purging expired tokens/caches and old trash).
export const AUTOMATIONS = [
    'orderReminders',
    'deliveryFollowUp',
    'tripShare',
    'digest',
    'fuelAnomaly',
    'winBack',
    'idleVehicle',
    'cleanup',
];
export function isAutomationName(value) {
    return AUTOMATIONS.includes(value);
}
export const AUTOMATION_DEFS = {
    orderReminders: {
        name: 'orderReminders',
        label: 'Order reminders',
        description: 'Remind customers the evening before their scheduled delivery date.',
        defaultEnabled: false,
        // sendHour is the IST hour (0–23) after which the reminder goes out.
        defaultConfig: { sendHour: 18, email: true, push: true, whatsapp: false, whatsappTemplate: '' },
    },
    deliveryFollowUp: {
        name: 'deliveryFollowUp',
        label: 'Delivery follow-up',
        description: 'Alert staff when a dispatched trip has not been marked delivered after a delay.',
        defaultEnabled: false,
        defaultConfig: { delayHours: 4, email: false, push: true },
    },
    tripShare: {
        name: 'tripShare',
        label: 'Auto trip-share link',
        description: 'Automatically send the customer a live-tracking link when their trip is dispatched.',
        defaultEnabled: false,
        defaultConfig: { ttlHours: 24, email: true, push: true, whatsapp: false, whatsappTemplate: '' },
    },
    digest: {
        name: 'digest',
        label: 'Daily / weekly digest',
        description: 'Send plant admins a summary of orders, dispatched volume, top clients and fuel flags by email and/or WhatsApp.',
        defaultEnabled: false,
        // frequency 'daily' | 'weekly'; weekday 0=Sunday…6=Saturday (weekly only).
        defaultConfig: { frequency: 'daily', sendHour: 8, weekday: 1, email: true, whatsapp: false, whatsappTemplate: '' },
    },
    fuelAnomaly: {
        name: 'fuelAnomaly',
        label: 'Fuel anomaly alerts',
        description: 'Alert staff when a vehicle burns more diesel than expected over the last few days.',
        defaultEnabled: false,
        defaultConfig: { thresholdPct: 15, windowDays: 7, email: true, push: true },
    },
    winBack: {
        name: 'winBack',
        label: 'Inactive customer win-back',
        description: 'Reach out to customers who have not ordered in a while.',
        defaultEnabled: false,
        defaultConfig: { inactiveDays: 30, email: true, whatsapp: false, whatsappTemplate: '' },
    },
    idleVehicle: {
        name: 'idleVehicle',
        label: 'Idle vehicle alerts',
        description: 'Alert staff when an active vehicle has had no trips for several days.',
        defaultEnabled: false,
        defaultConfig: { idleDays: 7, email: false, push: true },
    },
    cleanup: {
        name: 'cleanup',
        label: 'Auto-cleanup',
        description: 'Purge expired OTP codes, tokens, caches and old trashed accounts past retention.',
        defaultEnabled: true,
        defaultConfig: { retentionDays: 30 },
    },
};
// plantId scope sentinel: settings rows use 0 for the platform-wide default so
// the (automation, plantId) unique index holds (NULLs would be distinct).
export const GLOBAL_SCOPE = 0;
// Merge only keys the definition knows about, with per-key type checking, so a
// stale/corrupt DB row can never smuggle unexpected keys or types into a job.
function mergeConfig(def, ...layers) {
    const out = { ...def.defaultConfig };
    for (const layer of layers) {
        if (!layer || typeof layer !== 'object')
            continue;
        for (const [key, defVal] of Object.entries(def.defaultConfig)) {
            const val = layer[key];
            if (val === undefined || val === null)
                continue;
            if (typeof val === typeof defVal)
                out[key] = val;
        }
    }
    return out;
}
function resolveEffective(name, globalRow, plantRow) {
    const def = AUTOMATION_DEFS[name];
    const enabled = plantRow ? plantRow.enabled : globalRow ? globalRow.enabled : def.defaultEnabled;
    return {
        name,
        enabled,
        config: mergeConfig(def, globalRow?.config ?? null, plantRow?.config ?? null),
        source: plantRow ? 'plant' : globalRow ? 'global' : 'default',
    };
}
// Load ALL settings rows once and answer effective-settings questions in memory.
// The runner uses this so one tick issues a single settings query no matter how
// many plants exist.
export class AutomationSettingsSnapshot {
    rows;
    constructor(rows) {
        this.rows = rows;
    }
    effective(name, plantId) {
        const globalRow = this.rows.find(r => r.automation === name && r.plantId === GLOBAL_SCOPE);
        const plantRow = plantId
            ? this.rows.find(r => r.automation === name && r.plantId === plantId)
            : undefined;
        return resolveEffective(name, globalRow, plantRow);
    }
    /** True when the automation is enabled for at least one scope — used to skip
     *  whole jobs without touching data tables. */
    enabledAnywhere(name) {
        const def = AUTOMATION_DEFS[name];
        const rows = this.rows.filter(r => r.automation === name);
        const globalRow = rows.find(r => r.plantId === GLOBAL_SCOPE);
        const globalEnabled = globalRow ? globalRow.enabled : def.defaultEnabled;
        if (globalEnabled)
            return true;
        return rows.some(r => r.plantId !== GLOBAL_SCOPE && r.enabled);
    }
}
export async function loadAutomationSnapshot() {
    const rows = await db
        .select({
        automation: automationSettings.automation,
        plantId: automationSettings.plantId,
        enabled: automationSettings.enabled,
        config: automationSettings.config,
    })
        .from(automationSettings);
    return new AutomationSettingsSnapshot(rows);
}
// Effective settings for one scope (used by the API route).
export async function getEffectiveAutomation(name, plantId) {
    const scopes = plantId ? [GLOBAL_SCOPE, plantId] : [GLOBAL_SCOPE];
    const rows = await db
        .select({
        automation: automationSettings.automation,
        plantId: automationSettings.plantId,
        enabled: automationSettings.enabled,
        config: automationSettings.config,
    })
        .from(automationSettings)
        .where(and(eq(automationSettings.automation, name), inArray(automationSettings.plantId, scopes)));
    return resolveEffective(name, rows.find(r => r.plantId === GLOBAL_SCOPE), plantId ? rows.find(r => r.plantId === plantId) : undefined);
}
export async function saveAutomationSettings(name, plantId, enabled, config) {
    const scope = plantId ?? GLOBAL_SCOPE;
    await db
        .insert(automationSettings)
        .values({ automation: name, plantId: scope, enabled, config, updatedAt: new Date() })
        .onConflictDoUpdate({
        target: [automationSettings.automation, automationSettings.plantId],
        set: { enabled, config, updatedAt: new Date() },
    });
}
// ---- Once-only claim ledger ---------------------------------------------------
// Claim the right to send. Returns true when THIS caller won the claim (nobody
// has sent for this target+window before). Race/restart-safe because the unique
// index decides; the losing insert simply returns no rows. Semantics are
// at-most-once: a crash after the claim but before the send drops that one
// notification instead of ever double-sending.
export async function claimSend(automation, targetType, targetId, windowKey, plantId, detail) {
    const rows = await db
        .insert(automationSends)
        .values({ automation, targetType, targetId, windowKey, plantId: plantId ?? null, detail: detail ?? null })
        .onConflictDoNothing({
        target: [automationSends.automation, automationSends.targetType, automationSends.targetId, automationSends.windowKey],
    })
        .returning({ id: automationSends.id });
    return rows.length > 0;
}
export async function lastSentAt(plantId) {
    const scope = plantId
        ? sql `(${automationSends.plantId} = ${plantId} or ${automationSends.plantId} is null)`
        : undefined;
    const rows = await db
        .select({
        automation: automationSends.automation,
        last: sql `max(${automationSends.sentAt})`,
    })
        .from(automationSends)
        .where(scope)
        .groupBy(automationSends.automation);
    const out = {};
    for (const r of rows)
        out[r.automation] = r.last ? new Date(r.last).toISOString() : null;
    return out;
}
// ---- Last-run watermark ---------------------------------------------------------
// One JSON blob in app_settings mapping automation → last tick ISO timestamp.
// Purely informational (shown on the admin page); correctness never depends on it.
const LAST_RUN_KEY = 'automation_last_run';
export async function getLastRunMap() {
    const raw = await getSetting(LAST_RUN_KEY);
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object')
            return parsed;
    }
    catch { /* corrupt watermark is not worth failing over */ }
    return {};
}
export async function recordLastRun(names, when = new Date()) {
    try {
        const map = await getLastRunMap();
        for (const n of names)
            map[n] = when.toISOString();
        await setSetting(LAST_RUN_KEY, JSON.stringify(map));
    }
    catch (err) {
        console.warn('[automations] failed to record last-run watermark:', err);
    }
}
// ---- IST time helpers -----------------------------------------------------------
// The business runs on Indian Standard Time; "send at 18:00" and "tomorrow's
// deliveries" are meant in IST regardless of the server's TZ. IST has no DST,
// so a fixed +05:30 offset is exact.
export const IST_OFFSET_MIN = 330;
export function istParts(now = new Date()) {
    const shifted = new Date(now.getTime() + IST_OFFSET_MIN * 60 * 1000);
    const dateStr = shifted.toISOString().slice(0, 10);
    const next = new Date(shifted.getTime() + 24 * 60 * 60 * 1000);
    return {
        dateStr,
        tomorrowStr: next.toISOString().slice(0, 10),
        hour: shifted.getUTCHours(),
        weekday: shifted.getUTCDay(),
        dayIndex: Math.floor(shifted.getTime() / (24 * 60 * 60 * 1000)),
    };
}
// Start of the given IST calendar date, as an absolute UTC instant.
export function istDayStartUtc(dateStr) {
    return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - IST_OFFSET_MIN * 60 * 1000);
}
// Period-index window key: the same target can be re-notified only after the
// window rolls over (e.g. every `windowDays` days). Deterministic across
// instances, so concurrent ticks compute the same key and the unique index
// dedupes them.
export function periodKey(dayIndex, windowDays) {
    const span = Math.max(1, Math.floor(windowDays));
    return `p${span}-${Math.floor(dayIndex / span)}`;
}
// ---- Config clamping (shared by the API route) -----------------------------------
function clampNumber(value, min, max, fallback) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
}
// Sanitize a caller-supplied config for one automation: unknown keys dropped,
// numbers clamped into sane operating ranges, booleans/strings coerced.
export function sanitizeConfig(name, input) {
    const def = AUTOMATION_DEFS[name];
    const src = (input && typeof input === 'object' ? input : {});
    const out = { ...def.defaultConfig };
    for (const [key, defVal] of Object.entries(def.defaultConfig)) {
        const val = src[key];
        if (val === undefined || val === null)
            continue;
        if (typeof defVal === 'boolean') {
            out[key] = Boolean(val);
        }
        else if (typeof defVal === 'number') {
            switch (key) {
                case 'sendHour':
                    out[key] = clampNumber(val, 0, 23, defVal);
                    break;
                case 'weekday':
                    out[key] = clampNumber(val, 0, 6, defVal);
                    break;
                case 'delayHours':
                    out[key] = clampNumber(val, 1, 72, defVal);
                    break;
                case 'ttlHours':
                    out[key] = clampNumber(val, 1, 168, defVal);
                    break;
                case 'thresholdPct':
                    out[key] = clampNumber(val, 1, 500, defVal);
                    break;
                case 'windowDays':
                    out[key] = clampNumber(val, 1, 90, defVal);
                    break;
                case 'inactiveDays':
                    out[key] = clampNumber(val, 3, 365, defVal);
                    break;
                case 'idleDays':
                    out[key] = clampNumber(val, 1, 90, defVal);
                    break;
                case 'retentionDays':
                    out[key] = clampNumber(val, 7, 365, defVal);
                    break;
                default: out[key] = clampNumber(val, 0, 100000, defVal);
            }
        }
        else {
            // strings: template names etc. — trim and cap length.
            if (typeof val === 'string')
                out[key] = val.trim().slice(0, 200);
        }
    }
    if (name === 'digest') {
        out.frequency = src.frequency === 'weekly' ? 'weekly' : 'daily';
    }
    return out;
}
