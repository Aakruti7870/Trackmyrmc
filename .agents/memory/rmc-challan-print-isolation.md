---
name: Challan print isolation
description: Why in-Layout print pages leak app chrome into window.print/PDF and how the challan print page isolates itself.
---

Pages rendered inside the app Layout (header, sidebar drawer, mobile bottom nav) leak that chrome into `window.print()` / headless `page.pdf()` output. A4 print width (~794 CSS px) also triggers the MOBILE media queries, so the bottom nav and quick-search drawer print even from a desktop session.

**Rule:** a printable page inside Layout must isolate itself in `@media print`:
```css
body * { visibility: hidden; }
.challan-page, .challan-page * { visibility: visible; }
.challan-page { position: absolute; left: 0; top: 0; width: 100%; }
```
`display:none` on `.no-print` alone is NOT enough — it only covers the page's own toolbar, not Layout chrome the page doesn't own.

**Why:** discovered when the redesigned challan PDF showed the TrackMyRMC header, sidebar drawer, and bottom nav on top of the challan sheet.

**How to apply:** any new print view (challan, shift report, invoices) that renders inside Layout needs this containment block, with everything printable kept inside ONE wrapper element.

Related: headless preview PDFs are generated with the nix `chromium` package + puppeteer-core in /tmp (SSE keeps the page from ever reaching `networkidle2` — wait on `domcontentloaded` + a text `waitForFunction` instead). Challan detail delivery-brief fields coalesce order snapshot FIRST, then client/site records (tested in challans.deliveryBrief.test.ts).
