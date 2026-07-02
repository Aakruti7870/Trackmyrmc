import { Router } from 'express';
import type { Request } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { whatsappMessages } from '../db/schema.js';
import { metaWebhookVerifyToken, verifyMetaWebhookSignature } from '../lib/whatsapp.js';
import { notifyStaffOfWhatsAppFailure } from '../lib/deliveryNotify.js';
import { emitSSEEvent } from '../lib/sseEmitter.js';

const router = Router();

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Meta delivery statuses meaning the customer never received the message.
const FAILURE_STATUSES = new Set(['failed', 'undelivered']);

// Shapes of the parts of a Meta webhook POST we actually read. Everything is
// optional/loosely typed because the payload is attacker-influenced external
// input — we validate field-by-field rather than trust a declared shape.
interface MetaStatus {
  id?: string;
  status?: string;
  errors?: { code?: number | string }[];
}
interface MetaInboundMessage {
  id?: string;
  from?: string;
  type?: string;
  timestamp?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
}
interface MetaContact {
  wa_id?: string;
  profile?: { name?: string };
}
interface MetaWebhookBody {
  entry?: {
    changes?: {
      value?: {
        statuses?: MetaStatus[];
        messages?: MetaInboundMessage[];
        contacts?: MetaContact[];
      };
    }[];
  }[];
}

// --- Meta WhatsApp webhook verification (GET) -------------------------------
// When you click "Verify and save" in the Meta app's Webhooks setup, Meta sends
// a GET to this URL with hub.mode=subscribe, hub.verify_token=<your token>, and
// hub.challenge=<random>. We must echo the challenge back verbatim (200, plain
// text) only when the token matches our configured WHATSAPP_META_VERIFY_TOKEN;
// otherwise 403. This is the handshake that makes the callback URL "validated".
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = metaWebhookVerifyToken();
  if (mode === 'subscribe' && expected && token === expected) {
    res.status(200).type('text/plain').send(typeof challenge === 'string' ? challenge : '');
    return;
  }
  res.sendStatus(403);
});

// --- Meta WhatsApp webhook receiver (POST) ----------------------------------
// Meta POSTs delivery-status updates (sent → delivered → read, or failed) and
// inbound messages here as JSON. We advance the stored notification's delivery
// state by matching Meta's message id (wamid), which the send path persists as
// messageSid. Verified with the X-Hub-Signature-256 HMAC when an app secret is
// configured; otherwise accepted best-effort (same configuration-gated stance as
// the rest of the WhatsApp stack). Always 2xx so Meta doesn't retry our writes.
router.post('/whatsapp', async (req, res) => {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const verification = verifyMetaWebhookSignature(req.header('X-Hub-Signature-256'), raw);
  if (verification === 'invalid') {
    res.sendStatus(403);
    return;
  }
  // Fail CLOSED in production: this is a public endpoint that mutates delivery
  // state and can trigger staff alerts, so an unverifiable POST must be rejected
  // there. Without WHATSAPP_META_APP_SECRET we cannot authenticate Meta, and
  // accepting anyway would let anyone forge status updates / spam alerts. In dev
  // we stay permissive so the flow is testable without the secret.
  if (verification === 'unconfigured' && isProd()) {
    console.error(
      '[whatsapp] Rejecting Meta webhook POST: WHATSAPP_META_APP_SECRET is not set, so the X-Hub-Signature-256 cannot be verified.',
    );
    res.sendStatus(403);
    return;
  }

  try {
    await processMetaWebhook(req.body as MetaWebhookBody);
  } catch (err) {
    console.error('[whatsapp] Failed to process Meta webhook:', err);
  }

  res.sendStatus(200);
});

async function processMetaWebhook(body: MetaWebhookBody): Promise<void> {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const statuses = change?.value?.statuses;
      if (Array.isArray(statuses)) {
        for (const st of statuses) await applyStatus(st);
      }
      const messages = change?.value?.messages;
      if (Array.isArray(messages)) {
        const contacts = Array.isArray(change?.value?.contacts) ? change.value!.contacts! : [];
        for (const msg of messages) await storeInboundMessage(msg, contacts);
      }
    }
  }
}

// Roles who staff the shared WhatsApp inbox — must match the chat endpoints'
// guard in routes/whatsapp.ts (authority + global admin) so the live toast only
// reaches people who can actually open the conversation. SSE can only target by
// role, so a plant-bound admin may still see the toast; the API gate (platform
// staff only) is what actually protects the data.
const CHAT_STAFF_ROLES = ['authority', 'admin'];

// Persist one customer message from Meta as an inbound chat row. The wamid is
// stored in messageSid, whose partial unique index makes redelivered webhooks
// (Meta retries on slow acks) a no-op instead of a duplicate bubble.
async function storeInboundMessage(msg: MetaInboundMessage, contacts: MetaContact[]): Promise<void> {
  const wamid = typeof msg?.id === 'string' ? msg.id : null;
  const from = typeof msg?.from === 'string' ? msg.from.replace(/[^\d]/g, '') : '';
  if (!wamid || !from) return;

  // Extract a human-readable body for the message types we can render. Button
  // taps and interactive replies carry their label; media types get a marker so
  // the thread still shows that SOMETHING arrived.
  const type = typeof msg?.type === 'string' ? msg.type : 'unknown';
  let text: string | null = null;
  if (typeof msg?.text?.body === 'string') text = msg.text.body;
  else if (typeof msg?.button?.text === 'string') text = msg.button.text;
  else if (typeof msg?.interactive?.button_reply?.title === 'string') text = msg.interactive.button_reply.title;
  else if (typeof msg?.interactive?.list_reply?.title === 'string') text = msg.interactive.list_reply.title;
  if (text === null && type !== 'text') text = `[${type} message]`;

  const profileName =
    contacts.find((c) => typeof c?.wa_id === 'string' && c.wa_id === msg.from)?.profile?.name ?? null;

  const toPhone = `+${from}`;
  try {
    const inserted = await db
      .insert(whatsappMessages)
      .values({
        messageSid: wamid,
        event: 'chat',
        direction: 'inbound',
        toPhone,
        status: 'received',
        channel: 'whatsapp',
        body: text?.slice(0, 4096) ?? null,
        profileName: typeof profileName === 'string' ? profileName.slice(0, 128) : null,
      })
      .onConflictDoNothing({
        target: whatsappMessages.messageSid,
        where: sql`${whatsappMessages.messageSid} IS NOT NULL`,
      })
      .returning({ id: whatsappMessages.id });

    // Only a genuinely new message (not a webhook retry) pings the inbox staff.
    if (inserted.length > 0) {
      emitSSEEvent(
        'whatsapp.message',
        { phone: toPhone, name: profileName, preview: (text ?? '').slice(0, 120) },
        { roles: CHAT_STAFF_ROLES },
      );
    }
  } catch (err) {
    console.error('[whatsapp] Failed to store inbound message:', err);
  }
}

async function applyStatus(st: MetaStatus): Promise<void> {
  const sid = st?.id;
  const status = st?.status;
  if (!sid || !status) return;
  const errorCode =
    Array.isArray(st?.errors) && st.errors[0]?.code != null ? String(st.errors[0].code) : null;

  // Alert staff only on the transition INTO a failure, not on every repeated
  // callback — read the stored status first so a duplicate 'failed' from Meta
  // doesn't re-toast/re-email. A read failure simply skips the dedupe.
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
    console.error('[whatsapp] Failed to apply Meta status update:', err);
  }

  // Fire-and-forget: notifying staff must never delay the webhook ack.
  if (alertOnFailure) void notifyStaffOfWhatsAppFailure(sid);
}

export default router;
