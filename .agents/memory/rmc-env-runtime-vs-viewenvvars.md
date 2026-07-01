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

**Provider reality in this env (verified 2026-07):** Twilio Verify SMS is live for customer OTP (so customer login uses SMS, NOT Meta WhatsApp). Meta is credentialed and is the precedence sender for business templates (order/dispatch/delivery) + staff-OTP WhatsApp fallback, but live Meta delivery was NOT exercised (whatsapp_messages empty; server-side Graph reads blocked on the dev-mode app). Confirming Meta "clear" requires one real template send to an opted-in number. Avoid firing live OTP/template sends to arbitrary numbers during diagnosis.
