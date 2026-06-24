import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';
import { proofPhotoStore } from '../lib/proofPhoto.js';
import { getStorageUsage, listPlantFiles } from '../lib/uploadedFiles.js';

const router = Router();
router.use(requireAuth);

const FILE_MANAGERS = requireRole('authority', 'admin', 'plant_owner', 'supervisor', 'dispatcher');

// Per-plant file vault. Platform staff can read any plant; plant-scoped staff
// only their own. Returns the registered files with short-lived signed URLs.
router.get('/plant/:id', FILE_MANAGERS, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  if (!isPlatformStaff(req.user!) && req.user!.plantId !== id) {
    res.status(403).json({ error: 'You can only view your own plant files.' });
    return;
  }
  const [plant] = await db.select({ id: plants.id }).from(plants).where(eq(plants.id, id));
  if (!plant) { res.status(404).json({ error: 'Plant not found' }); return; }

  const fileType = typeof req.query.type === 'string' ? req.query.type : undefined;
  const rows = await listPlantFiles(id, fileType);
  const withUrls = await Promise.all(rows.map(async (r) => ({
    ...r,
    url: await proofPhotoStore.resolve(r.storagePath).catch(() => null),
  })));
  res.json(withUrls);
});

// Platform-wide storage usage aggregate (super-admin only). Grouped by plant +
// file type, with plant names joined for display.
router.get('/usage', requireRole('authority', 'admin'), async (req, res) => {
  if (!isPlatformStaff(req.user!)) {
    res.status(403).json({ error: 'Platform staff only.' });
    return;
  }
  const usage = await getStorageUsage();
  const plantRows = await db.select({ id: plants.id, name: plants.name }).from(plants);
  const nameById = new Map(plantRows.map(p => [p.id, p.name]));
  const totalFiles = usage.reduce((s, u) => s + u.fileCount, 0);
  res.json({
    totalFiles,
    byPlant: usage.map(u => ({
      plantId: u.plantId,
      plantName: u.plantId == null ? 'Unassigned' : (nameById.get(u.plantId) ?? `Plant #${u.plantId}`),
      fileType: u.fileType,
      fileCount: u.fileCount,
    })),
  });
});

export default router;
