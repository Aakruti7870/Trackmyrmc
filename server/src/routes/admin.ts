import { Router } from 'express';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail, getSmtpSettings, verifySmtpConnection, getSmtpConfig, SMTP_KEYS } from '../lib/email.js';
import { setSetting } from '../lib/settings.js';
import { getVarianceTolerance, VARIANCE_KEYS, DEFAULT_VARIANCE_ABS, DEFAULT_VARIANCE_PCT } from '../lib/variance.js';
import {
  getPlantInviteNotifyConfig,
  parseRecipients,
  serializeRoles,
  PLANT_INVITE_NOTIFY_KEYS,
  PLANT_INVITE_NOTIFY_ROLES,
  DEFAULT_PLANT_INVITE_EMAIL_ENABLED,
  DEFAULT_PLANT_INVITE_NOTIFY_ROLES,
} from '../lib/plantInviteNotify.js';
import {
  getFreshnessConfig,
  FRESHNESS_KEYS,
  DEFAULT_WORKING_LIFE_MIN,
  DEFAULT_WARN_MIN,
  DEFAULT_AVG_SPEED_KMH,
} from '../lib/freshness.js';
import { getIdleConfig, IDLE_KEYS, DEFAULT_IDLE_FREE_MIN } from '../lib/idle.js';
import { getWhatsAppConfig, WHATSAPP_KEYS, DEFAULT_WHATSAPP_ENABLED } from '../lib/whatsapp.js';
import {
  getFuelConfig,
  FUEL_KEYS,
  DEFAULT_RECON_VARIANCE_PCT,
  DEFAULT_IDLE_BURN_LPH,
  DEFAULT_UNSCHEDULED_STOP_MIN,
  DEFAULT_ROUTE_DEVIATION_M,
} from '../lib/fuelConfig.js';
import { getAiSettings, setAiSettings, DEFAULT_AI_PERSONA, DEFAULT_AI_GREETING } from '../lib/aiSettings.js';
import { getActiveLockouts, clearLockout } from '../lib/loginAttempts.js';
import { findStuckPhotos, retryFailedPhotos } from '../db/migrate-proof-photos.js';
import {
  listPendingWhatsAppRetries,
  cancelWhatsAppRetry,
  retryWhatsAppNow,
} from '../lib/whatsappRetry.js';

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
    .refine(
      v => v === undefined || v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535),
      'Port must be a number between 1 and 65535',
    ),
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
  if (host !== undefined) await setSetting(SMTP_KEYS.host, host.trim() || null);
  if (port !== undefined) await setSetting(SMTP_KEYS.port, port.trim() || null);
  if (user !== undefined) await setSetting(SMTP_KEYS.user, user.trim() || null);
  if (from !== undefined) await setSetting(SMTP_KEYS.from, from.trim() || null);
  if (pass !== undefined && pass.trim() !== '') await setSetting(SMTP_KEYS.pass, pass.trim());

  const settings = await getSmtpSettings();

  // Diff the resolved config to summarise which fields changed. The password is
  // never logged by value — only that it was rotated.
  const after = await getSmtpConfig();
  const changed: string[] = [];
  if (before.host !== after.host) changed.push('host');
  if (before.port !== after.port) changed.push('port');
  if (before.user !== after.user) changed.push('username');
  if (before.from !== after.from) changed.push('from address');
  if (before.pass !== after.pass) changed.push('password rotated');

  const detail = changed.length
    ? `SMTP configuration updated from the admin panel. Changed: ${changed.join(', ')}.`
    : 'SMTP configuration saved from the admin panel. No fields were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'smtp_settings_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
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
    .refine(
      v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100),
      'Percentage must be between 0 and 100',
    ),
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

  if (abs !== undefined) await setSetting(VARIANCE_KEYS.abs, abs.trim() === '' ? null : String(Number(abs)));
  if (pct !== undefined) await setSetting(VARIANCE_KEYS.pct, pct.trim() === '' ? null : String(Number(pct)));

  const after = await getVarianceTolerance();

  const changed: string[] = [];
  if (before.abs !== after.abs) changed.push(`absolute ${before.abs} → ${after.abs} m³`);
  if (before.pct !== after.pct) changed.push(`percentage ${before.pct}% → ${after.pct}%`);

  const detail = changed.length
    ? `Delivery variance tolerance updated. Changed: ${changed.join('; ')}.`
    : 'Delivery variance tolerance saved from the admin panel. No values were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'variance_tolerance_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write variance tolerance audit log:', err);
  }

  res.json({ ...after, defaults: { abs: DEFAULT_VARIANCE_ABS, pct: DEFAULT_VARIANCE_PCT } });
});

