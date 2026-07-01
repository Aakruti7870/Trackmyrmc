---
name: RMC runtime secrets vs viewEnvVars
description: viewEnvVars under-reports secrets the running server actually has; probe live endpoints to learn true provider config.
---

`viewEnvVars()` (environment-secrets skill) does NOT reliably list every secret the running workflow process sees. In this repl it reported `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`CLERK_SECRET_KEY` as MISSING, yet the live server clearly had all of them.

**Why:** account/deploy-level secrets are injected into the workflow process env but aren't surfaced by the managed-secrets view. The system prompt's `<available_secrets>` banner is a better signal, and even it isn't exhaustive.

**How to apply:** to determine which auth/OTP provider is actually active, PROBE the running server, don't infer from viewEnvVars:
- Customer SMS OTP live: `POST /api/auth/otp/send {phone}` → `{"channel":"sms"}` means Twilio Verify is configured AND the send hit Twilio 2xx (all three TWILIO_* present). `{"channel":"whatsapp"}` = Meta. `{"channel":"dev","devCode":...}` = no provider (dev fallback).
- Clerk configured check: `POST /api/auth/clerk {token:"dummy"}` → 401 "Invalid or expired single sign-on session" = configured; 503 = CLERK_SECRET_KEY unset.
- Meta gate needs BOTH `WHATSAPP_META_PHONE_NUMBER_ID` + `WHATSAPP_META_ACCESS_TOKEN`.

**Provider reality (diagnosed & fixed 2026-07):** Twilio Verify SMS is live for customer OTP (customer login uses SMS, NOT Meta WhatsApp). The token is VALID and owns WABA `1741623446838210` ("Kb construction"), which has two numbers: `1281365125049836` = +91 74982 86760 (primary IN sender) and `1098617556678997` = +1 555-919-9805 (Meta test). Meta root-cause chain, fixed in order:
1. `WHATSAPP_META_PHONE_NUMBER_ID` was WRONG (`1154625911071476`, not owned by this token) → `#100` `error_subcode:33` GraphMethodException on the phone-id node. Subcode 33 here = wrong/foreign object ID, NOT necessarily an expired token. Fixed: set phone-id to `1281365125049836` (shared env).
2. That number was not registered to Cloud API → `#133010 Account not registered`. Fixed via `POST /{phone-id}/register` with `WHATSAPP_META_REGISTER_PIN` → `{success:true}`. ⚠️ Registering to Cloud API makes the number API-ONLY — it stops working in the consumer WhatsApp / WA-Business app.
3. WABA had ZERO templates → `#100 Invalid parameter`. Fixed: created + auto-APPROVED `login_code` AUTHENTICATION template (BODY add_security_recommendation + FOOTER code_expiration_minutes + COPY_CODE OTP button). The app's send payload (body param + button `sub_type:"url"` index 0) matches Meta's authentication-template send format — correct, do NOT change.

**Remaining test gotcha:** a send STILL returns `#100 Invalid parameter` when recipient == sender number (self-send) and/or the WABA is in DEV mode (recipients must be allow-listed in API Setup). To confirm live delivery, send from `1281365125049836` to a DIFFERENT opted-in WhatsApp number, or take the number Live. The Meta pipeline itself is now healthy (valid token + WABA + registered number + approved template).

**Impact if Meta still not delivering:** business WhatsApp alerts (order/dispatch/delivery) + staff-OTP WhatsApp fallback fail (Meta is precedence sender; no Twilio WhatsApp fallback — `TWILIO_WHATSAPP_FROM` unset). Staff email OTP (SMTP) + customer Twilio SMS are unaffected.
