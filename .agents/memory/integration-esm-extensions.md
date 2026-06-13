---
name: Integration files break prod ESM
description: replit_integrations/* generated files use extensionless imports that crash the deployed ESM server
---

The server is `"type": "module"` with tsconfig `moduleResolution: "bundler"`. Bundler resolution permits extensionless relative imports AND tsc does not rewrite them to add `.js` on emit. Dev runs via `tsx` (tolerant), production runs compiled `dist` via plain `node` (strict ESM) which requires explicit `.js` extensions.

Generated integration code under `server/src/replit_integrations/**` ships extensionless relative imports (e.g. `from "./objectStorage"`), so the deployed server crash-loops at startup with `ERR_MODULE_NOT_FOUND` and fails the health check, even though the file exists in dist.

**Why:** the bug is invisible in dev and in `tsc` (build passes); it only surfaces at production runtime.

**How to apply:** after installing or re-installing any Replit integration, grep the integration's source for extensionless relative imports (`from "./..."` / `from "../..."` without `.js`) and append `.js`. The rest of `server/src` already uses `.js` everywhere; keep integration files consistent.
