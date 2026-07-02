import crypto from 'crypto';
import { db } from '../db/index.js';
import { appSettings } from '../db/schema.js';
import { getSettings } from './settings.js';
import { normalizePhone } from './otp.js';

// WhatsApp business-notification sender (Twilio Programmable Messaging).
//
// This is distinct from otp.ts: Twilio *Verify* (used for login codes) can only
// send one-time passcodes. Business-initiated messages (order/dispatch/delivery
// updates) go through the Programmable Messaging API using a pre-approved
// WhatsApp message *template* (Content SID) plus its variables — WhatsApp does
// not allow free-form business-initiated text outside the 24h service window.
//
// Mirrors the otp.ts contract: a configured-check, a hard prod fail-closed, and
// a dev console-log fallback so the whole flow is exercisable with no Twilio
// credentials. Nothing here ever throws — delivery is best-effort and must never
// break the request that triggered it.

// app_settings keys. Toggles persist 'true'/'false'; SIDs persist the raw
// Twilio Content SID (HX…). Absent rows fall back to the defaults below.
export const WHATSAPP_KEYS = {
  enabled: 'whatsapp_enabled',
  orderEnabled: 'whatsapp_order_enabled',
  dispatchEnabled: 'whatsapp_dispatch_enabled',
  deliveryEnabled: 'whatsapp_delivery_enabled',
  orderTemplateSid: 'whatsapp_order_template_sid',
  dispatchTemplateSid: 'whatsapp_dispatch_template_sid',
  deliveryTemplateSid: 'whatsapp_delivery_template_sid',
} as const;

// Notifications are on by default, but nothing is actually delivered until a
// Twilio WhatsApp sender + the matching template SID are configured, so these
// defaults are safe.
export const DEFAULT_WHATSAPP_ENABLED = true;

export type WhatsAppEvent = 'order' | 'dispatch' | 'delivery';

// Out-of-the-box per-event Meta template NAMES. When the Meta Cloud API sender is
// configured, the per-event "template" settings hold a Meta template name (not a
// Twilio Content SID); these values match the approved templates on the
// production WABA. Seeded on boot (see ensureWhatsAppTemplateDefaults) so
// order/dispatch/delivery alerts deliver without an admin first filling them in.
export const DEFAULT_META_TEMPLATE_NAMES: Record<WhatsAppEvent, string> = {
  order: 'order_confirmation',
  dispatch: 'dispatch_update',
  delivery: 'delivery_confirmation',
};

export interface WhatsAppConfig {
  enabled: boolean;
  orderEnabled: boolean;
  dispatchEnabled: boolean;
  deliveryEnabled: boolean;
  orderTemplateSid: string | null;
  dispatchTemplateSid: string | null;
  deliveryTemplateSid: string | null;
  // True when a provider (Meta Cloud API or Twilio) is configured, i.e. real
  // delivery is possible. Surfaced to the admin UI as a configured/not badge.
  configured: boolean;
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Meta WhatsApp Cloud API sender. When a Phone Number ID + access token are both
// present we send business templates straight through Meta's Graph API. In this
// mode the per-event "template" settings hold the Meta template NAME (not a
// Twilio Content SID) and placeholders are filled positionally ({{1}},{{2}},…).
export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  token: string;
  version: string;
  lang: string;
}

// The configured Meta sender, or null when either required value is missing. We
// need BOTH the Phone Number ID and the access token to reach Meta; without them
// we fall back to Twilio (below) or the dev / fail-closed path. version + lang
// have safe defaults so only the two identifiers are mandatory.
export function metaWhatsAppConfig(): MetaWhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID?.trim();
  const token = process.env.WHATSAPP_META_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !token) return null;
  return {
    phoneNumberId,
    token,
    version: process.env.WHATSAPP_META_API_VERSION?.trim() || 'v21.0',
    lang: process.env.WHATSAPP_META_LANG?.trim() || 'en_US',
  };
}

// The token Meta echoes back during the Webhooks "Verify and save" handshake.
// Meta sends a GET with hub.verify_token; we must compare it to this value and
// reply with hub.challenge. Returns null when unset so verification fails closed.
export function metaWebhookVerifyToken(): string | null {
  return process.env.WHATSAPP_META_VERIFY_TOKEN?.trim() || null;
}

