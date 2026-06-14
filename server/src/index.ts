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
import recurringRoutes from './routes/recurring.js';
import fuelRoutes from './routes/fuel.js';
import plantRoutes from './routes/plants.js';
import eventsRoutes from './routes/events.js';
import { cleanupOldAttempts } from './lib/loginAttempts.js';
import { runDueRecurringOrders } from './lib/recurring.js';
import { runDueWhatsAppRetries } from './lib/whatsappRetry.js';
import { tickFreshnessAlerts } from './lib/freshnessAlerts.js';
import { cleanupExpiredRateLimits } from './lib/rateLimit.js';
import { cleanupExpiredCache } from './lib/places.js';
import { ensureMasterAccounts } from './lib/masterAccounts.js';

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
app.use('/api/recurring', recurringRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/plants', plantRoutes);

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
    '/login',
    '/register',
    '/set-password',
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
    '/activity-log',
    '/audit-log',
    '/profile',
  ]);

  // Dynamic SPA routes (e.g. /challans/:id/print)
  const SPA_PATTERNS = [/^\/challans\/[^/]+\/print$/];

  app.get('*', (req, res) => {
    const p = req.path;
    const isSpaRoute =
      SPA_ROUTES.has(p) || SPA_PATTERNS.some((re) => re.test(p));
    if (isSpaRoute) {
      res.sendFile(path.join(staticDir, 'index.html'));
    } else {
      res.status(404).sendFile(path.join(staticDir, 'index.html'));
    }
  });
}

// Materialise any due recurring orders, guarding against overlapping runs so a
// slow check can't stack on top of the next interval tick.
let recurringRunning = false;
async function tickRecurringOrders() {
  if (recurringRunning) return;
  recurringRunning = true;
  try {
    const n = await runDueRecurringOrders();
    if (n > 0) console.log(`Recurring scheduler created ${n} order(s)`);
  } catch (e) {
    console.error('Recurring scheduler failed', e);
  } finally {
    recurringRunning = false;
  }
}

// Re-send any WhatsApp notifications whose inline send failed transiently, with
// exponential backoff. Runs out-of-band so it never blocks order placement or
// dispatch. Guarded against overlapping runs.
let whatsappRetryRunning = false;
async function tickWhatsAppRetries() {
  if (whatsappRetryRunning) return;
  whatsappRetryRunning = true;
  try {
    const r = await runDueWhatsAppRetries();
    if (r.sent > 0 || r.gaveUp > 0) {
      console.log(`WhatsApp retry: ${r.sent} sent, ${r.retried} rescheduled, ${r.gaveUp} gave up`);
    }
  } catch (e) {
    console.error('WhatsApp retry tick failed', e);
  } finally {
    whatsappRetryRunning = false;
  }
}

// Re-evaluate concrete freshness for in-transit loads and push an SSE alert when
// a load newly crosses into critical/expired. Guarded against overlapping runs.
let freshnessRunning = false;
async function tickFreshness() {
  if (freshnessRunning) return;
  freshnessRunning = true;
  try {
    await tickFreshnessAlerts();
  } catch (e) {
    console.error('Freshness alert tick failed', e);
  } finally {
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
  if (discoveryCleanupRunning) return;
  discoveryCleanupRunning = true;
  try {
    await Promise.all([cleanupExpiredRateLimits(), cleanupExpiredCache()]);
  } catch (e) {
    console.error('Discovery cleanup tick failed', e);
  } finally {
    discoveryCleanupRunning = false;
  }
}

app.listen(PORT, () => {
  console.log(`TrackMyRMC API running on port ${PORT}`);
  ensureMasterAccounts().catch((e) => console.error('ensureMasterAccounts failed', e));
  cleanupOldAttempts().catch(() => {});
  setInterval(() => cleanupOldAttempts().catch(() => {}), 60 * 60 * 1000);
  tickRecurringOrders();
  setInterval(tickRecurringOrders, 60 * 60 * 1000);
  setInterval(tickFreshness, 60 * 1000);
  tickWhatsAppRetries();
  setInterval(tickWhatsAppRetries, 60 * 1000);
  tickDiscoveryCleanup();
  setInterval(tickDiscoveryCleanup, 60 * 60 * 1000);
});

export default app;
