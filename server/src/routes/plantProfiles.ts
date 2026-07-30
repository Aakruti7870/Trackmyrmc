import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { plantCertificates, plantProfiles, plantPromotions } from '../db/plantProfileSchema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';

const router = Router();
const certificateStatus = z.enum(['available', 'not_available', 'applied', 'expired', 'not_applicable']);
const verificationMethod = z.enum(['document_review', 'manual_confirmation', 'physical_verification', 'external_verification', 'not_verified']);
const paymentStatus = z.enum(['pending', 'paid', 'waived', 'refunded', 'cancelled']);
const optionalNonNegative = z.coerce.number().min(0).nullable().optional();
const decimalFields = ['productionCapacityM3PerHour','maximumDailySupplyCapacityM3','minimumOrderQuantityM3','dieselGeneratorCapacityKva','supportingPlantDistanceKm','cementStorageCapacityMt','flyAshStorageCapacityMt','aggregateStorageCapacityMt'] as const;

const profileInput = z.object({
  productionCapacityM3PerHour: z.coerce.number().positive().nullable().optional(), maximumDailySupplyCapacityM3: optionalNonNegative,
  numberOfTransitMixers: z.coerce.number().int().min(0).nullable().optional(), numberOfPumps: z.coerce.number().int().min(0).nullable().optional(),
  inhouseConcretePumpAvailable: z.boolean().nullable().optional(), externalPumpArrangementAvailable: z.boolean().nullable().optional(), works24Hours: z.boolean().optional(),
  workingHoursStart: z.string().nullable().optional(), workingHoursEnd: z.string().nullable().optional(), minimumOrderQuantityM3: optionalNonNegative,
  laboratoryAvailable: z.boolean().nullable().optional(), laboratoryDetails: z.string().max(2000).nullable().optional(), qualityEngineerAvailable: z.boolean().nullable().optional(),
  cubeTestingAvailable: z.boolean().nullable().optional(), cubeTestingReportsAvailable: z.boolean().nullable().optional(), cubeTestingFrequency: z.string().max(200).nullable().optional(),
  batchingCabinCameraAvailable: z.boolean().nullable().optional(), batchReportAvailable: z.boolean().nullable().optional(), batchReportLinkedWithTm: z.boolean().nullable().optional(),
  challanAvailable: z.boolean().nullable().optional(), challanLinkedWithTm: z.boolean().nullable().optional(), dieselGeneratorAvailable: z.boolean().nullable().optional(), dieselGeneratorCapacityKva: optionalNonNegative,
  supportingPlantAvailable: z.boolean().nullable().optional(), supportingPlantName: z.string().max(200).nullable().optional(), supportingPlantDistanceKm: optionalNonNegative,
  breakdownBackupDescription: z.string().max(2000).nullable().optional(), plantMake: z.string().max(200).nullable().optional(), plantModel: z.string().max(200).nullable().optional(),
  numberOfSilos: z.coerce.number().int().min(0).nullable().optional(), cementStorageCapacityMt: optionalNonNegative, flyAshStorageCapacityMt: optionalNonNegative, aggregateStorageCapacityMt: optionalNonNegative,
  weighbridgeAvailable: z.boolean().nullable().optional(), gpsTrackingAvailable: z.boolean().nullable().optional(), plantManagerAvailable: z.boolean().nullable().optional(),
  safetyOfficerAvailable: z.boolean().nullable().optional(), emergencySupportAvailable: z.boolean().nullable().optional(), cashPaymentAvailable: z.boolean().nullable().optional(),
  smallQuantityCashPaymentAvailable: z.boolean().nullable().optional(), creditPaymentAvailable: z.boolean().nullable().optional(), creditDaysMin: z.coerce.number().int().min(0).nullable().optional(),
  creditDaysMax: z.coerce.number().int().min(0).nullable().optional(), advancePaymentRequired: z.boolean().nullable().optional(), paymentTermsNotes: z.string().max(2000).nullable().optional(),
  additionalInformation: z.string().max(4000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.creditDaysMin != null && value.creditDaysMax != null && value.creditDaysMax < value.creditDaysMin) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'creditDaysMax must be greater than or equal to creditDaysMin' });
});

