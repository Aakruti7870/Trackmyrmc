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
import eventsRoutes from './routes/events.js';
import { cleanupOldAttempts } from './lib/loginAttempts.js';
import { runDueRecurringOrders } from './lib/recurring.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const app = express();
const PORT = process.env.PORT || process.env.API_PORT || (isProd ? 5000 : 3001);
app.use(cors({ origin: '*' }));
// Larger limit to accommodate proof-of-delivery photos (base64 data URLs).
app.use(express.json({ limit: '12mb' }));
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
app.use('/api/events', eventsRoutes);
if (isProd) {
    const staticDir = path.resolve(__dirname, '../../rmc-app/dist');
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(staticDir, 'index.html'));
    });
}
// Materialise any due recurring orders, guarding against overlapping runs so a
// slow check can't stack on top of the next interval tick.
let recurringRunning = false;
async function tickRecurringOrders() {
    if (recurringRunning)
        return;
    recurringRunning = true;
    try {
        const n = await runDueRecurringOrders();
        if (n > 0)
            console.log(`Recurring scheduler created ${n} order(s)`);
    }
    catch (e) {
        console.error('Recurring scheduler failed', e);
    }
    finally {
        recurringRunning = false;
    }
}
app.listen(PORT, () => {
    console.log(`TrackMyRMC API running on port ${PORT}`);
    cleanupOldAttempts().catch(() => { });
    setInterval(() => cleanupOldAttempts().catch(() => { }), 60 * 60 * 1000);
    tickRecurringOrders();
    setInterval(tickRecurringOrders, 60 * 60 * 1000);
});
export default app;
