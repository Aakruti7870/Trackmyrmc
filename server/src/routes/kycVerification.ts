import { Router } from 'express';
import { eq, and, desc, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { kycProfiles, kycDocuments, users, vehicles, auditLogs } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { proofPhotoStore, isObjectStoragePath } from '../lib/proofPhoto.js';
import { plantScope } from '../lib/tenancy.js';
import { registerUploadedFileSafe, unregisterUploadedFilesSafe } from '../lib/uploadedFiles.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { assertKycTransition, isKycState, transitionRequiresReason, type KycState } from '../lib/kycStateMachine.js';

// ============================================================================
// KYC & Verification module. Additive on top of the legacy Aadhaar/DigiLocker
// eKYC (routes/kyc.ts) — this is the broader document-based compliance layer:
// every user role plus vehicles gets a KYC profile with uploaded documents,
// reviewed by staff via an approve/reject workflow. Audit history goes through
// the canonical audit_logs table tagged with [kyc#<profileId>].
// ============================================================================

const router = Router();
router.use(requireAuth);

// Who may review (approve/reject) KYC submissions and see the verification
// dashboard. plant_owner/admin are plant-scoped via plantScope; a null-plant
// admin/authority is platform staff and sees everything.
const REVIEW_ROLES = ['authority', 'admin', 'plant_owner'] as const;
// Who may manage VEHICLE KYC profiles (create/edit/submit + docs) for their
// plant's fleet. Roles below authority/admin MUST be plant-bound (see
// requireFleetScope) or plantScope would silently go global.
const VEHICLE_MANAGER_ROLES = ['authority', 'admin', 'plant_owner', 'supervisor', 'fleet_manager'] as const;

const MAX_OBJECT_PATH_CHARS = 1024;
const MAX_TEXT_CHARS = 200;

const DOC_TYPES = ['gst', 'pan', 'aadhaar', 'driving_license', 'rc', 'insurance', 'puc', 'fitness', 'photo', 'other'] as const;
type DocType = typeof DOC_TYPES[number];

// Which entity type a user-role account's own KYC profile is.
function entityTypeForRole(role: string): 'customer' | 'driver' | 'staff' | 'plant_owner' {
  if (role === 'client') return 'customer';
  if (role === 'driver') return 'driver';
  if (role === 'plant_owner') return 'plant_owner';
  return 'staff';
}

// ---------------------------------------------------------------------------
// Field validation. All identity numbers are optional but validated when
// present. Aadhaar is NEVER stored in full: we accept only the last 4 digits
// (or a value ending in them) and persist the masked form XXXX-XXXX-<last4>.
// ---------------------------------------------------------------------------
function cleanText(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${label} must be text`);
  const v = value.trim();
  if (v.length > MAX_TEXT_CHARS) throw new Error(`${label} is too long`);
  return v || null;
}

function parseGst(value: unknown): string | null {
  const v = cleanText(value, 'GST number');
  if (v === null) return null;
  const g = v.toUpperCase().replace(/\s+/g, '');
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(g)) {
    throw new Error('GST number must be a valid 15-character GSTIN');
  }
  return g;
}

function parsePan(value: unknown): string | null {
  const v = cleanText(value, 'PAN');
  if (v === null) return null;
  const p = v.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(p)) throw new Error('PAN must be a valid 10-character PAN');
  return p;
}

function parseAadhaarMasked(value: unknown): string | null {
  const v = cleanText(value, 'Aadhaar');
  if (v === null) return null;
  const digits = v.replace(/\D/g, '');
  // Refuse anything that looks like a full Aadhaar number — we only ever hold
  // the last 4 digits, in masked form.
  if (digits.length !== 4) throw new Error('Provide only the LAST 4 digits of Aadhaar (never the full number)');
  return `XXXX-XXXX-${digits}`;
}

function parseDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw new Error(`${label} must be a YYYY-MM-DD date`);
  }
  return value;
}

function parseDocType(value: unknown): DocType {
  if (typeof value !== 'string' || !DOC_TYPES.includes(value as DocType)) throw new Error('Invalid document type');
  return value as DocType;
}

function parseObjectPath(value: unknown): string {
  if (typeof value !== 'string' || !isObjectStoragePath(value)) throw new Error('Document must be an uploaded object path');
  if (value.length > MAX_OBJECT_PATH_CHARS) throw new Error('Document path is too long');
  return value;
}

// Profile fields accepted from the subject/manager. Throws on invalid input.
function parseProfileFields(body: Record<string, unknown>) {
  return {
    legalName: cleanText(body.legalName, 'Legal name'),
    gstNumber: parseGst(body.gstNumber),
    panNumber: parsePan(body.panNumber),
    dlNumber: cleanText(body.dlNumber, 'Driving licence number'),
    dlExpiry: parseDate(body.dlExpiry, 'Driving licence expiry'),
    aadhaarMasked: parseAadhaarMasked(body.aadhaarMasked),
    notes: cleanText(body.notes, 'Notes'),
  };
}

async function writeAudit(actor: { id: number; name: string }, action: string, profileId: number, targetUserId: number | null, detail: string) {
  await db.insert(auditLogs).values({
    actorId: actor.id,
    actorName: actor.name,
    action,
    targetUserId,
    status: 'ok',
    detail: `[kyc#${profileId}] ${detail}`,
  }).catch((e) => console.error('KYC audit write failed', e));
}