// Verify an incoming Meta webhook POST against its X-Hub-Signature-256 header.
// Meta signs the raw request body as 'sha256=' + HMAC-SHA256(appSecret, body).
// Returns 'unconfigured' when no app secret is set (we then accept best-effort,
// mirroring how the rest of the WhatsApp stack is gated by configuration),
// 'valid' on a matching signature, and 'invalid' otherwise.
export function verifyMetaWebhookSignature(
  signatureHeader: string | null | undefined,
  rawBody: Buffer | undefined,
): 'valid' | 'invalid' | 'unconfigured' {
  const appSecret = process.env.WHATSAPP_META_APP_SECRET?.trim();
  if (!appSecret) return 'unconfigured';
  if (!signatureHeader || !rawBody || rawBody.length === 0) return 'invalid';
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return 'invalid';
  return crypto.timingSafeEqual(a, b) ? 'valid' : 'invalid';
}

// Twilio WhatsApp delivery needs the shared Twilio account credentials plus a
// registered WhatsApp sender number. (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are
// already used by the OTP flow.)
function isTwilioWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
  );
}

// Real WhatsApp delivery is possible when EITHER provider is configured. Meta
// takes precedence when present (see sendWhatsAppTemplate). Surfaced to the admin
// UI as a configured/not badge.
export function isWhatsAppMessagingConfigured(): boolean {
  return Boolean(metaWhatsAppConfig()) || isTwilioWhatsAppConfigured();
}

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === 'true';
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getWhatsAppConfig(): Promise<WhatsAppConfig> {
  const s = await getSettings(Object.values(WHATSAPP_KEYS));
  return {
    enabled: parseBool(s[WHATSAPP_KEYS.enabled], DEFAULT_WHATSAPP_ENABLED),
    orderEnabled: parseBool(s[WHATSAPP_KEYS.orderEnabled], DEFAULT_WHATSAPP_ENABLED),
    dispatchEnabled: parseBool(s[WHATSAPP_KEYS.dispatchEnabled], DEFAULT_WHATSAPP_ENABLED),
    deliveryEnabled: parseBool(s[WHATSAPP_KEYS.deliveryEnabled], DEFAULT_WHATSAPP_ENABLED),
    orderTemplateSid: clean(s[WHATSAPP_KEYS.orderTemplateSid]),
    dispatchTemplateSid: clean(s[WHATSAPP_KEYS.dispatchTemplateSid]),
    deliveryTemplateSid: clean(s[WHATSAPP_KEYS.deliveryTemplateSid]),
    configured: isWhatsAppMessagingConfigured(),
  };
}

// Whether a given event should fire, combining the global switch with the
// per-event toggle and the presence of an approved template for that event.
export function eventEnabled(cfg: WhatsAppConfig, event: WhatsAppEvent): boolean {
  if (!cfg.enabled) return false;
  if (event === 'order') return cfg.orderEnabled && !!cfg.orderTemplateSid;
  if (event === 'dispatch') return cfg.dispatchEnabled && !!cfg.dispatchTemplateSid;
  return cfg.deliveryEnabled && !!cfg.deliveryTemplateSid;
}

// Seed the per-event Meta template NAMES the first time the app boots with a Meta
// Cloud API sender configured, so business-initiated alerts fire out of the box.
// Idempotent (onConflictDoNothing): it never overwrites a name an admin set in the
// Settings UI, and it no-ops when Meta isn't configured (Twilio mode needs Content
// SIDs, not template names, so seeding names there would be wrong). Mirrors
// ensurePlantDirectory — runs on every dev restart and prod publish, and is
// prod-safe via the conflict guard. Best-effort; callers swallow failures.
export async function ensureWhatsAppTemplateDefaults(): Promise<number> {
  if (!metaWhatsAppConfig()) return 0;
  const now = new Date();
  const rows = [
    { key: WHATSAPP_KEYS.orderTemplateSid, value: DEFAULT_META_TEMPLATE_NAMES.order, updatedAt: now },
    { key: WHATSAPP_KEYS.dispatchTemplateSid, value: DEFAULT_META_TEMPLATE_NAMES.dispatch, updatedAt: now },
    { key: WHATSAPP_KEYS.deliveryTemplateSid, value: DEFAULT_META_TEMPLATE_NAMES.delivery, updatedAt: now },
  ];
  const inserted = await db
    .insert(appSettings)
    .values(rows)
    .onConflictDoNothing({ target: appSettings.key })
    .returning({ key: appSettings.key });
  if (inserted.length) {
    console.log(`ensureWhatsAppTemplateDefaults: seeded ${inserted.length} template name(s)`);
  }
  return inserted.length;
}

const twilioAuthHeader = () =>
  'Basic ' +
  Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

function senderAddress(): string {
  const from = process.env.TWILIO_WHATSAPP_FROM!.trim();
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
}