const PLANT_INVITE_NOTIFY_DEFAULTS = {
  emailEnabled: DEFAULT_PLANT_INVITE_EMAIL_ENABLED,
  roles: DEFAULT_PLANT_INVITE_NOTIFY_ROLES,
  availableRoles: PLANT_INVITE_NOTIFY_ROLES,
};

router.get('/plant-invite-notify', async (_req, res) => {
  res.json({
    ...(await getPlantInviteNotifyConfig()),
    defaults: PLANT_INVITE_NOTIFY_DEFAULTS,
  });
});

// emailEnabled toggles whether the email is sent at all (the in-app toast always
// fires). roles is the staff audience: every active user in one of the chosen
// roles is notified (email + SSE toast). recipients is an optional list of extra
// mailboxes ADDED on top of the role-based audience.
const plantInviteNotifySchema = z.object({
  emailEnabled: z.boolean().optional(),
  roles: z.array(z.enum(PLANT_INVITE_NOTIFY_ROLES)).optional(),
  recipients: z
    .string()
    .max(2000)
    .optional()
    .refine(
      v => v === undefined || parseRecipients(v).every(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
      'Every recipient must be a valid email address',
    ),
});

router.post('/plant-invite-notify', async (req, res) => {
  const parse = plantInviteNotifySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }

  const { emailEnabled, roles, recipients } = parse.data;
  const before = await getPlantInviteNotifyConfig();

  if (emailEnabled !== undefined) {
    await setSetting(PLANT_INVITE_NOTIFY_KEYS.emailEnabled, String(emailEnabled));
  }
  if (roles !== undefined) {
    // Persist the canonical, de-duplicated list. Store '' for an empty selection
    // so it reads back as an explicit "no roles" rather than reverting to the
    // default admin + authority audience.
    await setSetting(PLANT_INVITE_NOTIFY_KEYS.roles, serializeRoles(roles));
  }
  if (recipients !== undefined) {
    const cleaned = parseRecipients(recipients);
    await setSetting(PLANT_INVITE_NOTIFY_KEYS.recipients, cleaned.length ? cleaned.join(', ') : null);
  }

  const after = await getPlantInviteNotifyConfig();

  const changed: string[] = [];
  if (before.emailEnabled !== after.emailEnabled) {
    changed.push(`email ${after.emailEnabled ? 'enabled' : 'disabled'}`);
  }
  if (before.roles.join(',') !== after.roles.join(',')) {
    changed.push(
      after.roles.length
        ? `roles set to ${after.roles.join(', ')}`
        : 'roles cleared (no role-based audience)',
    );
  }
  if (before.recipients.join(', ') !== after.recipients.join(', ')) {
    changed.push(
      after.recipients.length
        ? `extra recipients set to ${after.recipients.length} address(es)`
        : 'extra recipients cleared',
    );
  }

  const detail = changed.length
    ? `New-plant-request notifications updated. Changed: ${changed.join('; ')}.`
    : 'New-plant-request notification settings saved from the admin panel. No values were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'plant_invite_notify_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write plant-invite notification audit log:', err);
  }

  res.json({ ...after, defaults: PLANT_INVITE_NOTIFY_DEFAULTS });
});

