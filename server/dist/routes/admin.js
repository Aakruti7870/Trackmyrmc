import { Router } from 'express';
import { desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail, getSmtpSettings, verifySmtpConnection, getSmtpConfig, SMTP_KEYS } from '../lib/email.js';
import { setSetting } from '../lib/settings.js';
import { getVarianceTolerance, VARIANCE_KEYS, DEFAULT_VARIANCE_ABS, DEFAULT_VARIANCE_PCT } from '../lib/variance.js';
import { getActiveLockouts, clearLockout } from '../lib/loginAttempts.js';
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
export default router;
