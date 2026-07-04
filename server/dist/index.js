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
import userManagementRoutes from './routes/userManagement.js';
import auditRoutes from './routes/audit.js';
import adminRoutes from './routes/admin.js';
import positionRoutes from './routes/positions.js';
import recurringRoutes from './routes/recurring.js';
import fuelRoutes from './routes/fuel.js';
import fileRoutes from './routes/files.js';
import plantRoutes from './routes/plants.js';
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
import { cleanupOldAttempts } from './lib/loginAttempts.js';
import { runDueRecurringOrders } from './lib/recurring.js';
import { runDueWhatsAppRetries } from './lib/whatsappRetry.js';
import { ensureWhatsAppTemplateDefaults } from './lib/whatsapp.js';
import { tickFreshnessAlerts } from './lib/freshnessAlerts.js';
import { cleanupExpiredRateLimits } from './lib/rateLimit.js';
import { cleanupExpiredCache } from './lib/places.js';
import { ensureMasterAccounts } from './lib/masterAccounts.js';
import { ensureReviewDemoAccount } from './lib/staffAuth.js';
import { syncSmtpFromEnv } from './lib/smtpRecovery.js';
import { ensurePlantDirectory, backfillNetworkStatus } from './lib/plantDirectory.js';
import { tickAutomations } from './lib/automationJobs.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const app = express();
const PORT = process.env.PORT || process.env.API_PORT || (isProd ? 5000 : 3001);
// CORS allowlist. The web app is served same-origin (no CORS needed there), but
// the native Capacitor build runs from a localhost WebView origin and calls this
// API cross-origin, so we permit the native origins plus the known web domains.
// Extra origins can be added via CORS_ALLOWED_ORIGINS (comma-separated). We never
// open it to all origins.
const STATIC_ALLOWED_ORIGINS = new Set([
    'https://localhost', // Capacitor Android (androidScheme: https)
    'http://localhost', // Capacitor Android (androidScheme: http) / local tooling
    'capacitor://localhost', // Capacitor iOS
    'ionic://localhost', // legacy Ionic/Capacitor scheme
    'https://www.goldetech.com',
    'https://goldetech.com',
    'https://www.trackmyrmc.com',
    'https://trackmyrmc.com',
]);
for (const o of (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    STATIC_ALLOWED_ORIGINS.add(o);
}
if (process.env.REPLIT_DEV_DOMAIN) {
    STATIC_ALLOWED_ORIGINS.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}
function isAllowedOrigin(origin) {
    if (STATIC_ALLOWED_ORIGINS.has(origin))
        return true;
    try {
        const host = new URL(origin).hostname;
        // Replit deployment + dev preview domains.
        return (host.endsWith('.replit.app') ||
            host.endsWith('.replit.dev') ||
            host.endsWith('.repl.co'));
    }
    catch {
        return false;
    }
}
app.use(cors({
    origin(origin, cb) {
        // No Origin header: same-origin requests, curl, or native fetches that omit
        // it. These are not browser cross-origin requests, so allow them.
        if (!origin)
            return cb(null, true);
        if (isAllowedOrigin(origin))
            return cb(null, true);
        // Disallowed: don't throw (which would 500); simply omit the CORS headers
        // so the browser blocks the cross-origin read on its own.
        cb(null, false);
    },
    credentials: true,
}));
// Larger limit to accommodate proof-of-delivery photos (base64 data URLs).
// Capture the raw body so the Meta webhook can verify its X-Hub-Signature-256
// HMAC, which must be computed over the exact bytes Meta sent.
app.use(express.json({
    limit: '12mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
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
app.use('/api/user-management', userManagementRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/config', configRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/kyc', kycRoutes);
// PUBLIC: shareable trip tracking — no requireAuth (the router has none).
app.use('/api/track', trackingRoutes);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/events', eventsRoutes);
if (isProd) {
    const staticDir = path.resolve(__dirname, '../../rmc-app/dist');
    app.use(express.static(staticDir));
    // Known client-side routes that the SPA handles. Any other path gets a real
    // 404 so crawlers don't treat unknown URLs as soft-404 200 responses.
    const SPA_ROUTES = new Set([
        '/',
        '/command',
        '/login',
        '/register',
        '/partner',
        '/privacy',
        '/terms',
        '/delete-account',
        '/set-password',
        '/forgot-password',
        '/sso-callback',
        '/kiosk',
        '/my-orders',
        '/nearby-plants',
        '/plants',
        '/my-trips',
        '/orders',
        '/dispatch',
        '/clients',
        '/vehicles',
        '/drivers',
        '/batch-report',
        '/mix-design',
        '/reports',
        '/freshness',
        '/forecast',
        '/shift-report',
        '/recurring',
        '/fuel-log',
        '/users',
        '/user-management',
        '/activity-log',
        '/audit-log',
        '/automations',
        '/whatsapp',
        '/profile',
    ]);
    // Dynamic SPA routes (e.g. /challans/:id/print, /track/:token)
    const SPA_PATTERNS = [/^\/challans\/[^/]+\/print$/, /^\/track\/[^/]+$/];
    app.get('*', (req, res) => {
        const p = req.path;
        const isSpaRoute = SPA_ROUTES.has(p) || SPA_PATTERNS.some((re) => re.test(p));
        if (isSpaRoute) {
            res.sendFile(path.join(staticDir, 'index.html'));
        }
        else {
            res.status(404).sendFile(path.join(staticDir, 'index.html'));
        }
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
// Re-send any WhatsApp notifications whose inline send failed transiently, with
// exponential backoff. Runs out-of-band so it never blocks order placement or
// dispatch. Guarded against overlapping runs.
let whatsappRetryRunning = false;
async function tickWhatsAppRetries() {
    if (whatsappRetryRunning)
        return;
    whatsappRetryRunning = true;
    try {
        const r = await runDueWhatsAppRetries();
        if (r.sent > 0 || r.gaveUp > 0) {
            console.log(`WhatsApp retry: ${r.sent} sent, ${r.retried} rescheduled, ${r.gaveUp} gave up`);
        }
    }
    catch (e) {
        console.error('WhatsApp retry tick failed', e);
    }
    finally {
        whatsappRetryRunning = false;
    }
}
// Re-evaluate concrete freshness for in-transit loads and push an SSE alert when
// a load newly crosses into critical/expired. Guarded against overlapping runs.
let freshnessRunning = false;
async function tickFreshness() {
    if (freshnessRunning)
        return;
    freshnessRunning = true;
    try {
        await tickFreshnessAlerts();
    }
    catch (e) {
        console.error('Freshness alert tick failed', e);
    }
    finally {
        freshnessRunning = false;
    }
}
// Purge expired plant-discovery rate-limit counters and cached Places responses.
// This scheduled job is the sole owner of cleanup — the discovery request path no
// longer cleans inline, so without this tick expired rows would accumulate. Each
// DELETE is idempotent and safe under multiple instances. Guarded against
// overlapping runs.
let discoveryCleanupRunning = false;
async function tickDiscoveryCleanup() {
    if (discoveryCleanupRunning)
        return;
    discoveryCleanupRunning = true;
    try {
        await Promise.all([cleanupExpiredRateLimits(), cleanupExpiredCache()]);
    }
    catch (e) {
        console.error('Discovery cleanup tick failed', e);
    }
    finally {
        discoveryCleanupRunning = false;
    }
}
// Complete the SMTP recovery sync BEFORE accepting traffic so an early login/
// forgot-password request can never race the stale persisted credentials.
// A failed sync must never keep the API down — log and start anyway.
await syncSmtpFromEnv().catch((e) => console.error('syncSmtpFromEnv failed', e));
app.listen(PORT, () => {
    console.log(`TrackMyRMC API running on port ${PORT}`);
    ensureMasterAccounts().catch((e) => console.error('ensureMasterAccounts failed', e));
    ensureReviewDemoAccount().catch((e) => console.error('ensureReviewDemoAccount failed', e));
    ensurePlantDirectory()
        .then(() => backfillNetworkStatus())
        .catch((e) => console.error('ensurePlantDirectory failed', e));
    ensureWhatsAppTemplateDefaults().catch((e) => console.error('ensureWhatsAppTemplateDefaults failed', e));
    cleanupOldAttempts().catch(() => { });
    setInterval(() => cleanupOldAttempts().catch(() => { }), 60 * 60 * 1000);
    tickRecurringOrders();
    setInterval(tickRecurringOrders, 60 * 60 * 1000);
    setInterval(tickFreshness, 60 * 1000);
    tickWhatsAppRetries();
    setInterval(tickWhatsAppRetries, 60 * 1000);
    tickDiscoveryCleanup();
    setInterval(tickDiscoveryCleanup, 60 * 60 * 1000);
    // Configurable automation suite (reminders, follow-ups, digests, anomaly
    // alerts, cleanup). tickAutomations self-guards against overlap and every
    // send is arbitrated by a once-only DB claim, so restarts can't double-send.
    tickAutomations().catch((e) => console.error('Automation tick failed', e));
    setInterval(() => tickAutomations().catch((e) => console.error('Automation tick failed', e)), 5 * 60 * 1000);
});
export default app;
