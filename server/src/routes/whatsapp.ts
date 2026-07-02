import { Router } from 'express';
import express from 'express';
import { desc, eq, and, gte, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { whatsappMessages, orders, challans, clients } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { plantScope } from '../lib/tenancy.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';
import { verifyWhatsAppWebhookSignature, whatsAppStatusCallbackUrl, sendWhatsAppText } from '../lib/whatsapp.js';
import { notifyChallanStatus, notifyOrderPlaced, notifyStaffOfWhatsAppFailure } from '../lib/deliveryNotify.js';
import { normalizePhone } from '../lib/otp.js';

const router = Router();

// Twilio MessageStatus values meaning the customer never received the message.
const FAILURE_STATUSES = new Set(['failed', 'undelivered']);

// Column shape shared by the list and re-send endpoints so both return an
// identical message record (latest delivery state joined to its order/challan).
const messageColumns = {
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
} as const;

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
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.body ?? {})) {
    if (typeof v === 'string') params[k] = v;
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

  // Alert staff only on the transition INTO a failure, not on every repeated
  // callback. Read the stored status first so a duplicate 'failed' delivery from
  // Twilio doesn't re-toast/re-email. A read failure simply skips the dedupe.
  let alertOnFailure = false;
  if (FAILURE_STATUSES.has(status)) {
    try {
      const [existing] = await db
        .select({ status: whatsappMessages.status })
        .from(whatsappMessages)
        .where(eq(whatsappMessages.messageSid, sid));
      alertOnFailure = !!existing && !FAILURE_STATUSES.has(existing.status);
    } catch (err) {
      console.error('[whatsapp] Failed to read prior status for failure alert:', err);
    }
  }

  try {
    await db
      .update(whatsappMessages)
      .set({ status, errorCode, updatedAt: new Date() })
      .where(eq(whatsappMessages.messageSid, sid));
  } catch (err) {
    console.error('[whatsapp] Failed to apply status callback:', err);
  }

  // Proactively notify staff that the customer never got their update so they can
  // phone instead. Best-effort and fire-and-forget — it must never delay the
  // webhook ack or make Twilio retry.
  if (alertOnFailure) {
    void notifyStaffOfWhatsAppFailure(sid);
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

  const scope = plantScope(req.user!.plantId, whatsappMessages.plantId);
  const filters: SQL[] = [];
  if (scope) filters.push(scope);
  const event = String(req.query.event ?? '');
  if (event === 'order' || event === 'dispatch' || event === 'delivery') {
    filters.push(eq(whatsappMessages.event, event));
  }
  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select(messageColumns)
    .from(whatsappMessages)
    .leftJoin(orders, eq(whatsappMessages.orderId, orders.id))
    .leftJoin(challans, eq(whatsappMessages.challanId, challans.id))
    .where(where)
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(limit);

  res.json(rows);
});

