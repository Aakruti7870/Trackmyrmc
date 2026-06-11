---
name: RMC frontend test flakiness (timer leaks + load timeouts)
description: Two distinct causes of red-but-passes-in-isolation frontend gate failures and how to fix them durably.
---

# RMC frontend suite: flaky failures that pass in isolation

When a frontend test file fails in the full `pnpm exec vitest run` but passes when run
alone, suspect one of these two systemic causes before "fixing" the named test — the
blamed test is often collateral damage, not the real bug.

## 1. ToastProvider auto-dismiss timer leak (cross-file teardown crash)
`ToastProvider.showToast` schedules a real `setTimeout(..., 4000)` to drop the toast.
Any test that fires a toast and finishes in under 4s leaves a dangling timer; when it
fires after jsdom is torn down it does `setState` into a dead tree and throws
`ReferenceError: window is not defined`, crashing whichever file happens to be running.
**Fix:** the provider must track its pending timers and `clearTimeout` them on unmount
(useEffect cleanup). Without that, the crash hops between files run-to-run.

## 2. CPU starvation → interaction tests blow the 5s default timeout
The full suite runs ~29 files in parallel and re-transforms large pages (e.g.
`Users.tsx`, 2000+ lines) per file, so collect/environment each take ~120s and CPU is
starved. `userEvent` click/type + `waitFor`-heavy tests then drift past vitest's 5s
default and time out non-deterministically — the failure hops between files each run.
**Fix:** raise the global `testTimeout`/`hookTimeout` in `rmc-app/vitest.config.ts`
(20s). Per-file/per-test timeout bumps are whack-a-mole — the next slow file just
fails instead. Also pass `userEvent.setup({ delay: null })` to drop the artificial
per-keystroke delay.

**Why:** both manifest as "this unrelated test fails sometimes" and waste time chasing
the wrong file. The cure is the shared root cause (provider cleanup / global timeout),
not the symptom test.
