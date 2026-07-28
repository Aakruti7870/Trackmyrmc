import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, pool } from '../db/index.js';
import { plants } from '../db/schema.js';
import {
  rmcMarketAreas,
  rmcPlantCandidates,
  rmcPlantImportQueries,
  rmcPlantImportRuns,
  rmcPlantOnboardingInvites,
  rmcPlantStatusHistory,
} from '../db/rmcDiscoverySchema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import { createRmcImportQueries, enqueueRmcImportRun } from '../lib/rmcDiscoveryRunner.js';
import { ACTIVE_OPERATIONAL_STATUSES } from '../lib/rmcDiscovery.js';
import { sendRmcPlantOnboardingInvite } from '../lib/rmcOnboardingEmail.js';

const adminRouter = Router();
const publicRouter = Router();

const IMPORT_SCOPES = ['MARKET', 'DISTRICT', 'MAHARASHTRA'] as const;
const OPERATIONAL_STATUSES = ['UNCONFIRMED', 'ACCEPTING_ORDERS', 'BUSY', 'LIMITED_CAPACITY', 'MAINTENANCE', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED'] as const;
const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED', 'HIDDEN'] as const;
const ONBOARDING_STATUSES = ['NOT_INVITED', 'INVITED', 'CLAIM_PENDING', 'DOCUMENTS_PENDING', 'ADMIN_REVIEW', 'APPROVED'] as const;
const VERIFICATION_LEVELS = ['GOOGLE_LISTED', 'TRACKMYRMC_REGISTERED', 'TRACKMYRMC_VERIFIED'] as const;

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}

function appBaseUrl(req: { headers: Record<string, unknown>; protocol: string }): string {
  const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  return `${proto}://${host}`;
}

adminRouter.use(requireAuth, requireRole('authority'));

adminRouter.get('/markets', async (req, res) => {
  const district = String(req.query.district ?? '').trim();
  const where = district ? eq(rmcMarketAreas.district, district) : undefined;
  const rows = await db.select().from(rmcMarketAreas).where(where).orderBy(rmcMarketAreas.priority, rmcMarketAreas.district, rmcMarketAreas.marketName);
  res.json(rows);
});

const importLimiter = rateLimit({ windowMs: 60_000, max: 5, name: 'rmc-state-import' });
const importSchema = z.object({
  scope: z.enum(IMPORT_SCOPES),
  marketAreaIds: z.array(z.number().int().positive()).max(100).default([]),
  district: z.string().trim().min(1).max(120).nullable().optional(),
});

adminRouter.post('/import', importLimiter, async (req, res) => {
  const parsed = importSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  const input = parsed.data;
  let markets = await db.select().from(rmcMarketAreas).where(eq(rmcMarketAreas.isEnabled, true));
  if (input.scope === 'MARKET') {
    if (input.marketAreaIds.length === 0) {
      res.status(400).json({ error: 'marketAreaIds is required for MARKET scope' });
      return;
    }
    markets = markets.filter(m => input.marketAreaIds.includes(m.id));
  } else if (input.scope === 'DISTRICT') {
    if (!input.district) {
      res.status(400).json({ error: 'district is required for DISTRICT scope' });
      return;
    }
    markets = markets.filter(m => m.district.toLowerCase() === input.district!.toLowerCase());
  }
  if (markets.length === 0) {
    res.status(404).json({ error: 'No enabled markets matched this import scope' });
    return;
  }

  const now = new Date();
  const blocked = markets.filter(m => m.nextScanEligibleAt && m.nextScanEligibleAt > now);
  if (blocked.length > 0) {
    res.status(409).json({
      error: 'One or more selected markets are still inside the scan cooldown period.',
      markets: blocked.map(m => ({ id: m.id, marketName: m.marketName, nextScanEligibleAt: m.nextScanEligibleAt })),
    });
    return;
  }

  const active = await db.select({ id: rmcPlantImportRuns.id, scopeType: rmcPlantImportRuns.scopeType })
    .from(rmcPlantImportRuns)
    .where(inArray(rmcPlantImportRuns.status, ['QUEUED', 'RUNNING']));
  if (active.length > 0) {
    res.status(409).json({ error: 'An RMC import is already queued or running.', activeRunId: active[0].id });
    return;
  }

  const maxQueries = positiveInt(process.env.RMC_IMPORT_MAX_QUERIES_PER_RUN, 500, 2_000);
  const estimatedQueries = markets.reduce((sum, m) => sum + (/\bmidc\b/i.test(m.marketName) || /\bmidc\b/i.test(m.locality) ? 8 : 6), 0);
  if (estimatedQueries > maxQueries) {
    res.status(422).json({ error: `Import would create ${estimatedQueries} queries, above RMC_IMPORT_MAX_QUERIES_PER_RUN=${maxQueries}.` });
    return;
  }

  const [run] = await db.insert(rmcPlantImportRuns).values({
    startedByUserId: req.user!.id,
    scopeType: input.scope,
    marketAreaId: input.scope === 'MARKET' && markets.length === 1 ? markets[0].id : null,
    district: input.scope === 'DISTRICT' ? input.district : null,
    state: 'Maharashtra',
    status: 'QUEUED',
  }).returning();
  const queryCount = await createRmcImportQueries(run.id, markets.map(m => m.id));
  enqueueRmcImportRun(run.id);
  res.status(202).json({ importRunId: run.id, status: 'QUEUED', marketCount: markets.length, totalQueries: queryCount });
});

