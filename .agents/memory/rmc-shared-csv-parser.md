---
name: RMC shared CSV import parser
description: The plant-import CSV parser is one module shared across server + frontend; constraints on keeping it that way.
---

# Shared plant-import CSV parser

`server/src/lib/csv.ts` (`parseCsv`) is the single source of truth for the plant-import CSV reader. `rmc-app/src/lib/importCsv.ts` imports it via the relative path `../../../server/src/lib/csv` and re-exports it as `parseImportCsv`; `buildSkippedRowsCsv` calls `parseCsv` directly. There is no second copy.

**Why:** It used to be two byte-identical copies guarded by a contract test (now deleted, since one implementation can't drift). The client copy only existed so the "download skipped rows" feature numbers rows the same way the server does.

**How to apply:**
- Direction is server→client, not the reverse: server `tsc` has `rootDir=./src` and cannot import outside its src; the frontend (vite/vitest) can reach server source, so the client reuses the server leaf.
- `server/src/lib/csv.ts` MUST stay browser-safe and dependency-free (no Node-only imports/APIs) — it is now bundled into the vite frontend build, not just the server. Adding a Node dependency there would break `rmc-app build`.
- After touching either file, re-verify BOTH `server build` and `rmc-app build` (the frontend vite bundle pulls in the server leaf).
