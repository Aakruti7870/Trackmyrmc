import { Router } from 'express';
import { desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail, getSmtpSettings, verifySmtpConnection, getSmtpConfig, SMTP_KEYS } from '../lib/email.js';
import { setSetting } from '../lib/settings.js';
import { getVarianceTolerance, VARIANCE_KEYS, DEFAULT_VARIANCE_ABS, DEFAULT_VARIANCE_PCT } from '../lib/variance.js';
import { getFreshnessConfig, FRESHNESS_KEYS, DEFAULT_WORKING_LIFE_MIN, DEFAULT_WARN_MIN, DEFAULT_AVG_SPEED_KMH, } from '../lib/freshness.js';
import { getIdleConfig, IDLE_KEYS, DEFAULT_IDLE_FREE_MIN } from '../lib/idle.js';
import { getFuelConfig, FUEL_KEYS, DEFAULT_RECON_VARIANCE_PCT, DEFAULT_IDLE_BURN_LPH, DEFAULT_UNSCHEDULED_STOP_MIN, DEFAULT_ROUTE_DEVIATION_M, } from '../lib/fuelConfig.js';
import { getActiveLockouts, clearLockout } from '../lib/loginAttempts.js';
import { findStuckPhotos, retryFailedPhotos } from '../db/migrate-proof-photos.js';
const router = Router();
router.use(requireAuth, requireRole('admin', 'authority'));
router.get('/smtp-settings', async (_req, res) => {
    res.json(await getSmtpSettings());
});
// Each field is optional. An empty string clears the persisted value (so the
// field falls back to its environment variable); a blank password is treated as
// "keep the current password" so admins never have to re-type the secret.
const smtpSettingsSchema = z.object({
    host: z.string().trim().max(255).optional(),
    port: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535), 'Port must be a number between 1 and 65535'),
    user: z.string().trim().max(255).optional(),
    from: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'From must be a valid email address'),
    pass: z.string().optional(),
});
router.post('/smtp-settings', async (req, res) => {
    const parse = smtpSettingsSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { host, port, user, from, pass } = parse.data;
    // Snapshot the resolved config before applying changes so we can report which
    // fields actually changed in the audit trail (never the secret values).
    const before = await getSmtpConfig();
    // host/port/user/from: persist trimmed value, or clear (null) when blank so it
    // reverts to the env var. pass: only update when a non-empty value is supplied.
    if (host !== undefined)
        await setSetting(SMTP_KEYS.host, host.trim() || null);
    if (port !== undefined)
        await setSetting(SMTP_KEYS.port, port.trim() || null);
    if (user !== undefined)
        await setSetting(SMTP_KEYS.user, user.trim() || null);
    if (from !== undefined)
        await setSetting(SMTP_KEYS.from, from.trim() || null);
    if (pass !== undefined && pass.trim() !== '')
        await setSetting(SMTP_KEYS.pass, pass.trim());
    const settings = await getSmtpSettings();
    // Diff the resolved config to summarise which fields changed. The password is
    // never logged by value — only that it was rotated.
    const after = await getSmtpConfig();
    const changed = [];
    if (before.host !== after.host)
        changed.push('host');
    if (before.port !== after.port)
        changed.push('port');
    if (before.user !== after.user)
        changed.push('username');
    if (before.from !== after.from)
        changed.push('from address');
    if (before.pass !== after.pass)
        changed.push('password rotated');
    const detail = changed.length
        ? `SMTP configuration updated from the admin panel. Changed: ${changed.join(', ')}.`
        : 'SMTP configuration saved from the admin panel. No fields were changed.';
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            actorId: actor.id,
            actorName: actor.name,
            action: 'smtp_settings_updated',
            status: 'success',
            detail,
            emailSent: null,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write SMTP settings audit log:', err);
    }
    res.json(settings);
});
// Verify the supplied SMTP values connect to the mail server without persisting
// them. Mirrors the save contract: a blank password (or any blank field) falls
// back to the currently stored value, so admins can test before saving.
router.post('/smtp-settings/verify', async (req, res) => {
    const parse = smtpSettingsSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ ok: false, error: parse.error.flatten().fieldErrors });
        return;
    }
    const { host, port, user, from, pass } = parse.data;
    const result = await verifySmtpConnection({ host, port, user, from, pass });
    // Record the verify attempt so admins have a trail of who tested the SMTP
    // connection and whether it succeeded. The password is never persisted here —
    // only the actor, outcome and (on failure) the connection error message.
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            action: 'smtp_verify',
            status: result.ok ? 'success' : 'failure',
            detail: result.ok
                ? 'SMTP connection verified successfully.'
                : (result.error || 'Unknown error'),
            actorId: actor?.id ?? null,
            actorName: actor?.name ?? null,
            targetUserEmail: null,
            emailSent: false,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write SMTP verify audit log:', err);
    }
    res.status(result.ok ? 200 : 502).json(result);
});
router.post('/email-test', async (req, res) => {
    const user = req.user;
    if (!user?.email || !user?.name) {
        res.status(400).json({ ok: false, error: 'Could not determine admin email address.' });
        return;
    }
    const result = await sendTestEmail(user.email, user.name);
    try {
        await db.insert(auditLogs).values({
            action: 'smtp_test',
            status: result.ok ? 'success' : 'failure',
            detail: result.ok ? `Test email sent to ${user.email}` : (result.error || 'Unknown error'),
            actorId: user.id,
            actorName: user.name,
            targetUserEmail: user.email,
            emailSent: result.ok,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write SMTP test audit log:', err);
    }
    res.status(result.ok ? 200 : 502).json(result);
});
router.get('/email-test/history', async (_req, res) => {
    // Surface both the "Send test email" (smtp_test) and "Test connection"
    // (smtp_verify) attempts so admins see the full mail-troubleshooting trail.
    const rows = await db
        .select()
        .from(auditLogs)
        .where(inArray(auditLogs.action, ['smtp_test', 'smtp_verify']))
        .orderBy(desc(auditLogs.createdAt))
        .limit(50);
    res.json(rows);
});
router.get('/variance-tolerance', async (_req, res) => {
    res.json(await getVarianceTolerance());
});
// Both fields optional. An empty string clears the persisted value (reverting to
// the built-in default). Absolute is m³ (>= 0); percentage is 0–100 (0 = off).
const varianceToleranceSchema = z.object({
    abs: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Tolerance must be a number of 0 or more'),
    pct: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100), 'Percentage must be between 0 and 100'),
});
router.post('/variance-tolerance', async (req, res) => {
    // Coerce numeric inputs to strings so the same schema handles either shape.
    const raw = {
        abs: req.body?.abs == null ? undefined : String(req.body.abs),
        pct: req.body?.pct == null ? undefined : String(req.body.pct),
    };
    const parse = varianceToleranceSchema.safeParse(raw);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { abs, pct } = parse.data;
    const before = await getVarianceTolerance();
    if (abs !== undefined)
        await setSetting(VARIANCE_KEYS.abs, abs.trim() === '' ? null : String(Number(abs)));
    if (pct !== undefined)
        await setSetting(VARIANCE_KEYS.pct, pct.trim() === '' ? null : String(Number(pct)));
    const after = await getVarianceTolerance();
    const changed = [];
    if (before.abs !== after.abs)
        changed.push(`absolute ${before.abs} → ${after.abs} m³`);
    if (before.pct !== after.pct)
        changed.push(`percentage ${before.pct}% → ${after.pct}%`);
    const detail = changed.length
        ? `Delivery variance tolerance updated. Changed: ${changed.join('; ')}.`
        : 'Delivery variance tolerance saved from the admin panel. No values were changed.';
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            actorId: actor.id,
            actorName: actor.name,
            action: 'variance_tolerance_updated',
            status: 'success',
            detail,
            emailSent: null,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write variance tolerance audit log:', err);
    }
    res.json({ ...after, defaults: { abs: DEFAULT_VARIANCE_ABS, pct: DEFAULT_VARIANCE_PCT } });
});
router.get('/freshness-settings', async (_req, res) => {
    res.json({
        ...(await getFreshnessConfig()),
        defaults: {
            workingLifeMin: DEFAULT_WORKING_LIFE_MIN,
            warnMin: DEFAULT_WARN_MIN,
            avgSpeedKmh: DEFAULT_AVG_SPEED_KMH,
        },
    });
});
// All fields optional. An empty string clears the persisted value (reverting to
// the built-in default). Each must be a positive number when supplied.
const freshnessSettingsSchema = z.object({
    workingLifeMin: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) > 0), 'Working life must be a positive number of minutes'),
    warnMin: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) > 0), 'Warning threshold must be a positive number of minutes'),
    avgSpeedKmh: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) > 0), 'Average speed must be a positive number'),
});
router.post('/freshness-settings', async (req, res) => {
    const raw = {
        workingLifeMin: req.body?.workingLifeMin == null ? undefined : String(req.body.workingLifeMin),
        warnMin: req.body?.warnMin == null ? undefined : String(req.body.warnMin),
        avgSpeedKmh: req.body?.avgSpeedKmh == null ? undefined : String(req.body.avgSpeedKmh),
    };
    const parse = freshnessSettingsSchema.safeParse(raw);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { workingLifeMin, warnMin, avgSpeedKmh } = parse.data;
    const before = await getFreshnessConfig();
    if (workingLifeMin !== undefined)
        await setSetting(FRESHNESS_KEYS.workingLifeMin, workingLifeMin.trim() === '' ? null : String(Number(workingLifeMin)));
    if (warnMin !== undefined)
        await setSetting(FRESHNESS_KEYS.warnMin, warnMin.trim() === '' ? null : String(Number(warnMin)));
    if (avgSpeedKmh !== undefined)
        await setSetting(FRESHNESS_KEYS.avgSpeedKmh, avgSpeedKmh.trim() === '' ? null : String(Number(avgSpeedKmh)));
    const after = await getFreshnessConfig();
    const changed = [];
    if (before.workingLifeMin !== after.workingLifeMin)
        changed.push(`working life ${before.workingLifeMin} → ${after.workingLifeMin} min`);
    if (before.warnMin !== after.warnMin)
        changed.push(`warning threshold ${before.warnMin} → ${after.warnMin} min`);
    if (before.avgSpeedKmh !== after.avgSpeedKmh)
        changed.push(`avg speed ${before.avgSpeedKmh} → ${after.avgSpeedKmh} km/h`);
    const detail = changed.length
        ? `Concrete freshness settings updated. Changed: ${changed.join('; ')}.`
        : 'Concrete freshness settings saved from the admin panel. No values were changed.';
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            actorId: actor.id,
            actorName: actor.name,
            action: 'freshness_settings_updated',
            status: 'success',
            detail,
            emailSent: null,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write freshness settings audit log:', err);
    }
    res.json({
        ...after,
        defaults: {
            workingLifeMin: DEFAULT_WORKING_LIFE_MIN,
            warnMin: DEFAULT_WARN_MIN,
            avgSpeedKmh: DEFAULT_AVG_SPEED_KMH,
        },
    });
});
router.get('/idle-settings', async (_req, res) => {
    res.json({
        ...(await getIdleConfig()),
        defaults: { freeMin: DEFAULT_IDLE_FREE_MIN, ratePerHour: null },
    });
});
// Both fields optional. An empty string clears the persisted value: freeMin
// reverts to the built-in default, ratePerHour reverts to "no rate". freeMin
// must be a non-negative number when supplied; ratePerHour must be >= 0.
const idleSettingsSchema = z.object({
    freeMin: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Free minutes must be a number of 0 or more'),
    ratePerHour: z
        .string()
        .trim()
        .optional()
        .refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), 'Idle rate must be a number of 0 or more'),
});
router.post('/idle-settings', async (req, res) => {
    const raw = {
        freeMin: req.body?.freeMin == null ? undefined : String(req.body.freeMin),
        ratePerHour: req.body?.ratePerHour == null ? undefined : String(req.body.ratePerHour),
    };
    const parse = idleSettingsSchema.safeParse(raw);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { freeMin, ratePerHour } = parse.data;
    const before = await getIdleConfig();
    if (freeMin !== undefined)
        await setSetting(IDLE_KEYS.freeMin, freeMin.trim() === '' ? null : String(Number(freeMin)));
    if (ratePerHour !== undefined)
        await setSetting(IDLE_KEYS.ratePerHour, ratePerHour.trim() === '' ? null : String(Number(ratePerHour)));
    const after = await getIdleConfig();
    const changed = [];
    if (before.freeMin !== after.freeMin)
        changed.push(`free window ${before.freeMin} → ${after.freeMin} min`);
    if (before.ratePerHour !== after.ratePerHour)
        changed.push(`idle rate ${before.ratePerHour ?? 'none'} → ${after.ratePerHour ?? 'none'}/hr`);
    const detail = changed.length
        ? `Idle-charge settings updated. Changed: ${changed.join('; ')}.`
        : 'Idle-charge settings saved from the admin panel. No values were changed.';
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            actorId: actor.id,
            actorName: actor.name,
            action: 'idle_settings_updated',
            status: 'success',
            detail,
            emailSent: null,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write idle settings audit log:', err);
    }
    res.json({ ...after, defaults: { freeMin: DEFAULT_IDLE_FREE_MIN, ratePerHour: null } });
});
const FUEL_DEFAULTS = {
    reconVariancePct: DEFAULT_RECON_VARIANCE_PCT,
    idleBurnLph: DEFAULT_IDLE_BURN_LPH,
    unscheduledStopMin: DEFAULT_UNSCHEDULED_STOP_MIN,
    routeDeviationM: DEFAULT_ROUTE_DEVIATION_M,
    plantLat: null,
    plantLng: null,
};
router.get('/fuel-settings', async (_req, res) => {
    res.json({ ...(await getFuelConfig()), defaults: FUEL_DEFAULTS });
});
// All fields optional; an empty string clears the persisted value (reverting to
// the built-in default, or to "unset" for the plant coordinates). Numeric
// thresholds must be non-negative; coordinates must be valid finite numbers in
// their lat/lng ranges.
const num0 = (v) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
const fuelSettingsSchema = z.object({
    reconVariancePct: z.string().trim().optional().refine(num0, 'Variance % must be a number of 0 or more'),
    idleBurnLph: z.string().trim().optional().refine(num0, 'Idle burn must be a number of 0 or more'),
    unscheduledStopMin: z.string().trim().optional().refine(num0, 'Stop minutes must be a number of 0 or more'),
    routeDeviationM: z.string().trim().optional().refine(num0, 'Deviation distance must be a number of 0 or more'),
    plantLat: z.string().trim().optional().refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 90), 'Latitude must be between -90 and 90'),
    plantLng: z.string().trim().optional().refine(v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 180), 'Longitude must be between -180 and 180'),
});
router.post('/fuel-settings', async (req, res) => {
    const b = req.body ?? {};
    const raw = {
        reconVariancePct: b.reconVariancePct == null ? undefined : String(b.reconVariancePct),
        idleBurnLph: b.idleBurnLph == null ? undefined : String(b.idleBurnLph),
        unscheduledStopMin: b.unscheduledStopMin == null ? undefined : String(b.unscheduledStopMin),
        routeDeviationM: b.routeDeviationM == null ? undefined : String(b.routeDeviationM),
        plantLat: b.plantLat == null ? undefined : String(b.plantLat),
        plantLng: b.plantLng == null ? undefined : String(b.plantLng),
    };
    const parse = fuelSettingsSchema.safeParse(raw);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const data = parse.data;
    const before = await getFuelConfig();
    const numKeys = [
        [FUEL_KEYS.reconVariancePct, data.reconVariancePct],
        [FUEL_KEYS.idleBurnLph, data.idleBurnLph],
        [FUEL_KEYS.unscheduledStopMin, data.unscheduledStopMin],
        [FUEL_KEYS.routeDeviationM, data.routeDeviationM],
        [FUEL_KEYS.plantLat, data.plantLat],
        [FUEL_KEYS.plantLng, data.plantLng],
    ];
    for (const [key, value] of numKeys) {
        if (value === undefined)
            continue;
        await setSetting(key, value.trim() === '' ? null : String(Number(value)));
    }
    const after = await getFuelConfig();
    const changed = [];
    if (before.reconVariancePct !== after.reconVariancePct)
        changed.push(`variance ${before.reconVariancePct} → ${after.reconVariancePct}%`);
    if (before.idleBurnLph !== after.idleBurnLph)
        changed.push(`idle burn ${before.idleBurnLph} → ${after.idleBurnLph} L/h`);
    if (before.unscheduledStopMin !== after.unscheduledStopMin)
        changed.push(`stop ${before.unscheduledStopMin} → ${after.unscheduledStopMin} min`);
    if (before.routeDeviationM !== after.routeDeviationM)
        changed.push(`deviation ${before.routeDeviationM} → ${after.routeDeviationM} m`);
    if (before.plantLat !== after.plantLat || before.plantLng !== after.plantLng)
        changed.push('plant location updated');
    const detail = changed.length
        ? `Fuel/theft settings updated. Changed: ${changed.join('; ')}.`
        : 'Fuel/theft settings saved from the admin panel. No values were changed.';
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            actorId: actor.id,
            actorName: actor.name,
            action: 'fuel_settings_updated',
            status: 'success',
            detail,
            emailSent: null,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write fuel settings audit log:', err);
    }
    res.json({ ...after, defaults: FUEL_DEFAULTS });
});
router.get('/lockouts', async (_req, res) => {
    const lockouts = await getActiveLockouts();
    res.json(lockouts);
});
const clearLockoutSchema = z.object({
    key: z.string().min(1, 'Lockout key is required'),
});
router.post('/lockouts/clear', async (req, res) => {
    const parse = clearLockoutSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { key } = parse.data;
    const cleared = await clearLockout(key);
    if (!cleared) {
        res.status(404).json({ error: 'No active lockout found for that key.' });
        return;
    }
    const actor = req.user;
    const targetEmail = key.startsWith('login:') ? key.slice('login:'.length) : key;
    await db.insert(auditLogs).values({
        actorId: actor.id,
        actorName: actor.name,
        action: 'lockout_cleared',
        targetUserId: null,
        targetUserEmail: targetEmail,
        emailSent: null,
    });
    res.json({ ok: true });
});
// ---------------------------------------------------------------------------
// Proof-photo migration recovery
//
// Some legacy proof-of-delivery photos may still be stored as base64 in the
// database because their upload to object storage failed (e.g. a storage
// outage during the migration). These endpoints let an admin see what is still
// stuck and re-attempt the upload from the admin panel, instead of running the
// `migrate-proof-photos --retry` CLI from a shell.
// ---------------------------------------------------------------------------
router.get('/proof-photos/stuck', async (_req, res) => {
    const stuck = await findStuckPhotos(db);
    res.json({ count: stuck.length, photos: stuck });
});
// Optional `ids`: retry only those photo rows. Omitted/empty retries every row
// still stuck as base64. Ids must be positive integers.
const retryProofPhotosSchema = z.object({
    ids: z.array(z.number().int().positive()).optional(),
});
router.post('/proof-photos/retry', async (req, res) => {
    const parse = retryProofPhotosSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    // With no ids supplied, target everything still stuck as base64 so the admin
    // can recover the whole backlog with one click after a storage outage clears.
    const explicitIds = parse.data.ids;
    const ids = explicitIds && explicitIds.length > 0
        ? explicitIds
        : (await findStuckPhotos(db)).map(p => p.id);
    const result = await retryFailedPhotos(db, ids);
    const actor = req.user;
    try {
        await db.insert(auditLogs).values({
            actorId: actor.id,
            actorName: actor.name,
            action: 'proof_photos_retried',
            status: result.failed > 0 ? 'failure' : 'success',
            detail: `Proof-photo retry from the admin panel: ${result.migrated} recovered, ${result.skipped} skipped, ${result.failed} still failed.`,
            emailSent: null,
        });
    }
    catch (err) {
        console.error('[admin] Failed to write proof-photo retry audit log:', err);
    }
    // The returned `failures` is a fresh, actionable report: the admin can retry
    // exactly those still-stuck rows again once the underlying issue is resolved.
    res.json({
        migrated: result.migrated,
        skipped: result.skipped,
        failed: result.failed,
        failures: result.failures,
    });
});
export default router;
