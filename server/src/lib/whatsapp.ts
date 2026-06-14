import crypto from 'crypto';
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

export interface WhatsAppConfig {
  enabled: boolean;
  orderEnabled: boolean;
  dispatchEnabled: boolean;
  deliveryEnabled: boolean;
  orderTemplateSid: string | null;
  dispatchTemplateSid: string | null;
  deliveryTemplateSid: string | null;
  // True when the Twilio messaging credentials + sender are present, i.e. real
  // delivery is possible. Surfaced to the admin UI as a configured/not badge.
  configured: boolean;
}

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

// Real WhatsApp delivery needs the shared Twilio account credentials plus a
// registered WhatsApp sender number. (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are
// already used by the OTP flow.)
export function isWhatsAppMessagingConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
  );
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

// Send one approved WhatsApp template to a recipient. `variables` maps the
// template's numbered placeholders ("1", "2", …) to their values. Never throws:
// callers fire-and-forget and any failure is returned, not raised.
export async function sendWhatsAppTemplate(
  toPhone: string | null | undefined,
  templateSid: string | null | undefined,
  variables: Record<string, string>,
): Promise<WhatsAppSendResult> {
  const to = normalizePhone(toPhone);
  if (!to) return { ok: false, channel: 'dev', error: 'No valid recipient phone number.', retryable: false };
  if (!templateSid) return { ok: false, channel: 'dev', error: 'No template configured for this message.', retryable: false };

  if (isWhatsAppMessagingConfigured()) {
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
