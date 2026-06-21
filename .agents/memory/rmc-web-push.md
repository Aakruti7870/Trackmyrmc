---
name: RMC web push notifications
description: How order/delivery push notifications are wired (VAPID + service worker) and the ownership rule on unsubscribe.
---

# RMC Web Push (no-approval alternative to WhatsApp/SMS)

Customers get order-placed + dispatch/delivered alerts via EMAIL and WEB PUSH (pop-up even when the app is closed). Push is the chosen path because it needs no carrier/Meta approval.

## Architecture
- VAPID keypair stored as SHARED env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (never print the private key). Backend must be restarted to pick them up.
- Backend: `push_subscriptions` table (userId FK cascade, endpoint unique, p256dh, auth, userAgent); `lib/push.ts` (ensureConfigured/getVapidPublicKey/saveSubscription upsert/deleteSubscription/sendPushToUser/sendPushToClientUsers via `users.linkedClientId`, prunes 404/410); `routes/push.ts` mounted at `/api/push` in BOTH `index.ts` AND `test/app.ts` (GET /vapid-public-key → 503 if unconfigured; POST /subscribe, /unsubscribe under requireAuth).
- Notify hooks live in `deliveryNotify.ts` (`notifyChallanStatus`, `notifyOrderPlaced`): email + push are sent ALWAYS (ungated); WhatsApp stays gated. Push deep-links to `/my-orders`.
- Frontend: `rmc-app/src/lib/push.ts` (base64→Uint8Array key, `applicationServerKey` needs `as BufferSource` cast or tsc fails on Uint8Array/SharedArrayBuffer; 5s `serviceWorker.ready` timeout so dev — where the SW is disabled — returns 'unavailable' instead of hanging). `public/push-sw.js` (push + notificationclick) is pulled into the Workbox generateSW build via `workbox.importScripts: ['/push-sw.js']` in vite.config.ts. UI = `NotificationsCard` in ProfileSettings.

## Ownership rule (security)
**`deleteSubscription(endpoint, userId?)` MUST be called with the requester's userId from the unsubscribe route.** Endpoint-only delete is an IDOR: any authed user could revoke another user's push by passing their endpoint. The unscoped form is internal-only (pruning gone 404/410 endpoints during send).

**Why:** caught in code review — original unsubscribe deleted by endpoint globally.
**How to apply:** any new "delete subscription by client-supplied id/endpoint" path must scope by `userId` (or owner) in the WHERE clause; covered by `src/test/push.authz.test.ts`.