export interface WhatsAppSendResult {
  ok: boolean;
  channel: 'whatsapp' | 'dev';
  // The Twilio message SID (SM…/MM…) when a real send was accepted, so the
  // caller can persist it and later match the status-callback webhook. Absent on
  // the dev fallback and on any send that never reached Twilio.
  sid?: string;
  // The send-time delivery state. Twilio returns 'queued'/'accepted' immediately;
  // the webhook later advances it. 'dev' marks the logged-only dev fallback.
  status?: string;
  error?: string;
  // True only for *transient* failures worth re-sending later (provider
  // unreachable, or a 5xx/429 from Twilio). Permanent failures — a bad number,
  // a template error (4xx), an unconfigured provider, or a missing recipient —
  // are false, so the retry queue never wastes attempts on something that can
  // only fail again. Undefined when ok.
  retryable?: boolean;
}

// The public URL Twilio should POST delivery-status updates to. Derived from the
// same APP_URL/PUBLIC_URL override used for owner-invite links so it lines up
// with the domain staff actually run on. Returns null when no base URL is known
// (e.g. local dev with no override): we then skip the StatusCallback entirely
// rather than register a bad one. The path must match the mounted webhook route.
export function whatsAppStatusCallbackUrl(): string | null {
  const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/api/whatsapp/status`;
}

// --- Meta WhatsApp Cloud API ------------------------------------------------

// Convert the numbered-placeholder variable map ({"1":…,"2":…}) into Meta's
// ordered body-parameter array, sorted numerically so {{1}},{{2}},… line up with
// the template's positional placeholders.
function metaBodyParams(variables: Record<string, string>): { type: 'text'; text: string }[] {
  return Object.keys(variables)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => ({ type: 'text' as const, text: variables[k] }));
}

// Send one approved Meta template via the Graph API. `templateName` is the Meta
// template's name; `to` is a normalized +E.164 number (Meta wants digits only,
// so the leading + is stripped). Mirrors the Twilio path's result contract,
// including the transient-vs-permanent retryable classification.
async function sendViaMeta(
  cfg: MetaWhatsAppConfig,
  to: string,
  templateName: string,
  variables: Record<string, string>,
): Promise<WhatsAppSendResult> {
  try {
    const params = metaBodyParams(variables);
    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: cfg.lang },
        // A static template (no placeholders) must NOT send an empty body
        // component, or Meta rejects it — only include components when we have
        // parameters to fill.
        ...(params.length ? { components: [{ type: 'body', parameters: params }] } : {}),
      },
    };
    const res = await fetch(
      `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Same split as Twilio: 5xx = provider-side fault and 429 = rate limited are
      // transient and worth a backed-off retry; every other 4xx (bad number,
      // template/name error, expired token) is permanent and will only fail again.
      const retryable = res.status >= 500 || res.status === 429;
      return { ok: false, channel: 'whatsapp', error: `WhatsApp provider error (${res.status}). ${detail.slice(0, 200)}`, retryable };
    }
    // Meta returns { messages: [{ id: "wamid…" }] }. Persist that id as the SID so
    // the stored notification row carries the provider's message handle. Parse
    // defensively: a malformed body must not turn an accepted send into a failure.
    const body = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
    return { ok: true, channel: 'whatsapp', sid: body.messages?.[0]?.id, status: 'accepted' };
  } catch {
    // Network-level failure (DNS, connection, timeout) — the provider was briefly
    // unreachable, so this is the canonical transient case to retry.
    return { ok: false, channel: 'whatsapp', error: 'Could not reach the WhatsApp provider.', retryable: true };
  }
}

// Send one free-text (session) WhatsApp message via the Meta Cloud API. Unlike
// templates, free text is only deliverable inside Meta's 24-hour customer
// service window (i.e. the customer messaged us within the last 24h) — the
// caller enforces that window; Meta rejects the send otherwise. Meta-only:
// Twilio freeform uses a different flow we don't support, so without a Meta
// sender this falls back to the dev log (non-prod) or fails closed (prod).
export async function sendWhatsAppText(
  toPhone: string | null | undefined,
  bodyText: string,
): Promise<WhatsAppSendResult> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, channel: 'dev', error: 'No valid recipient phone number.', retryable: false };
  const text = bodyText.trim();
  if (!text) return { ok: false, channel: 'dev', error: 'Message text is empty.', retryable: false };

  const meta = metaWhatsAppConfig();
  if (meta) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${meta.version}/${meta.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${meta.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to.replace(/^\+/, ''),
            type: 'text',
            text: { body: text },
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        const retryable = res.status >= 500 || res.status === 429;
        return { ok: false, channel: 'whatsapp', error: `WhatsApp provider error (${res.status}). ${detail.slice(0, 200)}`, retryable };
      }
      const body = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
      return { ok: true, channel: 'whatsapp', sid: body.messages?.[0]?.id, status: 'accepted' };
    } catch {
      return { ok: false, channel: 'whatsapp', error: 'Could not reach the WhatsApp provider.', retryable: true };
    }
  }

  if (!isProd()) {
    console.log(`[whatsapp:dev] text -> ${to}: ${text}`);
    return { ok: true, channel: 'dev', status: 'dev' };
  }
  return { ok: false, channel: 'dev', error: 'WhatsApp Cloud API is not configured.', retryable: false };
}

