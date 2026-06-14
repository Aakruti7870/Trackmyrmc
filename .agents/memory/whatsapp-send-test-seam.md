---
name: Testing WhatsApp send outcomes
description: How to deterministically control sendWhatsAppTemplate results in a full-app supertest without mock.module
---

When a server test needs to drive `sendWhatsAppTemplate` (lib/whatsapp.ts) to a
specific outcome (success / transient-retry / permanent-give-up) **and** also boots
the full app via `buildTestApp`, do NOT `mock.module('../lib/whatsapp.js', …)`.

**Why mock.module fails here:**
- `mock.module` FULLY replaces the module — only the exports you list exist. The
  full route graph imports many things from whatsapp.js (`getWhatsAppConfig`,
  `WHATSAPP_KEYS`, `DEFAULT_WHATSAPP_ENABLED`, `eventEnabled`, …), so the mock
  must re-declare every one or you get `does not provide an export named X` at load.
  This list silently grows as the module grows — brittle.
- You cannot pre-import the real module to spread it: under **tsx, `whatsapp.ts`
  and `whatsapp.js` resolve to the SAME module**, so importing either one caches
  the real module and *poisons the mock* for downstream importers (e.g.
  whatsappRetry.js keeps calling the real sender; you'll see `[whatsapp:dev] →`).

**The seam that works:** set the Twilio env vars so `isWhatsAppMessagingConfigured()`
is true and the real sender takes its provider branch, then stub `globalThis.fetch`
to return a controllable `new Response(body, { status })`:
- 2xx → success ("sent")
- 5xx / 429 → transient → retryable ("retried", row rescheduled, attempts++)
- other 4xx → permanent → not retryable ("gaveUp", row dropped)

Each test file runs in its own `node --test` process (see scripts/test.mjs), so
setting env + replacing global.fetch is isolated. This also guards against real
network calls if the validation env has live TWILIO_* secrets (the runner only
strips SMTP_*, not TWILIO_*). Restore `globalThis.fetch` in `after`.
