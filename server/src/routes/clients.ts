import { Router } from 'express';
import { eq, desc, sql, and, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, sites, ledgerEntries, users } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';
import { clientKycVerifiedSql } from '../lib/kycBadge.js';

const router = Router();
router.use(requireAuth);
// Staff-only surface, hard-scoped per plant. Customers manage their own profile
// and sites via /api/me/*; a null-plantId legacy global admin stays unscoped so
// the existing single-tenant admin app keeps working. Without this gate a
// null-plant non-staff account would be treated as "global" by plantScope and
// could read/mutate every plant's customers, sites and ledgers.
router.use(requireRole('authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher'));
// Belt-and-suspenders scope guard: plantScope() treats a null plantId as
// "global" (unscoped). That is intended ONLY for platform staff (authority or a
// legacy global admin). A plant-scoped role (plant_owner/supervisor/dispatcher,
// or a plant admin) that somehow has no plant binding must never fall through to
// global access, so reject it here before any query runs.
router.use((req, res, next) => {
  const actor = req.user!;
  if (!isPlatformStaff(actor) && actor.plantId == null) {
    res.status(403).json({ error: 'Your account is not linked to a plant. Ask an administrator to assign your plant.' });
    return;
  }
  next();
});

// Resolve the client the request targets, scoped to the actor's plant. Returns
// undefined when the client doesn't exist OR belongs to another plant — callers
// translate that to a 404 so cross-tenant ids are indistinguishable from missing.
async function scopedClient(req: { user?: { plantId?: number | null } }, id: number) {
  const [row] = await db.select().from(clients)
    .where(and(eq(clients.id, id), plantScope(req.user?.plantId, clients.plantId)));
  return row;
}

router.get('/', async (req, res) => {
  const scope = plantScope(req.user!.plantId, clients.plantId);
  const rows = await db.select({
    client: clients,
    kycVerified: clientKycVerifiedSql(),
  }).from(clients)
    .where(scope ?? sql`true`)
    .orderBy(desc(clients.createdAt))
    .then(rs => rs.map(r => ({ ...r.client, kycVerified: r.kycVerified })));
  const linked = await db.select({ id: users.id, name: users.name, email: users.email, linkedClientId: users.linkedClientId })
    .from(users)
    .where(and(isNotNull(users.linkedClientId), isNull(users.deletedAt)));
  const byClient = new Map<number, { id: number; name: string; email: string }[]>();
  for (const u of linked) {
    const arr = byClient.get(u.linkedClientId!) ?? [];
    arr.push({ id: u.id, name: u.name, email: u.email });
    byClient.set(u.linkedClientId!, arr);
  }
  res.json(rows.map(r => ({ ...r, linkedUsers: byClient.get(r.id) ?? [] })));
});

router.get('/:id', async (req, res) => {
  const client = await scopedClient(req, +req.params.id);
  if (!client) { res.status(404).json({ error: 'Not found' }); return; }
  const [flag] = await db.select({ kycVerified: clientKycVerifiedSql() })
    .from(clients).where(eq(clients.id, client.id));
  res.json({ ...client, kycVerified: flag?.kycVerified ?? false });
});