// WhatsApp order-automation settings. `enabled` is the global kill switch; the
// three per-event toggles + their Twilio Content template SIDs control order
// confirmation, dispatch, and delivery messages. `configured` reflects whether
// the Twilio messaging credentials/sender are present (read-only status).
router.get('/whatsapp-settings', async (_req, res) => {
  res.json({
    ...(await getWhatsAppConfig()),
    defaults: { enabled: DEFAULT_WHATSAPP_ENABLED },
  });
});

// All fields optional so the form can patch a subset. A template SID may be
// cleared (empty string) to silence that event without flipping its toggle.
const whatsappSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  orderEnabled: z.boolean().optional(),
  dispatchEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  orderTemplateSid: z.string().trim().max(64).optional(),
  dispatchTemplateSid: z.string().trim().max(64).optional(),
  deliveryTemplateSid: z.string().trim().max(64).optional(),
});

router.post('/whatsapp-settings', async (req, res) => {
  const parse = whatsappSettingsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }

  const { enabled, orderEnabled, dispatchEnabled, deliveryEnabled, orderTemplateSid, dispatchTemplateSid, deliveryTemplateSid } = parse.data;
  const before = await getWhatsAppConfig();

  if (enabled !== undefined) await setSetting(WHATSAPP_KEYS.enabled, String(enabled));
  if (orderEnabled !== undefined) await setSetting(WHATSAPP_KEYS.orderEnabled, String(orderEnabled));
  if (dispatchEnabled !== undefined) await setSetting(WHATSAPP_KEYS.dispatchEnabled, String(dispatchEnabled));
  if (deliveryEnabled !== undefined) await setSetting(WHATSAPP_KEYS.deliveryEnabled, String(deliveryEnabled));
  // A blank SID clears the stored value (so that event won't send).
  if (orderTemplateSid !== undefined) await setSetting(WHATSAPP_KEYS.orderTemplateSid, orderTemplateSid.trim() || null);
  if (dispatchTemplateSid !== undefined) await setSetting(WHATSAPP_KEYS.dispatchTemplateSid, dispatchTemplateSid.trim() || null);
  if (deliveryTemplateSid !== undefined) await setSetting(WHATSAPP_KEYS.deliveryTemplateSid, deliveryTemplateSid.trim() || null);

  const after = await getWhatsAppConfig();

  const changed: string[] = [];
  if (before.enabled !== after.enabled) changed.push(`notifications ${after.enabled ? 'enabled' : 'disabled'}`);
  if (before.orderEnabled !== after.orderEnabled) changed.push(`order confirmation ${after.orderEnabled ? 'on' : 'off'}`);
  if (before.dispatchEnabled !== after.dispatchEnabled) changed.push(`dispatch ${after.dispatchEnabled ? 'on' : 'off'}`);
  if (before.deliveryEnabled !== after.deliveryEnabled) changed.push(`delivery ${after.deliveryEnabled ? 'on' : 'off'}`);
  if (before.orderTemplateSid !== after.orderTemplateSid) changed.push('order template updated');
  if (before.dispatchTemplateSid !== after.dispatchTemplateSid) changed.push('dispatch template updated');
  if (before.deliveryTemplateSid !== after.deliveryTemplateSid) changed.push('delivery template updated');

  const detail = changed.length
    ? `WhatsApp notification settings updated. Changed: ${changed.join('; ')}.`
    : 'WhatsApp notification settings saved from the admin panel. No values were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'whatsapp_settings_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write WhatsApp settings audit log:', err);
  }

  res.json({ ...after, defaults: { enabled: DEFAULT_WHATSAPP_ENABLED } });
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

  if (workingLifeMin !== undefined) await setSetting(FRESHNESS_KEYS.workingLifeMin, workingLifeMin.trim() === '' ? null : String(Number(workingLifeMin)));
  if (warnMin !== undefined) await setSetting(FRESHNESS_KEYS.warnMin, warnMin.trim() === '' ? null : String(Number(warnMin)));
  if (avgSpeedKmh !== undefined) await setSetting(FRESHNESS_KEYS.avgSpeedKmh, avgSpeedKmh.trim() === '' ? null : String(Number(avgSpeedKmh)));

  const after = await getFreshnessConfig();

  const changed: string[] = [];
  if (before.workingLifeMin !== after.workingLifeMin) changed.push(`working life ${before.workingLifeMin} → ${after.workingLifeMin} min`);
  if (before.warnMin !== after.warnMin) changed.push(`warning threshold ${before.warnMin} → ${after.warnMin} min`);
  if (before.avgSpeedKmh !== after.avgSpeedKmh) changed.push(`avg speed ${before.avgSpeedKmh} → ${after.avgSpeedKmh} km/h`);

  const detail = changed.length
    ? `Concrete freshness settings updated. Changed: ${changed.join('; ')}.`
    : 'Concrete freshness settings saved from the admin panel. No values were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'freshness_settings_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
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

  if (freeMin !== undefined) await setSetting(IDLE_KEYS.freeMin, freeMin.trim() === '' ? null : String(Number(freeMin)));
  if (ratePerHour !== undefined) await setSetting(IDLE_KEYS.ratePerHour, ratePerHour.trim() === '' ? null : String(Number(ratePerHour)));

  const after = await getIdleConfig();

  const changed: string[] = [];
  if (before.freeMin !== after.freeMin) changed.push(`free window ${before.freeMin} → ${after.freeMin} min`);
  if (before.ratePerHour !== after.ratePerHour) changed.push(`idle rate ${before.ratePerHour ?? 'none'} → ${after.ratePerHour ?? 'none'}/hr`);

  const detail = changed.length
    ? `Idle-charge settings updated. Changed: ${changed.join('; ')}.`
    : 'Idle-charge settings saved from the admin panel. No values were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'idle_settings_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
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
const num0 = (v: unknown) => v === undefined || v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0);
const fuelSettingsSchema = z.object({
  reconVariancePct: z.string().trim().optional().refine(num0, 'Variance % must be a number of 0 or more'),
  idleBurnLph: z.string().trim().optional().refine(num0, 'Idle burn must be a number of 0 or more'),
  unscheduledStopMin: z.string().trim().optional().refine(num0, 'Stop minutes must be a number of 0 or more'),
  routeDeviationM: z.string().trim().optional().refine(num0, 'Deviation distance must be a number of 0 or more'),
  plantLat: z.string().trim().optional().refine(
    v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 90),
    'Latitude must be between -90 and 90',
  ),
  plantLng: z.string().trim().optional().refine(
    v => v === undefined || v === '' || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 180),
    'Longitude must be between -180 and 180',
  ),
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
  ] as const;
  for (const [key, value] of numKeys) {
    if (value === undefined) continue;
    await setSetting(key, value.trim() === '' ? null : String(Number(value)));
  }

  const after = await getFuelConfig();
  const changed: string[] = [];
  if (before.reconVariancePct !== after.reconVariancePct) changed.push(`variance ${before.reconVariancePct} → ${after.reconVariancePct}%`);
  if (before.idleBurnLph !== after.idleBurnLph) changed.push(`idle burn ${before.idleBurnLph} → ${after.idleBurnLph} L/h`);
  if (before.unscheduledStopMin !== after.unscheduledStopMin) changed.push(`stop ${before.unscheduledStopMin} → ${after.unscheduledStopMin} min`);
  if (before.routeDeviationM !== after.routeDeviationM) changed.push(`deviation ${before.routeDeviationM} → ${after.routeDeviationM} m`);
  if (before.plantLat !== after.plantLat || before.plantLng !== after.plantLng) changed.push('plant location updated');

  const detail = changed.length
    ? `Fuel/theft settings updated. Changed: ${changed.join('; ')}.`
    : 'Fuel/theft settings saved from the admin panel. No values were changed.';

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'fuel_settings_updated',
      status: 'success',
      detail,
      emailSent: null,
    });
  } catch (err) {
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

  const actor = req.user!;
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

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'proof_photos_retried',
      status: result.failed > 0 ? 'failure' : 'success',
      detail: `Proof-photo retry from the admin panel: ${result.migrated} recovered, ${result.skipped} skipped, ${result.failed} still failed.`,
      emailSent: null,
    });
  } catch (err) {
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

// ---------------------------------------------------------------------------
// WhatsApp retry queue
//
// Transient WhatsApp notification failures (provider unreachable / 5xx / 429)
// are queued and re-sent in the background with exponential backoff. These
// endpoints make that otherwise-invisible queue observable and operable from
// the admin panel: list what's pending, cancel a queued message, or force an
// immediate re-send instead of waiting for the next backoff window.
// ---------------------------------------------------------------------------

router.get('/whatsapp-retries', async (_req, res) => {
  const retries = await listPendingWhatsAppRetries();
  res.json({ count: retries.length, retries });
});

const whatsappRetryIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

router.post('/whatsapp-retries/:id/cancel', async (req, res) => {
  const parse = whatsappRetryIdSchema.safeParse(req.params);
  if (!parse.success) {
    res.status(400).json({ error: 'A valid retry id is required.' });
    return;
  }

  const { id } = parse.data;
  const cancelled = await cancelWhatsAppRetry(id);
  if (!cancelled) {
    res.status(404).json({ error: 'No queued WhatsApp retry found for that id.' });
    return;
  }

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'whatsapp_retry_cancelled',
      status: 'success',
      detail: `Cancelled queued WhatsApp retry #${id} from the admin panel.`,
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write WhatsApp retry cancel audit log:', err);
  }

  res.json({ ok: true });
});

