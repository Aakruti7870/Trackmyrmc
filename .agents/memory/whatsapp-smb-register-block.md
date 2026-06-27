---
name: WhatsApp SMB account cannot use /register (coexistence required)
description: Why Cloud API /register migration fails for an existing WhatsApp Business App number, and the real paths forward.
---

**Picking the right WABA/number (durable lesson):** one Business can own SEVERAL near-identically-named WABAs, and the SAME display number can appear on multiple of them as DIFFERENT `phone_number_id`s (some PENDING, some CONNECTED, some with zero templates). Do NOT match by display name or by the phone number — match by the WABA that is CONNECTED + CLOUD_API AND actually carries the APPROVED message templates you need. Enumerate candidates via `GET /{business_id}/owned_whatsapp_business_accounts` (NOT a single Business-Settings URL), then check each WABA's `message_templates` before wiring `WHATSAPP_META_PHONE_NUMBER_ID`.
- A `(#10) Application does not have permission` on `POST /{phone_id}/register` usually just means the number is ALREADY CONNECTED, not a real permission gap — reads + template lists still work; do NOT keep retrying register.
- A system-user token belongs to a SPECIFIC app — debug/self-debug it against its OWN app id, not a sibling app with a near-identical name.
- `WHATSAPP_META_PHONE_NUMBER_ID` may exist BOTH as a shared env var AND a same-named secret; the shared env var wins at runtime, so `setEnvVars` + workflow restart is enough (verify via `/proc/<pid>/environ`). The live phone id / token live in env (the source of truth) — never copy them (or the display number) into memory.

A WABA created from the WhatsApp **Business (consumer) app** is consumer-grade, NOT a Cloud-API WABA. Such a WABA is permanently blocked from the two operations a Cloud API needs — you CANNOT reuse it for Cloud API:
- `POST /{PHONE_ID}/register` → **"Register endpoint is not available for SMB businesses."**
- `POST /{WABA}/message_templates` → **"This WABA is not allowed to create or update templates."** (`error_subcode 2494160`, `code 100`, non-transient).
Both are Meta **policy blocks**, not transient errors and not formatting bugs. A system-user token / Graph API alone cannot lift them.

Signals that a WABA is consumer-grade / SMB / shared rather than a real Cloud-API WABA:
- `GET /{WABA}?fields=...` returns `(#100) The parameter partner_ids is required.`
- The number shows `platform_type=ON_PREMISE`, `status=DISCONNECTED`, `is_official_business_account=false`, `throughput.level=NOT_APPLICABLE`.

**Why:** Meta routes SMB (Business App) numbers through the Coexistence onboarding, not the partner/BSP register flow. The number stays usable in the phone app; API access is granted via Meta's Embedded Signup (browser) flow, which a system-user token cannot perform.

**How to apply:** Do NOT keep retrying `/register` (or `request_code`) or `/message_templates` against a consumer-grade WABA — they are Meta policy blocks, not transient errors. To put an EXISTING consumer-app number on Cloud API self-serve: (1) user frees it — WhatsApp Business app → Settings → Account → Delete my account → wait ~3 min (loses chat history + app use of that number; get explicit consent); (2) user re-onboards the freed number through Meta's **Embedded Signup wizard** in the developer console (App → WhatsApp → API Setup → add phone number), which mints a NEW Cloud-API-grade WABA + a NEW `phone_number_id` — the old consumer WABA/IDs are dead and stay blocked. Then update `WHATSAPP_META_PHONE_NUMBER_ID` to the new id, create templates (now allowed), and test. Embedded Signup is a browser flow a system-user token cannot perform, so this step is unavoidably user-driven. Other paths: provision a FRESH dedicated number directly on Cloud API; or real Coexistence (keeps the app) which needs a Meta Tech Provider. Email + VAPID web push already work as a no-Meta fallback to ship without blocking.

**Coexistence is heavier than it sounds (2025/2026):** real Coexistence (number live in BOTH the WhatsApp Business App AND Cloud API) requires the connecting platform to be a **Meta Tech Provider** with Embedded Signup configured + Advanced access to `whatsapp_business_messaging`/`whatsapp_business_management` via App Review (days/weeks). A self-serve owner app is NOT a Tech Provider, so this is not a quick step. The number must already be active in the WhatsApp Business App on a phone for the QR pairing to work.

**Practical "keep the same number" route without Tech Provider:** have the user do the standard **WhatsApp Manager UI** add/verify-phone flow (Business Settings → WhatsApp Manager → Phone numbers → add/verify). This is a non-coexistence full migration: it needs the user to RECEIVE an SMS/voice OTP on that number (must hold the SIM), and it will DISCONNECT the number from any active WhatsApp Business App on the phone. Fine when the number is an idle/abandoned reg; get explicit consent if it's their live chat number.