const profileSelect = {
  id: kycProfiles.id,
  entityType: kycProfiles.entityType,
  userId: kycProfiles.userId,
  vehicleId: kycProfiles.vehicleId,
  plantId: kycProfiles.plantId,
  status: kycProfiles.status,
  legalName: kycProfiles.legalName,
  gstNumber: kycProfiles.gstNumber,
  panNumber: kycProfiles.panNumber,
  dlNumber: kycProfiles.dlNumber,
  dlExpiry: kycProfiles.dlExpiry,
  aadhaarMasked: kycProfiles.aadhaarMasked,
  notes: kycProfiles.notes,
  submittedAt: kycProfiles.submittedAt,
  reviewedByName: kycProfiles.reviewedByName,
  reviewedAt: kycProfiles.reviewedAt,
  rejectionReason: kycProfiles.rejectionReason,
  createdAt: kycProfiles.createdAt,
  updatedAt: kycProfiles.updatedAt,
};

async function docsForProfile(profileId: number) {
  return db
    .select({
      id: kycDocuments.id,
      docType: kycDocuments.docType,
      fileName: kycDocuments.fileName,
      expiryDate: kycDocuments.expiryDate,
      createdAt: kycDocuments.createdAt,
    })
    .from(kycDocuments)
    .where(eq(kycDocuments.profileId, profileId))
    .orderBy(desc(kycDocuments.id));
}

// Notify the subject of a review decision over SSE, scoped to exactly them
// (client/driver identities are targetable; staff subjects fall back to a
// plant-scoped staff broadcast of their own role only).
async function notifySubject(profile: { userId: number | null; plantId: number | null; id: number; status: string }) {
  if (!profile.userId) return;
  const [u] = await db
    .select({ role: users.role, clientId: users.linkedClientId, driverId: users.linkedDriverId })
    .from(users)
    .where(eq(users.id, profile.userId));
  if (!u) return;
  const data = { profileId: profile.id, status: profile.status };
  if (u.role === 'client' && u.clientId) {
    emitSSEEvent('kyc.updated', data, { clientId: u.clientId });
  } else if (u.role === 'driver' && u.driverId) {
    emitSSEEvent('kyc.updated', data, { driverId: u.driverId });
  } else {
    emitSSEEvent('kyc.updated', data, { roles: [u.role], plantId: profile.plantId });
  }
}