// Send one approved WhatsApp template to a recipient. `variables` maps the
// template's numbered placeholders ("1", "2", …) to their values. When the Meta
// Cloud API is configured it is used (templateSid carries the Meta template
// NAME); otherwise Twilio is used (templateSid is a Content SID). Never throws:
// callers fire-and-forget and any failure is returned, not raised.
export async function sendWhatsAppTemplate(
  toPhone: string | null | undefined,
  templateSid: string | null | undefined,
  variables: Record<string, string>,
): Promise<WhatsAppSendResult> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, channel: 'dev', error: 'No valid recipient phone number.', retryable: false };
  if (!templateSid) return { ok: false, channel: 'dev', error: 'No template configured for this message.', retryable: false };

  // Meta Cloud API takes precedence when configured.
  const meta = metaWhatsAppConfig();
  if (meta) return sendViaMeta(meta, to, templateSid, variables);

  if (isTwilioWhatsAppConfigured()) {
    try {
      const params = new URLSearchParams({
        From: senderAddress(),
        To: `whatsapp:${to}`,
        ContentSid: templateSid,
        ContentVariables: JSON.stringify(variables),
      });
      // Ask Twilio to call us back with delivery-status updates. Only when we
      // know our own public URL — otherwise the callback would 404.
      const callback = whatsAppStatusCallbackUrl();
      if (callback) params.set('StatusCallback', callback);

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: twilioAuthHeader(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        // 5xx = provider-side fault, 429 = rate limited: both are transient and
        // worth a backed-off retry. Every other 4xx (invalid number, template
        // error, auth) is the caller's fault and will only fail again.
        const retryable = res.status >= 500 || res.status === 429;
        return { ok: false, channel: 'whatsapp', error: `WhatsApp provider error (${res.status}). ${detail.slice(0, 200)}`, retryable };
      }
      // Capture the SID + initial status so the caller can persist and the webhook
      // can later match. A malformed body must not turn a successful send into a
      // failure, so parse defensively.
      const body = (await res.json().catch(() => ({}))) as { sid?: string; status?: string };
      return { ok: true, channel: 'whatsapp', sid: body.sid, status: body.status ?? 'queued' };
    } catch {
      // Network-level failure (DNS, connection, timeout) — the provider was
      // briefly unreachable, so this is the canonical transient case to retry.
      return { ok: false, channel: 'whatsapp', error: 'Could not reach the WhatsApp provider.', retryable: true };
    }
  }

  // --- Dev fallback ---------------------------------------------------------
  // Fail CLOSED in production: with no provider there is no way to deliver, so
  // returning ok would silently drop real customer notifications. Not retryable:
  // a backed-off re-send can't conjure provider credentials, so queuing it would
  // just churn until the attempts are exhausted.
  if (isProd()) {
    return { ok: false, channel: 'dev', error: 'WhatsApp messaging is not configured.', retryable: false };
  }
  console.info(`[whatsapp:dev] → ${to} template=${templateSid} vars=${JSON.stringify(variables)}`);
  return { ok: true, channel: 'dev', status: 'dev' };
}

// Recompute Twilio's X-Twilio-Signature for an incoming status-callback POST and
// constant-time compare it to the header. The algorithm (per Twilio's docs): take
// the exact callback URL, append every POST param sorted by key as key+value
// (no separators), HMAC-SHA1 with the account auth token, base64-encode.
//
// `url` MUST be the URL Twilio was told to call (our whatsAppStatusCallbackUrl),
// not a proxy-rewritten request URL, or the signature won't match.
export function validateTwilioSignature(
  authToken: string,
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!signature) return false;
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Webhook-level gate for the status callback. Verifies the request really came
// from Twilio. With no auth token configured we can't verify: accept in dev so
// the flow is exercisable, but fail CLOSED in production (reject unsigned posts).
export function verifyWhatsAppWebhookSignature(
  signature: string | undefined,
  url: string,
  params: Record<string, string>,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return !isProd();
  return validateTwilioSignature(authToken, signature, url, params);
}
