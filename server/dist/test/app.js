import express from 'express';
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/users.js';
import adminRoutes from '../routes/admin.js';
import auditRoutes from '../routes/audit.js';
// Builds a minimal Express app wired with only the routes exercised by the
// automated tests. This avoids importing the production entrypoint (which calls
// app.listen and registers background intervals).
export function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/audit-logs', auditRoutes);
    return app;
}
