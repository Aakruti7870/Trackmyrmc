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
import mixDesignRoutes from './routes/mixDesigns.js';
import batchReportRoutes from './routes/batchReports.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';
import meRoutes from './routes/me.js';
import userRoutes from './routes/users.js';
import userManagementRoutes from './routes/userManagement.js';
import auditRoutes from './routes/audit.js';
import adminRoutes from './routes/admin.js';
import positionRoutes from './routes/positions.js';
import recurringRoutes from './routes/recurring.js';
import fuelRoutes from './routes/fuel.js';
import fileRoutes from './routes/files.js';
import plantRoutes from './routes/plants.js';
import paidAdNearbyRoutes from './routes/paidAdNearby.js';
import plantProfileRoutes from './routes/plantProfiles.js';
import mapsRoutes from './routes/maps.js';
import eventsRoutes from './routes/events.js';
import whatsappRoutes from './routes/whatsapp.js';
import webhookRoutes from './routes/webhooks.js';
import aiRoutes from './routes/ai.js';
import pushRoutes from './routes/push.js';
import configRoutes from './routes/config.js';
import attendanceRoutes from './routes/attendance.js';
import trackingRoutes from './routes/tracking.js';
import automationRoutes from './routes/automations.js';
import kycRoutes from './routes/kyc.js';
import kycVerificationRoutes from './routes/kycVerification.js';
import widgetRoutes from './routes/widget.js';
import expenseRoutes from './routes/expenses.js';
import sosRoutes from './routes/sos.js';
import { rmcDiscoveryAdminRoutes, rmcDiscoveryPublicRoutes } from './routes/rmcDiscovery.js';
import rmcDiscoveryGuards from './routes/rmcDiscoveryGuards.js';
import { requireAuth } from './middleware/auth.js';
import { allowRecurringPauseOrRequireVerifiedKyc, requireVerifiedCustomerKyc } from './middleware/customerOrderKycGate.js';
import { rmcBulkImportGuard } from './middleware/rmcBulkImportGuard.js';
import { cleanupOldAttempts } from './lib/loginAttempts.js';
import { runDueRecurringOrders } from './lib/recurring.js';
import { tickKycExpiryAlerts } from './lib/kycExpiry.js';
import { runDueWhatsAppRetries } from './lib/whatsappRetry.js';
import { ensureWhatsAppTemplateDefaults } from './lib/whatsapp.js';
import { tickFreshnessAlerts } from './lib/freshnessAlerts.js';
import { cleanupExpiredRateLimits } from './lib/rateLimit.js';
import { cleanupExpiredCache } from './lib/places.js';
import { ensureMasterAccounts } from './lib/masterAccounts.js';
import { ensureReviewDemoAccount } from './lib/staffAuth.js';
import { syncSmtpFromEnv } from './lib/smtpRecovery.js';
import { ensurePlantDirectory, backfillNetworkStatus } from './lib/plantDirectory.js';
import { tickAutomations, checkExpiredPromotions } from './lib/automationJobs.js';
import { resumeQueuedRmcImportRuns } from './lib/rmcDiscoveryRunner.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const app = express();
const rawPort = process.env.PORT || process.env.API_PORT || (isProd ? '8080' : '3001');
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535)
    throw new Error(`Invalid PORT value: ${JSON.stringify(rawPort)} — must be an integer between 1 and 65535`);
const STATIC_ALLOWED_ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost', 'https://www.goldetech.com', 'https://goldetech.com', 'https://www.trackmyrmc.com', 'https://trackmyrmc.com']);
for (const origin of (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean))
    STATIC_ALLOWED_ORIGINS.add(origin);
if (process.env.REPLIT_DEV_DOMAIN)
    STATIC_ALLOWED_ORIGINS.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
function isAllowedOrigin(origin) { if (STATIC_ALLOWED_ORIGINS.has(origin))
    return true; try {
    const host = new URL(origin).hostname;
    return host.endsWith('.replit.app') || host.endsWith('.replit.dev') || host.endsWith('.repl.co');
}
catch {
    return false;
} }
app.use(cors({ origin(origin, callback) { if (!origin || isAllowedOrigin(origin))
        return callback(null, true); callback(null, false); }, credentials: true }));
