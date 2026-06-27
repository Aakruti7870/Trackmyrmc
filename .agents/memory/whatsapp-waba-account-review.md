---
name: WhatsApp WABA account review gates /register
description: Why phone /register fails even when the Meta business is verified, and the two-WABA / two-number trap for this project.
---

# WhatsApp go-live gates (Cloud API number)

**Rule:** `business_verification_status: verified` on the WABA does NOT mean you can register a number for Cloud API sending. `POST /{phone_id}/register` fails with `(#100) Invalid parameter … unverified WABA … account is not verified` until the WABA's **`account_review_status` flips from `PENDING` to `APPROVED`**. That account review is Meta's queue — there is no Graph endpoint to trigger or expedite it.

**Also gating go-live:** the phone's **`name_status`** (display name). It can come back `DECLINED`; a declined/absent display name must be resubmitted (WhatsApp Manager UI — no reliable self-serve Graph endpoint for non-tech-provider businesses) before the number is usable to customers. `platform_type: NOT_APPLICABLE` means the number is NOT yet on Cloud API; it becomes `CLOUD_API` only after a successful register.

**Why this matters here — two different account/number types existed for this project (identifiers intentionally omitted; look them up in the live Meta dashboards, never hardcode):**
- **The SMB number** — a WhatsApp Business *app* (SMB) type WABA. CANNOT use Cloud API. Dead end, confirmed three ways even after its `account_review_status` flipped to **APPROVED**: (1) phone stuck `platform_type=ON_PREMISE`, `status=DISCONNECTED`, `code_verification_status=NOT_VERIFIED`; (2) `request_code` (SMS+VOICE) throttled `136024` "servers temporarily unavailable, wait 1 hour" (each retry restarts the clock); (3) template create returns `2494160` "WABA not allowed to manage templates". **Lesson: an APPROVED review on a legacy/On-Premise/SMB WABA is NOT a usable Cloud API sender** — template sends need a proper Cloud API WABA.
- **The Cloud API number** — a proper **Cloud API** WABA under the chosen business. This is the chosen sender. Templates (order_confirmation/dispatch_update/delivery_confirmation) created here, pending approval.

**Misleading signal:** WABA-level `health_status.can_send_message: AVAILABLE` does NOT mean the number can register — the PHONE entity health returns `BLOCKED` with error 141000 ("not linked … Register and finish OTP"), yet `/register` still hard-fails with "unverified WABA" while `account_review_status: PENDING`. So trust `account_review_status`, not WABA `health_status`, as the register gate. Subscribing the app to the WABA (`POST /{WABA}/subscribed_apps`) succeeds independently and is safe to do early.

**How to apply:** before attempting `/register`, GET the WABA `account_review_status` and the phone `platform_type`; only register when review is APPROVED and platform_type != CLOUD_API. Don't re-POST register on a PENDING WABA (it just re-fails). Meta's shared test number only reaches a few approved recipients; switching the app env phone-id to the real number is the last step once it's registered.
