import { Router } from 'express';
import { eq, and, isNull, sql, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { plants, users, auditLogs, plantInvites, passwordSetupTokens, rateCards } from '../db/schema.js';
import { randomBytes } from 'node:crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { sendWelcomeEmail, sendOwnerInviteEmail, sendPlantInviteNotification } from '../lib/email.js';
import { getPlantInviteNotifyConfig, DEFAULT_PLANT_INVITE_EMAIL_ENABLED, DEFAULT_PLANT_INVITE_NOTIFY_ROLES, } from '../lib/plantInviteNotify.js';
import { createInviteToken } from '../lib/inviteToken.js';
import { rateLimit } from '../lib/rateLimit.js';
import { discoverConcretePlants, discoverSuppliers, isDiscoveryConfigured, isSupplierCategoryKey, SUPPLIER_CATEGORIES, } from '../lib/places.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';
import { canCreateRole, roleLimit, isPlatformStaff } from '../lib/roleHierarchy.js';
import { extractDocumentFields, isGeminiConfigured } from '../lib/gemini.js';
import { ObjectStorageService } from '../replit_integrations/object_storage/index.js';
import { parseCsv } from '../lib/csv.js';
import { SUBSCRIPTION_STATUSES, SUBSCRIPTION_PLANS, } from '../lib/subscription.js';
// Build the public base URL the owner-invite link points at. Prefers an
// explicit env override (so emails work behind a custom domain in production),
// then the proxy-forwarded host, finally the request's own host. This matches
// whatever domain staff are actually using to provision the owner.
function appBaseUrl(req) {
    const envUrl = process.env.APP_URL || process.env.PUBLIC_URL;
    if (envUrl)
        return envUrl.replace(/\/+$/, '');
    const fwdProto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
    const proto = fwdProto || req.protocol || 'https';
    const host = String(req.headers['x-forwarded-host'] ?? req.headers['host'] ?? '').trim();
    return `${proto}://${host}`;
}
const router = Router();
// Great-circle distance in km between two lat/lng points.
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// Is the plant open right now, given 'HH:MM' open/close in its local (IST) time?
// `nowUtcMs` is injectable for tests; defaults to the real clock.
export function isOpenNow(openTime, closeTime, nowUtcMs = Date.now()) {
    if (!openTime || !closeTime)
        return false;
    const now = new Date(nowUtcMs + 5.5 * 3600000); // shift UTC -> IST
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const toMin = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
    };
    const open = toMin(openTime);
    const close = toMin(closeTime);
    if (close <= open)
        return mins >= open || mins < close; // crosses midnight
    return mins >= open && mins < close;
}
const ADMIN = requireRole('authority', 'admin');
// Who may view/provision a plant's logins. Adds plant_owner to the platform
// staff so an owner can manage their own plant's team. Plant-scoped callers are
// further restricted to their own plant inside each handler.
const OWNER_PROVISIONERS = requireRole('authority', 'admin', 'plant_owner');
// Platform staff (the Super Owner, or a global admin not bound to a single
// plant) sit at the top of the chain: they onboard plants and may seed any owner
// role. Plant-scoped callers (a plant_owner, or an admin bound to one plant) are
// governed by the role hierarchy and may only act on their own plant.
// (isPlatformStaff is shared from lib/roleHierarchy.)
// Global plant administration (the directory itself, invite queue, create / edit
// / delete) is platform-staff territory. A plant-scoped admin (role `admin` bound
// to one plant) satisfies `requireRole('admin')` but must NOT reach across
// tenants to list, edit or delete every plant — they manage their own plant's
// team through the owner console (/:id/owner). Legacy global admins have
// plantId == null, so this stays backward-compatible for pre-existing accounts.
const platformStaffOnly = (req, res, next) => {
    if (!isPlatformStaff(req.user)) {
        res.status(403).json({ error: 'Global plant administration is restricted to platform staff. Manage your plant from the owner console.' });
        return;
    }
    next();
};
// Customer-facing: approved + active + location-verified plants within radius km,
// nearest first. Never exposes status/verification internals. Login-only — only a
// signed-in user (customers reach it via the post-login GPS discovery screen) may
// query nearby plants; logged-out visitors cannot enumerate the directory.
router.get('/nearby', requireAuth, async (req, res) => {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radius = req.query.radius != null ? parseFloat(String(req.query.radius)) : 40;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: 'lat and lng are required' });
        return;
    }
    // Clamp to a sane ceiling: an unbounded radius would let a caller enumerate the
    // whole plant directory in one shot. 250km is the widest the UI offers.
    const MAX_RADIUS_KM = 250;
    const effRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, MAX_RADIUS_KM);
    const rows = await db.select().from(plants);
    const nearby = rows
        // verified = a fully onboarded partner. Onboarding leads (verified=false) are
        // never shown to customers, even if their GPS pin happens to be confirmed.
        .filter(p => p.plantStatus === 'approved' && p.isActive && p.locationVerified && p.verified)
        .map(p => {
        const pLat = parseFloat(p.latitude);
        const pLng = parseFloat(p.longitude);
        return {
            id: p.id,
            name: p.name,
            address: p.address,
            city: p.city,
            contactNumber: p.contactNumber,
            latitude: pLat,
            longitude: pLng,
            deliveryRadiusKm: p.deliveryRadiusKm,
            grades: p.grades,
            openTime: p.openTime,
            closeTime: p.closeTime,
            openNow: isOpenNow(p.openTime, p.closeTime),
            distanceKm: Math.round(haversineKm(lat, lng, pLat, pLng) * 10) / 10,
        };
    })
        .filter(p => p.distanceKm <= effRadius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    res.json(nearby);
});
// Dashboard network map: every verified partner plant with the fields the map
// popup needs (contact for call/WhatsApp, coordinates for directions, live
// open/closed status). Same visibility filter as /nearby and /directory —
// approved + active + location-verified + verified — and login-only, so it
// never exposes onboarding leads or lets logged-out visitors enumerate plants.
router.get('/map', requireAuth, async (_req, res) => {
    const rows = await db.select().from(plants);
    const mapped = rows
        .filter(p => p.plantStatus === 'approved' && p.isActive && p.locationVerified && p.verified)
        .map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        contactNumber: p.contactNumber,
        latitude: parseFloat(p.latitude),
        longitude: parseFloat(p.longitude),
        grades: p.grades,
        openTime: p.openTime,
        closeTime: p.closeTime,
        openNow: isOpenNow(p.openTime, p.closeTime),
    }))
        .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .sort((a, b) => a.name.localeCompare(b.name));
    res.json(mapped);
});
// Live discovery: real-world concrete plants pulled from Google Places around the
// customer's coordinates. These are UNVERIFIED leads not in our directory and are
// rendered as such by the client. Public (matches /nearby) but rate-limited
// because every call hits a paid upstream.
const discoverLimiter = rateLimit({ windowMs: 60_000, max: 20, name: 'discover' });
router.get('/discover', discoverLimiter, async (req, res) => {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radius = req.query.radius != null ? parseFloat(String(req.query.radius)) : 40;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: 'lat and lng are required' });
        return;
    }
    if (!isDiscoveryConfigured()) {
        // Soft-fail: the feature is optional. The client hides the section silently.
        res.status(503).json({ error: 'Live plant discovery is not configured.', configured: false });
        return;
    }
    const MAX_RADIUS_KM = 250;
    const effRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, MAX_RADIUS_KM);
    try {
        const places = await discoverConcretePlants(lat, lng, effRadius);
        // Pull onboarded approved plants so we can drop any discovered lead that is
        // really one of our partner plants (avoids showing the same plant twice).
        const onboarded = (await db.select().from(plants)).filter(p => p.plantStatus === 'approved' && p.isActive && p.locationVerified);
        const out = places
            .map(pl => ({
            ...pl,
            source: 'discovered',
            distanceKm: Math.round(haversineKm(lat, lng, pl.latitude, pl.longitude) * 10) / 10,
        }))
            .filter(pl => pl.distanceKm <= effRadius)
            .filter(pl => !onboarded.some(op => haversineKm(pl.latitude, pl.longitude, parseFloat(op.latitude), parseFloat(op.longitude)) < 0.15))
            .sort((a, b) => a.distanceKm - b.distanceKm);
        res.json(out);
    }
    catch (e) {
        console.error('Plant discovery failed', e);
        res.status(502).json({ error: 'Could not reach the live plant directory right now.' });
    }
});
// Customer-facing: every plant a signed-in customer may place an order at — the
// approved, active, location-verified, verified marketplace partners. Powers the
// Place Order plant picker and its remembered/pinned default. Unlike /nearby this
// is NOT distance-filtered: a customer can order from any partner plant, near or
// far. Exposes only public listing fields, never status/verification internals.
router.get('/directory', requireAuth, requireRole('client'), async (_req, res) => {
    const rows = await db.select({
        id: plants.id, plantCode: plants.plantCode, name: plants.name, city: plants.city,
        grades: plants.grades, openTime: plants.openTime, closeTime: plants.closeTime,
    }).from(plants)
        .where(and(eq(plants.plantStatus, 'approved'), eq(plants.isActive, true), eq(plants.locationVerified, true), eq(plants.verified, true)))
        .orderBy(plants.name);
    res.json(rows);
});
// ---- Admin onboarding / management ----
// The /nearby route above gates itself with requireAuth (customer discovery).
// Everything below this guard additionally requires authentication.
router.use(requireAuth);
// Super-Admin supplier hunt: a live, multi-category Google Places search of all
// RMC-adjacent suppliers (ready-mix plants, concrete/cement/fly-ash/GGBS
// suppliers, contractors) around a point, so the platform owner can find and
// invite real businesses to join. Authority-only (this is a platform growth
// tool, not a tenant feature) and rate-limited because each call fans out to
// several paid upstream searches.
const discoverSuppliersLimiter = rateLimit({ windowMs: 60_000, max: 12, name: 'discover-suppliers' });
router.get('/discover-suppliers', requireRole('authority'), discoverSuppliersLimiter, async (req, res) => {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    const radius = req.query.radius != null ? parseFloat(String(req.query.radius)) : 40;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: 'lat and lng are required' });
        return;
    }
    if (!isDiscoveryConfigured()) {
        res.status(503).json({ error: 'Live supplier discovery is not configured.', configured: false });
        return;
    }
    // categories is an optional CSV of category keys; default to all of them. We
    // silently drop unknown keys and fall back to the full set if none are valid.
    const raw = String(req.query.categories ?? '').trim();
    const requested = raw
        ? raw.split(',').map(s => s.trim()).filter(isSupplierCategoryKey)
        : SUPPLIER_CATEGORIES.map(c => c.key);
    const categories = requested.length
        ? requested
        : SUPPLIER_CATEGORIES.map(c => c.key);
    const MAX_RADIUS_KM = 250;
    const effRadius = Math.min(Number.isFinite(radius) && radius > 0 ? radius : 40, MAX_RADIUS_KM);
    try {
        const suppliers = await discoverSuppliers(lat, lng, effRadius, categories);
        // Drop any discovered supplier that is already one of our onboarded,
        // location-verified partner plants (matched by near-identical coordinates),
        // so the Super Admin only sees businesses not yet on the platform.
        const onboarded = (await db.select().from(plants)).filter(p => p.plantStatus === 'approved' && p.isActive && p.locationVerified);
        const out = suppliers
            .map(s => ({
            ...s,
            distanceKm: Math.round(haversineKm(lat, lng, s.latitude, s.longitude) * 10) / 10,
        }))
            .filter(s => s.distanceKm <= effRadius)
            .filter(s => !onboarded.some(op => haversineKm(s.latitude, s.longitude, parseFloat(op.latitude), parseFloat(op.longitude)) < 0.15))
            .sort((a, b) => a.distanceKm - b.distanceKm);
        res.json(out);
    }
    catch (e) {
        console.error('Supplier discovery failed', e);
        res.status(502).json({ error: 'Could not reach the live supplier directory right now.' });
    }
});
// Lightweight directory of plants a signed-in customer may order from, used to
// populate the Place Order plant selector (and to surface each plant's offered
// grades). Mirrors the customer-facing visibility filter of /nearby (approved +
// active + location-verified + verified partner) but without distance — it is a
// flat list keyed by the plant's public identity. Any authed user may read it.
router.get('/directory', async (_req, res) => {
    const rows = await db.select({
        id: plants.id,
        plantCode: plants.plantCode,
        name: plants.name,
        city: plants.city,
        grades: plants.grades,
        openTime: plants.openTime,
        closeTime: plants.closeTime,
        plantStatus: plants.plantStatus,
        isActive: plants.isActive,
        locationVerified: plants.locationVerified,
        verified: plants.verified,
    }).from(plants);
    const directory = rows
        .filter(p => p.plantStatus === 'approved' && p.isActive && p.locationVerified && p.verified)
        .map(p => ({
        id: p.id,
        plantCode: p.plantCode,
        name: p.name,
        city: p.city,
        grades: p.grades,
        openTime: p.openTime,
        closeTime: p.closeTime,
    }))
        .sort((a, b) => a.name.localeCompare(b.name));
    res.json(directory);
});
// A customer (or staff) flags a discovered, not-yet-onboarded plant so the
// business can reach out and onboard it. De-duplicated by Google placeId: a
// repeat request for the same plant bumps requestCount + records the latest
// requester rather than creating a duplicate lead. Available to any signed-in
// user — customers reach it from the live discovery map.
const inviteSchema = z.object({
    placeId: z.string().min(1, 'placeId is required'),
    name: z.string().min(1, 'name is required'),
    address: z.string().nullish(),
    latitude: z.coerce.number().finite().optional(),
    longitude: z.coerce.number().finite().optional(),
    contactNumber: z.string().nullish(),
});
router.post('/invite', async (req, res) => {
    const parse = inviteSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { placeId, name, address, latitude, longitude, contactNumber } = parse.data;
    const actor = req.user;
    const [row] = await db
        .insert(plantInvites)
        .values({
        placeId,
        name,
        address: address ?? null,
        latitude: latitude != null ? String(latitude) : null,
        longitude: longitude != null ? String(longitude) : null,
        contactNumber: contactNumber ?? null,
        requestCount: 1,
        status: 'pending',
        firstRequestedById: actor.id,
        firstRequestedByName: actor.name,
        lastRequestedById: actor.id,
        lastRequestedByName: actor.name,
    })
        .onConflictDoUpdate({
        target: plantInvites.placeId,
        set: {
            requestCount: sql `${plantInvites.requestCount} + 1`,
            name,
            address: address ?? null,
            latitude: latitude != null ? String(latitude) : null,
            longitude: longitude != null ? String(longitude) : null,
            contactNumber: contactNumber ?? null,
            lastRequestedById: actor.id,
            lastRequestedByName: actor.name,
            // A dismissed lead that gets requested again returns to the pending
            // queue so staff see the renewed demand; an already-onboarded one stays.
            status: sql `CASE WHEN ${plantInvites.status} = 'onboarded' THEN ${plantInvites.status} ELSE 'pending' END`,
            updatedAt: sql `NOW()`,
        },
    })
        .returning();
    const deduped = row.requestCount > 1;
    res.status(201).json({ ...row, deduped });
    // Proactively alert admins about a genuinely NEW request so they don't have to
    // sit watching the Onboarding-requests tab. Repeat/de-duplicated requests are
    // intentionally silent to avoid spam. Fire-and-forget AFTER responding so a
    // slow SMTP server never delays the customer's request.
    if (!deduped)
        void notifyNewPlantRequest(row);
});
// Shared admin alert for a brand-new plant request — whether a signed-in
// customer asking us to chase a plant they found (/invite) or a plant owner
// volunteering their own plant (/partner-request). Fire-and-forget AFTER the
// response so a slow SMTP server never delays the caller.
async function notifyNewPlantRequest(row) {
    // Resolve the configured audience once. On any failure fall back to the
    // built-in defaults so the in-app toast still reaches admins.
    let notifyCfg;
    try {
        notifyCfg = await getPlantInviteNotifyConfig();
    }
    catch (err) {
        console.error('[plants] Failed to load plant-request notification config:', err);
        notifyCfg = {
            emailEnabled: DEFAULT_PLANT_INVITE_EMAIL_ENABLED,
            roles: DEFAULT_PLANT_INVITE_NOTIFY_ROLES,
            recipients: [],
        };
    }
    // In-app SSE toast, scoped to the chosen staff roles. When no roles are
    // selected we still alert admins + authority so the in-app heads-up is never
    // silently lost (the `authority` super-admin is outside STAFF_ROLES, hence an
    // explicit allow-list either way).
    const toastRoles = notifyCfg.roles.length > 0 ? notifyCfg.roles : DEFAULT_PLANT_INVITE_NOTIFY_ROLES;
    emitSSEEvent('plant.invite', {
        id: row.id,
        name: row.name,
        address: row.address,
        requestedByName: row.lastRequestedByName,
    }, { roles: toastRoles });
    // The toast above always fires (cheap, non-intrusive). The email is opt-out
    // via an admin setting; its audience = active users in the chosen roles PLUS
    // any explicit extra recipient mailboxes.
    try {
        if (!notifyCfg.emailEnabled)
            return;
        const emails = new Set();
        for (const e of notifyCfg.recipients)
            emails.add(e);
        if (notifyCfg.roles.length > 0) {
            const staff = await db
                .select({ email: users.email })
                .from(users)
                .where(and(isNull(users.deletedAt), eq(users.isActive, true), inArray(users.role, notifyCfg.roles)));
            for (const s of staff)
                if (s.email)
                    emails.add(s.email);
        }
        if (emails.size > 0) {
            await sendPlantInviteNotification([...emails], {
                plantName: row.name,
                address: row.address,
                contactNumber: row.contactNumber,
                requestedByName: row.lastRequestedByName,
            });
        }
    }
    catch (err) {
        console.error('[plants] Failed to notify admins of a new plant request:', err);
    }
}
// Public: a plant OWNER volunteers their own plant for partnership review.
// Unlike /invite this carries no Google placeId, so we mint a synthetic one per
// submission. The lead lands in the same staff onboarding queue as a pending,
// unverified entry — approve-first: staff verify & provision the owner login
// before the plant ever becomes visible to customers.
const partnerRequestLimiter = rateLimit({ windowMs: 60_000, max: 5, name: 'partner-request' });
const partnerRequestSchema = z.object({
    ownerName: z.string().trim().min(1, 'Your name is required').max(120),
    plantName: z.string().trim().min(1, 'Plant / company name is required').max(160),
    phone: z.string().trim().min(5, 'A contact number is required').max(40),
    email: z.string().trim().email('Enter a valid email').max(160).optional().or(z.literal('')),
    city: z.string().trim().max(120).optional(),
    address: z.string().trim().max(400).optional(),
    note: z.string().trim().max(1000).optional(),
});
router.post('/partner-request', partnerRequestLimiter, async (req, res) => {
    const parse = partnerRequestSchema.safeParse(req.body ?? {});
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { ownerName, plantName, phone, email, city, address, note } = parse.data;
    // Fold the free-text bits into the single address line staff read in the queue
    // (the leads table has no dedicated city/note columns).
    const addressParts = [address, city, note ? `Note: ${note}` : null].filter(Boolean);
    const fullAddress = addressParts.length ? addressParts.join(' \u00b7 ') : null;
    const contactNumber = email ? `${phone} \u00b7 ${email}` : phone;
    const requestedByName = `${ownerName} (plant owner)`;
    const placeId = `partner:${randomBytes(8).toString('hex')}`;
    const [row] = await db
        .insert(plantInvites)
        .values({
        placeId,
        name: plantName,
        address: fullAddress,
        contactNumber,
        requestCount: 1,
        status: 'pending',
        firstRequestedByName: requestedByName,
        lastRequestedByName: requestedByName,
    })
        .returning();
    res.status(201).json({ ok: true, id: row.id });
    void notifyNewPlantRequest(row);
});
// Staff-only: the queue of submitted invites, most-requested / most-recent first.
// ---------------------------------------------------------------------------
// AI document extraction — staff upload a GST / registration certificate image
// (base64) or paste raw text; Gemini extracts the key onboarding fields and
// returns them so the form can be pre-filled without retyping.
// ---------------------------------------------------------------------------
const EXTRACT_DOC_MIME_WHITELIST = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
]);
const extractDocSchema = z.union([
    z.object({
        type: z.literal('image'),
        data: z.string().min(1, 'image data is required'),
        mimeType: z.string().min(1, 'mimeType is required'),
    }),
    z.object({
        type: z.literal('text'),
        data: z.string().min(1, 'text content is required').max(20_000),
    }),
    z.object({
        // Client uploads the file to object storage via presigned URL (from
        // /extract-doc/upload-url) then sends the returned objectPath here.
        // Server reads the bytes from storage and passes them to Gemini — avoids
        // large base64 payloads transiting the API server.
        type: z.literal('object'),
        objectPath: z.string().min(1, 'objectPath is required').startsWith('/objects/'),
        mimeType: z.string().min(1, 'mimeType is required'),
    }),
]);
// Mints a presigned PUT URL for direct client → object-storage upload of a
// GST/registration document. The client uploads the file there, then sends the
// returned objectPath to POST /extract-doc for AI extraction.
router.post('/extract-doc/upload-url', ADMIN, platformStaffOnly, async (_req, res) => {
    try {
        const svc = new ObjectStorageService();
        const uploadURL = await svc.getObjectEntityUploadURL();
        const objectPath = svc.normalizeObjectEntityPath(uploadURL);
        res.json({ uploadURL, objectPath });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create document upload URL.' });
        console.error('[plants] extract-doc upload URL error:', err);
    }
});
router.post('/extract-doc', ADMIN, platformStaffOnly, async (req, res) => {
    const parse = extractDocSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    if (!isGeminiConfigured()) {
        res.status(503).json({
            error: 'AI document extraction is not configured. Please contact your platform administrator.',
            configured: false,
        });
        return;
    }
    const input = parse.data;
    if (input.type === 'image') {
        if (!EXTRACT_DOC_MIME_WHITELIST.has(input.mimeType)) {
            res.status(400).json({ error: `Unsupported file type "${input.mimeType}". Please upload a JPEG, PNG, WebP, HEIC, or PDF.` });
            return;
        }
        // Cap at ~9MB of base64 (≈ 6.7MB binary).
        if (input.data.length > 9_000_000) {
            res.status(400).json({ error: 'Document is too large. Please upload a file under ~6 MB.' });
            return;
        }
    }
    if (input.type === 'object') {
        if (!EXTRACT_DOC_MIME_WHITELIST.has(input.mimeType)) {
            res.status(400).json({ error: `Unsupported file type "${input.mimeType}". Please upload a JPEG, PNG, WebP, HEIC, or PDF.` });
            return;
        }
        // Resolve the object-storage path to bytes via the GCS File handle, then
        // re-invoke extraction as an image input.
        try {
            const svc = new ObjectStorageService();
            const gcsFile = await svc.getObjectEntityFile(input.objectPath);
            // .download() resolves the GCS File handle into raw bytes ([Buffer]).
            const [buffer] = await gcsFile.download();
            if (buffer.length > 9_000_000) {
                res.status(400).json({ error: 'Document is too large. Please upload a file under ~6 MB.' });
                return;
            }
            const imageInput = { type: 'image', data: buffer.toString('base64'), mimeType: input.mimeType };
            const fields = await extractDocumentFields(imageInput);
            res.json(fields);
        }
        catch (err) {
            if (err.code === 'NOT_FOUND') {
                res.status(404).json({ error: 'Uploaded document not found. Please try uploading again.' });
            }
            else {
                const status = err.status ?? 502;
                res.status(status).json({ error: err.message ?? 'Document extraction failed.' });
            }
        }
        return;
    }
    try {
        const fields = await extractDocumentFields(input);
        res.json(fields);
    }
    catch (err) {
        const status = err.status ?? 502;
        res.status(status).json({ error: err.message ?? 'Document extraction failed.' });
    }
});
router.get('/invites', ADMIN, platformStaffOnly, async (_req, res) => {
    const rows = await db
        .select()
        .from(plantInvites)
        .orderBy(sql `${plantInvites.status} = 'pending' DESC`, sql `${plantInvites.requestCount} DESC`, sql `${plantInvites.updatedAt} DESC`);
    res.json(rows);
});
// Staff-only: update an invite's status (e.g. mark onboarded once the plant is
// added, or dismiss a request that won't be pursued).
const inviteStatusSchema = z.object({
    status: z.enum(['pending', 'onboarded', 'dismissed']),
});
router.patch('/invites/:id', ADMIN, platformStaffOnly, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const parse = inviteStatusSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'Invalid status' });
        return;
    }
    const [row] = await db
        .update(plantInvites)
        .set({ status: parse.data.status, updatedAt: new Date() })
        .where(eq(plantInvites.id, id))
        .returning();
    if (!row) {
        res.status(404).json({ error: 'Invite not found' });
        return;
    }
    res.json(row);
});
router.get('/', ADMIN, platformStaffOnly, async (_req, res) => {
    const rows = await db.select().from(plants).orderBy(plants.createdAt);
    // Count the live (non-soft-deleted) login accounts bound to each plant so the
    // onboarding UI can show whether an owner has already been provisioned.
    const counts = await db
        .select({ plantId: users.plantId, count: sql `count(*)::int` })
        .from(users)
        .where(and(isNull(users.deletedAt), sql `${users.plantId} IS NOT NULL`))
        .groupBy(users.plantId);
    const byPlant = new Map(counts.map(c => [c.plantId, c.count]));
    res.json(rows.map(r => ({ ...r, ownerCount: byPlant.get(r.id) ?? 0 })));
});
function parseBody(body) {
    const out = {};
    const optStr = (v) => (v === null || v === '' ? null : String(v));
    if (body.name !== undefined)
        out.name = String(body.name).trim();
    if (body.legalName !== undefined)
        out.legalName = optStr(body.legalName);
    if (body.gstNo !== undefined)
        out.gstNo = optStr(body.gstNo);
    if (body.email !== undefined)
        out.email = optStr(body.email);
    if (body.address !== undefined)
        out.address = body.address === null ? null : String(body.address);
    if (body.city !== undefined)
        out.city = body.city === null ? null : String(body.city);
    if (body.contactNumber !== undefined)
        out.contactNumber = body.contactNumber === null ? null : String(body.contactNumber);
    if (body.latitude !== undefined)
        out.latitude = String(body.latitude);
    if (body.longitude !== undefined)
        out.longitude = String(body.longitude);
    if (body.placeId !== undefined)
        out.placeId = optStr(body.placeId);
    if (body.plantStatus !== undefined)
        out.plantStatus = body.plantStatus;
    if (body.subscriptionStatus !== undefined && SUBSCRIPTION_STATUSES.includes(body.subscriptionStatus)) {
        out.subscriptionStatus = body.subscriptionStatus;
    }
    if (body.subscriptionPlan !== undefined && SUBSCRIPTION_PLANS.includes(body.subscriptionPlan)) {
        out.subscriptionPlan = body.subscriptionPlan;
    }
    if (body.commissionPct !== undefined) {
        // null/'' clears the override (inherit global); otherwise clamp 0–100 with 2dp.
        out.commissionPct = body.commissionPct === null || body.commissionPct === ''
            ? null
            : String(Math.min(100, Math.max(0, Math.round(Number(body.commissionPct) * 100) / 100)));
    }
    if (body.isActive !== undefined)
        out.isActive = Boolean(body.isActive);
    if (body.locationVerified !== undefined)
        out.locationVerified = Boolean(body.locationVerified);
    if (body.verified !== undefined)
        out.verified = Boolean(body.verified);
    if (body.deliveryRadiusKm !== undefined)
        out.deliveryRadiusKm = Math.round(Number(body.deliveryRadiusKm)) || 0;
    if (body.grades !== undefined)
        out.grades = Array.isArray(body.grades) ? body.grades.map(String) : [];
    if (body.openTime !== undefined)
        out.openTime = body.openTime === null ? null : String(body.openTime);
    if (body.closeTime !== undefined)
        out.closeTime = body.closeTime === null ? null : String(body.closeTime);
    return out;
}
// Shared verify-time checks (GST format, placeId dupe, near-coordinate dupe)
// and auto-invite dispatch. Both POST / (create-with-verified=true) and
// PUT /:id (flip verified false→true) must pass through this helper.
// Returns null on success or an already-sent error response (caller should return).
async function runVerifyChecks(req, res, data, currentPlantId) {
    // 1. GST format validation (only when gstNo is provided).
    if (data.gstNo && typeof data.gstNo === 'string' && !validateGst(data.gstNo)) {
        res.status(422).json({ error: `"${data.gstNo}" is not a valid Indian GST number (format: 29ABCDE1234F1Z5).` });
        return false;
    }
    // 2. Duplicate guard by placeId (if this plant has a placeId and another
    //    verified plant already claims the same one).
    if (data.placeId && typeof data.placeId === 'string') {
        const existingById = await db
            .select({ id: plants.id, name: plants.name })
            .from(plants)
            .where(and(eq(plants.placeId, data.placeId), eq(plants.verified, true), ...(currentPlantId ? [ne(plants.id, currentPlantId)] : [])));
        if (existingById.length > 0) {
            res.status(409).json({
                error: `Another verified plant ("${existingById[0].name}") is already registered for this Google Places location. Did you mean to edit it instead?`,
                duplicatePlantId: existingById[0].id,
                duplicatePlantName: existingById[0].name,
            });
            return false;
        }
    }
    // 3. Near-coordinate duplicate guard (< 0.3 km vs any other verified plant).
    const DUPE_KM = 0.3;
    if (data.latitude !== undefined && data.longitude !== undefined) {
        const effLat = parseFloat(String(data.latitude));
        const effLng = parseFloat(String(data.longitude));
        const verifiedOthers = await db
            .select({ id: plants.id, name: plants.name, latitude: plants.latitude, longitude: plants.longitude })
            .from(plants)
            .where(and(eq(plants.verified, true), ...(currentPlantId ? [ne(plants.id, currentPlantId)] : [])));
        const dupe = verifiedOthers.find(o => haversineKm(effLat, effLng, parseFloat(o.latitude), parseFloat(o.longitude)) < DUPE_KM);
        if (dupe) {
            res.status(409).json({
                error: `Another verified plant ("${dupe.name}") is already registered at a very similar location (< ${DUPE_KM * 1000} m away). ` +
                    `Please confirm this is a different physical plant before verifying.`,
                duplicatePlantId: dupe.id,
                duplicatePlantName: dupe.name,
            });
            return false;
        }
    }
    return { autoInvitesSent: 0, autoInviteLinks: [] };
}
async function runAutoInvite(req, plantId) {
    const autoInviteLinks = [];
    const autoInviteErrors = [];
    let autoInvitesSent = 0;
    let ownerUsers = [];
    try {
        // Target plant_owner and plant-scoped admin accounts (provisioning UI defaults to admin).
        ownerUsers = await db
            .select({ id: users.id, name: users.name, email: users.email, role: users.role })
            .from(users)
            .where(and(eq(users.plantId, plantId), inArray(users.role, ['plant_owner', 'admin']), isNull(users.deletedAt), eq(users.isActive, true)));
    }
    catch (err) {
        // DB query failure — surface as a structured error so the caller can include
        // it in the response and staff know auto-invite didn't run.
        console.error('[plants] Auto-invite: owner query failed:', err);
        return {
            autoInvitesSent: 0,
            autoInviteLinks: [],
            autoInviteErrors: [{ email: '(all)', reason: 'Could not query plant users. Please send invites manually.' }],
        };
    }
    for (const u of ownerUsers) {
        try {
            // Only invite users who have a pending (not-yet-redeemed) token row.
            // No token row = account was created with a direct password → skip.
            // Used token = already set their password → skip.
            const [pendingToken] = await db
                .select({ id: passwordSetupTokens.id })
                .from(passwordSetupTokens)
                .where(and(eq(passwordSetupTokens.userId, u.id), isNull(passwordSetupTokens.usedAt)));
            if (!pendingToken)
                continue;
            const { token, expiresAt } = await createInviteToken(u.id);
            const inviteUrl = `${appBaseUrl(req)}/set-password?token=${token}`;
            let emailSent = false;
            try {
                emailSent = await sendOwnerInviteEmail(u.email, u.name, u.role, inviteUrl, expiresAt);
            }
            catch { /* Non-fatal: fallback invite link is returned in the response */ }
            autoInvitesSent++;
            // When email delivery fails, include the raw invite URL so staff can copy
            // and forward it manually without needing to re-trigger the flow.
            autoInviteLinks.push({ name: u.name, email: u.email, ...(emailSent ? {} : { inviteUrl }) });
        }
        catch (err) {
            console.error(`[plants] Auto-invite: token creation failed for ${u.email}:`, err);
            autoInviteErrors.push({ email: u.email, reason: 'Token generation failed. Use "Resend invite" to retry.' });
        }
    }
    return {
        autoInvitesSent,
        autoInviteLinks,
        ...(autoInviteErrors.length > 0 ? { autoInviteErrors } : {}),
    };
}
router.post('/', ADMIN, platformStaffOnly, async (req, res) => {
    const data = parseBody(req.body ?? {});
    if (!data.name || data.latitude === undefined || data.longitude === undefined) {
        res.status(400).json({ error: 'name, latitude and longitude are required' });
        return;
    }
    // When creating as already-verified, enforce the same field completeness and
    // duplicate guards that the PUT endpoint uses on a false→true transition.
    if (data.verified === true) {
        const missing = missingVerifyFields(data);
        if (missing.length > 0) {
            res.status(422).json({ error: `Cannot verify plant: missing required field(s): ${missing.join(', ')}.` });
            return;
        }
        const guardResult = await runVerifyChecks(req, res, data, null);
        if (guardResult === false)
            return;
    }
    let row;
    try {
        [row] = await db.insert(plants).values(data).returning();
    }
    catch {
        res.status(409).json({ error: 'A plant with this name already exists' });
        return;
    }
    // Auto-invite plant_owner / admin accounts if the plant was created as verified.
    let autoInvitesSent = 0;
    let autoInviteLinks = [];
    let autoInviteErrors;
    if (data.verified === true) {
        const inviteResult = await runAutoInvite(req, row.id);
        autoInvitesSent = inviteResult.autoInvitesSent;
        autoInviteLinks = inviteResult.autoInviteLinks;
        autoInviteErrors = inviteResult.autoInviteErrors;
    }
    res.status(201).json({
        ...row,
        ...(autoInvitesSent > 0 ? { autoInvitesSent, autoInviteLinks } : {}),
        ...(autoInviteErrors?.length ? { autoInviteErrors } : {}),
    });
});
// ---------------------------------------------------------------------------
// Bulk CSV import (staff). Onboard a whole spreadsheet of new plants at once
// instead of one-at-a-time through the form. Every valid row lands as an
// un-verified lead; invalid rows are skipped with a per-row reason so staff can
// fix just the failures and re-upload.
// ---------------------------------------------------------------------------
// The columns the importer understands. `name`, `latitude` and `longitude` are
// mandatory; the rest are optional company details.
const IMPORT_COLUMNS = [
    'name', 'address', 'city', 'latitude', 'longitude',
    'contactNumber', 'email', 'legalName', 'gstNo',
];
const importSchema = z.object({
    csv: z.string().min(1, 'csv content is required'),
});
router.post('/import', ADMIN, platformStaffOnly, async (req, res) => {
    const parse = importSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: 'A non-empty CSV is required.' });
        return;
    }
    // Drop fully-blank lines so a trailing newline or spacer row doesn't count.
    const grid = parseCsv(parse.data.csv).filter(r => r.some(cell => cell.trim() !== ''));
    if (grid.length === 0) {
        res.status(400).json({ error: 'The CSV is empty.' });
        return;
    }
    const headerLc = grid[0].map(h => h.trim().toLowerCase());
    const colIndex = {};
    for (const col of IMPORT_COLUMNS)
        colIndex[col] = headerLc.indexOf(col.toLowerCase());
    if (colIndex.name < 0 || colIndex.latitude < 0 || colIndex.longitude < 0) {
        res.status(400).json({
            error: 'CSV must include at least these column headers: name, latitude, longitude. ' +
                'Optional columns: address, city, contactNumber, email, legalName, gstNo.',
        });
        return;
    }
    const dataRows = grid.slice(1);
    if (dataRows.length === 0) {
        res.status(400).json({ error: 'The CSV has a header row but no data rows.' });
        return;
    }
    // Pre-load existing plant names + coordinates once for the duplicate guards.
    const existing = await db
        .select({ name: plants.name, latitude: plants.latitude, longitude: plants.longitude })
        .from(plants);
    const existingNames = new Set(existing.map(p => p.name.trim().toLowerCase()));
    const existingCoords = existing.map(p => ({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) }));
    const DUPE_KM = 0.3;
    const results = [];
    // Names/coords accepted earlier in THIS batch, so two identical CSV rows can't
    // both slip past the (committed-rows-only) DB checks above.
    const batchNames = new Set();
    const batchCoords = [];
    const toInsert = [];
    const cellAt = (cells, col) => {
        const idx = colIndex[col];
        return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
    };
    dataRows.forEach((cells, i) => {
        const rowNum = i + 2; // 1-based + header row
        const name = cellAt(cells, 'name');
        const result = { row: rowNum, name, status: 'skipped' };
        if (!name) {
            result.reason = 'Missing plant name.';
            results.push(result);
            return;
        }
        const latStr = cellAt(cells, 'latitude');
        const lngStr = cellAt(cells, 'longitude');
        const lat = Number(latStr);
        const lng = Number(lngStr);
        if (!latStr || !lngStr || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            result.reason = 'Missing or invalid latitude/longitude.';
            results.push(result);
            return;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            result.reason = 'Latitude/longitude out of range.';
            results.push(result);
            return;
        }
        const gstNo = cellAt(cells, 'gstNo');
        if (gstNo && !validateGst(gstNo)) {
            result.reason = `Invalid GST format ("${gstNo}").`;
            results.push(result);
            return;
        }
        const nameKey = name.toLowerCase();
        if (existingNames.has(nameKey) || batchNames.has(nameKey)) {
            result.reason = 'A plant with this name already exists.';
            results.push(result);
            return;
        }
        const dupeCoord = existingCoords.some(c => haversineKm(lat, lng, c.lat, c.lng) < DUPE_KM) ||
            batchCoords.some(c => haversineKm(lat, lng, c.lat, c.lng) < DUPE_KM);
        if (dupeCoord) {
            result.reason = `Duplicate location (within ${DUPE_KM * 1000} m of another plant).`;
            results.push(result);
            return;
        }
        // Row is valid — queue it for insertion as an un-verified lead.
        batchNames.add(nameKey);
        batchCoords.push({ lat, lng });
        const optStr = (v) => (v === '' ? null : v);
        const values = {
            name,
            address: optStr(cellAt(cells, 'address')),
            city: optStr(cellAt(cells, 'city')),
            latitude: String(lat),
            longitude: String(lng),
            contactNumber: optStr(cellAt(cells, 'contactNumber')),
            email: optStr(cellAt(cells, 'email')),
            legalName: optStr(cellAt(cells, 'legalName')),
            gstNo: gstNo ? gstNo.toUpperCase() : null,
            verified: false,
        };
        result.status = 'created';
        results.push(result);
        toInsert.push({ values, resultIdx: results.length - 1 });
    });
    // Insert the valid rows one at a time so a late DB failure (e.g. a race that
    // created a same-named plant after our pre-check) flips only that row to
    // skipped rather than aborting the whole import. drizzle wraps the driver
    // error, so the Postgres `code` lives on `.cause` (see users.ts).
    const pgCode = (err) => {
        const e = err;
        return e?.code ?? e?.cause?.code;
    };
    let created = 0;
    for (const item of toInsert) {
        try {
            await db.insert(plants).values(item.values);
            created++;
        }
        catch (err) {
            results[item.resultIdx].status = 'skipped';
            if (pgCode(err) === '23505') {
                // Unique violation — a same-named plant was created concurrently.
                results[item.resultIdx].reason = 'A plant with this name already exists.';
            }
            else {
                // Unexpected DB failure — surface it transparently rather than passing
                // it off as a duplicate, and log it for operators.
                console.error('[plants] CSV import: row insert failed:', err);
                results[item.resultIdx].reason = 'Could not be saved due to a server error. Please retry this row.';
            }
        }
    }
    const skipped = results.filter(r => r.status === 'skipped').length;
    if (created > 0) {
        await db.insert(auditLogs).values({
            actorId: req.user.id,
            actorName: req.user.name,
            action: 'plants.imported',
            detail: `Bulk CSV import: ${created} lead(s) created, ${skipped} row(s) skipped.`,
        });
    }
    res.status(created > 0 ? 201 : 200).json({ created, skipped, results });
});
// The company details that must be present before a plant can be published to
// the customer-facing marketplace. Mirrors missingVerifyFields() in the UI.
function missingVerifyFields(src) {
    const checks = [
        [src.legalName, 'legal / company name'],
        [src.gstNo, 'GST number'],
        [src.contactNumber, 'contact number'],
        [src.email, 'email'],
    ];
    return checks.filter(([v]) => v == null || !String(v).trim()).map(([, label]) => label);
}
// Indian GST number: 2-digit state code + 5-char PAN + 4 digits + entity type
// + Z + checksum character.
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function validateGst(gst) {
    return GST_RE.test(gst.trim().toUpperCase());
}
router.put('/:id', ADMIN, platformStaffOnly, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const data = parseBody(req.body ?? {});
    data.updatedAt = new Date();
    // When setting verified=true, fetch the stored row so we can merge the
    // partial-PUT payload against it for field completeness checks.
    let existing;
    if (data.verified === true) {
        [existing] = await db.select().from(plants).where(eq(plants.id, id));
        if (!existing) {
            res.status(404).json({ error: 'Plant not found' });
            return;
        }
        const pick = (key) => key in data ? data[key] : existing[key];
        // --- Missing-fields guard ---
        const missing = missingVerifyFields({
            legalName: pick('legalName'), gstNo: pick('gstNo'),
            contactNumber: pick('contactNumber'), email: pick('email'),
        });
        if (missing.length > 0) {
            res.status(400).json({
                error: `Cannot verify a plant with missing details: ${missing.join(', ')}. ` +
                    `Verified plants are published to the customer-facing marketplace.`,
            });
            return;
        }
        // Merge effective coordinates and placeId for dupe guards.
        const merged = {
            ...data,
            latitude: 'latitude' in data ? data.latitude : existing.latitude,
            longitude: 'longitude' in data ? data.longitude : existing.longitude,
            gstNo: pick('gstNo'),
            placeId: pick('placeId'),
        };
        const guardResult = await runVerifyChecks(req, res, merged, id);
        if (guardResult === false)
            return;
    }
    // Capture whether verification is being newly turned on (false → true transition).
    const isNewVerification = data.verified === true && (existing ? !existing.verified : false);
    const [row] = await db.update(plants).set(data).where(eq(plants.id, id)).returning();
    if (!row) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    let autoInvitesSent = 0;
    let autoInviteLinks = [];
    let autoInviteErrors;
    if (isNewVerification) {
        const result = await runAutoInvite(req, id);
        autoInvitesSent = result.autoInvitesSent;
        autoInviteLinks = result.autoInviteLinks;
        autoInviteErrors = result.autoInviteErrors;
    }
    res.json({
        ...row,
        ...(isNewVerification && autoInvitesSent > 0
            ? { autoInvitesSent, autoInviteLinks }
            : {}),
        ...(autoInviteErrors?.length ? { autoInviteErrors } : {}),
    });
});
router.delete('/:id', ADMIN, platformStaffOnly, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const [row] = await db.delete(plants).where(eq(plants.id, id)).returning();
    if (!row) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    res.json({ ok: true });
});
// List the live (non-soft-deleted) login accounts bound to a plant so staff can
// see who can sign in for it and manage them (deactivate / resend invite) via
// the existing /api/users endpoints. Scoped strictly by plantId.
router.get('/:id/owner', OWNER_PROVISIONERS, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    // A plant-scoped caller (plant_owner, or an admin bound to one plant) may only
    // see their own plant's team. Platform staff may view any plant.
    if (!isPlatformStaff(req.user) && req.user.plantId !== id) {
        res.status(403).json({ error: 'You can only manage your own plant.' });
        return;
    }
    const [plant] = await db.select({ id: plants.id }).from(plants).where(eq(plants.id, id));
    if (!plant) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    const rows = await db
        .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
    })
        .from(users)
        .where(and(eq(users.plantId, id), isNull(users.deletedAt)))
        .orderBy(users.createdAt);
    res.json(rows);
});
// ---------------------------------------------------------------------------
// Rate cards: per-plant ₹/m³ price per concrete grade.
// Manageable by platform staff (any plant) and a plant's own admin/owner/
// supervisor/dispatcher (their plant only). Hard tenant-scoped by :id.
// ---------------------------------------------------------------------------
const RATE_CARD_MANAGERS = requireRole('authority', 'admin', 'plant_owner', 'supervisor', 'dispatcher');
// Resolve + authorize the :id plant for a rate-card request. Returns the plant
// id on success, or null after already writing the error response.
async function resolveRateCardPlant(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return null;
    }
    if (!isPlatformStaff(req.user) && req.user.plantId !== id) {
        res.status(403).json({ error: 'You can only manage your own plant.' });
        return null;
    }
    const [plant] = await db.select({ id: plants.id }).from(plants).where(eq(plants.id, id));
    if (!plant) {
        res.status(404).json({ error: 'Plant not found' });
        return null;
    }
    return id;
}
router.get('/:id/rate-cards', RATE_CARD_MANAGERS, async (req, res) => {
    const id = await resolveRateCardPlant(req, res);
    if (id == null)
        return;
    const rows = await db
        .select()
        .from(rateCards)
        .where(eq(rateCards.plantId, id))
        .orderBy(rateCards.grade);
    res.json(rows);
});
const rateCardSchema = z.object({
    grade: z.string().trim().min(1, 'Grade is required').max(40),
    ratePerM3: z.coerce.number().finite('Rate must be a number').min(0, 'Rate must be 0 or more'),
    effectiveFrom: z.string().trim().optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
});
// Upsert by (plantId, grade): editing a grade that already has a card updates it.
router.post('/:id/rate-cards', RATE_CARD_MANAGERS, async (req, res) => {
    const id = await resolveRateCardPlant(req, res);
    if (id == null)
        return;
    const parse = rateCardSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { grade, ratePerM3, effectiveFrom, notes, isActive } = parse.data;
    const effFrom = effectiveFrom ? new Date(effectiveFrom) : null;
    const [row] = await db
        .insert(rateCards)
        .values({
        plantId: id,
        grade,
        ratePerM3: String(ratePerM3),
        effectiveFrom: effFrom && !Number.isNaN(effFrom.getTime()) ? effFrom : null,
        notes: notes || null,
        isActive: isActive ?? true,
    })
        .onConflictDoUpdate({
        target: [rateCards.plantId, rateCards.grade],
        set: {
            ratePerM3: String(ratePerM3),
            effectiveFrom: effFrom && !Number.isNaN(effFrom.getTime()) ? effFrom : null,
            notes: notes || null,
            isActive: isActive ?? true,
            updatedAt: new Date(),
        },
    })
        .returning();
    res.status(201).json(row);
});
router.put('/:id/rate-cards/:rcId', RATE_CARD_MANAGERS, async (req, res) => {
    const id = await resolveRateCardPlant(req, res);
    if (id == null)
        return;
    const rcId = Number(req.params.rcId);
    if (!Number.isInteger(rcId)) {
        res.status(400).json({ error: 'Invalid rate card id' });
        return;
    }
    const parse = rateCardSchema.partial().safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const d = parse.data;
    const set = { updatedAt: new Date() };
    if (d.grade !== undefined)
        set.grade = d.grade;
    if (d.ratePerM3 !== undefined)
        set.ratePerM3 = String(d.ratePerM3);
    if (d.effectiveFrom !== undefined) {
        const eff = d.effectiveFrom ? new Date(d.effectiveFrom) : null;
        set.effectiveFrom = eff && !Number.isNaN(eff.getTime()) ? eff : null;
    }
    if (d.notes !== undefined)
        set.notes = d.notes || null;
    if (d.isActive !== undefined)
        set.isActive = d.isActive;
    const [row] = await db
        .update(rateCards)
        .set(set)
        .where(and(eq(rateCards.id, rcId), eq(rateCards.plantId, id)))
        .returning();
    if (!row) {
        res.status(404).json({ error: 'Rate card not found' });
        return;
    }
    res.json(row);
});
router.delete('/:id/rate-cards/:rcId', RATE_CARD_MANAGERS, async (req, res) => {
    const id = await resolveRateCardPlant(req, res);
    if (id == null)
        return;
    const rcId = Number(req.params.rcId);
    if (!Number.isInteger(rcId)) {
        res.status(400).json({ error: 'Invalid rate card id' });
        return;
    }
    const [row] = await db
        .delete(rateCards)
        .where(and(eq(rateCards.id, rcId), eq(rateCards.plantId, id)))
        .returning();
    if (!row) {
        res.status(404).json({ error: 'Rate card not found' });
        return;
    }
    res.json({ ok: true });
});
// Plant-owner roles a staff member may provision at onboarding. An owner account
// is hard-scoped to its plant (plantId) so it only ever sees its own tenant data.
const OWNER_ROLES = ['plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'driver'];
// password is optional: when omitted (the default, recommended flow) the owner
// receives a single-use invite link to set their own password, instead of staff
// typing and sharing one. A password may still be passed for the legacy
// set-it-by-hand flow.
const ownerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    role: z.enum(OWNER_ROLES).optional(),
});
// Provision a login for an onboarded plant. Creates a plant-scoped staff account
// (default role: admin = plant owner) bound to this plant via plantId.
router.post('/:id/owner', OWNER_PROVISIONERS, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const parse = ownerSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.flatten().fieldErrors });
        return;
    }
    const { name, email, password } = parse.data;
    const role = parse.data.role ?? 'admin';
    // No typed password => the owner sets their own via an emailed invite link.
    const useInvite = !password;
    const actor = req.user;
    // Plant-scoped callers (a plant_owner, or an admin bound to one plant) are
    // governed by the role hierarchy: they may only provision into their OWN plant
    // and only the roles strictly below them. Platform staff (the Super Owner or a
    // global admin) keep the original behaviour — they onboard plants and may seed
    // any owner role for any plant.
    if (!isPlatformStaff(actor)) {
        if (actor.plantId !== id) {
            res.status(403).json({ error: 'You can only provision logins for your own plant.' });
            return;
        }
        if (!canCreateRole(actor.role, role)) {
            res.status(403).json({ error: `Your role is not permitted to create a "${role}" account.` });
            return;
        }
    }
    // For the invite flow the account has no usable password yet, so we seed it
    // with an un-guessable random hash. The owner can't log in until they redeem
    // the invite (which overwrites this hash with the password they choose).
    // Hash before the transaction so the per-plant lock below is held only for the
    // count + insert, never during the (slow) bcrypt work.
    const passwordHash = await hashPassword(password ?? randomBytes(32).toString('base64url'));
    // The role-cap check (count) and the insert must be atomic per plant, or two
    // concurrent requests could both read held < limit and both insert, busting
    // the cap. We serialize provisioning for a given plant by taking a row lock on
    // the plant inside a transaction (FOR UPDATE); concurrent provisioners for the
    // same plant queue behind it, so the count each one sees already reflects the
    // other's insert.
    const limit = roleLimit(role);
    const result = await db.transaction(async (tx) => {
        const [plant] = await tx.select({ id: plants.id, name: plants.name })
            .from(plants).where(eq(plants.id, id)).for('update');
        if (!plant)
            return { kind: 'not_found' };
        if (Number.isFinite(limit)) {
            const [{ count: held }] = await tx.select({ count: sql `count(*)::int` })
                .from(users)
                .where(and(eq(users.plantId, id), eq(users.role, role), isNull(users.deletedAt)));
            if (held >= limit)
                return { kind: 'limit' };
        }
        const [existing] = await tx.select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
            .from(users).where(eq(users.email, email));
        if (existing)
            return { kind: 'exists', existing };
        const [created] = await tx.insert(users).values({
            name, email, passwordHash, role, plantId: id,
            createdBy: actor.id,
        }).returning();
        return { kind: 'ok', plant, user: created };
    });
    if (result.kind === 'not_found') {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    if (result.kind === 'limit') {
        res.status(409).json({
            error: `This plant already has the maximum number of "${role}" accounts (${limit}).`,
        });
        return;
    }
    if (result.kind === 'exists') {
        if (result.existing.deletedAt) {
            res.status(409).json({ error: `An account with this email was previously deleted (${result.existing.name}). Restore it instead of creating a new one.` });
        }
        else {
            res.status(409).json({ error: 'Email already in use' });
        }
        return;
    }
    const { plant, user } = result;
    let emailSent;
    let inviteUrl;
    if (useInvite) {
        try {
            const { token, expiresAt } = await createInviteToken(user.id);
            inviteUrl = `${appBaseUrl(req)}/set-password?token=${token}`;
            emailSent = await sendOwnerInviteEmail(user.email, user.name, user.role, inviteUrl, expiresAt);
        }
        catch (err) {
            console.error('[email] Failed to send owner invite email:', err);
            emailSent = false;
        }
    }
    else {
        try {
            emailSent = await sendWelcomeEmail(user.email, user.name, user.role);
        }
        catch (err) {
            console.error('[email] Failed to send owner welcome email:', err);
            emailSent = false;
        }
    }
    await db.insert(auditLogs).values({
        actorId: actor.id,
        actorName: actor.name,
        action: 'user.created',
        targetUserId: user.id,
        targetUserEmail: user.email,
        detail: `Plant-owner login provisioned for ${plant.name}${useInvite ? ' (password-setup invite)' : ''}`,
        emailSent: emailSent ?? false,
    });
    res.status(201).json({
        id: user.id, name: user.name, email: user.email, role: user.role, plantId: user.plantId,
        emailSent,
        invited: useInvite,
        // When the invite email couldn't be sent (SMTP not configured), hand the
        // link back so staff can deliver it out-of-band. Never expose it when the
        // email went out — the whole point is not to pass the secret around.
        ...(useInvite && !emailSent ? { inviteUrl } : {}),
    });
});
export default router;
