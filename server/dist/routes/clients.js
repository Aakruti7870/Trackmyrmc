import { Router } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, sites, ledgerEntries } from '../db/schema.js';
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
    await db.delete(clients).where(eq(clients.id, +req.params.id));
    res.json({ ok: true });
});
router.get('/:id/sites', async (req, res) => {
    const rows = await db.select().from(sites).where(eq(sites.clientId, +req.params.id));
    res.json(rows);
});
router.post('/:id/sites', async (req, res) => {
    const { name, address, city } = req.body;
    const [row] = await db.insert(sites).values({
        clientId: +req.params.id, name, address, city
    }).returning();
    res.status(201).json(row);
});
router.put('/:id/sites/:siteId', async (req, res) => {
    const { name, address, city } = req.body;
    const [row] = await db.update(sites).set({ name, address, city })
        .where(eq(sites.id, +req.params.siteId)).returning();
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
