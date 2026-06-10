---
name: Workbox runtimeCaching urlPattern matches full href
description: vite-plugin-pwa / Workbox RegExp urlPatterns test against the whole URL, not the pathname — anchored pathname regexes silently never fire.
---

When configuring `VitePWA({ workbox: { runtimeCaching: [...] } })`, a **RegExp** `urlPattern`
is tested by Workbox against the **full URL href** (e.g. `https://host/api/x`), NOT the
pathname. So a pathname-anchored regex like `/^\/api\//` never matches and the rule is a
silent no-op.

Use a **callback matcher** when you mean "match by path":
`urlPattern: ({ url }) => url.pathname.startsWith('/api')`.

**Why:** A `{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }` rule looked correct but did
nothing. It was harmless only because unmatched fetches fall through to the network by
default and `navigateFallbackDenylist` (which DOES match on pathname) already prevented
index.html being served for `/api` navigations. The danger is latent: add any broad runtime
cache later and `/api` would no longer be excluded.

**How to apply:** For auth'd / realtime apps (SSE, private APIs) always exclude `/api` with a
callback matcher, and keep `navigateFallbackDenylist: [/^\/api/]`. Note `navigateFallbackDenylist`
regexes ARE matched against the pathname — only `runtimeCaching` urlPattern regexes use the href.
