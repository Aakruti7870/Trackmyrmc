---
name: PWA SW blocks server-rendered routes
description: Any server-rendered route not in navigateFallbackDenylist gets intercepted by the SW and served as SPA shell instead
---

# PWA Service Worker Intercepts Server-Rendered Routes

## The rule
Any URL path served by the Express server (not the SPA) MUST be added to Workbox's `navigateFallbackDenylist` in `rmc-app/vite.config.ts`, or the SW will intercept the navigation and serve the SPA's `index.html` shell instead.

## Why
The app has `navigateFallback: '/index.html'` in the Workbox config. This means every navigation that isn't explicitly denied gets the SPA shell served by the cached SW. Express routes (like `/privacy`, `/privacy_policy`, `/account-deletion`) exist before the SPA catch-all on the server, but once a user has visited the app and the SW is registered, the SW intercepts ALL subsequent navigations — including direct URL visits — before they reach the network/server.

## How to apply
When adding a new server-rendered Express route:
1. Add the path to `navigateFallbackDenylist` in `rmc-app/vite.config.ts`
2. Also add a React Router route as a fallback in `rmc-app/src/App.tsx` (so the SPA renders something valid if the SW does intercept, e.g. before the denylist fix is deployed)
3. Current denylist: `/api`, `/login`, `/register`, `/set-password`, `/privacy`, `/privacy_policy`

File: `rmc-app/vite.config.ts` line ~120, `navigateFallbackDenylist` array.
