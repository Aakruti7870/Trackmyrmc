---
name: WhatsApp resend action
description: How the staff "re-send a failed notification" endpoint works and how it signals success.
---

The staff WhatsApp Delivery Status panel can re-send a notification that failed
to reach the customer (POST /api/whatsapp/messages/:id/resend, role-gated to the
same READ_ROLES as the list, plant-scoped).

**Rule:** the endpoint re-invokes the SAME notify* helper that originally fired
(notifyOrderPlaced for event=order, notifyChallanStatus(challanId,'dispatched'|
'delivered') for dispatch/delivery). It does NOT re-send by hand — the helper is
the single source of truth for gating + recording, and inserts a fresh
whatsapp_messages row on a real send.

**Success detection:** there is no return value from the notify helpers, so the
route reads the newest row for the same event+link after calling. If its id != the
original message id, a new attempt was logged → `resent: true` + the new row. If
it's still the original id, nothing was sent (gated off: notifications disabled,
no template SID, or customer has no phone) → `resent: false`, `message: null`.

**Why:** mirrors the proof-photo retry pattern (re-run the original side-effect,
don't duplicate its logic). In tests with no Twilio sender, the dev fallback
records a row with status 'dev', so resent:true is observable; drop the template
SIDs from app_settings to exercise the gated-off resent:false branch.
