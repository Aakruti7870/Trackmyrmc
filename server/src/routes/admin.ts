import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendTestEmail } from '../lib/email.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.post('/email-test', async (req, res) => {
  const user = req.user;
  if (!user?.email || !user?.name) {
    res.status(400).json({ ok: false, error: 'Could not determine admin email address.' });
    return;
  }
  const result = await sendTestEmail(user.email, user.name);
  res.status(result.ok ? 200 : 502).json(result);
});

export default router;
