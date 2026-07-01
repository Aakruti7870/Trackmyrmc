---
name: Canvas presentArtifact id for mockups
description: The artifactId to pass to presentArtifact for canvas mockup work, and how to recover it.
---

For canvas mockup work, `presentArtifact({ artifactId, shapeIds })` needs the artifact
id `artifacts/mockup-sandbox` — NOT the slug `mockup-sandbox`.

**Why:** passing the slug fails with "Artifact 'mockup-sandbox' not found".

**How to apply:**
- Use `artifactId: "artifacts/mockup-sandbox"`.
- If unsure, call `presentArtifact` with any guess: the error lists `Available artifacts`
  (e.g. `[{id: 'artifacts/mockup-sandbox', title: 'Mockup Sandbox'}]`) — read the id from there.
- `createArtifact({artifactType:"mockup-sandbox"})` on an existing project returns
  `success:false, "Only one mockup-sandbox artifact ... is allowed"` — it does NOT return the id,
  so don't rely on it to fetch the id; use the presentArtifact-error trick instead.
- The mockup preview server (workflow "artifacts/mockup-sandbox: Component Preview Server")
  serves at path `/__mockup/preview/{folder}/{Component}` on the main dev domain (no port).
  Verify a component renders with `curl -s -o /dev/null -w "%{http_code}"` on that URL — 200 +
  clean Vite logs (no "Failed to resolve import") is reliable; external_url screenshots hit
  the Replit auth wall and app_preview defaults to port 5000 (refused when only the mockup server runs).
