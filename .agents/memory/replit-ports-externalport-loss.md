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

**Why:** July 2026 publish failure; the artifact workflow is platform-managed (removeWorkflow → PROHIBITED_ACTION) so its workflow cannot be deleted — and re-registering 5000→80 via configureWorkflow is NOT enough: the duplicate `externalPort = 80` entries make the next publish fail silently (no new deployment logs at all).

**How to apply:** re-register 5000→80 via `configureWorkflow` (as above), then delete the stale `[[ports]]` block with the `verifyAndReplaceDotReplit` code_execution callback: write the full desired .replit to a temp file INSIDE the workspace, pass its ABSOLUTE path (`/home/runner/workspace/...`; /tmp is rejected, relative paths are rejected). Verify with grep that only one externalPort=80 remains + prod boot serves `/` and `/api/health` 200, then republish.

## Why the stale entry keeps coming back
Replit AUTO-REGISTERS any port a process opens into `[[ports]]`. If a stale dev-server process is still LISTENING on the old port (e.g. an orphaned artifact vite on 23636, or your own smoke-test server), the removed block reappears after every cleanup. Removing the .replit entry is NOT enough.

**How to apply:** `ss -tlnp | grep <port>` → kill the listener FIRST, then rewrite .replit via verifyAndReplaceDotReplit, then verify the port is free AND the entry is gone. Also: never leave ad-hoc smoke-test servers running — their ports get auto-registered too (a 5056 test server gained its own [[ports]] entry).