app.use(express.json({ limit: '12mb', verify: (req, _res, buffer) => { req.rawBody = buffer; } }));
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/challans', challanRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/mix-designs', mixDesignRoutes);
app.use('/api/batch-reports', batchReportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
// Authenticate and authorize KYC before the existing customer order handlers.
// The me router still performs its own authentication/role checks afterwards.
app.post('/api/me/orders', requireAuth, requireVerifiedCustomerKyc);
app.put('/api/me/orders/:id', requireAuth, requireVerifiedCustomerKyc);
app.post('/api/me/recurring', requireAuth, requireVerifiedCustomerKyc);
app.patch('/api/me/recurring/:id', requireAuth, allowRecurringPauseOrRequireVerifiedKyc);
app.use('/api/me', meRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-management', userManagementRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/files', fileRoutes);
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
app.use('/api/automations', automationRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/kyc-verification', kycVerificationRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/emergencies', sosRoutes);
app.use('/api/track', trackingRoutes);
app.post('/api/super-admin/rmc-discovery/import', rmcBulkImportGuard);
app.use('/api/super-admin/rmc-discovery', rmcDiscoveryGuards);
app.use('/api/super-admin/rmc-discovery', rmcDiscoveryAdminRoutes);
app.use('/api/public', rmcDiscoveryPublicRoutes);
app.use('/api/events', eventsRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
if (isProd) {
    const staticDir = path.resolve(__dirname, '../../rmc-app/dist');
    app.use(express.static(staticDir));
    const SPA_ROUTES = new Set(['/', '/command', '/login', '/register', '/partner', '/privacy', '/terms', '/delete-account', '/set-password', '/forgot-password', '/sso-callback', '/kiosk', '/my-orders', '/nearby-plants', '/plants', '/plant/profile-management', '/admin/plant-profiles', '/admin/plant-promotions', '/rmc-plant-network', '/my-trips', '/orders', '/dispatch', '/clients', '/vehicles', '/drivers', '/batch-report', '/batch-sheets', '/mix-design', '/reports', '/freshness', '/forecast', '/shift-report', '/recurring', '/fuel-log', '/users', '/user-management', '/activity-log', '/audit-log', '/automations', '/whatsapp', '/profile', '/live-drivers', '/home', '/expenses', '/expense-review', '/kyc', '/kyc-admin', '/sos', '/emergencies', '/widget-settings']);
    const SPA_PATTERNS = [/^\/challans\/[^/]+\/print$/, /^\/track\/[^/]+$/, /^\/batch-sheets\/[^/]+\/print$/, /^\/plants\/[^/]+\/about$/];
    app.get('*', (req, res) => { const isSpaRoute = SPA_ROUTES.has(req.path) || SPA_PATTERNS.some(pattern => pattern.test(req.path)); res.status(isSpaRoute ? 200 : 404).sendFile(path.join(staticDir, 'index.html')); });
}
let recurringRunning = false;
async function tickRecurringOrders() { if (recurringRunning)
    return; recurringRunning = true; try {
    const count = await runDueRecurringOrders();
    if (count > 0)
        console.log(`Recurring scheduler created ${count} order(s)`);
}
catch (error) {
    console.error('Recurring scheduler failed', error);
}
finally {
    recurringRunning = false;
} }
let whatsappRetryRunning = false;
async function tickWhatsAppRetries() { if (whatsappRetryRunning)
    return; whatsappRetryRunning = true; try {
    const result = await runDueWhatsAppRetries();
    if (result.sent > 0 || result.gaveUp > 0)
        console.log(`WhatsApp retry: ${result.sent} sent, ${result.retried} rescheduled, ${result.gaveUp} gave up`);
}
catch (error) {
    console.error('WhatsApp retry tick failed', error);
}
finally {
    whatsappRetryRunning = false;
} }
let freshnessRunning = false;
async function tickFreshness() { if (freshnessRunning)
    return; freshnessRunning = true; try {
    await tickFreshnessAlerts();
}
catch (error) {
    console.error('Freshness alert tick failed', error);
}
finally {
    freshnessRunning = false;
} }
let discoveryCleanupRunning = false;
async function tickDiscoveryCleanup() { if (discoveryCleanupRunning)
    return; discoveryCleanupRunning = true; try {
    await Promise.all([cleanupExpiredRateLimits(), cleanupExpiredCache()]);
}
catch (error) {
    console.error('Discovery cleanup tick failed', error);
}
finally {
    discoveryCleanupRunning = false;
} }
await Promise.race([syncSmtpFromEnv(), new Promise(resolve => setTimeout(resolve, 10_000))]).catch(error => console.error('syncSmtpFromEnv failed', error));
app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackMyRMC API running on port ${PORT}`);
    ensureMasterAccounts().catch(error => console.error('ensureMasterAccounts failed', error));
    ensureReviewDemoAccount().catch(error => console.error('ensureReviewDemoAccount failed', error));
    ensurePlantDirectory().then(() => backfillNetworkStatus()).catch(error => console.error('ensurePlantDirectory failed', error));
    ensureWhatsAppTemplateDefaults().catch(error => console.error('ensureWhatsAppTemplateDefaults failed', error));
    resumeQueuedRmcImportRuns().catch(error => console.error('resumeQueuedRmcImportRuns failed', error));
    cleanupOldAttempts().catch(() => { });
    setInterval(() => cleanupOldAttempts().catch(() => { }), 60 * 60 * 1000);
    void tickRecurringOrders();
    setInterval(() => void tickRecurringOrders(), 60 * 60 * 1000);
    setInterval(() => void tickFreshness(), 60 * 1000);
    void tickWhatsAppRetries();
    setInterval(() => void tickWhatsAppRetries(), 60 * 1000);
    void tickDiscoveryCleanup();
    setInterval(() => void tickDiscoveryCleanup(), 60 * 60 * 1000);
    tickKycExpiryAlerts().catch(error => console.error('KYC expiry tick failed', error));
    setInterval(() => tickKycExpiryAlerts().catch(error => console.error('KYC expiry tick failed', error)), 6 * 60 * 60 * 1000);
    tickAutomations().catch(error => console.error('Automation tick failed', error));
    setInterval(() => tickAutomations().catch(error => console.error('Automation tick failed', error)), 5 * 60 * 1000);
    checkExpiredPromotions().catch(error => console.error('Expired promotions check failed', error));
    setInterval(() => checkExpiredPromotions().catch(error => console.error('Expired promotions check failed', error)), 6 * 60 * 60 * 1000);
});
export default app;
