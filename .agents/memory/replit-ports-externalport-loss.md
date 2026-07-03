---
name: Workflow DIDNT_OPEN_A_PORT from lost externalPort mapping
description: Why restart_workflow can fail "didn't open port 5000" even though vite prints ready, and the fix.
---

## Rule
If `restart_workflow` repeatedly fails with `DIDNT_OPEN_A_PORT` while the workflow's own log shows the dev server ready on that port (and a manual `pnpm run dev` binds and serves 200), check `.replit` `[[ports]]`: the `externalPort` line for that localPort has probably been dropped, so the platform's port watcher never registers the open.

**Why:** July 2026 — `.replit` lost `externalPort` for localPort 5000/3001 (showed up as an uncommitted diff); 4 consecutive restarts failed identically despite vite being healthy.

**How to apply:** you cannot edit `.replit` directly. Re-run `configureWorkflow({ name, command, waitForPort: 5000, outputType: "webview" })` from code_execution — it re-registers the port mapping (writes `externalPort = 80`) and starts the workflow. Verify with `curl localhost:5000` + `grep -A2 "localPort = 5000" .replit`.