function paramId(raw: unknown): number | null {
  const scalar = Array.isArray(raw) ? raw[0] : raw;
  const value = Number(scalar);
  return Number.isInteger(value) && value > 0 ? value : null;
}
function canEditPlant(req: any, plantId: number): boolean {
  return isPlatformStaff(req.user!) || ((req.user?.role === 'plant_owner' || req.user?.role === 'admin') && req.user?.plantId === plantId);
}
function cleanText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value as null | undefined;
  return String(value).replace(/<[^>]*>/g, '').trim();
}
function completion(value: Record<string, unknown>): number {
  const groups: Array<[number, string[]]> = [[15,['productionCapacityM3PerHour','maximumDailySupplyCapacityM3']],[15,['numberOfTransitMixers','inhouseConcretePumpAvailable']],[15,['laboratoryAvailable','qualityEngineerAvailable']],[15,['dieselGeneratorAvailable','batchingCabinCameraAvailable']],[10,['supportingPlantAvailable']],[10,['batchReportAvailable','challanAvailable']],[5,['cashPaymentAvailable','creditPaymentAvailable']],[5,['works24Hours','workingHoursStart']],[5,['additionalInformation']],[5,['minimumOrderQuantityM3']]];
  return groups.reduce((total,[weight,keys]) => total + (keys.some(key => value[key] !== null && value[key] !== undefined && value[key] !== '') ? weight : 0), 0);
}
function normalizedProfile(input: Record<string, unknown>): Record<string, unknown> {
  const values = { ...input };
  for (const key of ['laboratoryDetails','supportingPlantName','breakdownBackupDescription','plantMake','plantModel','paymentTermsNotes','additionalInformation']) values[key] = cleanText(values[key]);
  for (const key of decimalFields) if (values[key] !== undefined && values[key] !== null) values[key] = String(values[key]);
  if (values.supportingPlantAvailable === false) { values.supportingPlantName = null; values.supportingPlantDistanceKm = null; values.breakdownBackupDescription = null; }
  if (values.creditPaymentAvailable === false) { values.creditDaysMin = null; values.creditDaysMax = null; }
  if (values.dieselGeneratorAvailable === false) values.dieselGeneratorCapacityKva = null;
  return values;
}
function publicProfile(profile: typeof plantProfiles.$inferSelect) {
  const { id: _id, completionPercentage: _completion, rejectionReason: _rejection, submittedAt: _submitted, reviewedAt, reviewedBy: _reviewedBy, createdBy: _createdBy, updatedBy: _updatedBy, createdAt: _createdAt, updatedAt: _updatedAt, ...safe } = profile;
  return { ...safe, verifiedAt: reviewedAt };
}

router.get('/plants/:plantId/profile', requireAuth, async (req, res) => {
  const plantId = paramId(req.params.plantId); if (!plantId) return res.status(400).json({ error: 'Invalid plant id' });
  const [plant] = await db.select({ id:plants.id,name:plants.name,address:plants.address,city:plants.city,plantStatus:plants.plantStatus,isActive:plants.isActive,verified:plants.verified }).from(plants).where(eq(plants.id,plantId)).limit(1);
  if (!plant || plant.plantStatus !== 'approved' || !plant.isActive || !plant.verified) return res.status(404).json({ error:'Plant not available' });
  const editor = canEditPlant(req, plantId);
  const [profile] = await db.select().from(plantProfiles).where(eq(plantProfiles.plantId,plantId)).limit(1);
  if (!profile) return res.json({ plant,profile:null,certificates:[],message:'Detailed plant information has not been added yet.' });
  if (!editor && profile.profileStatus !== 'verified') return res.json({ plant,profile:null,certificates:[],message:'Some plant information is awaiting verification.',pendingChanges:true });
  const certificates = editor
    ? await db.select().from(plantCertificates).where(eq(plantCertificates.plantId,plantId))
    : await db.select({ id:plantCertificates.id,certificateName:plantCertificates.certificateName,certificateStatus:plantCertificates.certificateStatus,certificateNumber:plantCertificates.certificateNumber,issuingAuthority:plantCertificates.issuingAuthority,issueDate:plantCertificates.issueDate,expiryDate:plantCertificates.expiryDate,verificationStatus:plantCertificates.verificationStatus,documentUrl:plantCertificates.documentUrl }).from(plantCertificates).where(and(eq(plantCertificates.plantId,plantId),eq(plantCertificates.isVisibleToCustomer,true)));
  return res.json({ plant,profile:editor ? profile : publicProfile(profile),certificates:editor ? certificates : certificates.map(c => ({...c,documentUrl:c.documentUrl || null})),pendingChanges:profile.profileStatus !== 'verified' });
});

