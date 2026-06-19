---
name: WhatsApp Meta Graph API access from the app server
description: Which Meta Graph calls work vs. fail from the Replit app server, and how to get the data that can't be read.
---

# Meta Graph API access from this app's server

**Reads are blocked, writes/sends work.** From the Replit app server network, Meta Graph API **GET/read** calls (`/me`, `/me/permissions`, `/{phone_number_id}`, `debug_token`, asset-graph reads) consistently return `{"error":{"message":"API access blocked.","code":200}}` (HTTP 400). But **POST** calls succeed: `POST /{phone_number_id}/messages` (send) and `POST /{waba_id}/message_templates` (create template) both return 200.

**Why:** The app is in Meta **Development / Unpublished** mode and hasn't completed Access verification / Advanced Access, so business-data *reads* are denied — while `whatsapp_business_messaging` send + template create have standard access that works. It is NOT an IP block and NOT a bad token.

**How to apply:**
- Don't try to discover Phone Number ID / WABA ID / token scopes via Graph from here — those reads will fail. Get them from the **user's screenshots** of Meta's *WhatsApp → API Setup ("Step 1. Try it out")* page instead. That page shows the test number, **Phone Number ID**, and **WhatsApp Business Account ID**.
- You **can** create message templates and send messages programmatically via curl using `$WHATSAPP_META_ACCESS_TOKEN` (the secret IS visible to the bash shell here, unlike some shared env vars).
- Free **test** numbers only deliver to numbers added to the API Setup **recipient allow-list** (else `(#131030) Recipient phone number not in allowed list`). Reaching real customers needs Production setup (own business number + payment + display-name review) — a user-only step.
- A wrong/foreign Phone Number ID yields `(#100/subcode 33) object does not exist or no permission` on send — symptom of an ID that the token's WABA doesn't own.
