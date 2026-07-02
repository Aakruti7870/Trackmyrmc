---
name: RMC SMTP recovery & sender
description: How SMTP creds are recovered from env at boot, and the current GoDaddy sender setup
---

# SMTP recovery sync + GoDaddy sender

- Email creds live in `app_settings` (DB), env is only the fallback. If bad creds get persisted (535 EAUTH), OTP/forgot-password emails die and authority users are locked out of prod.
- Recovery seam: `server/src/lib/smtpRecovery.ts` — when shared env var `SMTP_SYNC_FROM_ENV=1`, boot copies non-blank SMTP_HOST/PORT/USER/PASS/FROM env values into app_settings BEFORE app.listen, then runs verifySmtpConnection() and logs a masked diagnostic (`[smtp-recovery] ... verified OK` / `FAILED ... user=xxx***, password length N`).
- **Why:** prod DB is not directly writable by the agent; a republish with the flag set is the only way to overwrite bad persisted creds in prod.
- **How to apply:** change secrets → wait ~20s (secrets propagate lazily) → restart Backend API → read the `[smtp-recovery]` boot line. That log line is the ONLY probe; bash/code_execution cannot see user secrets.
- Remove `SMTP_SYNC_FROM_ENV` once recovery is confirmed, or every boot re-overwrites Settings-page edits.
- Current sender (Jul 2026): GoDaddy Professional Email mailbox `notification@trackmyrmc.com`, host `smtpout.secureserver.net`, port 465 (plain mailbox password, NOT a Gmail App Password). Gmail attempts failed repeatedly (535 BadCredentials — users never produced a real 16-letter App Password); GoDaddy needs no app password, so it's the sturdier choice here.
