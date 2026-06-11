---
name: RMC MyOrders error surfaces
description: Why per-action failures in MyOrders must use a local banner, not the page-level error state.
---

In rmc-app/src/pages/MyOrders.tsx the render uses `loading ? … : error ? … : <content>`,
so the page-level `error` state is a *full-page replacement* — setting it from a
per-row action handler (cancel, receipt download, etc.) blanks the entire Orders/
Challans/Ledger view until reload.

**Rule:** transient action failures use a separate dismissible `actionError` banner
rendered above the content; reserve `setError` for the initial data-load failure.

**Why:** an architect review flagged that routing action errors through `setError`
hides the whole page on a recoverable hiccup.

**How to apply:** any new per-item action in MyOrders (or pages with the same
`loading/error/content` ternary) should surface failures via a local banner/toast,
never the page-level error.
