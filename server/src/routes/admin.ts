import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail } from '../lib/email.js';
import { db } from '../db/index.js';
import { auditLogs } from '../db/schema.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

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

export default router;
