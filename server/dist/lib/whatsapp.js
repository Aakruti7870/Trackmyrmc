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
// Real WhatsApp delivery needs the shared Twilio account credentials plus a
// registered WhatsApp sender number. (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are
// already used by the OTP flow.)
export function isWhatsAppMessagingConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM);
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
// Send one approved WhatsApp template to a recipient. `variables` maps the
// template's numbered placeholders ("1", "2", …) to their values. Never throws:
// callers fire-and-forget and any failure is returned, not raised.
export async function sendWhatsAppTemplate(toPhone, templateSid, variables) {
    const to = normalizePhone(toPhone);
    if (!to)
        return { ok: false, channel: 'dev', error: 'No valid recipient phone number.', retryable: false };
    if (!templateSid)
        return { ok: false, channel: 'dev', error: 'No template configured for this message.', retryable: false };
    if (isWhatsAppMessagingConfigured()) {
        try {
            const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: twilioAuthHeader(),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    From: senderAddress(),
                    To: `whatsapp:${to}`,
                    ContentSid: templateSid,
                    ContentVariables: JSON.stringify(variables),
                }),
            });
            if (!res.ok) {
                const detail = await res.text().catch(() => '');
                // 5xx = provider-side fault, 429 = rate limited: both are transient and
                // worth a backed-off retry. Every other 4xx (invalid number, template
                // error, auth) is the caller's fault and will only fail again.
                const retryable = res.status >= 500 || res.status === 429;
                return { ok: false, channel: 'whatsapp', error: `WhatsApp provider error (${res.status}). ${detail.slice(0, 200)}`, retryable };
            }
            return { ok: true, channel: 'whatsapp' };
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
    return { ok: true, channel: 'dev' };
}
