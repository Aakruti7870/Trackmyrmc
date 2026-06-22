---
name: RMC shared CSV import parser
description: The plant-import CSV parser is one module shared across server + frontend; constraints on keeping it that way.
---

# Shared plant-import CSV parser

`parseCsv` (the plant-import CSV reader) now exists as TWO byte-identical copies: `server/src/lib/csv.ts` (runtime authority) and `rmc-app/src/lib/csv.ts` (vendored frontend copy). `rmc-app/src/lib/importCsv.ts` imports the local copy via `./csv` and re-exports it as `parseImportCsv`; `buildSkippedRowsCsv` calls it directly.

**Why the split (was a single shared module):** the frontend used to import `../../../server/src/lib/csv` — a cross-package reach into `server/`. That breaks any standalone export of `rmc-app` that doesn't ship the `server/` tree, e.g. the Capacitor Android slim zip (rooted at `rmc-app/` only). On the user's machine `tsc` couldn't resolve the import → TS2307 + TS7006 implicit-any on the `r`/`cell` callback params, failing `build:native` (and thus `cap sync`). Vendoring a copy makes `rmc-app` self-contained.

**How to apply:**
- Keep the two `csv.ts` files byte-for-byte identical (skipped-row numbering must match the server). Update both together; there is no test enforcing this anymore.
- Both MUST stay browser-safe and dependency-free (no Node-only APIs) — the frontend copy is bundled by vite.
- Do NOT reintroduce a `../../../server/...` import from `rmc-app/src` — it re-breaks the standalone Android export. Other `server/src/...` mentions in `rmc-app/src` are comments only, not imports.
- After touching either file, re-verify BOTH `server build` and `rmc-app build`/`build:native`.
