import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { auditLogs } from '../db/schema.js';
import { rmcPlantCandidates } from '../db/rmcDiscoverySchema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { haversineMeters, nameSimilarity, normalizeGstin, normalizeIndianMobile, normalizeRmcName } from '../lib/rmcDiscovery.js';

const router = Router();
router.use(requireAuth, requireRole('authority'));

// Record every successful Super Admin mutation in the existing platform audit log.
router.use((req, res, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    void db.insert(auditLogs).values({
      actorId: req.user!.id,
      actorName: req.user!.name,
      action: `rmc.discovery.${req.method.toLowerCase()}`,
      status: 'success',
      detail: JSON.stringify({ path: req.path, params: req.params }),
    }).catch(error => console.error('[rmc-discovery] audit write failed', error));
  });
  next();
});

// Approval-time duplicate checks include the manually supplied contact and GST data
// that are intentionally absent from the narrow Google Places field mask.
router.post('/candidates/:id/approve', async (req, res, next) => {
  const candidateId = Number(req.params.id);
  if (!Number.isInteger(candidateId) || candidateId <= 0) return res.status(400).json({ error: 'Invalid candidate id.' });
  const [candidate] = await db.select().from(rmcPlantCandidates).where(eq(rmcPlantCandidates.id, candidateId));
  if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });

  const requestedName = String(req.body?.plantName ?? candidate.discoveredName).trim();
  const requestedLocality = String(req.body?.locality ?? candidate.locality ?? '').trim().toLowerCase();
  const requestedGstin = normalizeGstin(req.body?.gstin);
  const requestedMobile = normalizeIndianMobile(req.body?.mobileNumber);
  const candidateLat = Number(req.body?.latitude ?? candidate.latitude);
  const candidateLng = Number(req.body?.longitude ?? candidate.longitude);

  const existing = await pool.query(`
    SELECT id, name, gst_no, contact_number, place_id, google_place_id,
           coalesce(locality, city, '') AS locality, latitude::float8 AS latitude, longitude::float8 AS longitude
      FROM plants
  `);
  for (const plant of existing.rows) {
    const exactPlace = candidate.googlePlaceId && (plant.google_place_id === candidate.googlePlaceId || plant.place_id === candidate.googlePlaceId);
    const exactGstin = requestedGstin && normalizeGstin(plant.gst_no) === requestedGstin;
    const exactMobile = requestedMobile && normalizeIndianMobile(plant.contact_number) === requestedMobile;
    const exactNameLocality = normalizeRmcName(plant.name) === normalizeRmcName(requestedName) && String(plant.locality).trim().toLowerCase() === requestedLocality;
    const distance = Number.isFinite(candidateLat) && Number.isFinite(candidateLng) && Number.isFinite(plant.latitude) && Number.isFinite(plant.longitude)
      ? haversineMeters(candidateLat, candidateLng, plant.latitude, plant.longitude)
      : Number.POSITIVE_INFINITY;
    const nearbySimilar = distance <= Number(process.env.RMC_DUPLICATE_RADIUS_METERS || 200) && nameSimilarity(plant.name, requestedName) >= 0.45;
    if (exactPlace || exactGstin || exactMobile || exactNameLocality || nearbySimilar) {
      return res.status(409).json({
        error: 'A possible duplicate plant already exists. Review it before approving this candidate.',
        duplicate: { id: plant.id, name: plant.name },
        matchedBy: exactPlace ? 'GOOGLE_PLACE_ID' : exactGstin ? 'GSTIN' : exactMobile ? 'MOBILE' : exactNameLocality ? 'NAME_LOCALITY' : 'LOCATION_NAME',
      });
    }
  }
  next();
});

// Prevent a generic status patch from bypassing the explicit activation workflow.
router.patch('/plants/:id/status', async (req, res, next) => {
  if (req.body?.publicationStatus === 'PUBLISHED') {
    return res.status(409).json({ error: 'Use Activate & Publish. Direct publication is not permitted.' });
  }
  if (req.body?.verificationLevel && !['GOOGLE_LISTED', 'TRACKMYRMC_REGISTERED', 'TRACKMYRMC_VERIFIED'].includes(req.body.verificationLevel)) {
    return res.status(400).json({ error: 'Invalid verification level.' });
  }
  next();
});

export default router;
