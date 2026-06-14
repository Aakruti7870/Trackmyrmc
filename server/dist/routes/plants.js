import { Router } from 'express';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { plants, users, auditLogs } from '../db/schema.js';
import { randomBytes } from 'node:crypto';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';
import { sendWelcomeEmail, sendOwnerInviteEmail } from '../lib/email.js';
import { createInviteToken } from '../lib/inviteToken.js';
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
function isOpenNow(openTime, closeTime) {
    if (!openTime || !closeTime)
        return false;
    const now = new Date(Date.now() + 5.5 * 3600000); // shift UTC -> IST
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
// ---- Admin onboarding / management ----
// The /nearby route above gates itself with requireAuth (customer discovery).
// Everything below this guard additionally requires authentication.
router.use(requireAuth);
router.get('/', ADMIN, async (_req, res) => {
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
    if (body.plantStatus !== undefined)
        out.plantStatus = body.plantStatus;
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
router.post('/', ADMIN, async (req, res) => {
    const data = parseBody(req.body ?? {});
    if (!data.name || data.latitude === undefined || data.longitude === undefined) {
        res.status(400).json({ error: 'name, latitude and longitude are required' });
        return;
    }
    try {
        const [row] = await db.insert(plants).values(data).returning();
        res.status(201).json(row);
    }
    catch {
        res.status(409).json({ error: 'A plant with this name already exists' });
    }
});
router.put('/:id', ADMIN, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
        return;
    }
    const data = parseBody(req.body ?? {});
    data.updatedAt = new Date();
    const [row] = await db.update(plants).set(data).where(eq(plants.id, id)).returning();
    if (!row) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    res.json(row);
});
router.delete('/:id', ADMIN, async (req, res) => {
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
router.get('/:id/owner', ADMIN, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: 'Invalid id' });
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
// Plant-owner roles a staff member may provision at onboarding. An owner account
// is hard-scoped to its plant (plantId) so it only ever sees its own tenant data.
const OWNER_ROLES = ['admin', 'dispatcher', 'plant_operator'];
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
router.post('/:id/owner', ADMIN, async (req, res) => {
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
    const [plant] = await db.select({ id: plants.id, name: plants.name }).from(plants).where(eq(plants.id, id));
    if (!plant) {
        res.status(404).json({ error: 'Plant not found' });
        return;
    }
    const [existing] = await db.select({ id: users.id, name: users.name, deletedAt: users.deletedAt })
        .from(users).where(eq(users.email, email));
    if (existing) {
        if (existing.deletedAt) {
            res.status(409).json({ error: `An account with this email was previously deleted (${existing.name}). Restore it instead of creating a new one.` });
        }
        else {
            res.status(409).json({ error: 'Email already in use' });
        }
        return;
    }
    // For the invite flow the account has no usable password yet, so we seed it
    // with an un-guessable random hash. The owner can't log in until they redeem
    // the invite (which overwrites this hash with the password they choose).
    const passwordHash = await hashPassword(password ?? randomBytes(32).toString('base64url'));
    const [user] = await db.insert(users).values({
        name, email, passwordHash, role, plantId: id,
    }).returning();
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
    const actor = req.user;
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
