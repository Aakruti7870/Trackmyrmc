---
name: WhatsApp Meta OTP login delivery
description: How phone-login OTP is delivered over Meta WhatsApp (local code, auth-template send) and the AUTHENTICATION-template eligibility blocker.
---

# Phone-login OTP over Meta WhatsApp

OTP delivery has three tiers in `lib/otp.ts` `sendOtp`, in priority order:
1. **Twilio Verify** (remote generate+verify) — only when a Verify Service SID is configured.
2. **Meta WhatsApp** — generate the code locally, store its hash, send it via an
   approved **AUTHENTICATION**-category template, then `verifyOtp` validates **locally**
   against the stored hash (the same local path as the dev fallback). Returns channel
   `whatsapp`.
3. **Dev fallback** — local hash, code echoed only in non-prod; fail-closed in prod.

**Why the verify path "just works" for Meta:** `verifyOtp` only goes remote when Twilio
Verify is configured; otherwise it always checks the local hash. So Meta + dev share one
verification code path — don't add a Meta-specific verify branch.

**devMode flag:** `/otp/send` must report `devMode: !isOtpDeliveryConfigured()`
(Twilio Verify OR Meta), NOT the old Twilio-only check, or a real Meta send is
mislabeled dev and could leak `devCode`.

**Send payload:** AUTHENTICATION templates carry the code in BOTH a BODY text param and
the OTP button (`sub_type: 'url'`, `index: 0`, text = the code) — this populates copy-code
and one-tap buttons alike. Same shape regardless of `otp_type`.

**Failed-send cleanup must be hash-scoped:** on a failed Meta send, delete the stored row
`WHERE phone = ? AND codeHash = ?` (the code just generated), never `WHERE phone = ?`
alone — a blanket delete clobbers a concurrent newer send's code.

## AUTHENTICATION-template eligibility blocker
Creating an AUTHENTICATION template can fail with `(#10) ... does not have permission to
create message template` (`error_subcode 2388185`) **even when UTILITY templates create
fine on the same WABA**. This is a WABA-level eligibility limit (sandbox/test WABAs, and
WABAs that haven't unlocked the Authentication category) — NOT a payload bug, so don't
retry with payload tweaks. The user must create the `login_code` AUTHENTICATION template
in WhatsApp Manager on an eligible (production/verified) WABA, and OTP login only works
once that template is **APPROVED**. The template name is overridable via
`WHATSAPP_META_OTP_TEMPLATE` (default `login_code`).

## Twilio Verify bypasses the auth-template blocker entirely
If the Meta AUTHENTICATION template is blocked, switch to **Twilio Verify** — it is the
*first*-priority tier and needs **NO WhatsApp template at all** (Twilio generates,
delivers, and verifies the code). Activation requires all three of `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. The Verify **Service SID** (starts
`VA…`) is a non-secret identifier — list existing services via
`GET https://verify.twilio.com/v2/Services` (auth = account SID + auth token) and set it
with `setEnvVars` (no need to `requestEnvVar`). Caveat: the code sends `Channel: 'whatsapp'`,
so the Twilio account must have **WhatsApp enabled for Verify**; if not, the send 4xx's and
you'd either enable WhatsApp Verify or change the channel to `sms`.
