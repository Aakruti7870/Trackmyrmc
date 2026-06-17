---
name: WhatsApp test env isolation
description: Why WhatsApp "unconfigured" tests must clear ambient TWILIO_* env vars, and which files do it.
---

# WhatsApp test env isolation

Tests that assert the **unconfigured** Twilio/WhatsApp branches (dev-fallback "ok",
fail-closed in prod, `configured:false`, dev-channel resend) must snapshot + delete
`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` in a `before()`
hook and restore them in `after()`. `getWhatsAppConfig().configured` and
`sendWhatsAppTemplate`'s dev-vs-live branch are driven by those env vars.

**Why:** once real Twilio secrets exist in the shared workspace env, every workflow
(incl. the `test` runner) sees them, so these assertions flip and the live provider
path can fire. This is the same hazard as the Gemini AI tests.

**How to apply:** the guard lives in `whatsapp.test.ts`, `admin.whatsapp.test.ts`,
and `whatsapp.resend.test.ts`. Tests that *set* `TWILIO_*` themselves + stub
`global.fetch` (the send-outcome suites) don't need it. Workers are separate
processes so env mutations don't bleed cross-worker; the `after()` restore prevents
intra-worker bleed.
