---
name: Workflow DIDNT_OPEN_A_PORT from lost externalPort mapping
description: Why restart_workflow can fail "didn't open port 5000" even though vite prints ready, and the fix.
---

## Rule
If `restart_workflow` repeatedly fails with `DIDNT_OPEN_A_PORT` while the workflow's own log shows the dev server ready on that port (and a manual `pnpm run dev` binds and serves 200), check `.replit` `[[ports]]`: the `externalPort` line for that localPort has probably been dropped, so the platform's port watcher never registers the open.

**Why:** July 2026 — `.replit` lost `externalPort` for localPort 5000/3001 (showed up as an uncommitted diff); 4 consecutive restarts failed identically despite vite being healthy.

**How to apply:** you cannot edit `.replit` directly. Re-run `configureWorkflow({ name, command, waitForPort: 5000, outputType: "webview" })` from code_execution — it re-registers the port mapping (writes `externalPort = 80`) and starts the workflow. Verify with `curl localhost:5000` + `grep -A2 "localPort = 5000" .replit`.

## Deploy variant: another workflow steals externalPort 80
The mockup-sandbox artifact workflow (localPort 23636, path-routed canvas previews) can claim `externalPort = 80` and demote 5000 to 8000. Deployments then expect the app on 23636 → "a port configuration was specified but the required port was never opened, expected port 23636" + endless `healthcheck / returned status 500`, and the publish rolls back — even though the build succeeded and the run cmd pins PORT=5000.

**Why:** July 2026 publish failure; the artifact workflow is platform-managed (removeWorkflow → PROHIBITED_ACTION) so its 23636→80 mapping cannot be deleted.

**How to apply:** re-register 5000→80 via `configureWorkflow` (as above) so the 5000 mapping exists and is listed first; verify prod boot locally with `NODE_ENV=production PORT=<spare> node server/dist/index.js` + curl `/` and `/api/health` = 200, then have the user republish.
