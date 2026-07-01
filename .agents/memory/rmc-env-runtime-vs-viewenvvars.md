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

**Provider reality in this env (verified 2026-07):** Twilio Verify SMS is live for customer OTP (so customer login uses SMS, NOT Meta WhatsApp). Meta is credentialed (token ~200 chars, phone-id 16 digits, app-secret 32 — all structurally valid) BUT a live `login_code` template send to a real number failed: HTTP 400, `code:100`, `error_subcode:33`, GraphMethodException on the phone-number-id node. That subcode = the access token CANNOT load the phone-number-id object → token expired, or token belongs to a different Meta app/WABA than the phone-id, or missing `whatsapp_business_messaging` permission. It is NOT a template or WABA account-review problem (that error fires before template eval). So Meta WhatsApp is effectively DOWN here.

**Impact of Meta being down:** business WhatsApp alerts (order/dispatch/delivery) fail — Meta is the precedence sender and there's no Twilio WhatsApp fallback (`TWILIO_WHATSAPP_FROM` unset). Staff-OTP WhatsApp fallback also fails, but staff email OTP (SMTP configured) is primary so staff login is unaffected. Customer login unaffected (Twilio SMS).

**How to fix Meta:** need a fresh valid `WHATSAPP_META_ACCESS_TOKEN` (permanent System User token from the SAME Business/app that owns the phone-id, with whatsapp_business_messaging) AND a matching `WHATSAPP_META_PHONE_NUMBER_ID`. Re-test with the same curl to the `/{phone-id}/messages` node; success = JSON with `messages[0].id`. Avoid firing live sends to arbitrary numbers during diagnosis.
