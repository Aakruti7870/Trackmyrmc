import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail, getSmtpSettings } from '../lib/email.js';
import { getActiveLockouts, clearLockout } from '../lib/loginAttempts.js';
const router = Router();
router.use(requireAuth, requireRole('admin'));
router.get('/smtp-settings', (_req, res) => {
    res.json(getSmtpSettings());
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
