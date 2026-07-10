# Changelog

## Final production correction — v1.14 (2026-07-10)

Controlled-correction pass for the final production package. No working features were rewritten.

### Changed
- **Removed redundant manual Refresh controls** from the two screens that still had them:
  - `LiveDrivers` — the header "Refresh" button (page already auto-refreshes via SSE + a 15s relative-time tick).
  - `WhatsAppChat` — the conversation-list Refresh icon (inbox already auto-refreshes via a 12s poll + the `whatsapp-message` SSE listener).
  - Removed the now-unused `RefreshCw` imports in both files.

### Added
- **`.env.example`** at the repository root — documents every server and frontend environment variable with **no real values**.
- **`FINAL_AUDIT_REPORT.md`** — the full audit/completion report for this pass.
- **`CHANGELOG.md`** — this file.

### Kept intentionally (spec "recovery/confirmed-error" & cost-control exceptions)
- `ProfileSettings` admin diagnostic/recovery refresh controls (WhatsApp retry queue, stuck-proof-photo re-check, log panels).
- `SupplierDiscoveryMap` manual refresh — deliberate, to avoid auto re-billing the paid Google Places API.

### Verified (no change required)
- Responsive layout / safe-area handling, Landing & Login viewport fit, background auto-refresh, security posture (auth, tenant isolation, CORS, rate limiting, parameterised queries), dependency audit (0 vulnerabilities).

### Validation
- Lint: pass. Type check + production build: pass. Dependency audit: 0 vulnerabilities. Privacy scan: 1 low. SAST: scanner unavailable (transient infra error). Backend automated tests: sampled run passing; full suite via the project validation gate.
