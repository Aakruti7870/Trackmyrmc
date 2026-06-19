---
name: WhatsApp Meta Graph API access from the app server
description: Which Meta Graph calls work vs. fail from the Replit app server, and how to get the data that can't be read.
---

# Meta Graph API access from this app's server

**Asset-graph reads DO work; only identity edges are blocked.** With the System-User token, GET on managed assets works fine from the Replit server: `/{waba_id}/phone_numbers`, `/{business_id}/owned_whatsapp_business_accounts`, `/{waba_id}?fields=account_review_status,business_verification_status`, `/{business_id}?fields=verification_status`. POST also works: send messages, create templates, `/{waba_id}/phone_numbers` (add number). What returns `{"error":"API access blocked.","code":200}` are **identity/permission edges** (`/me`, `/me/permissions`, `debug_token`) — those need user-level perms a system-user token lacks. So: query account state directly, but get token-scope/debug info from the user.

**How to apply:**
- You CAN discover Phone Number ID / WABA list / verification state via Graph from here (asset reads work). Only token *scope*/debug info needs the user (screenshots of *WhatsApp → API Setup*).
- The auto-created WABA named **"Test WhatsApp Business Account"** is a sandbox: it allows only the +1 test number (phone-number limit 1). Adding a real number returns `(#100, subcode 2388112) Phone Numbers Count Exceeded Limit Per Business` — the fix is a production WABA + payment method, done in the dashboard (not via API). Business/portfolio can be fully `verified` and this still blocks.
- You **can** create message templates and send messages programmatically via curl using `$WHATSAPP_META_ACCESS_TOKEN` (the secret IS visible to the bash shell here, unlike some shared env vars).
- Free **test** numbers only deliver to numbers added to the API Setup **recipient allow-list** (else `(#131030) Recipient phone number not in allowed list`). Reaching real customers needs Production setup (own business number + payment + display-name review) — a user-only step.
- A wrong/foreign Phone Number ID yields `(#100/subcode 33) object does not exist or no permission` on send — symptom of an ID that the token's WABA doesn't own.
