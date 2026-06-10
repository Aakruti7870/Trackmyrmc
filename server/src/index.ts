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
import { addSSEClient, removeSSEClient } from './lib/sseEmitter.js';

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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/events', (req, res) => {
  const id = addSSEClient(res);
  const keepAlive = setInterval(() => {
    try { res.write(':ping\n\n'); } catch { clearInterval(keepAlive); }
  }, 25000);
  req.on('close', () => {
    clearInterval(keepAlive);
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
});

export default app;
