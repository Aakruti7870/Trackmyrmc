---
name: WhatsApp Meta Cloud API provider
description: How the WhatsApp send path chooses Meta vs Twilio and what gates activation.
---

The WhatsApp notification send path supports TWO providers, selected at runtime
inside the single `sendWhatsAppTemplate()` entrypoint: **Meta-first**, then Twilio,
then dev/fail-closed. `templateSid`/per-event template fields hold the **Meta
template NAME** (e.g. `order_placed`) when Meta is active, or the Twilio Content
SID (`HX…`) when Twilio is active — same column, different meaning per provider.

**Activation gate:** `metaWhatsAppConfig()` returns non-null only when BOTH
`WHATSAPP_META_PHONE_NUMBER_ID` and `WHATSAPP_META_ACCESS_TOKEN` are set, so the
app stays inert (Twilio/dev path) until both arrive — no premature activation.
`isWhatsAppMessagingConfigured()` = Meta-configured OR Twilio-configured.

**Why these constraints:**
- Meta payload uses positional body params ordered NUMERICALLY (so `10` sorts
  after `2`, not after `1`), recipient digits with the leading `+` stripped.
- Retryable classification mirrors Twilio exactly (5xx/429/network = retryable,
  other 4xx = permanent) so the existing whatsappRetry queue works unchanged.

**Test isolation:** `server/scripts/test.mjs` strips ambient `WHATSAPP_META_*`
from baseEnv (like it does `SMTP_*`/`TWILIO_*` partially) so the globally-set
production Meta creds do NOT flip legacy Twilio/dev-path tests. Meta-specific
tests set the env themselves and stub `global.fetch`.

**Known limitation:** Meta delivery-status webhook is NOT built. Only Twilio has
`/api/whatsapp/status`. Meta sends are recorded as `accepted` at send time — no
delivered/read tracking. The admin message-status badge ("Twilio error …") only
reflects Twilio status callbacks.

**Go-live (per-tenant, in app_settings via Settings → WhatsApp Notifications):**
set the 3 approved Meta template names + enable toggles; `eventEnabled()` needs a
template name per event in addition to the global switch.

**Out-of-the-box defaults:** `ensureWhatsAppTemplateDefaults()` (in whatsapp.ts,
called ONLY from index.ts `app.listen`, NOT buildTestApp) seeds the 3 approved
template NAMES into app_settings with `onConflictDoNothing`, but ONLY when
`metaWhatsAppConfig()` is set — so alerts work without manual Settings entry, an
admin override is never clobbered, and it's prod-safe (self-seeds on publish like
ensurePlantDirectory, since the prod DB is read-only to the agent).
`getWhatsAppConfig()` stays null-default, so the test DB is never seeded and no
real sends arm in tests. CAVEAT: a send still fails at Meta if the approved
template body's `{{n}}` count ≠ the vars the code sends (order=6, dispatch/
delivery=5) — verify each template body, not just its name.
