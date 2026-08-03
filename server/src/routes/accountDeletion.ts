import { Router } from 'express';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { accountDeletionRequests, auditLogs, clients, passwordSetupTokens, pushSubscriptions, sites, users } from '../db/schema.js';
import { requireAuth, bumpSessionVersion } from '../middleware/auth.js';
import { normalizePhone, sendOtp, verifyOtp } from '../lib/otp.js';
import { rateLimit } from '../lib/rateLimit.js';
import { sendAccountDeletionEmail } from '../lib/email.js';

const router = Router();
const ACTIVE = ['pending_verification', 'verified', 'processing'] as const;
const publicLimiter = rateLimit({ name: 'account-deletion-public', windowMs: 60 * 60_000, max: 5 });
const otpLimiter = rateLimit({ name: 'account-deletion-otp', windowMs: 15 * 60_000, max: 5 });
const text = (max: number) => z.string().trim().min(1).max(max).transform(v => v.replace(/[<>]/g, ''));
const formSchema = z.object({
  fullName: text(120),
  mobile: z.string().trim().max(30).optional().default(''),
  email: z.string().trim().email().max(254).optional().or(z.literal('')).default(''),
  reason: z.string().trim().max(1000).transform(v => v.replace(/[<>]/g, '')).optional().default(''),
  confirmed: z.literal(true),
}).superRefine((v, ctx) => {
  if (!normalizePhone(v.mobile) && !v.email) ctx.addIssue({ code: 'custom', message: 'Enter your registered mobile number or email address.' });
  if (v.mobile && !normalizePhone(v.mobile)) ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Enter a valid registered mobile number.' });
});

async function findCustomer(mobile: string | null, email: string) {
  const conditions = [];
  if (mobile) conditions.push(eq(users.phone, mobile));
  if (email) conditions.push(eq(users.email, email.toLowerCase()));
  if (!conditions.length) return null;
  const [user] = await db.select().from(users).where(and(
    eq(users.role, 'client'), eq(users.isActive, true), isNull(users.deletedAt),
    conditions.length === 1 ? conditions[0] : or(...conditions),
  ));
  return user ?? null;
}

router.post('/', publicLimiter, async (req, res) => {
  const parsed = formSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }); return; }
  const mobile = normalizePhone(parsed.data.mobile);
  const email = parsed.data.email.toLowerCase();
  const user = await findCustomer(mobile, email);
  if (!user) { res.status(400).json({ error: 'The mobile number or email does not match an active Concrete King customer account.' }); return; }
  const [duplicate] = await db.select({ id: accountDeletionRequests.id }).from(accountDeletionRequests)
    .where(and(eq(accountDeletionRequests.userId, user.id), or(...ACTIVE.map(s => eq(accountDeletionRequests.status, s)))));
  if (duplicate) { res.status(409).json({ error: 'An active deletion request already exists for this account.' }); return; }
  const [created] = await db.insert(accountDeletionRequests).values({
    userId: user.id, fullName: parsed.data.fullName, mobile: mobile ?? user.phone,
    email: email || user.email, reason: parsed.data.reason || null,
  }).returning({ id: accountDeletionRequests.id, requestedAt: accountDeletionRequests.requestedAt });
  await db.insert(auditLogs).values({ actorId: user.id, actorName: user.name, action: 'account_deletion.requested', targetUserId: user.id, detail: `Public account deletion request #${created.id}` });
  const adminEmail = process.env.ACCOUNT_DELETION_ADMIN_EMAIL?.trim() || process.env.SMTP_USER?.trim();
  void Promise.allSettled([
    sendAccountDeletionEmail(email || user.email, 'user', { requestId: created.id, name: parsed.data.fullName, mobile, email: email || user.email }),
    ...(adminEmail ? [sendAccountDeletionEmail(adminEmail, 'admin', { requestId: created.id, name: parsed.data.fullName, mobile, email: email || user.email })] : []),
  ]);
  res.status(201).json({ ok: true, requestId: created.id, requestedAt: created.requestedAt });
});

router.post('/otp', otpLimiter, requireAuth, async (req, res) => {
  const actor = req.user!;
  if (actor.role !== 'client') { res.status(403).json({ error: 'Staff, driver, plant owner and administrator accounts must use the applicable offboarding process.' }); return; }
  const [user] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, actor.id));
  if (!user?.phone) { res.status(400).json({ error: 'A registered mobile number is required. Contact support to verify your account.' }); return; }
  const sent = await sendOtp(user.phone);
  if (!sent.ok) { res.status(503).json({ error: sent.error ?? 'Could not send verification code.' }); return; }
  res.json({ ok: true, channel: sent.channel, ...(sent.devCode ? { devCode: sent.devCode } : {}) });
});

