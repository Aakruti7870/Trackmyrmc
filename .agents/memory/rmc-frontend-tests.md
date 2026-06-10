---
name: RMC frontend test harness
description: How automated frontend (React/Vite) tests run for rmc-app.
---

# RMC frontend test harness

`cd rmc-app && pnpm test` runs `vitest run` (config in `rmc-app/vitest.config.ts`):
- jsdom environment, globals on, setup `src/test/setup.ts` imports `@testing-library/jest-dom/vitest`.
- `@` alias points at `src` (mirrors vite.config).
- esbuild needs its native binary: `pnpm.onlyBuiltDependencies: ["esbuild"]` is set in package.json so the postinstall runs (pnpm ignores build scripts by default).

The `test` validation command runs BOTH suites: `cd server && pnpm test && cd ../rmc-app && pnpm test`. If you change either, keep them chained.

**Testing SSE→toast wiring (Layout):** mock `@/lib/useSSE` to capture the handlers passed to `subscribe`, render Layout inside real ThemeProvider/AuthProvider/ToastProvider, then invoke captured handlers inside `act()` and assert the real toast text appears in the DOM. Using the real ToastProvider exercises toast.tsx end-to-end rather than mocking showToast.
