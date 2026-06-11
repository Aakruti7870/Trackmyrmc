---
name: Deploy build type-checks test files
description: Why test-file TS errors block publishing the RMC app, and how to verify before deploy
---

The autoscale deploy build (`.replit` `[deployment].build`) runs
`cd rmc-app && pnpm build && cd ../server && pnpm build`, and each `pnpm build`
invokes the TypeScript compiler (`tsc -b && vite build` for rmc-app, `tsc` for
server). So a TYPE error in any `*.test.ts(x)` file fails the deploy build —
even though `vite build` alone never type-checks and the production bundle
itself would be fine.

**Why:** test files live inside the tsconfig project graph, so `tsc` checks
them. Publishing therefore fails on test-only type errors, not just production
code.

**How to apply:** Background task-agent merges repeatedly reintroduce
test-file type errors. Common shapes seen:
- unused import → TS6133 (drop the import).
- `let spy: ReturnType<typeof vi.spyOn>` — TS resolves that to an
  `unknown[]`-arg procedure that the overloaded real spies (window.confirm,
  canvas getContext/toDataURL) are NOT assignable to → TS2322. Fix: annotate
  as vitest `MockInstance` (default `any` args accept any spy).
- inserting a plain `string` into the Drizzle `role` enum column → TS2769.
  Fix: `role: role as typeof users.$inferInsert['role']`.

Before suggesting deploy, re-run the FULL deploy build command after every
merge wave (`cd rmc-app && pnpm build && cd ../server && pnpm build`) — the
`build` workflow status in the UI is often stale relative to the latest merges.
