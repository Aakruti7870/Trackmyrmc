import express from 'express';
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/users.js';
import adminRoutes from '../routes/admin.js';
import auditRoutes from '../routes/audit.js';
import challanRoutes from '../routes/challans.js';
import clientRoutes from '../routes/clients.js';
import driverRoutes from '../routes/drivers.js';
import eventsRoutes from '../routes/events.js';
import meRoutes from '../routes/me.js';
import orderRoutes from '../routes/orders.js';
import positionRoutes from '../routes/positions.js';
import recurringRoutes from '../routes/recurring.js';
import reportRoutes from '../routes/reports.js';
import dashboardRoutes from '../routes/dashboard.js';
import fuelRoutes from '../routes/fuel.js';
import vehicleRoutes from '../routes/vehicles.js';
import plantRoutes from '../routes/plants.js';
import whatsappRoutes from '../routes/whatsapp.js';
// Builds a minimal Express app wired with only the routes exercised by the
// automated tests. This avoids importing the production entrypoint (which calls
// app.listen and registers background intervals).
export function buildTestApp() {
    const app = express();
    // Mirror the production limit (see src/index.ts) so proof-of-delivery photo
    // size validation is exercised by validateProofPhoto, not the body parser.
    app.use(express.json({ limit: '12mb' }));
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/audit-logs', auditRoutes);
    app.use('/api/challans', challanRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/drivers', driverRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/me', meRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/positions', positionRoutes);
    app.use('/api/recurring', recurringRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/fuel', fuelRoutes);
    app.use('/api/vehicles', vehicleRoutes);
    app.use('/api/plants', plantRoutes);
    app.use('/api/whatsapp', whatsappRoutes);
    return app;
}