router.put('/plants/:plantId/profile', requireAuth, async (req,res) => {
  const plantId=paramId(req.params.plantId); if(!plantId)return res.status(400).json({error:'Invalid plant id'}); if(!canEditPlant(req,plantId))return res.status(403).json({error:'Not authorized for this plant'});
  const parsed=profileInput.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});
  const [existing]=await db.select().from(plantProfiles).where(eq(plantProfiles.plantId,plantId)).limit(1);
  const values=normalizedProfile(parsed.data as Record<string,unknown>); values.completionPercentage=completion(values); values.updatedBy=req.user!.id; values.updatedAt=new Date();
  if(!isPlatformStaff(req.user!)){ values.profileStatus='draft'; values.reviewedAt=null; values.reviewedBy=null; values.rejectionReason=null; } else if(existing) values.profileStatus=existing.profileStatus;
  const [row]=await db.insert(plantProfiles).values({plantId,...values,createdBy:req.user!.id} as any).onConflictDoUpdate({target:plantProfiles.plantId,set:values as any}).returning(); return res.json(row);
});
router.post('/plants/:plantId/profile/submit',requireAuth,async(req,res)=>{const plantId=paramId(req.params.plantId);if(!plantId)return res.status(400).json({error:'Invalid plant id'});if(!canEditPlant(req,plantId))return res.status(403).json({error:'Not authorized for this plant'});const [row]=await db.update(plantProfiles).set({profileStatus:'submitted',submittedAt:new Date(),updatedBy:req.user!.id,updatedAt:new Date()}).where(eq(plantProfiles.plantId,plantId)).returning();if(!row)return res.status(404).json({error:'Profile not found'});return res.json(row);});

const certificateInput=z.object({certificateType:z.string().min(1),certificateName:z.string().min(1),certificateStatus:certificateStatus.default('available'),certificateNumber:z.string().nullable().optional(),issuingAuthority:z.string().nullable().optional(),issueDate:z.string().nullable().optional(),expiryDate:z.string().nullable().optional(),documentUrl:z.string().url().nullable().optional(),isVisibleToCustomer:z.boolean().default(false),ownerNotes:z.string().max(2000).nullable().optional()});
router.post('/plants/:plantId/certificates',requireAuth,async(req,res)=>{const plantId=paramId(req.params.plantId);if(!plantId)return res.status(400).json({error:'Invalid plant id'});if(!canEditPlant(req,plantId))return res.status(403).json({error:'Not authorized for this plant'});const parsed=certificateInput.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});const [row]=await db.insert(plantCertificates).values({plantId,...parsed.data,verificationStatus:'pending',ownerNotes:cleanText(parsed.data.ownerNotes)}).returning();return res.status(201).json(row);});
router.patch('/plants/:plantId/certificates/:certificateId',requireAuth,async(req,res)=>{const plantId=paramId(req.params.plantId),certificateId=paramId(req.params.certificateId);if(!plantId||!certificateId)return res.status(400).json({error:'Invalid id'});if(!canEditPlant(req,plantId))return res.status(403).json({error:'Not authorized'});const parsed=certificateInput.partial().safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});const [existing]=await db.select().from(plantCertificates).where(and(eq(plantCertificates.id,certificateId),eq(plantCertificates.plantId,plantId))).limit(1);if(!existing)return res.status(404).json({error:'Certificate not found'});const [row]=await db.update(plantCertificates).set({...parsed.data,ownerNotes:cleanText(parsed.data.ownerNotes),verificationStatus:'pending',verificationMethod:'not_verified',verifiedBy:null,verifiedAt:null,updatedAt:new Date()}).where(eq(plantCertificates.id,certificateId)).returning();return res.json(row);});
router.delete('/plants/:plantId/certificates/:certificateId',requireAuth,async(req,res)=>{const plantId=paramId(req.params.plantId),certificateId=paramId(req.params.certificateId);if(!plantId||!certificateId)return res.status(400).json({error:'Invalid id'});if(!canEditPlant(req,plantId))return res.status(403).json({error:'Not authorized'});const [row]=await db.delete(plantCertificates).where(and(eq(plantCertificates.id,certificateId),eq(plantCertificates.plantId,plantId),inArray(plantCertificates.verificationStatus,['unverified','pending','rejected']))).returning();if(!row)return res.status(409).json({error:'Verified certificates cannot be deleted'});return res.status(204).end();});