// --- Staff re-send action ----------------------------------------------------
// Re-send a notification that failed to reach the customer (wrong number, no
// WhatsApp, opt-out — typically after staff have corrected the phone number).
// Mirrors the proof-photo retry pattern: it simply re-invokes the same notify*
// helper that originally fired, which sends afresh and records a brand-new
// whatsapp_messages row. Plant-scoped and role-gated identically to the list:
// a plant-bound actor can only re-send their own plant's notifications.
router.post('/messages/:id/resend', requireAuth, requireRole(...READ_ROLES), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid message id' });
    return;
  }

  // Load the original notification within the actor's plant scope so a
  // plant-bound user can never re-send (and reveal) another plant's message.
  const scope = plantScope(req.user!.plantId, whatsappMessages.plantId);
  const idFilter = eq(whatsappMessages.id, id);
  const [msg] = await db
    .select()
    .from(whatsappMessages)
    .where(scope ? and(idFilter, scope) : idFilter)
    .limit(1);

  if (!msg) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }

  // Re-invoke the helper that maps to the original event + linked record. Each
  // helper is best-effort (never throws) and inserts a fresh message row when it
  // actually sends; a re-send for an event that is now gated off (notifications
  // disabled, no template, or the customer has no phone) inserts nothing.
  let linkFilter: SQL;
  if (msg.event === 'order') {
    if (!msg.orderId) {
      res.status(400).json({ error: 'Notification has no linked order to re-send' });
      return;
    }
    await notifyOrderPlaced(msg.orderId);
    linkFilter = and(eq(whatsappMessages.event, 'order'), eq(whatsappMessages.orderId, msg.orderId))!;
  } else if (msg.event === 'dispatch' || msg.event === 'delivery') {
    if (!msg.challanId) {
      res.status(400).json({ error: 'Notification has no linked dispatch to re-send' });
      return;
    }
    await notifyChallanStatus(msg.challanId, msg.event === 'dispatch' ? 'dispatched' : 'delivered');
    linkFilter = and(eq(whatsappMessages.event, msg.event), eq(whatsappMessages.challanId, msg.challanId))!;
  } else {
    res.status(400).json({ error: 'Unknown notification type' });
    return;
  }

  // A real re-send inserts a NEW row (higher id) for the same event + link. If
  // the newest row is still the one we re-sent, nothing went out (gated off).
  const [newest] = await db
    .select(messageColumns)
    .from(whatsappMessages)
    .leftJoin(orders, eq(whatsappMessages.orderId, orders.id))
    .leftJoin(challans, eq(whatsappMessages.challanId, challans.id))
    .where(linkFilter)
    .orderBy(desc(whatsappMessages.id))
    .limit(1);

  const resent = !!newest && newest.id !== msg.id;
  res.json({ ok: true, resent, message: resent ? newest : null });
});

// --- Two-way WhatsApp chat ----------------------------------------------------
// One shared business number serves the whole platform, so inbound customer
// messages are inherently cross-tenant (any plant's customer can write in).
// The inbox is therefore platform-staff only: authority or a global admin
// (plantId == null) — mirroring the global user/plant consoles. Plant-bound
// staff keep the plant-scoped /messages notification list above.
const CHAT_ROLES = ['admin', 'authority'];

function requirePlatformStaff(req: express.Request, res: express.Response): boolean {
  if (!isPlatformStaff(req.user!)) {
    res.status(403).json({ error: 'Platform staff only' });
    return false;
  }
  return true;
}

// Meta's customer-service window: free-text replies are deliverable only within
// 24 hours of the customer's LAST inbound message; outside it only templates go
// through.
const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Conversation list: one row per customer phone that has chat traffic, newest
// conversation first, carrying the latest message preview + the last inbound
// timestamp (so the UI can show whether the 24h reply window is open) and the
// matching client name when the phone belongs to a known customer.
router.get('/chats', requireAuth, requireRole(...CHAT_ROLES), async (req, res) => {
  if (!requirePlatformStaff(req, res)) return;

  const result = await db.execute(sql`
    SELECT DISTINCT ON (m.to_phone)
      m.to_phone AS phone,
      m.body AS last_body,
      m.direction AS last_direction,
      m.event AS last_event,
      m.created_at AS last_at,
      (SELECT max(i.created_at) FROM whatsapp_messages i
        WHERE i.to_phone = m.to_phone AND i.direction = 'inbound') AS last_inbound_at,
      (SELECT p.profile_name FROM whatsapp_messages p
        WHERE p.to_phone = m.to_phone AND p.profile_name IS NOT NULL
        ORDER BY p.created_at DESC LIMIT 1) AS profile_name,
      (SELECT c.name FROM clients c
        WHERE regexp_replace(c.phone, '[^0-9]', '', 'g') <> ''
          AND regexp_replace(m.to_phone, '[^0-9]', '', 'g')
              LIKE '%' || right(regexp_replace(c.phone, '[^0-9]', '', 'g'), 10)
        ORDER BY c.id LIMIT 1) AS client_name
    FROM whatsapp_messages m
    WHERE m.to_phone IS NOT NULL AND m.event = 'chat'
    ORDER BY m.to_phone, m.created_at DESC
  `);
  const now = Date.now();
  const rows = (result.rows as {
    phone: string;
    last_body: string | null;
    last_direction: string;
    last_event: string;
    last_at: string | Date;
    last_inbound_at: string | Date | null;
    profile_name: string | null;
    client_name: string | null;
  }[])
    .map((r) => {
      const lastInboundAt = r.last_inbound_at ? new Date(r.last_inbound_at) : null;
      return {
        phone: r.phone,
        lastBody: r.last_body,
        lastDirection: r.last_direction,
        lastAt: new Date(r.last_at),
        lastInboundAt,
        profileName: r.profile_name,
        clientName: r.client_name,
        windowOpen: !!lastInboundAt && now - lastInboundAt.getTime() < CHAT_WINDOW_MS,
      };
    })
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, 200);
  res.json(rows);
});

