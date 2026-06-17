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
};
// Notifications are on by default, but nothing is actually delivered until a
// Twilio WhatsApp sender + the matching template SID are configured, so these
// defaults are safe.
export const DEFAULT_WHATSAPP_ENABLED = true;
function isProd() {
    return process.env.NODE_ENV === 'production';
}
// The configured Meta sender, or null when either required value is missing. We
// need BOTH the Phone Number ID and the access token to reach Meta; without them
// we fall back to Twilio (below) or the dev / fail-closed path. version + lang
// have safe defaults so only the two identifiers are mandatory.
export function metaWhatsAppConfig() {
    const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID?.trim();
    const token = process.env.WHATSAPP_META_ACCESS_TOKEN?.trim();
    if (!phoneNumberId || !token)
        return null;
    return {
        phoneNumberId,
        token,
        version: process.env.WHATSAPP_META_API_VERSION?.trim() || 'v21.0',
        lang: process.env.WHATSAPP_META_LANG?.trim() || 'en_US',
    };
}
// Twilio WhatsApp delivery needs the shared Twilio account credentials plus a
// registered WhatsApp sender number. (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are
// already used by the OTP flow.)
function isTwilioWhatsAppConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM);
}
// Real WhatsApp delivery is possible when EITHER provider is configured. Meta
// takes precedence when present (see sendWhatsAppTemplate). Surfaced to the admin
// UI as a configured/not badge.
export function isWhatsAppMessagingConfigured() {
    return Boolean(metaWhatsAppConfig()) || isTwilioWhatsAppConfigured();
}
function parseBool(value, fallback) {
    if (value === null)
        return fallback;
    return value === 'true';
}
function clean(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
export async function getWhatsAppConfig() {
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
export function eventEnabled(cfg, event) {
    if (!cfg.enabled)
        return false;
    if (event === 'order')
        return cfg.orderEnabled && !!cfg.orderTemplateSid;
    if (event === 'dispatch')
        return cfg.dispatchEnabled && !!cfg.dispatchTemplateSid;
    return cfg.deliveryEnabled && !!cfg.deliveryTemplateSid;
}
const twilioAuthHeader = () => 'Basic ' +
    Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
function senderAddress() {
    const from = process.env.TWILIO_WHATSAPP_FROM.trim();
    return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
}
// The public URL Twilio should POST delivery-status updates to. Derived from the
// same APP_URL/PUBLIC_URL override used for owner-invite links so it lines up
// with the domain staff actually run on. Returns null when no base URL is known
// (e.g. local dev with no override): we then skip the StatusCallback entirely
// rather than register a bad one. The path must match the mounted webhook route.
export function whatsAppStatusCallbackUrl() {
    const base = (process.env.APP_URL || process.env.PUBLIC_URL || '').trim();
    if (!base)
        return null;
    return `${base.replace(/\/+$/, '')}/api/whatsapp/status`;
}
// --- Meta WhatsApp Cloud API ------------------------------------------------
// Convert the numbered-placeholder variable map ({"1":…,"2":…}) into Meta's
// ordered body-parameter array, sorted numerically so {{1}},{{2}},… line up with
// the template's positional placeholders.
function metaBodyParams(variables) {
    return Object.keys(variables)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => ({ type: 'text', text: variables[k] }));
}
// Send one approved Meta template via the Graph API. `templateName` is the Meta
// template's name; `to` is a normalized +E.164 number (Meta wants digits only,
// so the leading + is stripped). Mirrors the Twilio path's result contract,
// including the transient-vs-permanent retryable classification.
async function sendViaMeta(cfg, to, templateName, variables) {
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
        const res = await fetch(`https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cfg.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
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
        const body = (await res.json().catch(() => ({})));
        return { ok: true, channel: 'whatsapp', sid: body.messages?.[0]?.id, status: 'accepted' };
    }
    catch {
        // Network-level failure (DNS, connection, timeout) — the provider was briefly
        // unreachable, so this is the canonical transient case to retry.
        return { ok: false, channel: 'whatsapp', error: 'Could not reach the WhatsApp provider.', retryable: true };
    }
}
// Send one approved WhatsApp template to a recipient. `variables` maps the
// template's numbered placeholders ("1", "2", …) to their values. When the Meta
// Cloud API is configured it is used (templateSid carries the Meta template
// NAME); otherwise Twilio is used (templateSid is a Content SID). Never throws:
// callers fire-and-forget and any failure is returned, not raised.
export async function sendWhatsAppTemplate(toPhone, templateSid, variables) {
    const to = normalizePhone(toPhone);
    if (!to)
        return { ok: false, channel: 'dev', error: 'No valid recipient phone number.', retryable: false };
    if (!templateSid)
        return { ok: false, channel: 'dev', error: 'No template configured for this message.', retryable: false };
    // Meta Cloud API takes precedence when configured.
    const meta = metaWhatsAppConfig();
    if (meta)
        return sendViaMeta(meta, to, templateSid, variables);
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
            if (callback)
                params.set('StatusCallback', callback);
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: twilioAuthHeader(),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            });
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
            const body = (await res.json().catch(() => ({})));
            return { ok: true, channel: 'whatsapp', sid: body.sid, status: body.status ?? 'queued' };
        }
        catch {
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
export function validateTwilioSignature(authToken, signature, url, params) {
    if (!signature)
        return false;
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
export function verifyWhatsAppWebhookSignature(signature, url, params) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken)
        return !isProd();
    return validateTwilioSignature(authToken, signature, url, params);
}
