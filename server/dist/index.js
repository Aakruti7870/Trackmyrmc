import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import orderRoutes from './routes/orders.js';
import challanRoutes from './routes/challans.js';
import vehicleRoutes from './routes/vehicles.js';
import driverRoutes from './routes/drivers.js';
import batchRoutes from './routes/batches.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import meRoutes from './routes/me.js';
import userRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import adminRoutes from './routes/admin.js';
import positionRoutes from './routes/positions.js';
import { addSSEClient, removeSSEClient } from './lib/sseEmitter.js';
import { cleanupOldAttempts } from './lib/loginAttempts.js';
import { verifyToken } from './middleware/auth.js';
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { users } from './db/schema.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const app = express();
const PORT = process.env.PORT || process.env.API_PORT || (isProd ? 5000 : 3001);
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/me', meRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/positions', positionRoutes);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/events', async (req, res) => {
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
if (isProd) {
    const staticDir = path.resolve(__dirname, '../../rmc-app/dist');
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(staticDir, 'index.html'));
    });
}
app.listen(PORT, () => {
    console.log(`TrackMyRMC API running on port ${PORT}`);
    cleanupOldAttempts().catch(() => { });
    setInterval(() => cleanupOldAttempts().catch(() => { }), 60 * 60 * 1000);
});
export default app;
