---
name: RMC runtime secrets vs viewEnvVars
description: viewEnvVars under-reports secrets the running server actually has; probe live endpoints to learn true provider config.
---

`viewEnvVars()` (environment-secrets skill) does NOT reliably list every secret the running workflow process sees. It has reported `TWILIO_*` / `CLERK_SECRET_KEY` as MISSING while the live server clearly had all of them.

**Why:** account/deploy-level secrets are injected into the workflow process env but aren't surfaced by the managed-secrets view. The system prompt's `<available_secrets>` banner is a better signal, and even it isn't exhaustive.

**How to apply:** to determine which auth/OTP provider is actually active, PROBE the running server, don't infer from viewEnvVars:
- Customer SMS OTP: `POST /api/auth/otp/send {phone}` → `{"channel":"sms"}` = Twilio Verify configured and send hit Twilio 2xx (all three TWILIO_* present). `{"channel":"whatsapp"}` = Meta. `{"channel":"dev","devCode":...}` = no provider (dev fallback).
- Clerk configured check: `POST /api/auth/clerk {token:"dummy"}` → 401 "Invalid or expired single sign-on session" = configured; 503 = CLERK_SECRET_KEY unset.
- Meta gate needs BOTH `WHATSAPP_META_PHONE_NUMBER_ID` + `WHATSAPP_META_ACCESS_TOKEN`.

**Provider reality here:** customer login OTP is Twilio Verify SMS, NOT Meta WhatsApp. Confirm provider by probing, not by assuming.

**Meta Cloud API pitfalls (generic, learned the hard way):**
- A wrong/foreign `WHATSAPP_META_PHONE_NUMBER_ID` returns `#100` `error_subcode:33` GraphMethodException on the phone-id node — subcode 33 means wrong/foreign object ID, NOT necessarily an expired token. Verify the phone-id is one the token owns.
- An unregistered number returns `#133010 Account not registered`; fix via `POST /{phone-id}/register` with the register PIN. ⚠️ Registering to Cloud API makes the number API-ONLY — it stops working in the consumer WhatsApp / WA-Business app.
- A WABA with zero templates returns `#100 Invalid parameter` on send; you need an APPROVED AUTHENTICATION template (add_security_recommendation body + code_expiration_minutes footer + COPY_CODE OTP button). The send payload uses a body param + button `sub_type:"url"` index 0 — correct for auth templates, do NOT change.
- Send STILL returns `#100 Invalid parameter` on self-send (recipient == sender) and/or when the WABA is in DEV mode (recipients must be allow-listed). To confirm live delivery, send to a different opted-in number, or take the number Live.

**Impact if Meta not delivering:** business WhatsApp alerts (order/dispatch/delivery) + staff-OTP WhatsApp fallback fail (Meta is precedence sender; no Twilio WhatsApp fallback unless `TWILIO_WHATSAPP_FROM` is set). Staff email OTP (SMTP) + customer Twilio SMS are unaffected.
