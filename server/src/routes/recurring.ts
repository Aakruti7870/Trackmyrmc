import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { recurringOrders, clients, sites } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Staff oversight of every customer's recurring-order templates. Customers
// manage their own templates under /api/me/recurring; this router is the
// cross-client admin view (read + pause/resume + delete).
const router = Router();
router.use(requireAuth);
router.use(requireRole('admin', 'authority', 'dispatcher'));

router.get('/', async (_req, res) => {
  const rows = await db.select({
    id: recurringOrders.id, clientId: recurringOrders.clientId,
    siteId: recurringOrders.siteId, grade: recurringOrders.grade,
    quantity: recurringOrders.quantity, pumpRequired: recurringOrders.pumpRequired,
    deliveryTime: recurringOrders.deliveryTime, notes: recurringOrders.notes,
    frequency: recurringOrders.frequency, anchor: recurringOrders.anchor,
    nextRunDate: recurringOrders.nextRunDate, active: recurringOrders.active,
    lastRunAt: recurringOrders.lastRunAt, createdAt: recurringOrders.createdAt,
    clientName: clients.name,
    siteName: sites.name,
  }).from(recurringOrders)
    .leftJoin(clients, eq(recurringOrders.clientId, clients.id))
    .leftJoin(sites, eq(recurringOrders.siteId, sites.id))
    .orderBy(desc(recurringOrders.active), desc(recurringOrders.id));
  res.json(rows);
});

// Pause / resume a template. Admin/authority only — dispatchers get read-only.
router.patch('/:id', requireRole('admin', 'authority'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid id' }); return; }
  if (typeof req.body?.active !== 'boolean') { res.status(400).json({ error: 'active (boolean) is required.' }); return; }

  const [row] = await db.update(recurringOrders)
    .set({ active: req.body.active })
    .where(eq(recurringOrders.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id', requireRole('admin', 'authority'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid id' }); return; }

  const [row] = await db.delete(recurringOrders)
    .where(and(eq(recurringOrders.id, id)))
    .returning();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.status(204).end();
});

export default router;
