# Changelog

## v1.30 — 2026-08-03

### Added
- Public Google Play account-and-data-deletion page at `/account-deletion`.
- Database-backed deletion requests, ownership verification, duplicate prevention, and Super Admin lifecycle management.
- Customer-only, OTP-verified permanent deletion with session/device-token revocation and statutory-record retention.

### Changed
- Android `versionCode` bumped **30 → 31** and `versionName` bumped **1.29 → 1.30**.
- Signed Play release workflow now gates the AAB on frontend and database-backed backend tests.


## v1.19 — 2026-07-28

### Merged
- **fix/nearby-plants-bottom-navigation** — Hardened mobile bottom navigation theming (CSS variable-based, Day/Night safe); tightened nearby-plants API: validated coordinates before saving, improved radius-option guard, robust `{ plants, count }` response handling, overflow-safe nav labels.
- **feature/plant-profile-capability** — Plant profile pages with capabilities, certificates, and paid-ad glow in nearby results; Super Admin plant profile review workflow; plant owner & plant admin About Plant shortcut; paid-ad nearby ranking with fixed radius; secured plant profile API with re-verification enforcement.

### Changed
- `versionCode` bumped **19 → 20**
- `versionName` bumped **1.18 → 1.19**
- `rmc-app/package.json` version bumped **0.0.0 → 1.19.0**
- GitHub Actions workflow renamed to `android-v1.19-build.yml`; artifact names updated to `vc20`.

---

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
- Lint: pass. Type check + production build: pass. Server tests: pass. Frontend tests: 68/69 files pass — 1 pre-existing stale file (`Login.plant-id.test.tsx`, 4 tests) fails on the untouched baseline (targets a removed "Staff login with email" button; current Login uses a Customer/Staff/Partner pill toggle), unrelated to this change. Dependency audit: 0 vulnerabilities. Privacy scan: 1 low. SAST: scanner unavailable (transient infra error).
