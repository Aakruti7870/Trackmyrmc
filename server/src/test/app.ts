import express, { type Express } from 'express';
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/users.js';

// Builds a minimal Express app wired with only the routes exercised by the
// automated tests. This avoids importing the production entrypoint (which calls
// app.listen and registers background intervals).
export function buildTestApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  return app;
}
