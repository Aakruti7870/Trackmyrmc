---
name: RMC frontend test speed
description: What makes the rmc-app vitest suite fast/slow and which pool knobs are safe.
---

The rmc-app vitest suite is jsdom-heavy (nearly every file renders a large page).

- **Use `pool: 'threads'`, not the default `forks`.** Threads start far cheaper and
  share the parent transform cache, cutting collect/test time meaningfully and
  reducing CPU contention. Stay on threads.
- **Do NOT set `isolate: false`.** It leaks module/mock state across files (shared
  `vi.mock('@/lib/api')` state bleeds), producing "Cannot read properties of
  undefined (reading 'then')" and missing-element failures. Tried and reverted.
- **Standalone `pnpm exec vitest run` numbers are misleading.** A `test` validation
  workflow (server + rmc-app) runs concurrently and competes for the 8 CPUs, so a
  manual run can look ~5x slower (~65s) than the dedicated validation run (~13s).
  Judge timing from the validation `test` workflow log, not an ad-hoc run.
- **Heavy export deps belong in a lazily dynamic-imported module.** `xlsx` (~425KB)
  and `jspdf`/`jspdf-autotable` live in `pages/usersAuditExport.ts`, imported via
  `await import()` only when an export fires, keeping them out of Users.tsx's static
  graph (and its own build chunk). Don't re-add a static `import * as XLSX` to a page.
- **testTimeout is 15s** — slowest interaction test is ~2.8s in validation, ~4.8s
  under worst contention, so 15s is safe headroom; don't bump back to 20s without cause.
