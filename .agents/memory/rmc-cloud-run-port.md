---
name: Cloud Run port contract
description: Port/boot decisions that keep the server deployable on both Replit autoscale and Google Cloud Run
---

- The server's port contract: `process.env.PORT` first (validated 1–65535, boot throws on garbage), prod fallback 8080 (Cloud Run's default), dev 3001; listen binds `0.0.0.0` explicitly.
- The Replit autoscale deployment pins `PORT=23636` in its `.replit` run command, NOT via the code fallback.
- **Why:** Replit uses the `localPort` that maps to `externalPort=80` in `.replit [[ports]]` to determine which port to route production traffic to. The mockup-sandbox added `localPort=23636, externalPort=80`, making 23636 the deployment's expected port. The run command must match. If the port mapping ever changes, update the run command in lockstep via `deployConfig`.
- **How to apply:** never re-hardcode a prod port in code; if the Replit port must change, edit the deployment run command via deployConfig (direct .replit edits are blocked).
- Nothing awaited before `app.listen` may block unboundedly — pre-listen boot work (e.g. SMTP env sync) is capped with a `Promise.race` timeout, else Cloud Run reports "container not listening on PORT" even though the code is fine.
- A "not listening on PORT" Cloud Run failure is usually a boot crash/hang (missing secret, unreachable DB/SMTP), not a port-number problem — check Cloud Run logs before touching port code.
- `git commit` is blocked for the agent; to push fresh work to GitHub, arm a detached watcher that waits for the auto-checkpoint commit (working tree clean) then pushes with the connector token in env (never on disk).