adminRouter.post('/import-runs/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  const [run] = await db.update(rmcPlantImportRuns).set({ cancelRequested: true, updatedAt: new Date() })
    .where(and(eq(rmcPlantImportRuns.id, id), inArray(rmcPlantImportRuns.status, ['QUEUED', 'RUNNING'])))
    .returning();
  if (!run) { res.status(404).json({ error: 'Active import run not found' }); return; }
  res.json({ ok: true, importRunId: id, cancelRequested: true });
});

adminRouter.get('/import-runs', async (req, res) => {
  const limit = positiveInt(req.query.limit, 30, 100);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const rows = await db.select().from(rmcPlantImportRuns).orderBy(desc(rmcPlantImportRuns.createdAt)).limit(limit).offset(offset);
  res.json(rows);
});

adminRouter.get('/import-runs/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [run] = await db.select().from(rmcPlantImportRuns).where(eq(rmcPlantImportRuns.id, id));
  if (!run) { res.status(404).json({ error: 'Import run not found' }); return; }
  const queries = await db.select().from(rmcPlantImportQueries)
    .where(eq(rmcPlantImportQueries.importRunId, id))
    .orderBy(rmcPlantImportQueries.id);
  res.json({ ...run, queries });
});

adminRouter.get('/dashboard', async (_req, res) => {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM rmc_plant_candidates) AS "totalCandidates",
      (SELECT count(*)::int FROM rmc_plant_candidates WHERE confidence_score >= 70 AND reviewed_at IS NULL) AS "highConfidenceCandidates",
      (SELECT count(*)::int FROM rmc_plant_candidates WHERE discovery_status = 'NEEDS_REVIEW' AND reviewed_at IS NULL) AS "pendingReview",
      (SELECT count(*)::int FROM rmc_plant_candidates WHERE discovery_status = 'REJECTED') AS "rejectedCandidates",
      (SELECT count(*)::int FROM rmc_plant_candidates WHERE discovery_status = 'DUPLICATE') AS "possibleDuplicates",
      (SELECT count(*)::int FROM plants WHERE onboarding_status = 'APPROVED') AS "approvedPlants",
      (SELECT count(*)::int FROM plants WHERE onboarding_status <> 'APPROVED') AS "onboardingPending",
      (SELECT count(*)::int FROM plants WHERE is_active = true AND publication_status = 'PUBLISHED' AND operational_status IN ('ACCEPTING_ORDERS','BUSY','LIMITED_CAPACITY')) AS "activePlants",
      (SELECT count(*)::int FROM plants WHERE operational_status = 'TEMPORARILY_CLOSED') AS "temporarilyClosedPlants",
      (SELECT count(DISTINCT district)::int FROM rmc_market_areas WHERE is_enabled = true) AS "districtCoverage"
  `);
  const [lastRun] = await db.select().from(rmcPlantImportRuns).orderBy(desc(rmcPlantImportRuns.createdAt)).limit(1);
  res.json({ ...result.rows[0], lastImport: lastRun ?? null });
});

adminRouter.get('/candidates', async (req, res) => {
  const limit = positiveInt(req.query.limit, 50, 200);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const filters = [];
  const district = String(req.query.district ?? '').trim();
  const locality = String(req.query.locality ?? '').trim();
  const status = String(req.query.discoveryStatus ?? '').trim();
  const search = String(req.query.search ?? '').trim();
  const businessStatus = String(req.query.googleBusinessStatus ?? '').trim();
  const minConfidence = Number(req.query.minConfidence);
  const maxConfidence = Number(req.query.maxConfidence);
  const reviewed = String(req.query.reviewed ?? '').trim();
  if (district) filters.push(eq(rmcPlantCandidates.district, district));
  if (locality) filters.push(eq(rmcPlantCandidates.locality, locality));
  if (status) filters.push(eq(rmcPlantCandidates.discoveryStatus, status as never));
  if (businessStatus) filters.push(eq(rmcPlantCandidates.googleBusinessStatus, businessStatus));
  if (search) filters.push(or(ilike(rmcPlantCandidates.discoveredName, `%${search}%`), ilike(rmcPlantCandidates.formattedAddress, `%${search}%`))!);
  if (Number.isFinite(minConfidence)) filters.push(gte(rmcPlantCandidates.confidenceScore, minConfidence));
  if (Number.isFinite(maxConfidence)) filters.push(lte(rmcPlantCandidates.confidenceScore, maxConfidence));
  if (reviewed === 'false') filters.push(isNull(rmcPlantCandidates.reviewedAt));
  const rows = await db.select().from(rmcPlantCandidates)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(rmcPlantCandidates.confidenceScore), desc(rmcPlantCandidates.lastDiscoveredAt))
    .limit(limit).offset(offset);
  res.json(rows);
});

adminRouter.get('/candidates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [candidate] = await db.select().from(rmcPlantCandidates).where(eq(rmcPlantCandidates.id, id));
  if (!candidate) { res.status(404).json({ error: 'Candidate not found' }); return; }
  const nearby = await pool.query(`
    SELECT id, name, city, latitude, longitude,
      (6371000 * 2 * asin(sqrt(
        power(sin(radians((latitude::numeric - $1) / 2)), 2) +
        cos(radians($1)) * cos(radians(latitude::numeric)) * power(sin(radians((longitude::numeric - $2) / 2)), 2)
      ))) AS distance_m
    FROM plants
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY distance_m ASC LIMIT 8
  `, [Number(candidate.latitude), Number(candidate.longitude)]);
  res.json({ ...candidate, nearbyPlants: nearby.rows });
});

const candidatePatchSchema = z.object({
  discoveredName: z.string().trim().min(1).max(200).optional(),
  formattedAddress: z.string().trim().max(500).nullable().optional(),
  locality: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  reviewerNotes: z.string().trim().max(2_000).nullable().optional(),
});

adminRouter.patch('/candidates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = candidatePatchSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const data = parsed.data;
  const [row] = await db.update(rmcPlantCandidates).set({
    ...(data.discoveredName !== undefined ? { discoveredName: data.discoveredName } : {}),
    ...(data.formattedAddress !== undefined ? { formattedAddress: data.formattedAddress } : {}),
    ...(data.locality !== undefined ? { locality: data.locality } : {}),
    ...(data.district !== undefined ? { district: data.district } : {}),
    ...(data.latitude !== undefined ? { latitude: String(data.latitude) } : {}),
    ...(data.longitude !== undefined ? { longitude: String(data.longitude) } : {}),
    ...(data.reviewerNotes !== undefined ? { reviewerNotes: data.reviewerNotes } : {}),
    updatedAt: new Date(),
  }).where(eq(rmcPlantCandidates.id, id)).returning();
  if (!row) { res.status(404).json({ error: 'Candidate not found' }); return; }
  res.json(row);
});

const approveSchema = z.object({
  plantName: z.string().trim().min(1).max(200),
  legalBusinessName: z.string().trim().max(200).nullable().optional(),
  gstin: z.string().trim().max(20).nullable().optional(),
  address: z.string().trim().min(1).max(500),
  locality: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(120).default('Maharashtra'),
  postalCode: z.string().trim().max(12).nullable().optional(),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  contactPersonName: z.string().trim().max(160).nullable().optional(),
  mobileNumber: z.string().trim().max(40).nullable().optional(),
  alternateMobileNumber: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  capacityM3PerHour: z.number().positive().nullable().optional(),
  availableGrades: z.array(z.string().trim().min(1)).max(30).default([]),
  deliveryRadiusKm: z.number().int().positive().max(250).default(25),
  minimumOrderM3: z.number().positive().nullable().optional(),
  transitMixerCount: z.number().int().nonnegative().nullable().optional(),
  pumpAvailable: z.boolean().nullable().optional(),
});

adminRouter.post('/candidates/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = approveSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const [candidate] = await db.select().from(rmcPlantCandidates).where(eq(rmcPlantCandidates.id, id));
  if (!candidate) { res.status(404).json({ error: 'Candidate not found' }); return; }
  if (candidate.discoveryStatus === 'DUPLICATE') { res.status(409).json({ error: 'Candidate is marked as a duplicate and cannot be approved.' }); return; }
  const body = parsed.data;

  const duplicate = await pool.query(`SELECT id, name FROM plants WHERE google_place_id = $1 OR place_id = $1 LIMIT 1`, [candidate.googlePlaceId]);
  if (duplicate.rowCount) { res.status(409).json({ error: 'A plant already exists for this Google Place ID.', duplicate: duplicate.rows[0] }); return; }

  try {
    // A single transaction: if the discovery-column UPDATE, the candidate
    // status update, or the history insert fails partway (a transient DB
    // error, a partial schema rollout), the whole approval rolls back instead
    // of leaving a half-approved plant that already carries the candidate's
    // place_id — which would permanently trip the duplicate check above on
    // every retry, with no way to finish approving the candidate.
    const plantId = await db.transaction(async (tx) => {
      const [plant] = await tx.insert(plants).values({
        name: body.plantName,
        legalName: body.legalBusinessName ?? null,
        gstNo: body.gstin ?? null,
        email: body.email ?? null,
        address: body.address,
        city: body.locality,
        contactNumber: body.mobileNumber ?? null,
        latitude: String(body.latitude),
        longitude: String(body.longitude),
        plantStatus: 'pending',
        isActive: false,
        locationVerified: false,
        verified: false,
        ownerName: body.contactPersonName ?? null,
        networkStatus: 'pending',
        showOnNetwork: false,
        placeId: candidate.googlePlaceId,
        deliveryRadiusKm: body.deliveryRadiusKm,
        grades: body.availableGrades,
      }).returning();

      await tx.execute(sql`
        UPDATE plants SET
          google_place_id = ${candidate.googlePlaceId}, locality = ${body.locality}, district = ${body.district},
          state = ${body.state}, postal_code = ${body.postalCode ?? null},
          contact_person_name = ${body.contactPersonName ?? null}, alternate_mobile_number = ${body.alternateMobileNumber ?? null},
          capacity_m3_per_hour = ${body.capacityM3PerHour ?? null}, minimum_order_m3 = ${body.minimumOrderM3 ?? null},
          transit_mixer_count = ${body.transitMixerCount ?? null}, pump_available = ${body.pumpAvailable ?? null},
          operational_status = 'UNCONFIRMED', onboarding_status = 'NOT_INVITED',
          publication_status = 'DRAFT', verification_level = 'GOOGLE_LISTED',
          source = 'GOOGLE_PLACES', candidate_id = ${candidate.id}, approved_by_user_id = ${req.user!.id},
          approved_at = now(), updated_at = now()
        WHERE id = ${plant.id}
      `);

      await tx.update(rmcPlantCandidates).set({
        discoveryStatus: 'DISCOVERED', reviewedByUserId: req.user!.id, reviewedAt: new Date(), updatedAt: new Date(),
      }).where(eq(rmcPlantCandidates.id, candidate.id));
      await tx.insert(rmcPlantStatusHistory).values({
        plantId: plant.id,
        changedByUserId: req.user!.id,
        newOperationalStatus: 'UNCONFIRMED',
        newPublicationStatus: 'DRAFT',
        reason: 'Approved Google-listed candidate as a private draft',
      });
      return plant.id;
    });
    res.status(201).json({ plantId, publicationStatus: 'DRAFT', operationalStatus: 'UNCONFIRMED', onboardingStatus: 'NOT_INVITED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(409).json({ error: 'Could not approve candidate as a draft plant.', detail: message.slice(0, 300) });
  }
});

const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1_000) });
adminRouter.post('/candidates/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = rejectSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const [row] = await db.update(rmcPlantCandidates).set({
    discoveryStatus: 'REJECTED', rejectionReason: parsed.data.reason,
    reviewedByUserId: req.user!.id, reviewedAt: new Date(), updatedAt: new Date(),
  }).where(eq(rmcPlantCandidates.id, id)).returning();
  if (!row) { res.status(404).json({ error: 'Candidate not found' }); return; }
  res.json(row);
});

const duplicateSchema = z.object({ plantId: z.number().int().positive().nullable().optional(), reason: z.string().trim().max(1_000).optional() });
adminRouter.post('/candidates/:id/mark-duplicate', async (req, res) => {
  const id = Number(req.params.id);
  const parsed = duplicateSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const [row] = await db.update(rmcPlantCandidates).set({
    discoveryStatus: 'DUPLICATE', possibleDuplicateOfPlantId: parsed.data.plantId ?? null,
    rejectionReason: parsed.data.reason ?? 'Marked duplicate by Super Admin',
    reviewedByUserId: req.user!.id, reviewedAt: new Date(), updatedAt: new Date(),
  }).where(eq(rmcPlantCandidates.id, id)).returning();
  if (!row) { res.status(404).json({ error: 'Candidate not found' }); return; }
  res.json(row);
});

adminRouter.get('/plants', async (req, res) => {
  const limit = positiveInt(req.query.limit, 50, 200);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const status = String(req.query.status ?? '').trim();
  const params: unknown[] = [];
  let where = '';
  if (status === 'active') where = `WHERE is_active = true AND publication_status = 'PUBLISHED' AND operational_status IN ('ACCEPTING_ORDERS','BUSY','LIMITED_CAPACITY')`;
  if (status === 'inactive') where = `WHERE NOT (is_active = true AND publication_status = 'PUBLISHED' AND operational_status IN ('ACCEPTING_ORDERS','BUSY','LIMITED_CAPACITY'))`;
  params.push(limit, offset);
  const result = await pool.query(`
    SELECT id, plant_code AS "plantCode", name AS "plantName", legal_name AS "legalBusinessName",
      gst_no AS "gstin", address, locality, district, state, postal_code AS "postalCode",
      latitude, longitude, contact_person_name AS "contactPersonName", contact_number AS "mobileNumber",
      alternate_mobile_number AS "alternateMobileNumber", email, capacity_m3_per_hour AS "capacityM3PerHour",
      grades AS "availableGrades", delivery_radius_km AS "deliveryRadiusKm", minimum_order_m3 AS "minimumOrderM3",
      transit_mixer_count AS "transitMixerCount", pump_available AS "pumpAvailable", operating_hours AS "operatingHours",
      operational_status AS "operationalStatus", onboarding_status AS "onboardingStatus",
      publication_status AS "publicationStatus", verification_level AS "verificationLevel",
      is_active AS "isActive", source, google_place_id AS "googlePlaceId", candidate_id AS "candidateId",
      owner_user_id AS "ownerUserId", approved_at AS "approvedAt", activated_at AS "activatedAt",
      last_operational_confirmation_at AS "lastOperationalConfirmationAt", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM plants ${where} ORDER BY updated_at DESC LIMIT $1 OFFSET $2
  `, params);
  res.json(result.rows);
});

const inviteSchema = z.object({
  mobileNumber: z.string().trim().min(8).max(40),
  email: z.string().trim().email().nullable().optional(),
});
adminRouter.post('/plants/:id/send-onboarding-invite', async (req, res) => {
  const plantId = Number(req.params.id);
  const parsed = inviteSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const plantResult = await pool.query(`SELECT id, name FROM plants WHERE id = $1`, [plantId]);
  if (!plantResult.rowCount) { res.status(404).json({ error: 'Plant not found' }); return; }
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await db.insert(rmcPlantOnboardingInvites).values({
    plantId,
    invitedMobileNumber: parsed.data.mobileNumber,
    invitedEmail: parsed.data.email ?? null,
    inviteTokenHash: tokenHash,
    inviteStatus: 'INVITED',
    expiresAt,
    createdByUserId: req.user!.id,
  });
  await pool.query(`UPDATE plants SET onboarding_status = 'INVITED', invite_status = 'invited', invite_sent_at = now(), updated_at = now() WHERE id = $1`, [plantId]);
  let emailSent = false;
  if (parsed.data.email) {
    const inviteUrl = `${appBaseUrl(req)}/partner?invite=${encodeURIComponent(token)}`;
    try {
      emailSent = await sendRmcPlantOnboardingInvite({
        toEmail: parsed.data.email,
        plantName: plantResult.rows[0].name,
        inviteUrl,
        expiresAt,
      });
    } catch (error) {
      console.error('[rmc-onboarding] invitation email failed', error);
    }
  }
  res.status(201).json({ ok: true, plantId, inviteStatus: 'INVITED', expiresAt, emailSent });
});

const statusSchema = z.object({
  operationalStatus: z.enum(OPERATIONAL_STATUSES).optional(),
  publicationStatus: z.enum(PUBLICATION_STATUSES).optional(),
  onboardingStatus: z.enum(ONBOARDING_STATUSES).optional(),
  verificationLevel: z.enum(VERIFICATION_LEVELS).optional(),
  reason: z.string().trim().min(3).max(1_000),
});

adminRouter.patch('/plants/:id/status', async (req, res) => {
  const plantId = Number(req.params.id);
  const parsed = statusSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const before = await pool.query(`SELECT operational_status, publication_status FROM plants WHERE id = $1`, [plantId]);
  if (!before.rowCount) { res.status(404).json({ error: 'Plant not found' }); return; }
  const body = parsed.data;
  const result = await pool.query(`
    UPDATE plants SET
      operational_status = COALESCE($2, operational_status),
      publication_status = COALESCE($3, publication_status),
      onboarding_status = COALESCE($4, onboarding_status),
      verification_level = COALESCE($5, verification_level),
      updated_at = now()
    WHERE id = $1
    RETURNING id, operational_status AS "operationalStatus", publication_status AS "publicationStatus",
      onboarding_status AS "onboardingStatus", verification_level AS "verificationLevel", is_active AS "isActive"
  `, [plantId, body.operationalStatus ?? null, body.publicationStatus ?? null, body.onboardingStatus ?? null, body.verificationLevel ?? null]);
  await db.insert(rmcPlantStatusHistory).values({
    plantId, changedByUserId: req.user!.id,
    previousOperationalStatus: before.rows[0].operational_status,
    newOperationalStatus: body.operationalStatus ?? before.rows[0].operational_status,
    previousPublicationStatus: before.rows[0].publication_status,
    newPublicationStatus: body.publicationStatus ?? before.rows[0].publication_status,
    reason: body.reason,
  });
  res.json(result.rows[0]);
});

const activationSchema = z.object({
  operationalStatus: z.enum(['ACCEPTING_ORDERS', 'BUSY', 'LIMITED_CAPACITY']),
  publicationStatus: z.literal('PUBLISHED'),
  verificationLevel: z.enum(['TRACKMYRMC_REGISTERED', 'TRACKMYRMC_VERIFIED']),
  reason: z.string().trim().min(5).max(1_000),
  confirmations: z.object({
    identityChecked: z.literal(true),
    contactChecked: z.literal(true),
    locationChecked: z.literal(true),
    operational: z.literal(true),
    authorisedForOrders: z.literal(true),
    deliveryRadiusChecked: z.literal(true),
  }),
});
adminRouter.post('/plants/:id/activate', async (req, res) => {
  const plantId = Number(req.params.id);
  const parsed = activationSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const current = await pool.query(`SELECT onboarding_status, operational_status, publication_status, delivery_radius_km FROM plants WHERE id = $1`, [plantId]);
  if (!current.rowCount) { res.status(404).json({ error: 'Plant not found' }); return; }
  if (current.rows[0].onboarding_status !== 'APPROVED') {
    res.status(409).json({ error: 'Plant onboarding must be APPROVED before activation.' });
    return;
  }
  if (!current.rows[0].delivery_radius_km || current.rows[0].delivery_radius_km <= 0) {
    res.status(422).json({ error: 'A valid delivery radius is required before activation.' });
    return;
  }
  const body = parsed.data;
  const result = await pool.query(`
    UPDATE plants SET is_active = true, show_on_network = true, network_status = 'active', plant_status = 'approved',
      location_verified = true, verified = true, onboarding_status = 'APPROVED',
      operational_status = $2, publication_status = 'PUBLISHED', verification_level = $3,
      activated_by_user_id = $4, activated_at = now(), last_operational_confirmation_at = now(), updated_at = now()
    WHERE id = $1
    RETURNING id, name, is_active AS "isActive", operational_status AS "operationalStatus",
      publication_status AS "publicationStatus", verification_level AS "verificationLevel", activated_at AS "activatedAt"
  `, [plantId, body.operationalStatus, body.verificationLevel, req.user!.id]);
  await db.insert(rmcPlantStatusHistory).values({
    plantId, changedByUserId: req.user!.id,
    previousOperationalStatus: current.rows[0].operational_status,
    newOperationalStatus: body.operationalStatus,
    previousPublicationStatus: current.rows[0].publication_status,
    newPublicationStatus: 'PUBLISHED',
    reason: body.reason,
  });
  res.json(result.rows[0]);
});

const deactivateSchema = z.object({ reason: z.string().trim().min(5).max(1_000), operationalStatus: z.enum(['TEMPORARILY_CLOSED', 'MAINTENANCE', 'PERMANENTLY_CLOSED']).default('TEMPORARILY_CLOSED') });
adminRouter.post('/plants/:id/deactivate', async (req, res) => {
  const plantId = Number(req.params.id);
  const parsed = deactivateSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const current = await pool.query(`SELECT operational_status, publication_status FROM plants WHERE id = $1`, [plantId]);
  if (!current.rowCount) { res.status(404).json({ error: 'Plant not found' }); return; }
  const result = await pool.query(`
    UPDATE plants SET is_active = false, show_on_network = false, network_status = 'verified',
      operational_status = $2, publication_status = 'HIDDEN', updated_at = now()
    WHERE id = $1 RETURNING id, name, is_active AS "isActive", operational_status AS "operationalStatus", publication_status AS "publicationStatus"
  `, [plantId, parsed.data.operationalStatus]);
  await db.insert(rmcPlantStatusHistory).values({
    plantId, changedByUserId: req.user!.id,
    previousOperationalStatus: current.rows[0].operational_status,
    newOperationalStatus: parsed.data.operationalStatus,
    previousPublicationStatus: current.rows[0].publication_status,
    newPublicationStatus: 'HIDDEN',
    reason: parsed.data.reason,
  });
  res.json(result.rows[0]);
});

publicRouter.get('/rmc-plants', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = Math.min(250, positiveInt(req.query.radiusKm, 50, 250));
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);
  const params: unknown[] = [];
  let distanceSql = 'NULL::numeric AS "distanceKm"';
  let distanceFilter = '';
  if (hasPoint) {
    params.push(lat, lng, radiusKm);
    distanceSql = `(6371 * 2 * asin(sqrt(power(sin(radians((latitude::numeric - $1) / 2)), 2) + cos(radians($1)) * cos(radians(latitude::numeric)) * power(sin(radians((longitude::numeric - $2) / 2)), 2)))) AS "distanceKm"`;
    distanceFilter = `AND (6371 * 2 * asin(sqrt(power(sin(radians((latitude::numeric - $1) / 2)), 2) + cos(radians($1)) * cos(radians(latitude::numeric)) * power(sin(radians((longitude::numeric - $2) / 2)), 2)))) <= $3`;
  }
  const result = await pool.query(`
    SELECT id, name AS "plantName", address, locality, district, state, latitude, longitude,
      capacity_m3_per_hour AS "capacityM3PerHour", grades AS "availableGrades",
      delivery_radius_km AS "deliveryRadiusKm", operational_status AS "operationalStatus",
      verification_level AS "verificationLevel", ${distanceSql}
    FROM plants
    WHERE onboarding_status = 'APPROVED' AND publication_status = 'PUBLISHED' AND is_active = true
      AND operational_status IN ('ACCEPTING_ORDERS','BUSY','LIMITED_CAPACITY')
      ${distanceFilter}
    ORDER BY ${hasPoint ? '"distanceKm" ASC,' : ''} name ASC
    LIMIT 250
  `, params);
  res.json(result.rows);
});

const claimSchema = z.object({
  inviteToken: z.string().trim().min(1),
  applicantName: z.string().trim().min(1).max(160),
  mobile: z.string().trim().min(8).max(40),
  email: z.string().trim().email().nullable().optional(),
  designation: z.string().trim().min(1).max(120),
  legalBusinessName: z.string().trim().min(1).max(200),
  gstin: z.string().trim().max(20).nullable().optional(),
  plantAddress: z.string().trim().min(1).max(500),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  capacityM3PerHour: z.number().positive().nullable().optional(),
  availableGrades: z.array(z.string().trim().min(1)).max(30).default([]),
  deliveryRadiusKm: z.number().int().positive().max(250),
  authorityConfirmed: z.literal(true),
});
// Any authenticated user could otherwise POST here and seize an arbitrary
// Google-listed plant (overwriting owner_user_id and every contact/legal
// field an operator already curated) — so the caller must present the invite
// token the admin-only send-onboarding-invite endpoint generated for THIS
// plant. The invite consumption and the plant claim happen in one
// transaction, atomically, so two concurrent claims (or a replayed token)
// can't both succeed: only the first to land the UPDATE ... WHERE
// owner_user_id IS NULL wins.
publicRouter.post('/rmc-plants/:id/claim', requireAuth, async (req, res) => {
  const plantId = Number(req.params.id);
  if (!Number.isInteger(plantId) || plantId <= 0) { res.status(400).json({ error: 'Invalid plant id.' }); return; }
  const parsed = claimSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten().fieldErrors }); return; }
  const body = parsed.data;
  const tokenHash = createHash('sha256').update(body.inviteToken).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invite = await client.query(`
      UPDATE rmc_plant_onboarding_invites
        SET invite_status = 'ACCEPTED', accepted_at = now(), updated_at = now()
        WHERE plant_id = $1 AND invite_token_hash = $2 AND invite_status = 'INVITED' AND expires_at > now()
        RETURNING id
    `, [plantId, tokenHash]);
    if (!invite.rowCount) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'This invite link is invalid, expired, or already used.' });
      return;
    }

    const result = await client.query(`
      UPDATE plants SET owner_name = $2, contact_person_name = $2, contact_number = $3, email = $4,
        legal_name = $5, gst_no = $6, address = $7, latitude = $8, longitude = $9,
        capacity_m3_per_hour = $10, grades = $11, delivery_radius_km = $12,
        onboarding_status = 'CLAIM_PENDING', publication_status = 'DRAFT', is_active = false,
        owner_user_id = $13, updated_at = now()
      WHERE id = $1 AND verification_level = 'GOOGLE_LISTED' AND owner_user_id IS NULL
      RETURNING id
    `, [plantId, body.applicantName, body.mobile, body.email ?? null, body.legalBusinessName,
      body.gstin ?? null, body.plantAddress, body.latitude, body.longitude, body.capacityM3PerHour ?? null,
      body.availableGrades, body.deliveryRadiusKm, req.user!.id]);
    if (!result.rowCount) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'This plant is not available to claim (not Google-listed, or already claimed).' });
      return;
    }

    await client.query('COMMIT');
    res.status(202).json({ ok: true, plantId, onboardingStatus: 'CLAIM_PENDING', message: 'Claim submitted for Super Admin review.' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

export { adminRouter as rmcDiscoveryAdminRoutes, publicRouter as rmcDiscoveryPublicRoutes };
