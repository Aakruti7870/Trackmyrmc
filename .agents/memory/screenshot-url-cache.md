---
name: external_url screenshot caching
description: The screenshot tool caches external_url captures by URL, returning stale images after the page changes.
---
The `screenshot` tool with `type: external_url` caches results keyed by the exact URL. Re-capturing the same URL after the page content changed (e.g. an HMR update, a fixed component) can return the OLD image.

**Why:** Wasted significant effort "debugging" a mockup-sandbox preview that appeared blank white across multiple captures and a workflow restart — the component was actually rendering fine the whole time; the screenshots were stale cache.

**How to apply:** When re-screenshotting a page you just changed, append a unique cache-buster query string, e.g. `.../preview/group/Comp?cb=<random>`. For mockup-sandbox preview routes the matcher only reads the path, so a `?cb=` query is safe and does not break component resolution.
