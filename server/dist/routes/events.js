import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { addSSEClient, removeSSEClient } from '../lib/sseEmitter.js';
import { verifyToken } from '../middleware/auth.js';
const router = Router();
// Server-Sent Events stream for live updates. The token is passed as a query
// param because EventSource cannot set Authorization headers. Authorization is
// enforced here (not via requireAuth) so the connection can be rejected before
// it is registered with the SSE emitter:
//   - no token            -> 401 Token required
//   - invalid/expired tok -> 401 Invalid token
//   - deactivated account -> 401 Account deactivated
// Only a valid, active user is registered as an SSE client; their identity
// scopes targeted events (order/trip toasts) to their owner.
router.get('/', async (req, res) => {
    const token = req.query.token;
    if (!token) {
        res.status(401).json({ error: 'Token required' });
        return;
    }
    let payload;
    try {
        payload = verifyToken(token);
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    const [user] = await db.select({
        isActive: users.isActive, role: users.role,
        linkedClientId: users.linkedClientId, linkedDriverId: users.linkedDriverId,
    }).from(users).where(eq(users.id, payload.id));
    if (!user?.isActive) {
        res.status(401).json({ error: 'Account deactivated' });
        return;
    }
    // Keepalive pings and dead-connection sweeping are handled centrally by the
    // SSE emitter (see KEEPALIVE_MS / STALE_THRESHOLD_MS in sseEmitter.ts).
    // The identity scopes targeted events (order/trip toasts) to their owner.
    const id = addSSEClient(res, {
        role: user.role,
        clientId: user.linkedClientId,
        driverId: user.linkedDriverId,
    });
    req.on('close', () => {
        removeSSEClient(id);
    });
});
export default router;
