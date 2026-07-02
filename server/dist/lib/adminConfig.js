import { db } from '../db/index.js';
import { clients, drivers, users, sites, vehicles, orders, challans, challanProofPhotos, fuelLogs, batchRecords, ledgerEntries, recurringOrders, plants, plantCustomers, plantInvites, rateCards, uploadedFiles, auditLogs, supportTickets, } from '../db/schema.js';
import { getSetting, setSetting } from './settings.js';
export const ROLE_PERMISSIONS_KEY = 'role_permission_overrides';
export const APP_VERSION_KEY = 'app_version';
export const DEFAULT_APP_VERSION = '';
// The roles that may carry a route override. Mirrors the frontend Role union in
// rmc-app/src/lib/permissions.ts.
export const OVERRIDABLE_ROLES = [
    'authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'client', 'driver',
];
// Read the DB-backed role→allowed-paths overrides. Returns {} when unset or
// malformed (the frontend then falls back to its static defaults — non-breaking).
export async function getRolePermissionOverrides() {
    const raw = await getSetting(ROLE_PERMISSIONS_KEY);
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return normalizeOverrides(parsed);
    }
    catch {
        return {};
    }
}
// Coerce arbitrary input into a clean overrides map: known roles only, string
// paths only (each starting with '/'), de-duplicated. Roles mapped to an empty
// array are kept (an explicit "no access" override).
export function normalizeOverrides(input) {
    const out = {};
    if (!input || typeof input !== 'object')
        return out;
    for (const role of OVERRIDABLE_ROLES) {
        const val = input[role];
        if (val === undefined || val === null)
            continue;
        if (!Array.isArray(val))
            continue;
        const paths = Array.from(new Set(val
            .filter((p) => typeof p === 'string')
            .map(p => p.trim())
            .filter(p => p.startsWith('/'))));
        out[role] = paths;
    }
    return out;
}
export async function setRolePermissionOverrides(overrides) {
    if (overrides === null || Object.keys(overrides).length === 0) {
        await setSetting(ROLE_PERMISSIONS_KEY, null);
        return;
    }
    await setSetting(ROLE_PERMISSIONS_KEY, JSON.stringify(normalizeOverrides(overrides)));
}
export async function getAppVersion() {
    return (await getSetting(APP_VERSION_KEY)) ?? DEFAULT_APP_VERSION;
}
export async function setAppVersion(version) {
    const v = version?.trim();
    await setSetting(APP_VERSION_KEY, v ? v : null);
}
// ── Social / marketing links ─────────────────────────────────────────────────
// Admin-editable, publicly served (bootstrap config) links behind the social
// icons on the landing deck and public pages. playStore stays empty until the
// app is published — the frontend shows its badge as "coming soon" meanwhile.
export const SOCIAL_LINKS_KEY = 'social_links';
export const SOCIAL_PLATFORMS = ['youtube', 'instagram', 'facebook', 'whatsapp', 'playStore'];
export const DEFAULT_SOCIAL_LINKS = {
    youtube: 'https://youtube.com/@trackmyrmc?si=PpDzLHQX72dqjmC9',
    instagram: 'https://www.instagram.com/gold_e_tech?igsh=MXd1eGJoMzNyOHVzNQ==',
    facebook: 'https://www.facebook.com/profile.php?id=61590998875994',
    whatsapp: 'https://wa.me/qr/FXY47PIBVMQFA1',
    playStore: '',
};
// Keep only known platforms with http(s) URLs; '' explicitly clears a link.
export function normalizeSocialLinks(input) {
    const out = {};
    if (!input || typeof input !== 'object')
        return out;
    for (const key of SOCIAL_PLATFORMS) {
        const val = input[key];
        if (typeof val !== 'string')
            continue;
        const v = val.trim();
        if (v === '' || /^https?:\/\/\S+$/i.test(v))
            out[key] = v;
    }
    return out;
}
export async function getSocialLinks() {
    const raw = await getSetting(SOCIAL_LINKS_KEY);
    if (!raw)
        return { ...DEFAULT_SOCIAL_LINKS };
    try {
        return { ...DEFAULT_SOCIAL_LINKS, ...normalizeSocialLinks(JSON.parse(raw)) };
    }
    catch {
        return { ...DEFAULT_SOCIAL_LINKS };
    }
}
export async function setSocialLinks(links) {
    if (links === null) {
        await setSetting(SOCIAL_LINKS_KEY, null);
        return;
    }
    const current = await getSocialLinks();
    const merged = { ...current, ...normalizeSocialLinks(links) };
    await setSetting(SOCIAL_LINKS_KEY, JSON.stringify(merged));
}
// Authority-only JSON snapshot of the core business tables. Secret/auth tables
// (tokens, OTPs, login attempts, caches, push subscriptions) are intentionally
// excluded, and user password hashes are stripped before serialization.
export async function buildDatabaseExport() {
    const exported = [];
    let total = 0;
    const userRows = await db.select().from(users);
    const safeUsers = userRows.map(({ passwordHash, permissions, ...rest }) => {
        void passwordHash;
        void permissions;
        return rest;
    });
    exported.push({ name: 'users', rowCount: safeUsers.length, rows: safeUsers });
    total += safeUsers.length;
    const tables = [
        { name: 'clients', table: clients },
        { name: 'drivers', table: drivers },
        { name: 'sites', table: sites },
        { name: 'vehicles', table: vehicles },
        { name: 'orders', table: orders },
        { name: 'challans', table: challans },
        { name: 'challanProofPhotos', table: challanProofPhotos },
        { name: 'fuelLogs', table: fuelLogs },
        { name: 'batchRecords', table: batchRecords },
        { name: 'ledgerEntries', table: ledgerEntries },
        { name: 'recurringOrders', table: recurringOrders },
        { name: 'plants', table: plants },
        { name: 'plantCustomers', table: plantCustomers },
        { name: 'plantInvites', table: plantInvites },
        { name: 'rateCards', table: rateCards },
        { name: 'uploadedFiles', table: uploadedFiles },
        { name: 'auditLogs', table: auditLogs },
        { name: 'supportTickets', table: supportTickets },
    ];
    for (const { name, table } of tables) {
        const rows = await db.select().from(table);
        exported.push({ name, rowCount: rows.length, rows });
        total += rows.length;
    }
    return { exportedAt: new Date().toISOString(), totalRows: total, tables: exported };
}
