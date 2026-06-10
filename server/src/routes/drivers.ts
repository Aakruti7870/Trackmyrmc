import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { drivers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const rows = await db.select().from(drivers).orderBy(desc(drivers.createdAt));
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [row] = await db.select().from(drivers).where(eq(drivers.id, +req.params.id));
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.post('/', async (req, res) => {
  const { name, phone, licenseNo, licenseExpiry, isActive } = req.body;
  const [row] = await db.insert(drivers).values({
    name, phone, licenseNo, licenseExpiry,
    isActive: isActive !== false,
  }).returning();
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const { name, phone, licenseNo, licenseExpiry, isActive } = req.body;
  const [row] = await db.update(drivers).set({
    name, phone, licenseNo, licenseExpiry,
    isActive: isActive !== undefined ? !!isActive : undefined,
  }).where(eq(drivers.id, +req.params.id)).returning();
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  await db.delete(drivers).where(eq(drivers.id, +req.params.id));
  res.json({ ok: true });
});

export default router;
