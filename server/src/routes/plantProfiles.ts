import { Router } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { plantCertificates, plantProfiles, plantPromotions } from '../db/plantProfileSchema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';

const router = Router();
const profileStatus = z.enum(['draft', 'submitted', 'changes_requested', 'verified', 'suspended']);
const certificateStatus = z.enum(['available', 'not_available', 'applied', 'expired', 'not_applicable']);
const verificationStatus = z.enum(['unverified', 'pending', 'verified', 'rejected', 'expired']);
const verificationMethod = z.enum(['document_review', 'manual_confirmation', 'physical_verification', 'external_verification', 'not_verified']);
const packageType = z.enum(['standard', 'featured', 'premium', 'custom']);
const paymentStatus = z.enum(['pending', 'paid', 'waived', 'refunded', 'cancelled']);

const optionalNonNegative = z.coerce.number().min(0).nullable().optional();
const profileInput = z.object({
  productionCapacityM3PerHour: z.coerce.number().positive().nullable().optional(),
  maximumDailySupplyCapacityM3: optionalNonNegative,
  numberOfTransitMixers: z.coerce.number().int().min(0).nullable().optional(),
  numberOfPumps: z.coerce.number().int().min(0).nullable().optional(),
  inhouseConcretePumpAvailable: z.boolean().nullable().optional(),
  externalPumpArrangementAvailable: z.boolean().nullable().optional(),
  works24Hours: z.boolean().optional(),
  workingHoursStart: z.string().nullable().optional(), workingHoursEnd: z.string().nullable().optional(),
  minimumOrderQuantityM3: optionalNonNegative,
  laboratoryAvailable: z.boolean().nullable().optional(), laboratoryDetails: z.string().max(2000).nullable().optional(),
  qualityEngineerAvailable: z.boolean().nullable().optional(), cubeTestingAvailable: z.boolean().nullable().optional(),
  cubeTestingReportsAvailable: z.boolean().nullable().optional(), cubeTestingFrequency: z.string().max(200).nullable().optional(),
  batchingCabinCameraAvailable: z.boolean().nullable().optional(), batchReportAvailable: z.boolean().nullable().optional(),
  batchReportLinkedWithTm: z.boolean().nullable().optional(), challanAvailable: z.boolean().nullable().optional(),
  challanLinkedWithTm: z.boolean().nullable().optional(), dieselGeneratorAvailable: z.boolean().nullable().optional(),
  dieselGeneratorCapacityKva: optionalNonNegative, supportingPlantAvailable: z.boolean().nullable().optional(),
  supportingPlantName: z.string().max(200).nullable().optional(), supportingPlantDistanceKm: optionalNonNegative,
  breakdownBackupDescription: z.string().max(2000).nullable().optional(), plantMake: z.string().max(200).nullable().optional(),
  plantModel: z.string().max(200).nullable().optional(), numberOfSilos: z.coerce.number().int().min(0).nullable().optional(),
  cementStorageCapacityMt: optionalNonNegative, flyAshStorageCapacityMt: optionalNonNegative,
  aggregateStorageCapacityMt: optionalNonNegative, weighbridgeAvailable: z.boolean().nullable().optional(),
  gpsTrackingAvailable: z.boolean().nullable().optional(), plantManagerAvailable: z.boolean().nullable().optional(),
  safetyOfficerAvailable: z.boolean().nullable().optional(), emergencySupportAvailable: z.boolean().nullable().optional(),
  cashPaymentAvailable: z.boolean().nullable().optional(), smallQuantityCashPaymentAvailable: z.boolean().nullable().optional(),
  creditPaymentAvailable: z.boolean().nullable().optional(), creditDaysMin: z.coerce.number().int().min(0).nullable().optional(),
  creditDaysMax: z.coerce.number().int().min(0).nullable().optional(), advancePaymentRequired: z.boolean().nullable().optional(),
  paymentTermsNotes: z.string().max(2000).nullable().optional(), additionalInformation: z.string().max(4000).nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.creditDaysMin != null && v.creditDaysMax != null && v.creditDaysMax < v.creditDaysMin) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'creditDaysMax must be greater than or equal to creditDaysMin' });
  }
});