// Roles below authority/admin must be plant-bound for fleet-wide vehicle KYC
// operations, otherwise plantScope(null) would silently widen to every plant.
function requireFleetScope(actor: { role: string; plantId?: number | null }): boolean {
  if (actor.role === 'authority' || actor.role === 'admin') return true;
  return actor.plantId != null;
}

// ---------------------------------------------------------------------------
// Shared: presigned upload URL (every role uploads its own KYC documents).
// ---------------------------------------------------------------------------
router.post('/upload-url', async (_req, res) => {
  try {
    const { uploadURL, objectPath } = await proofPhotoStore.createUploadUrl();
    res.json({ uploadURL, objectPath });
  } catch (e) {
    console.error('Failed to create KYC upload URL:', e);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// ---------------------------------------------------------------------------
// Self-service: my own KYC profile (all roles).
// ---------------------------------------------------------------------------
router.get('/me', async (req, res) => {
  const [profile] = await db.select(profileSelect).from(kycProfiles).where(eq(kycProfiles.userId, req.user!.id));
  if (!profile) { res.json({ profile: null, documents: [] }); return; }
  res.json({ profile, documents: await docsForProfile(profile.id) });
});

// Create/update my profile fields. Allowed while pending/rejected (or submitted,
// which drops it back to pending so the reviewer sees only final submissions).
router.put('/me', async (req, res) => {
  let fields: ReturnType<typeof parseProfileFields>;
  try {
    fields = parseProfileFields(req.body ?? {});
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid KYC fields' });
    return;
  }
  const actor = req.user!;
  const [existing] = await db.select({ id: kycProfiles.id, status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.userId, actor.id));
  if (existing && existing.status === 'verified') {
    res.status(409).json({ error: 'A verified KYC profile can no longer be edited. Contact an administrator.' });
    return;
  }
  if (existing) {
    const [row] = await db
      .update(kycProfiles)
      .set({ ...fields, status: existing.status === 'submitted' ? 'pending' : existing.status, updatedAt: new Date() })
      .where(eq(kycProfiles.id, existing.id))
      .returning();
    res.json(row);
    return;
  }
  const [row] = await db
    .insert(kycProfiles)
    .values({ entityType: entityTypeForRole(actor.role), userId: actor.id, plantId: actor.plantId ?? null, ...fields })
    .returning();
  res.status(201).json(row);
});

// Submit my profile for review.
router.post('/me/submit', async (req, res) => {
  const actor = req.user!;
  const [existing] = await db.select({ id: kycProfiles.id, status: kycProfiles.status, plantId: kycProfiles.plantId }).from(kycProfiles).where(eq(kycProfiles.userId, actor.id));
  if (!existing) { res.status(404).json({ error: 'Fill in your KYC details before submitting' }); return; }
  if (existing.status === 'verified') { res.status(409).json({ error: 'Already verified' }); return; }
  if (existing.status === 'submitted') { res.status(409).json({ error: 'Already submitted and awaiting review' }); return; }
  const [row] = await db
    .update(kycProfiles)
    .set({ status: 'submitted', submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
    .where(eq(kycProfiles.id, existing.id))
    .returning();
  await writeAudit(actor, 'kyc.submitted', existing.id, actor.id, `${actor.name} submitted their KYC profile for review`);
  emitSSEEvent('kyc.submitted', { profileId: existing.id }, { roles: [...REVIEW_ROLES], plantId: existing.plantId });
  res.json(row);
});

// Attach an uploaded document to my profile.
router.post('/me/documents', async (req, res) => {
  const actor = req.user!;
  let docType: DocType, objectPath: string, expiryDate: string | null, fileName: string | null;
  try {
    docType = parseDocType(req.body?.docType);
    objectPath = parseObjectPath(req.body?.objectPath);
    expiryDate = parseDate(req.body?.expiryDate, 'Expiry date');
    fileName = cleanText(req.body?.fileName, 'File name');
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid document' });
    return;
  }
  let [profile] = await db.select({ id: kycProfiles.id, status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.userId, actor.id));
  if (profile && profile.status === 'verified') {
    res.status(409).json({ error: 'A verified KYC profile can no longer be changed' });
    return;
  }
  if (!(await proofPhotoStore.verifyExists(objectPath))) {
    res.status(400).json({ error: 'Document upload was not found in storage' });
    return;
  }
  if (!profile) {
    const [created] = await db
      .insert(kycProfiles)
      .values({ entityType: entityTypeForRole(actor.role), userId: actor.id, plantId: actor.plantId ?? null })
      .returning({ id: kycProfiles.id, status: kycProfiles.status });
    profile = created;
  }
  const [doc] = await db
    .insert(kycDocuments)
    .values({ profileId: profile.id, docType, objectPath, fileName, expiryDate, uploadedBy: actor.id })
    .returning();
  await registerUploadedFileSafe({ storagePath: objectPath, fileType: 'kyc_document', plantId: actor.plantId ?? undefined, userId: actor.id });
  await writeAudit(actor, 'kyc.document.added', profile.id, actor.id, `added ${docType} document${expiryDate ? ` (expires ${expiryDate})` : ''}`);
  res.status(201).json({ id: doc.id, docType: doc.docType, fileName: doc.fileName, expiryDate: doc.expiryDate, createdAt: doc.createdAt });
});

// Remove one of my documents (while not verified).
router.delete('/me/documents/:id', async (req, res) => {
  const actor = req.user!;
  const id = +req.params.id;
  const [row] = await db
    .select({ id: kycDocuments.id, objectPath: kycDocuments.objectPath, docType: kycDocuments.docType, profileId: kycDocuments.profileId, status: kycProfiles.status, userId: kycProfiles.userId })
    .from(kycDocuments)
    .innerJoin(kycProfiles, eq(kycDocuments.profileId, kycProfiles.id))
    .where(eq(kycDocuments.id, id));
  if (!row || row.userId !== actor.id) { res.status(404).json({ error: 'Not found' }); return; }
  if (row.status === 'verified') { res.status(409).json({ error: 'A verified KYC profile can no longer be changed' }); return; }
  await db.delete(kycDocuments).where(eq(kycDocuments.id, id));
  await proofPhotoStore.remove(row.objectPath).catch(() => {});
  await unregisterUploadedFilesSafe([row.objectPath]);
  await writeAudit(actor, 'kyc.document.removed', row.profileId, actor.id, `removed ${row.docType} document`);
  res.json({ ok: true });
});

// Signed URL for one of my own documents.
router.get('/me/documents/:id/url', async (req, res) => {
  const id = +req.params.id;
  const [row] = await db
    .select({ objectPath: kycDocuments.objectPath, userId: kycProfiles.userId })
    .from(kycDocuments)
    .innerJoin(kycProfiles, eq(kycDocuments.profileId, kycProfiles.id))
    .where(eq(kycDocuments.id, id));
  if (!row || row.userId !== req.user!.id) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ url: await proofPhotoStore.resolve(row.objectPath) });
});

// ---------------------------------------------------------------------------
// Vehicle KYC (fleet managers, plant-scoped).
// ---------------------------------------------------------------------------

// Resolve a vehicle the actor may manage, or null (plant-scoped).
async function vehicleInScope(actor: { plantId?: number | null }, vehicleId: number) {
  const scope = plantScope(actor.plantId, vehicles.plantId);
  const idEq = eq(vehicles.id, vehicleId);
  const [v] = await db
    .select({ id: vehicles.id, plantId: vehicles.plantId, vehicleNo: vehicles.vehicleNo })
    .from(vehicles)
    .where(scope ? and(idEq, scope) : idEq);
  return v ?? null;
}

router.get('/vehicles/:vehicleId', requireRole(...VEHICLE_MANAGER_ROLES), async (req, res) => {
  const actor = req.user!;
  if (!requireFleetScope(actor)) { res.status(403).json({ error: 'Not bound to a plant' }); return; }
  const v = await vehicleInScope(actor, +req.params.vehicleId);
  if (!v) { res.status(404).json({ error: 'Vehicle not found' }); return; }
  const [profile] = await db.select(profileSelect).from(kycProfiles).where(eq(kycProfiles.vehicleId, v.id));
  if (!profile) { res.json({ vehicle: v, profile: null, documents: [] }); return; }
  res.json({ vehicle: v, profile, documents: await docsForProfile(profile.id) });
});

router.put('/vehicles/:vehicleId', requireRole(...VEHICLE_MANAGER_ROLES), async (req, res) => {
  const actor = req.user!;
  if (!requireFleetScope(actor)) { res.status(403).json({ error: 'Not bound to a plant' }); return; }
  const v = await vehicleInScope(actor, +req.params.vehicleId);
  if (!v) { res.status(404).json({ error: 'Vehicle not found' }); return; }
  let fields: ReturnType<typeof parseProfileFields>;
  try {
    fields = parseProfileFields(req.body ?? {});
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid KYC fields' });
    return;
  }
  const [existing] = await db.select({ id: kycProfiles.id, status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.vehicleId, v.id));
  if (existing) {
    if (existing.status === 'verified') { res.status(409).json({ error: 'A verified vehicle KYC can no longer be edited' }); return; }
    const [row] = await db
      .update(kycProfiles)
      .set({ ...fields, status: existing.status === 'submitted' ? 'pending' : existing.status, updatedAt: new Date() })
      .where(eq(kycProfiles.id, existing.id))
      .returning();
    res.json(row);
    return;
  }
  const [row] = await db
    .insert(kycProfiles)
    .values({ entityType: 'vehicle', vehicleId: v.id, plantId: v.plantId, ...fields })
    .returning();
  res.status(201).json(row);
});

router.post('/vehicles/:vehicleId/submit', requireRole(...VEHICLE_MANAGER_ROLES), async (req, res) => {
  const actor = req.user!;
  if (!requireFleetScope(actor)) { res.status(403).json({ error: 'Not bound to a plant' }); return; }
  const v = await vehicleInScope(actor, +req.params.vehicleId);
  if (!v) { res.status(404).json({ error: 'Vehicle not found' }); return; }
  const [existing] = await db.select({ id: kycProfiles.id, status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.vehicleId, v.id));
  if (!existing) { res.status(404).json({ error: 'Fill in the vehicle KYC details before submitting' }); return; }
  if (existing.status === 'verified') { res.status(409).json({ error: 'Already verified' }); return; }
  if (existing.status === 'submitted') { res.status(409).json({ error: 'Already submitted and awaiting review' }); return; }
  const [row] = await db
    .update(kycProfiles)
    .set({ status: 'submitted', submittedAt: new Date(), rejectionReason: null, updatedAt: new Date() })
    .where(eq(kycProfiles.id, existing.id))
    .returning();
  await writeAudit(actor, 'kyc.submitted', existing.id, null, `${actor.name} submitted vehicle ${v.vehicleNo} KYC for review`);
  emitSSEEvent('kyc.submitted', { profileId: existing.id }, { roles: [...REVIEW_ROLES], plantId: v.plantId });
  res.json(row);
});

router.post('/vehicles/:vehicleId/documents', requireRole(...VEHICLE_MANAGER_ROLES), async (req, res) => {
  const actor = req.user!;
  if (!requireFleetScope(actor)) { res.status(403).json({ error: 'Not bound to a plant' }); return; }
  const v = await vehicleInScope(actor, +req.params.vehicleId);
  if (!v) { res.status(404).json({ error: 'Vehicle not found' }); return; }
  let docType: DocType, objectPath: string, expiryDate: string | null, fileName: string | null;
  try {
    docType = parseDocType(req.body?.docType);
    objectPath = parseObjectPath(req.body?.objectPath);
    expiryDate = parseDate(req.body?.expiryDate, 'Expiry date');
    fileName = cleanText(req.body?.fileName, 'File name');
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid document' });
    return;
  }
  let [profile] = await db.select({ id: kycProfiles.id, status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.vehicleId, v.id));
  if (profile && profile.status === 'verified') { res.status(409).json({ error: 'A verified vehicle KYC can no longer be changed' }); return; }
  if (!(await proofPhotoStore.verifyExists(objectPath))) {
    res.status(400).json({ error: 'Document upload was not found in storage' });
    return;
  }
  if (!profile) {
    const [created] = await db
      .insert(kycProfiles)
      .values({ entityType: 'vehicle', vehicleId: v.id, plantId: v.plantId })
      .returning({ id: kycProfiles.id, status: kycProfiles.status });
    profile = created;
  }
  const [doc] = await db
    .insert(kycDocuments)
    .values({ profileId: profile.id, docType, objectPath, fileName, expiryDate, uploadedBy: actor.id })
    .returning();
  await registerUploadedFileSafe({ storagePath: objectPath, fileType: 'kyc_document', plantId: v.plantId ?? undefined, userId: actor.id });
  await writeAudit(actor, 'kyc.document.added', profile.id, null, `added ${docType} document for vehicle ${v.vehicleNo}${expiryDate ? ` (expires ${expiryDate})` : ''}`);
  res.status(201).json({ id: doc.id, docType: doc.docType, fileName: doc.fileName, expiryDate: doc.expiryDate, createdAt: doc.createdAt });
});

// ---------------------------------------------------------------------------
// Verification dashboard (reviewers).
// ---------------------------------------------------------------------------

// List profiles, filterable by status/entityType. Plant-scoped: a plant-bound
// reviewer sees only their plant's subjects; platform staff see everything.
router.get('/profiles', requireRole(...REVIEW_ROLES), async (req, res) => {
  const filters = [];
  const scope = plantScope(req.user!.plantId, kycProfiles.plantId);
  if (scope) filters.push(scope);
  const status = req.query.status;
  if (isKycState(status)) {
    filters.push(eq(kycProfiles.status, status));
  }
  const entityType = req.query.entityType;
  if (entityType === 'customer' || entityType === 'driver' || entityType === 'staff' || entityType === 'plant_owner' || entityType === 'vehicle') {
    filters.push(eq(kycProfiles.entityType, entityType));
  }
  const rows = await db
    .select({
      ...profileSelect,
      subjectName: users.name,
      subjectEmail: users.email,
      subjectRole: users.role,
      vehicleNo: vehicles.vehicleNo,
      docCount: sql<number>`(select count(*)::int from ${kycDocuments} where ${kycDocuments.profileId} = ${kycProfiles.id})`,
    })
    .from(kycProfiles)
    .leftJoin(users, eq(kycProfiles.userId, users.id))
    .leftJoin(vehicles, eq(kycProfiles.vehicleId, vehicles.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(kycProfiles.updatedAt));
  res.json(rows);
});

// Profile detail with documents + signed URLs + audit history.
router.get('/profiles/:id', requireRole(...REVIEW_ROLES), async (req, res) => {
  const id = +req.params.id;
  const scope = plantScope(req.user!.plantId, kycProfiles.plantId);
  const idEq = eq(kycProfiles.id, id);
  const [profile] = await db
    .select({ ...profileSelect, subjectName: users.name, subjectEmail: users.email, subjectRole: users.role, vehicleNo: vehicles.vehicleNo })
    .from(kycProfiles)
    .leftJoin(users, eq(kycProfiles.userId, users.id))
    .leftJoin(vehicles, eq(kycProfiles.vehicleId, vehicles.id))
    .where(scope ? and(idEq, scope) : idEq);
  if (!profile) { res.status(404).json({ error: 'Not found' }); return; }
  const docs = await db
    .select({
      id: kycDocuments.id,
      docType: kycDocuments.docType,
      fileName: kycDocuments.fileName,
      expiryDate: kycDocuments.expiryDate,
      objectPath: kycDocuments.objectPath,
      createdAt: kycDocuments.createdAt,
    })
    .from(kycDocuments)
    .where(eq(kycDocuments.profileId, id))
    .orderBy(desc(kycDocuments.id));
  const documents = await Promise.all(
    docs.map(async (d) => ({
      id: d.id, docType: d.docType, fileName: d.fileName, expiryDate: d.expiryDate, createdAt: d.createdAt,
      url: await proofPhotoStore.resolve(d.objectPath).catch(() => null),
    })),
  );
  const history = await db
    .select({ id: auditLogs.id, actorName: auditLogs.actorName, action: auditLogs.action, detail: auditLogs.detail, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(sql`${auditLogs.detail} LIKE ${`[kyc#${id}]%`}`)
    .orderBy(desc(auditLogs.id))
    .limit(50);
  res.json({ profile, documents, history });
});

// Approve / reject a submitted profile.
router.post('/profiles/:id/:decision(approve|reject)', requireRole(...REVIEW_ROLES), async (req, res) => {
  const id = +req.params.id;
  const decision = req.params.decision === 'approve' ? 'verified' : 'rejected';
  const actor = req.user!;
  const scope = plantScope(actor.plantId, kycProfiles.plantId);
  const idEq = eq(kycProfiles.id, id);
  const [existing] = await db
    .select({ id: kycProfiles.id, status: kycProfiles.status, userId: kycProfiles.userId, vehicleId: kycProfiles.vehicleId, plantId: kycProfiles.plantId })
    .from(kycProfiles)
    .where(scope ? and(idEq, scope) : idEq);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  // Nobody reviews their own KYC — not even a platform admin.
  if (existing.userId === actor.id) { res.status(403).json({ error: 'You cannot review your own KYC profile' }); return; }
  if (existing.status !== 'submitted' && existing.status !== 'under_review') {
    res.status(409).json({ error: 'Only a submitted or under-review profile can be reviewed' });
    return;
  }
  const reason = cleanText(req.body?.reason, 'Reason');
  if (decision === 'rejected' && !reason) {
    res.status(400).json({ error: 'A rejection reason is required' });
    return;
  }
  const startedReview = existing.status === 'submitted';
  const row = await db.transaction(async (tx) => {
    if (existing.status === 'submitted') {
      assertKycTransition('submitted', 'under_review', 'reviewer');
      await tx.update(kycProfiles).set({ status: 'under_review', updatedAt: new Date() }).where(eq(kycProfiles.id, id));
    }
    assertKycTransition('under_review', decision, 'reviewer');
    const [updated] = await tx.update(kycProfiles).set({
        status: decision, reviewedBy: actor.id, reviewedByName: actor.name,
        reviewedAt: new Date(), rejectionReason: decision === 'rejected' ? reason : null, updatedAt: new Date(),
      }).where(eq(kycProfiles.id, id)).returning();
    return updated;
  });
  if (startedReview) {
    await writeAudit(actor, 'kyc.under_review', id, existing.userId, 'started reviewing the KYC profile');
  }
  await writeAudit(
    actor,
    decision === 'verified' ? 'kyc.verified' : 'kyc.rejected',
    id,
    existing.userId,
    decision === 'verified' ? 'verified the KYC profile' : `rejected the KYC profile: ${reason}`,
  );
  await notifySubject({ id, userId: existing.userId, plantId: existing.plantId, status: decision });
  res.json(row);
});

// Administrative lifecycle transitions. Backend policy is authoritative; the
// UI cannot manufacture a verified/reactivated state.
router.post('/profiles/:id/transition', requireRole(...REVIEW_ROLES), async (req, res) => {
  const id = Number(req.params.id);
  const to = req.body?.status;
  const reason = cleanText(req.body?.reason, 'Reason');
  if (!Number.isInteger(id) || id <= 0 || !isKycState(to)) {
    res.status(400).json({ error: 'A valid profile id and KYC status are required' }); return;
  }
  const actor = req.user!;
  const scope = plantScope(actor.plantId, kycProfiles.plantId);
  const idEq = eq(kycProfiles.id, id);
  const [existing] = await db.select({ status: kycProfiles.status, userId: kycProfiles.userId, plantId: kycProfiles.plantId })
    .from(kycProfiles).where(scope ? and(idEq, scope) : idEq);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (existing.userId === actor.id) { res.status(403).json({ error: 'You cannot transition your own KYC profile' }); return; }
  try { assertKycTransition(existing.status as KycState, to, 'reviewer'); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Invalid KYC transition' }); return; }
  if (transitionRequiresReason(existing.status as KycState, to) && !reason) {
    res.status(400).json({ error: 'A reason is required for this KYC transition' }); return;
  }
  const [row] = await db.update(kycProfiles).set({
    status: to, reviewedBy: actor.id, reviewedByName: actor.name, reviewedAt: new Date(),
    rejectionReason: to === 'rejected' || to === 'suspended' || to === 'revoked' ? reason : null,
    updatedAt: new Date(),
  }).where(eq(kycProfiles.id, id)).returning();
  await writeAudit(actor, `kyc.${to}`, id, existing.userId, `${existing.status} -> ${to}: ${reason ?? 'no reason required'}`);
  await notifySubject({ id, userId: existing.userId, plantId: existing.plantId, status: to });
  res.json(row);
});

// Documents expiring within ?days= (default 30), plant-scoped. Powers the
// dashboard's "expiring soon" panel.
router.get('/expiring', requireRole(...REVIEW_ROLES), async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const filters = [isNotNull(kycDocuments.expiryDate), lte(kycDocuments.expiryDate, cutoff)];
  const scope = plantScope(req.user!.plantId, kycProfiles.plantId);
  if (scope) filters.push(scope);
  const rows = await db
    .select({
      id: kycDocuments.id,
      docType: kycDocuments.docType,
      fileName: kycDocuments.fileName,
      expiryDate: kycDocuments.expiryDate,
      profileId: kycProfiles.id,
      entityType: kycProfiles.entityType,
      subjectName: users.name,
      vehicleNo: vehicles.vehicleNo,
    })
    .from(kycDocuments)
    .innerJoin(kycProfiles, eq(kycDocuments.profileId, kycProfiles.id))
    .leftJoin(users, eq(kycProfiles.userId, users.id))
    .leftJoin(vehicles, eq(kycProfiles.vehicleId, vehicles.id))
    .where(and(...filters))
    .orderBy(kycDocuments.expiryDate);
  res.json(rows);
});

// Bulk verification badges: kyc status per user/vehicle id, for list screens.
// Staff-only; plant-scoped like every other aggregate.
router.get('/badges', requireRole(...REVIEW_ROLES, 'supervisor', 'fleet_manager', 'dispatcher'), async (req, res) => {
  // Roles below authority/admin must be plant-bound, otherwise plantScope(null)
  // silently widens to every plant and leaks cross-tenant KYC status.
  if (!requireFleetScope(req.user!)) {
    res.status(403).json({ error: 'Your account is not bound to a plant' });
    return;
  }
  const entity = req.query.entity === 'vehicle' ? 'vehicle' : 'user';
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((s) => +s)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 500);
  if (!ids.length) { res.json({}); return; }
  const filters = [entity === 'vehicle' ? inArray(kycProfiles.vehicleId, ids) : inArray(kycProfiles.userId, ids)];
  const scope = plantScope(req.user!.plantId, kycProfiles.plantId);
  if (scope) filters.push(scope);
  const rows = await db
    .select({ userId: kycProfiles.userId, vehicleId: kycProfiles.vehicleId, status: kycProfiles.status })
    .from(kycProfiles)
    .where(and(...filters));
  const map: Record<number, string> = {};
  for (const r of rows) {
    const key = entity === 'vehicle' ? r.vehicleId : r.userId;
    if (key != null) map[key] = r.status;
  }
  res.json(map);
});

export default router;