router.get('/admin/plant-profiles/pending',requireAuth,requireRole('authority'),async(_req,res)=>res.json(await db.select().from(plantProfiles).where(inArray(plantProfiles.profileStatus,['submitted','changes_requested'])).orderBy(asc(plantProfiles.submittedAt))));
router.get('/admin/plant-profiles/:plantId',requireAuth,requireRole('authority'),async(req,res)=>{const plantId=paramId(req.params.plantId);if(!plantId)return res.status(400).json({error:'Invalid plant id'});const [profile]=await db.select().from(plantProfiles).where(eq(plantProfiles.plantId,plantId)).limit(1);if(!profile)return res.status(404).json({error:'Profile not found'});return res.json({profile,certificates:await db.select().from(plantCertificates).where(eq(plantCertificates.plantId,plantId))});});
router.post('/admin/plant-profiles/:plantId/verify',requireAuth,requireRole('authority'),async(req,res)=>{const plantId=paramId(req.params.plantId);if(!plantId)return res.status(400).json({error:'Invalid plant id'});const [row]=await db.update(plantProfiles).set({profileStatus:'verified',rejectionReason:null,reviewedAt:new Date(),reviewedBy:req.user!.id,updatedAt:new Date()}).where(eq(plantProfiles.plantId,plantId)).returning();if(!row)return res.status(404).json({error:'Profile not found'});return res.json(row);});
router.post('/admin/plant-profiles/:plantId/reject',requireAuth,requireRole('authority'),async(req,res)=>{const plantId=paramId(req.params.plantId);if(!plantId)return res.status(400).json({error:'Invalid plant id'});const reason=z.string().min(3).max(1000).parse(req.body.reason);const [row]=await db.update(plantProfiles).set({profileStatus:'changes_requested',rejectionReason:cleanText(reason),reviewedAt:new Date(),reviewedBy:req.user!.id,updatedAt:new Date()}).where(eq(plantProfiles.plantId,plantId)).returning();if(!row)return res.status(404).json({error:'Profile not found'});return res.json(row);});
router.post('/admin/plant-certificates/:certificateId/verify',requireAuth,requireRole('authority'),async(req,res)=>{const id=paramId(req.params.certificateId);if(!id)return res.status(400).json({error:'Invalid certificate id'});const method=verificationMethod.parse(req.body.verificationMethod??'manual_confirmation');const [row]=await db.update(plantCertificates).set({verificationStatus:'verified',verificationMethod:method,verifiedBy:req.user!.id,verifiedAt:new Date(),updatedAt:new Date()}).where(eq(plantCertificates.id,id)).returning();if(!row)return res.status(404).json({error:'Certificate not found'});return res.json(row);});
router.post('/admin/plant-certificates/:certificateId/reject',requireAuth,requireRole('authority'),async(req,res)=>{const id=paramId(req.params.certificateId);if(!id)return res.status(400).json({error:'Invalid certificate id'});const [row]=await db.update(plantCertificates).set({verificationStatus:'rejected',verificationMethod:'not_verified',verifiedBy:req.user!.id,verifiedAt:new Date(),updatedAt:new Date()}).where(eq(plantCertificates.id,id)).returning();if(!row)return res.status(404).json({error:'Certificate not found'});return res.json(row);});

