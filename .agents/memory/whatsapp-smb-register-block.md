---
name: WhatsApp SMB account cannot use /register (coexistence required)
description: Why Cloud API /register migration fails for an existing WhatsApp Business App number, and the real paths forward.
---

If a WhatsApp number is owned by an SMB (WhatsApp Business App) account, `POST /{PHONE_ID}/register` fails with **"Register endpoint is not available for SMB businesses."** You CANNOT migrate such a number to Cloud API via a system-user token / Graph API alone.

Signals that a WABA is SMB / shared (coexistence) rather than directly owned:
- `GET /{WABA}?fields=...` returns `(#100) The parameter partner_ids is required.`
- The number shows `platform_type=ON_PREMISE`, `status=DISCONNECTED`, `is_official_business_account=false`, `throughput.level=NOT_APPLICABLE`.

**Why:** Meta routes SMB (Business App) numbers through the Coexistence onboarding, not the partner/BSP register flow. The number stays usable in the phone app; API access is granted via Meta's Embedded Signup (browser) flow, which a system-user token cannot perform.

**How to apply:** Do NOT keep retrying `/register` (or `request_code`) for an SMB app number — it's a Meta policy block, not a transient error. Realistic paths: (1) Coexistence Embedded Signup — user does a browser/Facebook login flow, keeps the app + their number; (2) provision a FRESH dedicated number directly on Cloud API (cleanest/most reliable, NOT a demo/test number). Email + VAPID web push already work as a no-Meta fallback to ship without blocking.
