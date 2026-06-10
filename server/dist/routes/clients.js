import { Router } from 'express';
import { eq, desc, sql, and, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, sites, ledgerEntries, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', async (_req, res) => {
    const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
    res.json(rows);
});
router.get('/:id', async (req, res) => {
    const [client] = await db.select().from(clients).where(eq(clients.id, +req.params.id));
    if (!client) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.json(client);
});
router.post('/', async (req, res) => {
    const { name, contactPerson, phone, email, gstNo, address, city, creditLimit } = req.body;
    const [row] = await db.insert(clients).values({
        name, contactPerson, phone, email, gstNo, address, city,
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
    }).where(eq(clients.id, +req.params.id)).returning();
    res.json(row);
});
router.delete('/:id', async (req, res) => {
    const clientId = +req.params.id;
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
    await db.delete(clients).where(eq(clients.id, clientId));
    res.json({ ok: true });
});
router.get('/:id/sites', async (req, res) => {
    const rows = await db.select().from(sites).where(eq(sites.clientId, +req.params.id));
    res.json(rows);
});
function coordOrNull(v) {
    if (v === undefined || v === null || v === '')
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n.toString() : null;
}
router.post('/:id/sites', async (req, res) => {
    const { name, address, city, latitude, longitude } = req.body;
    const [row] = await db.insert(sites).values({
        clientId: +req.params.id, name, address, city,
        latitude: coordOrNull(latitude), longitude: coordOrNull(longitude),
    }).returning();
    res.status(201).json(row);
});
router.put('/:id/sites/:siteId', async (req, res) => {
    const { name, address, city, latitude, longitude } = req.body;
    const [row] = await db.update(sites).set({
        name, address, city,
        latitude: coordOrNull(latitude), longitude: coordOrNull(longitude),
    }).where(eq(sites.id, +req.params.siteId)).returning();
    res.json(row);
});
router.delete('/:id/sites/:siteId', async (req, res) => {
    await db.delete(sites).where(eq(sites.id, +req.params.siteId));
    res.json({ ok: true });
});
router.get('/:id/ledger', async (req, res) => {
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
    const { type, amount, description, referenceNo } = req.body;
    const [row] = await db.insert(ledgerEntries).values({
        clientId: +req.params.id, type, amount: amount.toString(), description, referenceNo
    }).returning();
    const delta = type === 'credit' ? -parseFloat(amount) : parseFloat(amount);
    await db.update(clients).set({
        outstandingAmount: sql `outstanding_amount + ${delta}`
    }).where(eq(clients.id, +req.params.id));
    res.status(201).json(row);
});
export default router;
