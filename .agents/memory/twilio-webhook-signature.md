---
name: Twilio status-callback signature
description: How the WhatsApp delivery webhook validates Twilio's X-Twilio-Signature and how to test it.
---

# Twilio WhatsApp status-callback signature

The public `POST /api/whatsapp/status` webhook validates `X-Twilio-Signature`
with HMAC-SHA1(base64) over `URL + sorted(key+value)` keyed by `TWILIO_AUTH_TOKEN`.

**The signed URL must be the *configured* callback URL** (`whatsAppStatusCallbackUrl()`,
derived from `APP_URL`/`PUBLIC_URL`) — the same one passed as `StatusCallback` when
sending. Do NOT reconstruct it from the inbound request: the Replit preview/proxy
rewrites host/proto, so a request-derived URL won't match the HMAC Twilio computed
and every callback 403s.

**Why:** Twilio signs the exact URL it was told to call. Behind a proxy the
received host differs, so signature validation must pin to the known public URL.

**How to apply (prod vs dev):** `verifyWhatsAppWebhookSignature` is fail-closed in
prod (rejects when token present + signature bad), but in dev with no
`TWILIO_AUTH_TOKEN` it accepts unsigned callbacks so local testing works.

**How to test:** set `APP_URL` to a fixed value (e.g. `https://app.test`) so the
signed URL is deterministic, set `TWILIO_AUTH_TOKEN`, then compute the signature in
the test the same way (sort params, concat, HMAC-SHA1, base64) and send the form
body with `.type('form')`. Without pinning APP_URL the supertest ephemeral host
makes the signature impossible to reproduce. Clear these env vars in beforeEach/after.