function canEditPlant(req: any, plantId: number): boolean {
  return isPlatformStaff(req.user) || ((req.user.role === 'plant_owner' || req.user.role === 'admin') && req.user.plantId === plantId);
}
function cleanText(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return v as null | undefined;
  return String(v).replace(/<[^>]*>/g, '').trim();
}
function completion(v: Record<string, unknown>): number {
  const groups = [
    [15, ['productionCapacityM3PerHour', 'maximumDailySupplyCapacityM3']],
    [15, ['numberOfTransitMixers', 'inhouseConcretePumpAvailable']],
    [15, ['laboratoryAvailable', 'qualityEngineerAvailable']],
    [15, ['dieselGeneratorAvailable', 'batchingCabinCameraAvailable']],
    [10, ['supportingPlantAvailable']], [10, ['batchReportAvailable', 'challanAvailable']],
    [5, ['cashPaymentAvailable', 'creditPaymentAvailable']], [5, ['works24Hours', 'workingHoursStart']],
    [5, ['additionalInformation']], [5, ['minimumOrderQuantityM3']],
  ] as const;
  return groups.reduce((n, [weight, keys]) => n + (keys.some(k => v[k] !== null && v[k] !== undefined && v[k] !== '') ? weight : 0), 0);
}

router.get('/plants/:plantId/profile', requireAuth, async (req, res) => {
  const plantId = Number(req.params.plantId);
  if (!Number.isInteger(plantId)) return res.status(400).json({ error: 'Invalid plant id' });
  const [plant] = await db.select({ id: plants.id, name: plants.name, address: plants.address, city: plants.city, plantStatus: plants.plantStatus, isActive: plants.isActive, verified: plants.verified }).from(plants).where(eq(plants.id, plantId)).limit(1);
  if (!plant || plant.plantStatus !== 'approved' || !plant.isActive || !plant.verified) return res.status(404).json({ error: 'Plant not available' });
  const [profile] = await db.select().from(plantProfiles).where(eq(plantProfiles.plantId, plantId)).limit(1);
  if (!profile || (profile.profileStatus !== 'verified' && !canEditPlant(req, plantId))) {
    return res.json({ plant, profile: null, certificates: [], message: 'Detailed plant information has not been added yet.' });
  }
  const certs = await db.select({
    id: plantCertificates.id, certificateName: plantCertificates.certificateName,
    certificateStatus: plantCertificates.certificateStatus, certificateNumber: plantCertificates.certificateNumber,
    issuingAuthority: plantCertificates.issuingAuthority, issueDate: plantCertificates.issueDate,
    expiryDate: plantCertificates.expiryDate, verificationStatus: plantCertificates.verificationStatus,
    documentUrl: plantCertificates.documentUrl,
  }).from(plantCertificates).where(and(eq(plantCertificates.plantId, plantId), eq(plantCertificates.isVisibleToCustomer, true)));
  const safeCerts = certs.map(c => ({ ...c, documentUrl: c.documentUrl || null }));
  res.json({ plant, profile, certificates: safeCerts, pendingChanges: profile.profileStatus !== 'verified' });
});

router.put('/plants/:plantId/profile', requireAuth, async (req, res) => {
  const plantId = Number(req.params.plantId);
  if (!canEditPlant(req, plantId)) return res.status(403).json({ error: 'Not authorized for this plant' });
  const parsed = profileInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const values: any = { ...parsed.data };
  for (const key of ['laboratoryDetails','supportingPlantName','breakdownBackupDescription','plantMake','plantModel','paymentTermsNotes','additionalInformation']) values[key] = cleanText(values[key]);
  if (values.supportingPlantAvailable === false) { values.supportingPlantName = null; values.supportingPlantDistanceKm = null; values.breakdownBackupDescription = null; }
  if (values.creditPaymentAvailable === false) { values.creditDaysMin = null; values.creditDaysMax = null; }
  if (values.dieselGeneratorAvailable === false) values.dieselGeneratorCapacityKva = null;
  values.completionPercentage = completion(values);
  values.updatedBy = req.user!.id; values.updatedAt = new Date();
  const [row] = await db.insert(plantProfiles).values({ plantId, ...values, createdBy: req.user!.id }).onConflictDoUpdate({ target: plantProfiles.plantId, set: values }).returning();
  res.json(row);
});

