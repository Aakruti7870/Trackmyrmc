---
name: Background test runs get torn down
description: Why long test suites launched via the bash tool die mid-run, and how to verify instead
---

Long-running test suites (`pnpm test`, full `vitest run`) launched in the background via the bash tool (nohup/`&`/disown) are frequently killed mid-run: the process disappears, no exit file is written, and the log ends abruptly on the first file. The server `scripts/test.mjs` runner and full frontend vitest both suffer this.

Compounding factor: with 3 dev workflows running and `nproc == 2`, concurrent background test runs are CPU-starved to a crawl (logs stop advancing for minutes).

**Why:** bash-tool background children are not reliably persisted across tool-call teardown, and the 2-core box can't run dev workflows + a full suite at once.

**How to apply:**
- Do NOT try to `kill`/`pkill` competing test procs from the foreground — the signal cascades and kills the tool's own bash (exit 137/143). `pgrep -f "<pattern>"` also gives phantom matches against your own kill command's argv; confirm with `ps -eo pid,etimes,pcpu,args` and `/proc/loadavg` (idle ~0.01) before believing a process is alive.
- Verify a single new test FILE in the foreground on a clean temp DB (completes well under the 120s timeout).
- For frontend, run just the FILES affected by your change (e.g. `npx vitest run src/components/Layout.toast.test.tsx ...`) in the foreground.
- Rely on the automatic validation gate (mark_task_complete) to run the FULL server+frontend suites in a proper context.