router.post('/', async (req, res) => {
  const { name, contactPerson, phone, email, gstNo, address, city, creditLimit } = req.body;
  // Stamp the client with the acting staff/owner's plant so it is tenant-isolated
  // from creation. A legacy global admin (null plantId) creates an unscoped row,
  // preserving the single-tenant behaviour.
  const [row] = await db.insert(clients).values({
    name, contactPerson, phone, email, gstNo, address, city,
    plantId: req.user!.plantId ?? null,
    creditLimit: creditLimit?.toString() || '0',
    outstandingAmount: '0',
  }).returning();
  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const { name, contactPerson, phone, email, gstNo, address, city, creditLimit } = req.body;
  const [row] = await db.update(clients).set({
    name, contactPerson, phone, email, gstNo, address, city,
    creditLimit: creditLimit?.toString(),
  }).where(and(eq(clients.id, +req.params.id), plantScope(req.user!.plantId, clients.plantId))).returning();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const clientId = +req.params.id;
  // Only act on a client within the actor's plant; a foreign id is a 404 (never
  // reveals existence) so a plant can't probe or delete another plant's customer.
  if (!(await scopedClient(req, clientId))) { res.status(404).json({ error: 'Not found' }); return; }
  const linked = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.linkedClientId, clientId), isNull(users.deletedAt)));
  if (linked.length) {
    const names = linked.map(u => `${u.name} (${u.email})`).join(', ');
    res.status(409).json({
      error: `Cannot delete this client because ${linked.length === 1 ? 'a login account is' : 'login accounts are'} still linked to it: ${names}. Unlink or remove the account first.`,
      linkedUsers: linked,
    });
    return;
  }
  await db.delete(clients).where(and(eq(clients.id, clientId), plantScope(req.user!.plantId, clients.plantId)));
  res.json({ ok: true });
});

router.get('/:id/sites', async (req, res) => {
  if (!(await scopedClient(req, +req.params.id))) { res.status(404).json({ error: 'Not found' }); return; }
  const rows = await db.select().from(sites).where(eq(sites.clientId, +req.params.id));
  res.json(rows);
});

function coordOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n.toString() : null;
}

router.post('/:id/sites', async (req, res) => {
  if (!(await scopedClient(req, +req.params.id))) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, address, city, latitude, longitude } = req.body;
  const [row] = await db.insert(sites).values({
    clientId: +req.params.id, name, address, city,
    latitude: coordOrNull(latitude), longitude: coordOrNull(longitude),
  }).returning();
  res.status(201).json(row);
});

router.put('/:id/sites/:siteId', async (req, res) => {
  if (!(await scopedClient(req, +req.params.id))) { res.status(404).json({ error: 'Not found' }); return; }
  const { name, address, city, latitude, longitude } = req.body;
  // Constrain the site update to the in-scope client so a foreign siteId can't be
  // retargeted under cover of an owned client id.
  const [row] = await db.update(sites).set({
    name, address, city,
    latitude: coordOrNull(latitude), longitude: coordOrNull(longitude),
  }).where(and(eq(sites.id, +req.params.siteId), eq(sites.clientId, +req.params.id))).returning();
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

router.delete('/:id/sites/:siteId', async (req, res) => {
  if (!(await scopedClient(req, +req.params.id))) { res.status(404).json({ error: 'Not found' }); return; }
  await db.delete(sites).where(and(eq(sites.id, +req.params.siteId), eq(sites.clientId, +req.params.id)));
  res.json({ ok: true });
});

router.get('/:id/ledger', async (req, res) => {
  if (!(await scopedClient(req, +req.params.id))) { res.status(404).json({ error: 'Not found' }); return; }
  const rows = await db.select().from(ledgerEntries)
    .where(eq(ledgerEntries.clientId, +req.params.id))
    .orderBy(desc(ledgerEntries.createdAt));
  let balance = 0;
  const withBalance = rows.map(r => {
    const amt = parseFloat(r.amount);
    balance += r.type === 'debit' ? amt : -amt;
    return { ...r, runningBalance: balance };
  });
  res.json({ entries: withBalance, outstanding: balance });
});

router.post('/:id/ledger', async (req, res) => {
  if (!(await scopedClient(req, +req.params.id))) { res.status(404).json({ error: 'Not found' }); return; }
  const { type, amount, description, referenceNo } = req.body;
  const [row] = await db.insert(ledgerEntries).values({
    clientId: +req.params.id, type, amount: amount.toString(), description, referenceNo
  }).returning();
  const delta = type === 'credit' ? -parseFloat(amount) : parseFloat(amount);
  await db.update(clients).set({
    outstandingAmount: sql`outstanding_amount + ${delta}`
  }).where(eq(clients.id, +req.params.id));
  res.status(201).json(row);
});

export default router;
