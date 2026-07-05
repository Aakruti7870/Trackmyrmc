import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { driverExpenses, drivers, users, challans } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { proofPhotoStore, isObjectStoragePath } from '../lib/proofPhoto.js';
import { plantScope } from '../lib/tenancy.js';
import { registerUploadedFileSafe, unregisterUploadedFilesSafe } from '../lib/uploadedFiles.js';
const router = Router();
router.use(requireAuth);
// Who may review (approve/reject + mark reimbursed) a driver's expense claim.
// Single-step: one approver settles both the decision and the reimbursement.
const REVIEW_ROLES = ['authority', 'admin', 'plant_owner', 'supervisor', 'fleet_manager', 'accountant'];
const MAX_OBJECT_PATH_CHARS = 1024;
const CATEGORIES = ['fuel', 'toll', 'food', 'repair', 'parking', 'loading', 'other'];
const expenseSelect = {
    id: driverExpenses.id,
    driverId: driverExpenses.driverId,
    userId: driverExpenses.userId,
    plantId: driverExpenses.plantId,
    challanId: driverExpenses.challanId,
    vehicleId: driverExpenses.vehicleId,
    category: driverExpenses.category,
    amount: driverExpenses.amount,
    description: driverExpenses.description,
    gpsLat: driverExpenses.gpsLat,
    gpsLng: driverExpenses.gpsLng,
    expenseAt: driverExpenses.expenseAt,
    status: driverExpenses.status,
    reviewerRemark: driverExpenses.reviewerRemark,
    reviewedByName: driverExpenses.reviewedByName,
    reviewedAt: driverExpenses.reviewedAt,
    reimbursementStatus: driverExpenses.reimbursementStatus,
    createdAt: driverExpenses.createdAt,
    // List only flags presence; the detail endpoint resolves a signed URL.
    hasReceipt: driverExpenses.receiptPhoto,
};
function parseAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0)
        throw new Error('Amount must be a positive number');
    return n.toString();
}
function parseCategory(value) {
    if (typeof value !== 'string' || !CATEGORIES.includes(value)) {
        throw new Error('Invalid expense category');
    }
    return value;
}
function parseExpenseAt(value) {
    if (value === undefined || value === null || value === '')
        return new Date();
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        throw new Error('Expense date/time must be valid');
    return d;
}
// Optional latitude/longitude captured on the device. Returns undefined when
// absent, or a validated string when present. Rejects out-of-range coordinates.
function parseCoord(value, kind) {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    const n = Number(value);
    const limit = kind === 'lat' ? 90 : 180;
    if (!Number.isFinite(n) || Math.abs(n) > limit)
        throw new Error(`Invalid ${kind === 'lat' ? 'latitude' : 'longitude'}`);
    return n.toString();
}
function validateReceipt(value) {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    if (typeof value !== 'string')
        throw new Error('Receipt must be a string');
    if (!isObjectStoragePath(value))
        throw new Error('Receipt must be an uploaded object path');
    if (value.length > MAX_OBJECT_PATH_CHARS)
        throw new Error('Receipt path is too long');
    return value;
}
// The driver profile + plant bound to the acting user. A driver logs in with a
// `driver` role account whose linkedDriverId + plantId identify them.
async function actingDriver(userId) {
    const [row] = await db
        .select({ driverId: users.linkedDriverId, plantId: users.plantId })
        .from(users)
        .where(eq(users.id, userId));
    return { driverId: row?.driverId ?? null, plantId: row?.plantId ?? null };
}
// Mint a presigned URL to upload a receipt photo directly to object storage.
router.post('/upload-url', async (_req, res) => {
    try {
        const { uploadURL, objectPath } = await proofPhotoStore.createUploadUrl();
        res.json({ uploadURL, objectPath });
    }
    catch (e) {
        console.error('Failed to create expense receipt upload URL:', e);
        res.status(500).json({ error: 'Failed to create upload URL' });
    }
});
// A driver's own submitted expenses (newest first).
router.get('/mine', requireRole('driver'), async (req, res) => {
    const rows = await db
        .select(expenseSelect)
        .from(driverExpenses)
        .where(eq(driverExpenses.userId, req.user.id))
        .orderBy(desc(driverExpenses.expenseAt));
    res.json(rows.map((r) => ({ ...r, hasReceipt: !!r.hasReceipt })));
});
// Staff review queue — plant-scoped, optional ?status= filter.
router.get('/', requireRole(...REVIEW_ROLES), async (req, res) => {
    const filters = [];
    const scope = plantScope(req.user.plantId, driverExpenses.plantId);
    if (scope)
        filters.push(scope);
    const status = req.query.status;
    if (status === 'pending' || status === 'approved' || status === 'rejected') {
        filters.push(eq(driverExpenses.status, status));
    }
    const rows = await db
        .select({ ...expenseSelect, driverName: drivers.name })
        .from(driverExpenses)
        .leftJoin(drivers, eq(driverExpenses.driverId, drivers.id))
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(driverExpenses.createdAt));
    res.json(rows.map((r) => ({ ...r, hasReceipt: !!r.hasReceipt })));
});
// Detail with a signed receipt URL. Visible to the owning driver or to a
// same-plant reviewer (a null-plant platform reviewer sees any).
router.get('/:id', async (req, res) => {
    const id = +req.params.id;
    const [row] = await db
        .select({ ...expenseSelect, receiptPhoto: driverExpenses.receiptPhoto, driverName: drivers.name })
        .from(driverExpenses)
        .leftJoin(drivers, eq(driverExpenses.driverId, drivers.id))
        .where(eq(driverExpenses.id, id));
    if (!row) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const actor = req.user;
    const isOwner = row.userId === actor.id;
    const isReviewer = REVIEW_ROLES.includes(actor.role)
        && (actor.plantId == null || actor.plantId === row.plantId);
    if (!isOwner && !isReviewer) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const receiptUrl = await proofPhotoStore.resolve(row.receiptPhoto);
    res.json({ ...row, hasReceipt: !!row.receiptPhoto, receiptUrl });
});
// A driver submits a new expense claim.
router.post('/', requireRole('driver'), async (req, res) => {
    let category, amount, expenseAt;
    let gpsLat, gpsLng;
    let receipt;
    try {
        category = parseCategory(req.body.category);
        amount = parseAmount(req.body.amount);
        expenseAt = parseExpenseAt(req.body.expenseAt);
        gpsLat = parseCoord(req.body.gpsLat, 'lat');
        gpsLng = parseCoord(req.body.gpsLng, 'lng');
        receipt = validateReceipt(req.body.receiptPhoto);
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid expense' });
        return;
    }
    let storedReceipt = null;
    if (receipt) {
        if (!(await proofPhotoStore.verifyExists(receipt))) {
            res.status(400).json({ error: 'Receipt upload was not found in storage' });
            return;
        }
        storedReceipt = receipt;
    }
    const { driverId, plantId } = await actingDriver(req.user.id);
    // Optional trip link must belong to the driver's plant (defence in depth).
    let challanId = null;
    if (req.body.challanId !== undefined && req.body.challanId !== null && req.body.challanId !== '') {
        const cId = +req.body.challanId;
        const scope = plantScope(plantId, challans.plantId);
        const cEq = eq(challans.id, cId);
        const [c] = await db.select({ id: challans.id }).from(challans).where(scope ? and(cEq, scope) : cEq);
        if (c)
            challanId = cId;
    }
    const [row] = await db
        .insert(driverExpenses)
        .values({
        driverId,
        userId: req.user.id,
        plantId,
        challanId,
        category,
        amount,
        description: typeof req.body.description === 'string' && req.body.description.trim() ? req.body.description.trim() : null,
        receiptPhoto: storedReceipt,
        gpsLat: gpsLat ?? null,
        gpsLng: gpsLng ?? null,
        expenseAt,
    })
        .returning();
    if (storedReceipt && isObjectStoragePath(storedReceipt)) {
        await registerUploadedFileSafe({
            storagePath: storedReceipt,
            fileType: 'expense_receipt',
            plantId: plantId ?? undefined,
            userId: req.user.id,
        });
    }
    res.status(201).json(row);
});
// Single-step review: an approver approves/rejects and settles reimbursement.
router.patch('/:id/review', requireRole(...REVIEW_ROLES), async (req, res) => {
    const id = +req.params.id;
    const scope = plantScope(req.user.plantId, driverExpenses.plantId);
    const idEq = eq(driverExpenses.id, id);
    const [existing] = await db
        .select({ id: driverExpenses.id, status: driverExpenses.status })
        .from(driverExpenses)
        .where(scope ? and(idEq, scope) : idEq);
    if (!existing) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const decision = req.body.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
        res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
        return;
    }
    // Reimbursement only makes sense on an approved claim.
    const reimbursed = decision === 'approved' && req.body.reimbursed === true;
    const remark = typeof req.body.remark === 'string' && req.body.remark.trim() ? req.body.remark.trim() : null;
    const actor = req.user;
    const [row] = await db
        .update(driverExpenses)
        .set({
        status: decision,
        reimbursementStatus: reimbursed ? 'reimbursed' : 'pending',
        reviewerRemark: remark,
        reviewedBy: actor.id,
        reviewedByName: actor.name,
        reviewedAt: new Date(),
    })
        .where(eq(driverExpenses.id, id))
        .returning();
    res.json(row);
});
// A driver may delete their own still-pending claim (and its receipt object).
router.delete('/:id', requireRole('driver'), async (req, res) => {
    const id = +req.params.id;
    const [existing] = await db
        .select({ id: driverExpenses.id, userId: driverExpenses.userId, status: driverExpenses.status, receiptPhoto: driverExpenses.receiptPhoto })
        .from(driverExpenses)
        .where(eq(driverExpenses.id, id));
    if (!existing || existing.userId !== req.user.id) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    if (existing.status !== 'pending') {
        res.status(409).json({ error: 'Only a pending expense can be deleted' });
        return;
    }
    await db.delete(driverExpenses).where(eq(driverExpenses.id, id));
    if (existing.receiptPhoto) {
        await proofPhotoStore.remove(existing.receiptPhoto).catch(() => { });
        await unregisterUploadedFilesSafe([existing.receiptPhoto]);
    }
    res.json({ ok: true });
});
export default router;