router.post('/plants/:plantId/profile/submit', requireAuth, async (req, res) => {
  const plantId = Number(req.params.plantId);
  if (!canEditPlant(req, plantId)) return res.status(403).json({ error: 'Not authorized for this plant' });
  const [row] = await db.update(plantProfiles).set({ profileStatus: 'submitted', submittedAt: new Date(), updatedBy: req.user!.id, updatedAt: new Date() }).where(eq(plantProfiles.plantId, plantId)).returning();
  if (!row) return res.status(404).json({ error: 'Profile not found' });
  res.json(row);
});

router.post('/plants/:plantId/certificates', requireAuth, async (req, res) => {
  const plantId = Number(req.params.plantId);
  if (!canEditPlant(req, plantId)) return res.status(403).json({ error: 'Not authorized for this plant' });
  const schema = z.object({ certificateType: z.string().min(1), certificateName: z.string().min(1), certificateStatus: certificateStatus.default('available'), certificateNumber: z.string().nullable().optional(), issuingAuthority: z.string().nullable().optional(), issueDate: z.string().nullable().optional(), expiryDate: z.string().nullable().optional(), documentUrl: z.string().url().nullable().optional(), isVisibleToCustomer: z.boolean().default(false), ownerNotes: z.string().max(2000).nullable().optional() });
  const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(plantCertificates).values({ plantId, ...parsed.data, verificationStatus: 'pending', ownerNotes: cleanText(parsed.data.ownerNotes) }).returning();
  res.status(201).json(row);
});

router.delete('/plants/:plantId/certificates/:certificateId', requireAuth, async (req, res) => {
  const plantId = Number(req.params.plantId); if (!canEditPlant(req, plantId)) return res.status(403).json({ error: 'Not authorized' });
  const [row] = await db.delete(plantCertificates).where(and(eq(plantCertificates.id, Number(req.params.certificateId)), eq(plantCertificates.plantId, plantId), inArray(plantCertificates.verificationStatus, ['unverified','pending','rejected']))).returning();
  if (!row) return res.status(409).json({ error: 'Verified certificates cannot be deleted' });
  res.status(204).end();
});

router.get('/admin/plant-profiles/pending', requireAuth, requireRole('authority'), async (_req, res) => {
  res.json(await db.select().from(plantProfiles).where(inArray(plantProfiles.profileStatus, ['submitted','changes_requested'])).orderBy(asc(plantProfiles.submittedAt)));
});
router.post('/admin/plant-profiles/:plantId/verify', requireAuth, requireRole('authority'), async (req, res) => {
  const [row] = await db.update(plantProfiles).set({ profileStatus: 'verified', rejectionReason: null, reviewedAt: new Date(), reviewedBy: req.user!.id, updatedAt: new Date() }).where(eq(plantProfiles.plantId, Number(req.params.plantId))).returning();
  res.json(row);
});
router.post('/admin/plant-profiles/:plantId/reject', requireAuth, requireRole('authority'), async (req, res) => {
  const reason = z.string().min(3).max(1000).parse(req.body.reason);
  const [row] = await db.update(plantProfiles).set({ profileStatus: 'changes_requested', rejectionReason: cleanText(reason), reviewedAt: new Date(), reviewedBy: req.user!.id, updatedAt: new Date() }).where(eq(plantProfiles.plantId, Number(req.params.plantId))).returning();
  res.json(row);
});
router.post('/admin/plant-certificates/:certificateId/verify', requireAuth, requireRole('authority'), async (req, res) => {
  const method = verificationMethod.parse(req.body.verificationMethod ?? 'manual_confirmation');
  const [row] = await db.update(plantCertificates).set({ verificationStatus: 'verified', verificationMethod: method, verifiedBy: req.user!.id, verifiedAt: new Date(), updatedAt: new Date() }).where(eq(plantCertificates.id, Number(req.params.certificateId))).returning();
  res.json(row);
});
router.post('/admin/plant-certificates/:certificateId/reject', requireAuth, requireRole('authority'), async (req, res) => {
  const [row] = await db.update(plantCertificates).set({ verificationStatus: 'rejected', verifiedBy: req.user!.id, verifiedAt: new Date(), updatedAt: new Date() }).where(eq(plantCertificates.id, Number(req.params.certificateId))).returning();
  res.json(row);
});

