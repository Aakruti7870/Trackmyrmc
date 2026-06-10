import { Router } from 'express';
import { eq, desc, and, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { drivers, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const rows = await db.select().from(drivers).orderBy(desc(drivers.createdAt));
  const linked = await db.select({ id: users.id, name: users.name, email: users.email, linkedDriverId: users.linkedDriverId })
    .from(users)
    .where(and(isNotNull(users.linkedDriverId), isNull(users.deletedAt)));
  const byDriver = new Map<number, { id: number; name: string; email: string }[]>();
  for (const u of linked) {
    const arr = byDriver.get(u.linkedDriverId!) ?? [];
    arr.push({ id: u.id, name: u.name, email: u.email });
    byDriver.set(u.linkedDriverId!, arr);
  }
  res.json(rows.map(r => ({ ...r, linkedUsers: byDriver.get(r.id) ?? [] })));
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
  const driverId = +req.params.id;
  const linked = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.linkedDriverId, driverId), isNull(users.deletedAt)));
  if (linked.length) {
    const names = linked.map(u => `${u.name} (${u.email})`).join(', ');
    res.status(409).json({
      error: `Cannot delete this driver because ${linked.length === 1 ? 'a login account is' : 'login accounts are'} still linked to it: ${names}. Unlink or remove the account first.`,
      linkedUsers: linked,
    });
    return;
  }
  await db.delete(drivers).where(eq(drivers.id, driverId));
  res.json({ ok: true });
});

export default router;
