---
name: dependency audit covers all lockfiles
description: How the dependency audit scans this monorepo and the right way to close vuln advisories across multiple lockfiles
---

The repo ships MULTIPLE lockfiles and the dependency audit (osv-scanner via runDependencyAudit) scans ALL of them:
- pnpm-lock.yaml at: root, `server/`, `rmc-app/`, `artifacts/mockup-sandbox/`
- a root **npm** `package-lock.json` (in addition to the root pnpm-lock)

**Rule:** a dependency-vuln fix is not done until every relevant lockfile is regenerated.
- Bumping a direct dep's range in package.json + `pnpm install` only updates the pnpm lock(s).
- The root npm `package-lock.json` must be regenerated SEPARATELY (`npm install --package-lock-only`) or the same advisory keeps showing (e.g. a stale `nodemailer@8.0.11` lingered there after every pnpm lock was already fixed).

**Why:** the scanner treats each lockfile as an independent SBOM; one un-regenerated lock keeps the advisory red even when all others are patched.

**How to apply transitive fixes:** use SCOPED pnpm overrides keyed by version range so you only move the vulnerable copy and leave newer duplicates alone, e.g. in `rmc-app/package.json` `pnpm.overrides`:
`"minimatch@<3.1.4": "3.1.4"`, `"tar@<7": "7.5.16"`, `"undici@<7.28.0": "7.28.0"`, `"uuid@<8": "11.1.1"`, `"dompurify@<3.4.11": "3.4.11"`.
Most rmc-app transitive vulns (tar, uuid, minimatch) come through dev-only `@capacitor/assets` tooling; verify with `pnpm why <pkg>` before forcing a major. Confirm a forced-major dev tool still loads via `pnpm exec <cli> --version`.