router.post('/whatsapp-retries/:id/retry', async (req, res) => {
  const parse = whatsappRetryIdSchema.safeParse(req.params);
  if (!parse.success) {
    res.status(400).json({ error: 'A valid retry id is required.' });
    return;
  }

  const { id } = parse.data;
  const outcome = await retryWhatsAppNow(id);
  if (outcome === 'notFound') {
    res.status(404).json({ error: 'No queued WhatsApp retry found for that id.' });
    return;
  }

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'whatsapp_retry_forced',
      status: outcome === 'sent' ? 'success' : 'failure',
      detail: `Forced an immediate re-send of WhatsApp retry #${id} from the admin panel. Outcome: ${outcome}.`,
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write WhatsApp retry force audit log:', err);
  }

  res.json({ ok: true, outcome });
});

// ---- AI Help Agent settings ------------------------------------------------

router.get('/ai-settings', async (_req, res) => {
  res.json({ ...(await getAiSettings()), defaults: { persona: DEFAULT_AI_PERSONA, greeting: DEFAULT_AI_GREETING } });
});

// enabled toggles the whole agent. persona/greeting are optional overrides; an
// empty string clears the override (reverting to the built-in default).
const aiSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  persona: z.string().max(4000).optional(),
  greeting: z.string().max(1000).optional(),
});

router.post('/ai-settings', async (req, res) => {
  const parse = aiSettingsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten().fieldErrors });
    return;
  }
  const before = await getAiSettings();
  const after = await setAiSettings(parse.data);

  const changed: string[] = [];
  if (before.enabled !== after.enabled) changed.push(`enabled ${before.enabled} → ${after.enabled}`);
  if (before.persona !== after.persona) changed.push('persona updated');
  if (before.greeting !== after.greeting) changed.push('greeting updated');

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'ai_settings_updated',
      status: 'success',
      detail: changed.length
        ? `AI Help Agent settings updated. Changed: ${changed.join('; ')}.`
        : 'AI Help Agent settings saved. No values were changed.',
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write AI settings audit log:', err);
  }

  res.json({ ...after, defaults: { persona: DEFAULT_AI_PERSONA, greeting: DEFAULT_AI_GREETING } });
});

export default router;
