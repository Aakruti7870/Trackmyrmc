---
name: RMC prod SPA route whitelist
description: Why new public client routes 404 in production even though they work in dev.
---

The production Express server (the `isProd` block in `server/src/index.ts`) does NOT blanket-serve
`index.html` for all paths. It serves the SPA only for paths in a **hardcoded `SPA_ROUTES` set**
(plus `SPA_PATTERNS` regexes for dynamic routes like `/challans/:id/print`, `/track/:token`).
Any other path returns a **404 status** (with index.html body, so the app still renders, but the
HTTP status is 404).

**Why:** deliberate — unknown URLs return a real 404 so crawlers don't treat every garbage path as a
soft-404 200.

**How to apply:** whenever you add a NEW public/client route in `rmc-app` (wouter `<Route>`), you
MUST also add its exact path to `SPA_ROUTES` (or a pattern to `SPA_PATTERNS`) or it 404s in
production — including for WhatsApp/link-preview crawlers and some in-app browsers that refuse a 404.
Dev (Vite) serves all routes, so this is invisible until published. Verify with
`curl -o /dev/null -w "%{http_code}" https://<domain>/<route>` against the LIVE domain.