router.post('/complete', otpLimiter, requireAuth, async (req, res) => {
  const actor = req.user!;
  if (actor.role !== 'client') { res.status(403).json({ error: 'Only customer accounts can be deleted in the app.' }); return; }
  const body = z.object({ otp: z.string().regex(/^\d{6}$/), confirmed: z.literal(true) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: 'A valid OTP and final confirmation are required.' }); return; }
  const [user] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!user?.phone) { res.status(400).json({ error: 'Registered mobile number not found.' }); return; }
  const verified = await verifyOtp(user.phone, body.data.otp);
  if (!verified.ok) { res.status(401).json({ error: verified.error }); return; }
  const now = new Date();
  await db.transaction(async tx => {
    const [existing] = await tx.select({ id: accountDeletionRequests.id }).from(accountDeletionRequests)
      .where(and(eq(accountDeletionRequests.userId, actor.id), or(...ACTIVE.map(s => eq(accountDeletionRequests.status, s)))));
    if (existing) await tx.update(accountDeletionRequests).set({ status: 'completed', verifiedAt: now, completedAt: now, updatedAt: now }).where(eq(accountDeletionRequests.id, existing.id));
    else await tx.insert(accountDeletionRequests).values({ userId: actor.id, fullName: user.name, mobile: user.phone, email: user.email, status: 'completed', verifiedAt: now, completedAt: now });
    if (user.linkedClientId) await tx.update(clients).set({ name: 'Deleted customer', contactPerson: 'Deleted customer', phone: `deleted-${actor.id}`, email: null, address: null, city: null }).where(eq(clients.id, user.linkedClientId));
    if (user.linkedClientId) await tx.update(sites).set({ name: 'Deleted site', address: null, city: null, latitude: null, longitude: null }).where(eq(sites.clientId, user.linkedClientId));
    await tx.update(passwordSetupTokens).set({ usedAt: now }).where(and(eq(passwordSetupTokens.userId, actor.id), isNull(passwordSetupTokens.usedAt)));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, actor.id));
    await tx.insert(auditLogs).values({ actorId: actor.id, actorName: 'Deleted customer', action: 'account_deletion.completed', targetUserId: actor.id, detail: 'Customer completed OTP-verified permanent account deletion; statutory transaction records retained.' });
    await tx.update(users).set({ name: 'Deleted customer', email: `deleted+${actor.id}@trackmyrmc.invalid`, phone: null, passwordHash: null, permissions: null, linkedClientId: null, preferredPlantId: null, isActive: false, deletedAt: now }).where(eq(users.id, actor.id));
  });
  await bumpSessionVersion(actor.id);
  res.json({ ok: true, message: 'Your Concrete King account and eligible personal data have been deleted.' });
});

router.get('/admin', requireAuth, async (req, res) => {
  if (req.user!.role !== 'authority') { res.status(403).json({ error: 'Super Admin access required.' }); return; }
  res.json(await db.select().from(accountDeletionRequests).orderBy(desc(accountDeletionRequests.requestedAt)));
});

router.patch('/admin/:id', requireAuth, async (req, res) => {
  if (req.user!.role !== 'authority') { res.status(403).json({ error: 'Super Admin access required.' }); return; }
  const id = Number(req.params.id);
  const parsed = z.object({ status: z.enum(['pending_verification','verified','processing','completed','rejected']), rejectionReason: z.string().trim().max(500).optional() }).safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) { res.status(400).json({ error: 'Invalid status update.' }); return; }
  const [current] = await db.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.id, id));
  if (!current) { res.status(404).json({ error: 'Request not found.' }); return; }
  if (current.status === 'completed') { res.status(409).json({ error: 'A completed permanent deletion cannot be changed or restored.' }); return; }
  if (parsed.data.status === 'rejected' && !parsed.data.rejectionReason) { res.status(400).json({ error: 'A rejection reason is required.' }); return; }
  const now = new Date();
  if (parsed.data.status === 'completed' && current.userId) {
    const [target] = await db.select().from(users).where(eq(users.id, current.userId));
    if (target?.role !== 'client') { res.status(409).json({ error: 'Only a verified customer request can be completed here.' }); return; }
    if (target.isActive) {
      await db.transaction(async tx => {
        if (target.linkedClientId) await tx.update(clients).set({ name: 'Deleted customer', contactPerson: 'Deleted customer', phone: `deleted-${target.id}`, email: null, address: null, city: null }).where(eq(clients.id, target.linkedClientId));
        if (target.linkedClientId) await tx.update(sites).set({ name: 'Deleted site', address: null, city: null, latitude: null, longitude: null }).where(eq(sites.clientId, target.linkedClientId));
        await tx.update(passwordSetupTokens).set({ usedAt: now }).where(and(eq(passwordSetupTokens.userId, target.id), isNull(passwordSetupTokens.usedAt)));
        await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, target.id));
        await tx.update(users).set({ name: 'Deleted customer', email: `deleted+${target.id}@trackmyrmc.invalid`, phone: null, passwordHash: null, permissions: null, linkedClientId: null, preferredPlantId: null, isActive: false, deletedAt: now }).where(eq(users.id, target.id));
        await tx.insert(auditLogs).values({ actorId: req.user!.id, actorName: req.user!.name, action: 'account_deletion.completed_by_admin', targetUserId: target.id, detail: 'Verified customer deletion completed; statutory transaction records retained.' });
      });
      await bumpSessionVersion(target.id);
    }
  }
  const [updated] = await db.update(accountDeletionRequests).set({ status: parsed.data.status, rejectionReason: parsed.data.status === 'rejected' ? parsed.data.rejectionReason : null, verifiedAt: parsed.data.status === 'verified' ? now : current.verifiedAt, completedAt: parsed.data.status === 'completed' ? now : null, updatedAt: now }).where(eq(accountDeletionRequests.id, id)).returning();
  res.json(updated);
});

export default router;
