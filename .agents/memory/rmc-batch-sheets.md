---
name: RMC batch sheet generator
description: Mix design master + batch report generator conventions (recipe snapshot, print pages, settings key)
---

- Each batch report SNAPSHOTS the mix design's materials into its own row; later mix-design edits never mutate existing sheets, and PUT edit-actuals enforces a batch row-count lock (sizes fixed, only actuals editable, or `regenerate:true` re-rolls within tolerance).
- Plant batching settings (plant type, mixer capacity, batch size) live in app_settings under `batch_settings:<plantId|global>` — a null-plant global admin keeps its own bucket.
- **Why:** printed production records must stay immutable evidence; regenerating from the live recipe would silently rewrite history.
- **How to apply:** any new field on the sheet must be copied onto batch_reports at generation time, not joined from mix_designs.
- Print pages (BatchSheetPrint landscape, ChallanPrint portrait dual-copy) both use the visibility-isolation pattern (`body * {visibility:hidden}` + wrapper visible) with `preferCSSPageSize`; challan one-pager works by fixing each `.challan-copy` to 136mm with `overflow:hidden` in @media print (281mm printable at 8mm margins).
- Verify print output with headless nix chromium + puppeteer-core (`/tmp/pdfgen/gen.mjs`, localStorage token injection) and count `/Type /Page` in the PDF — screen screenshots can't prove page breaks.
