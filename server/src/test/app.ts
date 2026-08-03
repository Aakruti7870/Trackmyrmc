import express, { type Express } from 'express';
import authRoutes from '../routes/auth.js';
import batchRoutes from '../routes/batches.js';
import mixDesignRoutes from '../routes/mixDesigns.js';
import batchReportRoutes from '../routes/batchReports.js';
import userRoutes from '../routes/users.js';
import userManagementRoutes from '../routes/userManagement.js';
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
import fileRoutes from '../routes/files.js';
import vehicleRoutes from '../routes/vehicles.js';
import plantRoutes from '../routes/plants.js';
import paidAdNearbyRoutes from '../routes/paidAdNearby.js';
import plantProfileRoutes from '../routes/plantProfiles.js';
import mapsRoutes from '../routes/maps.js';
import whatsappRoutes from '../routes/whatsapp.js';
import webhookRoutes from '../routes/webhooks.js';
import aiRoutes from '../routes/ai.js';
import pushRoutes from '../routes/push.js';
import configRoutes from '../routes/config.js';
import attendanceRoutes from '../routes/attendance.js';
import trackingRoutes from '../routes/tracking.js';
import automationRoutes from '../routes/automations.js';
import kycRoutes from '../routes/kyc.js';
import kycVerificationRoutes from '../routes/kycVerification.js';
import expenseRoutes from '../routes/expenses.js';
import emergencyRoutes from '../routes/sos.js';
import widgetRoutes from '../routes/widget.js';
import { rmcDiscoveryAdminRoutes, rmcDiscoveryPublicRoutes } from '../routes/rmcDiscovery.js';
import rmcDiscoveryGuards from '../routes/rmcDiscoveryGuards.js';
import { requireAuth } from '../middleware/auth.js';
import { allowRecurringPauseOrRequireVerifiedKyc, requireVerifiedCustomerKyc } from '../middleware/customerOrderKycGate.js';
import accountDeletionRoutes from '../routes/accountDeletion.js';
import { accountDeletionPage } from '../lib/accountDeletionPage.js';

// Builds a minimal Express app wired with only the routes exercised by the
// automated tests. This avoids importing the production entrypoint (which calls
// app.listen and registers background intervals).
export function buildTestApp(): Express {
  const app = express();
  app.use(express.json({
    limit: '12mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.get(['/account-deletion', '/delete-account'], (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(accountDeletionPage());
  });
  app.use('/api/account-deletion-requests', accountDeletionRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/user-management', userManagementRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/mix-designs', mixDesignRoutes);
  app.use('/api/batch-reports', batchReportRoutes);
  app.use('/api/challans', challanRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/events', eventsRoutes);
  app.post('/api/me/orders', requireAuth, requireVerifiedCustomerKyc);
  app.put('/api/me/orders/:id', requireAuth, requireVerifiedCustomerKyc);
  app.post('/api/me/recurring', requireAuth, requireVerifiedCustomerKyc);
  app.patch('/api/me/recurring/:id', requireAuth, allowRecurringPauseOrRequireVerifiedKyc);
  app.use('/api/me', meRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/positions', positionRoutes);
  app.use('/api/recurring', recurringRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/fuel', fuelRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/vehicles', vehicleRoutes);
  app.use('/api/plants', paidAdNearbyRoutes);
  app.use('/api/plants', plantRoutes);
  app.use('/api', plantProfileRoutes);
  app.use('/api', mapsRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/track', trackingRoutes);
  app.use('/api/automations', automationRoutes);
  app.use('/api/kyc', kycRoutes);
  app.use('/api/kyc-verification', kycVerificationRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/emergencies', emergencyRoutes);
  app.use('/api/widget', widgetRoutes);
  app.use('/api/super-admin/rmc-discovery', rmcDiscoveryGuards);
  app.use('/api/super-admin/rmc-discovery', rmcDiscoveryAdminRoutes);
  app.use('/api/public', rmcDiscoveryPublicRoutes);
  return app;
}
