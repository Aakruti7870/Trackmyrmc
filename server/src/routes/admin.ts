import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail, getSmtpSettings, SMTP_KEYS } from '../lib/email.js';
import { setSetting } from '../lib/settings.js';
import { getActiveLockouts, clearLockout } from '../lib/loginAttempts.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

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

  // host/port/user/from: persist trimmed value, or clear (null) when blank so it
  // reverts to the env var. pass: only update when a non-empty value is supplied.
  if (host !== undefined) await setSetting(SMTP_KEYS.host, host.trim() || null);
  if (port !== undefined) await setSetting(SMTP_KEYS.port, port.trim() || null);
  if (user !== undefined) await setSetting(SMTP_KEYS.user, user.trim() || null);
  if (from !== undefined) await setSetting(SMTP_KEYS.from, from.trim() || null);
  if (pass !== undefined && pass.trim() !== '') await setSetting(SMTP_KEYS.pass, pass.trim());

  const settings = await getSmtpSettings();

  const actor = req.user!;
  try {
    await db.insert(auditLogs).values({
      actorId: actor.id,
      actorName: actor.name,
      action: 'smtp_settings_updated',
      status: 'success',
      detail: 'SMTP configuration updated from the admin panel.',
      emailSent: null,
    });
  } catch (err) {
    console.error('[admin] Failed to write SMTP settings audit log:', err);
  }

  res.json(settings);
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
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.action, 'smtp_test'))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  res.json(rows);
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

export default router;
