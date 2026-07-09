---
name: Puppeteer captures vs SSE connection starvation
description: Why lazy routes hang on "Loading…" during multi-page puppeteer screenshot runs against the Vite dev server
---
Rule: when scripting multi-page screenshot runs (puppeteer) against the dev app, close each page before opening the next.

**Why:** Each logged-in app page keeps an SSE connection (/api/events) open and retrying. Chrome caps HTTP/1.1 at 6 connections per host, so leftover pages' SSE sockets starve the pool; Vite module requests for lazy routes then hang indefinitely and the page sticks on the Suspense "Loading…" fallback with NO console/network errors — the requests are just pending.

**How to apply:** `await page.close()` between capture jobs, or use a fresh browser context per job. Diagnose by tracking `request`/`requestfinished` events and printing still-pending URLs after a timeout.

Related capture-rig facts (re-derivable but handy): use waitUntil 'domcontentloaded' (networkidle2 hangs on HMR/SSE); the delivery-location picker enters map-with-pin mode only after choosing a search prediction ("Use Current Location" confirms and closes immediately).
