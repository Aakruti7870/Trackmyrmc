---
name: Importing test-harness helpers from TS tests
description: How to unit-test pure helpers that live in scripts/*.mjs (the test runner) from src/test/*.test.ts without rootDir/build errors.
---

The test runner `server/scripts/test.mjs` runs as plain `node scripts/test.mjs`
(no tsx), so any helper it imports must be a `.mjs`/`.js` module — it cannot
import a `.ts` file. But the unit tests live in `server/src/test/*.test.ts` and
are type-checked by the deploy build (`tsc` over `src/**/*`).

**Pattern that works:** put the pure helper in `server/scripts/<name>.mjs` and add
a sibling `server/scripts/<name>.d.mts`. The `.ts` test imports
`'../../scripts/<name>.mjs'`.

**Why:** with `allowJs` off, tsc resolves the import via the `.d.mts` declaration
(not the `.mjs` source), so the JS implementation is never added to the program —
no TS6059 "not under rootDir" error, and `rootDir` stays `src` (output still lands
at `dist/test/...`, not `dist/src/...`). Verified: `tsc` build emits the test file
correctly and `node --import tsx --test` runs it.

**How to apply:** keep declaration in lockstep with the `.mjs` exports. Make any
timer/log side-effects injectable via an options arg (e.g. `sleep`, `log`) so the
unit test runs with no real waits or console noise while production callers fall
back to the real timer-backed sleep + console.error.