// Full thread for one customer phone: chat messages AND the template
// notifications we sent them (orders/dispatch/delivery), oldest first, so staff
// see the whole relationship in one place.
router.get('/chats/:phone/messages', requireAuth, requireRole(...CHAT_ROLES), async (req, res) => {
  if (!requirePlatformStaff(req, res)) return;
  const phone = normalizePhone(String(req.params.phone ?? ''));
  if (!phone) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }

  const rows = await db
    .select({
      id: whatsappMessages.id,
      direction: whatsappMessages.direction,
      event: whatsappMessages.event,
      body: whatsappMessages.body,
      status: whatsappMessages.status,
      errorCode: whatsappMessages.errorCode,
      channel: whatsappMessages.channel,
      profileName: whatsappMessages.profileName,
      orderId: whatsappMessages.orderId,
      challanId: whatsappMessages.challanId,
      createdAt: whatsappMessages.createdAt,
      orderNo: orders.orderNo,
      challanNo: challans.challanNo,
    })
    .from(whatsappMessages)
    .leftJoin(orders, eq(whatsappMessages.orderId, orders.id))
    .leftJoin(challans, eq(whatsappMessages.challanId, challans.id))
    .where(eq(whatsappMessages.toPhone, phone))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(300);
  rows.reverse();

  const [lastInbound] = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(and(eq(whatsappMessages.toPhone, phone), eq(whatsappMessages.direction, 'inbound')))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);
  const lastInboundAt = lastInbound?.createdAt ?? null;

  res.json({
    phone,
    messages: rows,
    lastInboundAt,
    windowOpen: !!lastInboundAt && Date.now() - lastInboundAt.getTime() < CHAT_WINDOW_MS,
  });
});

// Staff free-text reply. Enforces Meta's 24-hour window server-side: outside it
// we 409 with a clear message (the UI then points staff at the template-based
// notifications instead) rather than let Meta reject the send opaquely.
router.post('/chats/:phone/reply', requireAuth, requireRole(...CHAT_ROLES), async (req, res) => {
  if (!requirePlatformStaff(req, res)) return;
  const phone = normalizePhone(String(req.params.phone ?? ''));
  if (!phone) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body) {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }
  if (body.length > 4096) {
    res.status(400).json({ error: 'Message is too long (max 4096 characters)' });
    return;
  }

  // The reply window opens with the customer's last inbound message.
  const [lastInbound] = await db
    .select({ createdAt: whatsappMessages.createdAt })
    .from(whatsappMessages)
    .where(and(
      eq(whatsappMessages.toPhone, phone),
      eq(whatsappMessages.direction, 'inbound'),
      gte(whatsappMessages.createdAt, new Date(Date.now() - CHAT_WINDOW_MS)),
    ))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(1);
  if (!lastInbound) {
    res.status(409).json({
      error: 'The 24-hour reply window has closed. WhatsApp only allows free-text replies within 24 hours of the customer\'s last message — use a template notification instead.',
      code: 'WINDOW_EXPIRED',
    });
    return;
  }

  const result = await sendWhatsAppText(phone, body);
  if (!result.ok) {
    res.status(502).json({ error: result.error ?? 'WhatsApp send failed' });
    return;
  }

  const [saved] = await db
    .insert(whatsappMessages)
    .values({
      messageSid: result.sid ?? null,
      event: 'chat',
      direction: 'outbound',
      toPhone: phone,
      status: result.status ?? 'accepted',
      channel: result.channel,
      body,
    })
    .returning();
  res.json({ ok: true, message: saved });
});

export default router;
