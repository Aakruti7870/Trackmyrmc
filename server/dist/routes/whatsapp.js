import { Router } from 'express';
import express from 'express';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { whatsappMessages, orders, challans } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { verifyWhatsAppWebhookSignature, whatsAppStatusCallbackUrl } from '../lib/whatsapp.js';
const router = Router();
// Roles allowed to read the WhatsApp delivery-status surface. Mirrors the staff
// challan/report readers; customers and drivers never see other people's
// notification delivery state.
const READ_ROLES = ['admin', 'dispatcher', 'authority', 'plant_operator'];
// --- Public Twilio status-callback webhook ----------------------------------
// Twilio POSTs application/x-www-form-urlencoded delivery-status updates here as
// a message moves through queued → sent → delivered → read (or fails). It is
// unauthenticated by design (Twilio can't carry our JWT), so the request is
// instead verified with the X-Twilio-Signature HMAC before we trust it. The body
// parser is scoped to this route so the rest of the API stays JSON-only.
router.post('/status', express.urlencoded({ extended: false }), async (req, res) => {
    // Validate against the exact URL Twilio was told to call (our configured
    // callback), not the proxy-rewritten request URL, or the HMAC won't match.
    const url = whatsAppStatusCallbackUrl() ?? `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const params = {};
    for (const [k, v] of Object.entries(req.body ?? {})) {
        if (typeof v === 'string')
            params[k] = v;
    }
    const signature = req.header('X-Twilio-Signature');
    if (!verifyWhatsAppWebhookSignature(signature, url, params)) {
        res.status(403).json({ error: 'Invalid signature' });
        return;
    }
    // Twilio sends MessageSid + MessageStatus (legacy SmsSid/SmsStatus aliases for
    // older accounts). ErrorCode is present only on a failed/undelivered message.
    const sid = params.MessageSid || params.SmsSid;
    const status = params.MessageStatus || params.SmsStatus;
    if (!sid || !status) {
        // Ack so Twilio doesn't retry a malformed payload, but record nothing.
        res.sendStatus(204);
        return;
    }
    const errorCode = params.ErrorCode || null;
    try {
        await db
            .update(whatsappMessages)
            .set({ status, errorCode, updatedAt: new Date() })
            .where(eq(whatsappMessages.messageSid, sid));
    }
    catch (err) {
        console.error('[whatsapp] Failed to apply status callback:', err);
    }
    // Always 2xx a verified callback — a write failure is ours to fix, not
    // Twilio's to retry indefinitely.
    res.sendStatus(204);
});
// --- Staff delivery-status list ---------------------------------------------
// Surfaces recent WhatsApp notifications with their latest delivery state, joined
// to the originating order/challan so staff can spot silent failures (wrong
// number, no WhatsApp, opt-out). Plant-scoped: a plant-bound actor only sees
// their own plant's notifications; a global admin/authority sees all.
router.get('/messages', requireAuth, requireRole(...READ_ROLES), async (req, res) => {
    const rawLimit = parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;
    const scope = plantScope(req.user.plantId, whatsappMessages.plantId);
    const filters = [];
    if (scope)
        filters.push(scope);
    const event = String(req.query.event ?? '');
    if (event === 'order' || event === 'dispatch' || event === 'delivery') {
        filters.push(eq(whatsappMessages.event, event));
    }
    const where = filters.length ? and(...filters) : undefined;
    const rows = await db
        .select({
        id: whatsappMessages.id,
        messageSid: whatsappMessages.messageSid,
        event: whatsappMessages.event,
        status: whatsappMessages.status,
        errorCode: whatsappMessages.errorCode,
        channel: whatsappMessages.channel,
        toPhone: whatsappMessages.toPhone,
        orderId: whatsappMessages.orderId,
        challanId: whatsappMessages.challanId,
        createdAt: whatsappMessages.createdAt,
        updatedAt: whatsappMessages.updatedAt,
        orderNo: orders.orderNo,
        challanNo: challans.challanNo,
    })
        .from(whatsappMessages)
        .leftJoin(orders, eq(whatsappMessages.orderId, orders.id))
        .leftJoin(challans, eq(whatsappMessages.challanId, challans.id))
        .where(where)
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(limit);
    res.json(rows);
});
export default router;
