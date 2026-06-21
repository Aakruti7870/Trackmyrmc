import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getVapidPublicKey, isPushConfigured, saveSubscription, deleteSubscription, } from '../lib/push.js';
const router = Router();
// The browser needs the VAPID public key before it can create a subscription.
// Returns 503 when push isn't configured so the client hides the enable UI.
router.get('/vapid-public-key', (_req, res) => {
    const key = getVapidPublicKey();
    if (!key || !isPushConfigured()) {
        res.status(503).json({ error: 'Push notifications are not configured' });
        return;
    }
    res.json({ key });
});
// Everything below requires a logged-in user — subscriptions are per-account.
router.use(requireAuth);
router.post('/subscribe', async (req, res) => {
    const body = (req.body ?? {});
    const { endpoint, keys } = body;
    if (typeof endpoint !== 'string' ||
        !endpoint ||
        !keys ||
        typeof keys.p256dh !== 'string' ||
        typeof keys.auth !== 'string') {
        res.status(400).json({ error: 'Invalid subscription' });
        return;
    }
    await saveSubscription(req.user.id, { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }, req.get('user-agent'));
    res.status(201).json({ ok: true });
});
router.post('/unsubscribe', async (req, res) => {
    const { endpoint } = (req.body ?? {});
    if (typeof endpoint !== 'string' || !endpoint) {
        res.status(400).json({ error: 'Invalid endpoint' });
        return;
    }
    await deleteSubscription(endpoint, req.user.id);
    res.json({ ok: true });
});
export default router;
