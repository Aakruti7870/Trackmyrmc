import { Router } from 'express';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mixDesigns } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { parseMaterials } from '../lib/batchSheet.js';
const router = Router();
router.use(requireAuth);
// The mix design master is plant-private production data. Mirrors the batch
// routes' role set plus the quality/store roles that own the /mix-design page.
const MIX_ROLES = ['authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'quality_engineer', 'store_manager'];
router.use(requireRole(...MIX_ROLES));
// Grades M10 → M50 per the batching spec (legacy dash form accepted on read).
export const MIX_GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'];
function validGrade(g) {
    return typeof g === 'string' && MIX_GRADES.includes(g);
}
// PG unique-violation code lives on err.cause under drizzle 0.45.
function isUniqueViolation(err) {
    const e = err;
    return e?.code === '23505' || e?.cause?.code === '23505';
}
router.get('/', async (req, res) => {
    const scope = plantScope(req.user.plantId, mixDesigns.plantId);
    let query = db.select().from(mixDesigns).$dynamic();
    if (scope)
        query = query.where(scope);
    const rows = await query.orderBy(asc(mixDesigns.grade));
    res.json(rows);
});
router.post('/', async (req, res) => {
    const { grade, recipeName, recipeCode, notes } = req.body;
    if (!validGrade(grade)) {
        res.status(400).json({ error: `Grade must be one of ${MIX_GRADES.join(', ')}` });
        return;
    }
    if (typeof recipeName !== 'string' || !recipeName.trim()) {
        res.status(400).json({ error: 'Recipe name is required' });
        return;
    }
    let materials;
    try {
        materials = parseMaterials(req.body.materials);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
        return;
    }
    try {
        const [row] = await db.insert(mixDesigns).values({
            plantId: req.user.plantId ?? null,
            grade,
            recipeName: recipeName.trim(),
            recipeCode: typeof recipeCode === 'string' && recipeCode.trim() ? recipeCode.trim() : null,
            materials,
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        }).onConflictDoNothing().returning();
        if (!row) {
            res.status(409).json({ error: `A ${grade} mix design already exists for this plant` });
            return;
        }
        res.status(201).json(row);
    }
    catch (err) {
        if (isUniqueViolation(err)) {
            res.status(409).json({ error: `A ${grade} mix design already exists for this plant` });
            return;
        }
        throw err;
    }
});
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid mix design id' });
        return;
    }
    const { grade, recipeName, recipeCode, notes } = req.body;
    if (!validGrade(grade)) {
        res.status(400).json({ error: `Grade must be one of ${MIX_GRADES.join(', ')}` });
        return;
    }
    if (typeof recipeName !== 'string' || !recipeName.trim()) {
        res.status(400).json({ error: 'Recipe name is required' });
        return;
    }
    let materials;
    try {
        materials = parseMaterials(req.body.materials);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
        return;
    }
    const scope = plantScope(req.user.plantId, mixDesigns.plantId);
    const idEq = eq(mixDesigns.id, id);
    try {
        const [row] = await db.update(mixDesigns).set({
            grade,
            recipeName: recipeName.trim(),
            recipeCode: typeof recipeCode === 'string' && recipeCode.trim() ? recipeCode.trim() : null,
            materials,
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
            updatedAt: new Date(),
        }).where(scope ? and(idEq, scope) : idEq).returning();
        if (!row) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(row);
    }
    catch (err) {
        if (isUniqueViolation(err)) {
            res.status(409).json({ error: `A ${grade} mix design already exists for this plant` });
            return;
        }
        throw err;
    }
});
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid mix design id' });
        return;
    }
    const scope = plantScope(req.user.plantId, mixDesigns.plantId);
    const idEq = eq(mixDesigns.id, id);
    const deleted = await db.delete(mixDesigns)
        .where(scope ? and(idEq, scope) : idEq)
        .returning({ id: mixDesigns.id });
    res.json({ ok: deleted.length > 0 });
});
export default router;