const promotionInput=z.object({plantId:z.coerce.number().int().positive(),priorityRank:z.coerce.number().int().min(1).default(1),paymentStatus:paymentStatus.default('paid'),startAt:z.coerce.date(),endAt:z.coerce.date(),amountPaid:z.coerce.number().min(0).nullable().optional(),paymentReference:z.string().max(200).nullable().optional(),internalNotes:z.string().max(2000).nullable().optional()}).refine(v=>v.endAt>v.startAt,{message:'endAt must be after startAt'});
router.get('/admin/plant-promotions',requireAuth,requireRole('authority'),async(_req,res)=>res.json(await db.select().from(plantPromotions).orderBy(asc(plantPromotions.priorityRank),desc(plantPromotions.updatedAt))));
router.post('/admin/plant-promotions',requireAuth,requireRole('authority'),async(req,res)=>{const parsed=promotionInput.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:parsed.error.flatten()});const [plant]=await db.select().from(plants).where(eq(plants.id,parsed.data.plantId)).limit(1);if(!plant||plant.plantStatus!=='approved'||!plant.isActive||!plant.verified||!plant.locationVerified||plant.networkStatus!=='active'||!plant.showOnNetwork)return res.status(409).json({error:'Only an approved, active and location-verified plant can be activated.'});const [row]=await db.insert(plantPromotions).values({plantId:parsed.data.plantId,packageType:'custom',promotionRadiusKm:'15',priorityRank:parsed.data.priorityRank,bannerTitle:'',bannerSubtitle:null,showGlowingEffect:true,paymentStatus:parsed.data.paymentStatus,startAt:parsed.data.startAt,endAt:parsed.data.endAt,amountPaid:parsed.data.amountPaid==null?null:String(parsed.data.amountPaid),paymentReference:cleanText(parsed.data.paymentReference),internalNotes:cleanText(parsed.data.internalNotes),createdBy:req.user!.id,updatedBy:req.user!.id}).returning();return res.status(201).json(row);});
router.post('/admin/plant-promotions/:promotionId/activate',requireAuth,requireRole('authority'),async(req,res)=>{const id=paramId(req.params.promotionId);if(!id)return res.status(400).json({error:'Invalid promotion id'});const [promotion]=await db.select().from(plantPromotions).where(eq(plantPromotions.id,id)).limit(1);if(!promotion||!['paid','waived'].includes(promotion.paymentStatus))return res.status(409).json({error:'Paid Ad must be paid or waived before activation'});if(promotion.endAt<=new Date())return res.status(409).json({error:'Paid Ad has already expired'});await db.update(plantPromotions).set({isActive:false,updatedAt:new Date()}).where(eq(plantPromotions.plantId,promotion.plantId));const [row]=await db.update(plantPromotions).set({isActive:true,promotionRadiusKm:'15',showGlowingEffect:true,approvedBy:req.user!.id,approvedAt:new Date(),suspendedAt:null,suspensionReason:null,updatedBy:req.user!.id,updatedAt:new Date()}).where(eq(plantPromotions.id,id)).returning();return res.json(row);});
router.post('/admin/plant-promotions/:promotionId/pause',requireAuth,requireRole('authority'),async(req,res)=>{const id=paramId(req.params.promotionId);if(!id)return res.status(400).json({error:'Invalid promotion id'});const [row]=await db.update(plantPromotions).set({isActive:false,updatedBy:req.user!.id,updatedAt:new Date()}).where(eq(plantPromotions.id,id)).returning();if(!row)return res.status(404).json({error:'Paid Ad not found'});return res.json(row);});
router.post('/admin/plant-promotions/:promotionId/suspend',requireAuth,requireRole('authority'),async(req,res)=>{const id=paramId(req.params.promotionId);if(!id)return res.status(400).json({error:'Invalid promotion id'});const [row]=await db.update(plantPromotions).set({isActive:false,suspendedAt:new Date(),suspensionReason:cleanText(req.body.reason),updatedBy:req.user!.id,updatedAt:new Date()}).where(eq(plantPromotions.id,id)).returning();if(!row)return res.status(404).json({error:'Paid Ad not found'});return res.json(row);});

// Plant owner can read their own plant's current promotion window.
router.get('/plant-promotions/window', requireAuth, requireRole('plant_owner'), async (req, res) => {
  if (req.user!.plantId == null) return res.status(403).json({ error: 'Not authorized: unbound account cannot access promotion window' });
  const plantId = req.user!.plantId;
  const [row] = await db.select({ id: plantPromotions.id, startAt: plantPromotions.startAt, endAt: plantPromotions.endAt, isActive: plantPromotions.isActive, paymentStatus: plantPromotions.paymentStatus }).from(plantPromotions).where(eq(plantPromotions.plantId, plantId)).limit(1);
  if (!row) return res.status(404).json({ error: 'No promotion found for your plant' });
  return res.json(row);
});

// Plant owner can update their own plant's promotion window (dates only).
// They can NOT activate, pause, or suspend — only set start/end times.
const promotionWindowInput = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
}).refine(v => v.endAt > v.startAt, { message: 'endAt must be after startAt' });

router.put('/plant-promotions/window', requireAuth, requireRole('plant_owner'), async (req, res) => {
  // Only plant-scoped (bound) plant owners may call this.
  if (req.user!.plantId == null) return res.status(403).json({ error: 'Not authorized: unbound account cannot manage a promotion window' });
  const plantId = req.user!.plantId;
  const parsed = promotionWindowInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { startAt, endAt } = parsed.data;
  // Find the promotion for this plant.
  const [existing] = await db.select().from(plantPromotions).where(eq(plantPromotions.plantId, plantId)).limit(1);
  if (!existing) return res.status(404).json({ error: 'No promotion found for your plant' });
  const [row] = await db.update(plantPromotions).set({ startAt, endAt, updatedBy: req.user!.id, updatedAt: new Date() }).where(and(eq(plantPromotions.id, existing.id), eq(plantPromotions.plantId, plantId))).returning();
  if (!row) return res.status(404).json({ error: 'Promotion not found' });
  return res.json(row);
});

export default router;
