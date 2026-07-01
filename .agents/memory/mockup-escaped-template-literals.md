---
name: Mockup subagent escaped template literals
description: DESIGN subagent output can corrupt className template literals, breaking canvas preview compile only in-browser.
---

# Escaped template literals from DESIGN subagents

Files written by fanned-out DESIGN subagents into `artifacts/mockup-sandbox/...` can
contain `className={\`...\${x}...\`}` where the backticks and `${` are literally
backslash-escaped (`\`` and `\${`). This is invalid TS/JSX source.

**Symptom:** the canvas iframe frame shows an error overlay:
`[plugin:vite:react-babel] ... Expecting Unicode escape sequence \uXXXX. (line:col)`.
The route still returns HTTP 200 (curl passes) and `pnpm build`/lint of the main app
pass, because the sandbox is compiled lazily in the browser — so it only fails when the
user actually opens the frame.

**Fix:** `perl -i -pe 's/\\`/`/g; s/\\\$\{/\$\{/g' <file>` then restart the mockup
workflow.

**How to apply:** after ANY DESIGN subagent fan-out that writes .tsx mockups, grep each
produced file for `\\`` / `\\\${` before declaring done. Verify by fetching the Vite
*transformed module* (`/__mockup/src/.../X.tsx`) — a clean transform returns JS starting
with `import { createHotContext ... }`; a broken one returns an error payload.