const promotionInput = z.object({ plantId: z.coerce.number().int().positive(), packageType: packageType.default('standard'), promotionRadiusKm: z.coerce.number().positive().max(250).default(20), priorityRank: z.coerce.number().int().min(1).default(1), bannerTitle: z.string().min(1).max(100).default('Featured RMC Plant'), bannerSubtitle: z.string().max(200).nullable().optional(), showGlowingEffect: z.boolean().default(true), paymentStatus: paymentStatus.default('pending'), startAt: z.coerce.date(), endAt: z.coerce.date(), amountPaid: z.coerce.number().min(0).nullable().optional(), paymentReference: z.string().max(200).nullable().optional(), internalNotes: z.string().max(2000).nullable().optional() }).refine(v => v.endAt > v.startAt, { message: 'endAt must be after startAt' });
router.get('/admin/plant-promotions', requireAuth, requireRole('authority'), async (_req, res) => res.json(await db.select().from(plantPromotions).orderBy(asc(plantPromotions.priorityRank), desc(plantPromotions.updatedAt))));
router.post('/admin/plant-promotions', requireAuth, requireRole('authority'), async (req, res) => {
  const parsed = promotionInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(plantPromotions).values({ ...parsed.data, createdBy: req.user!.id, updatedBy: req.user!.id, internalNotes: cleanText(parsed.data.internalNotes) }).returning();
  res.status(201).json(row);
});
router.patch('/admin/plant-promotions/:promotionId', requireAuth, requireRole('authority'), async (req, res) => {
  const parsed = promotionInput.partial().safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [row] = await db.update(plantPromotions).set({ ...parsed.data, updatedBy: req.user!.id, updatedAt: new Date() }).where(eq(plantPromotions.id, Number(req.params.promotionId))).returning();
  res.json(row);
});
router.post('/admin/plant-promotions/:promotionId/activate', requireAuth, requireRole('authority'), async (req, res) => {
  const id = Number(req.params.promotionId); const [promotion] = await db.select().from(plantPromotions).where(eq(plantPromotions.id, id)).limit(1);
  if (!promotion || !['paid','waived'].includes(promotion.paymentStatus)) return res.status(409).json({ error: 'Promotion must be paid or waived before activation' });
  await db.update(plantPromotions).set({ isActive: false, updatedAt: new Date() }).where(eq(plantPromotions.plantId, promotion.plantId));
  const [row] = await db.update(plantPromotions).set({ isActive: true, approvedBy: req.user!.id, approvedAt: new Date(), suspendedAt: null, suspensionReason: null, updatedAt: new Date() }).where(eq(plantPromotions.id, id)).returning();
  res.json(row);
});
router.post('/admin/plant-promotions/:promotionId/pause', requireAuth, requireRole('authority'), async (req, res) => {
  const [row] = await db.update(plantPromotions).set({ isActive: false, updatedBy: req.user!.id, updatedAt: new Date() }).where(eq(plantPromotions.id, Number(req.params.promotionId))).returning(); res.json(row);
});
router.post('/admin/plant-promotions/:promotionId/suspend', requireAuth, requireRole('authority'), async (req, res) => {
  const [row] = await db.update(plantPromotions).set({ isActive: false, suspendedAt: new Date(), suspensionReason: cleanText(req.body.reason), updatedBy: req.user!.id, updatedAt: new Date() }).where(eq(plantPromotions.id, Number(req.params.promotionId))).returning(); res.json(row);
});

export default router;
