# TrackMyRMC Production Readiness Design

## Purpose

Make `fix/kyc-identity-order-gating-ui` safe to review against `main` by completing and validating credential-independent identity, KYC, DigiLocker, order, plant-discovery, GPS, web, Android, database, security, and delivery behavior. Live provider, deployment, signing, Play Console, and GitHub operations remain production integrations, but are reported as externally blocked when credentials or network access are unavailable.

## Delivery Strategy

Use incremental authority-first hardening rather than a subsystem rewrite. Preserve working interfaces where possible, centralize duplicated policy in focused backend services, use additive migrations, and move callers to authoritative projections. Every material behavior change requires regression coverage.

## Repository and Branch Safety

- Work only on `fix/kyc-identity-order-gating-ui`; never modify or force-push `main`.
- Add repository-wide ignore rules for dependency directories, generated output, caches, temporary files, local environment files, signing materials, and service-account credentials.
- Confirm ignored dependencies and generated files are neither staged nor tracked.
- Audit frontend, server, schema and migrations, native Android/Capacitor, workflows, and tests for dead or duplicate logic, TODO/FIXME markers, unsafe defaults, broken imports/navigation, leaks, and performance defects.
- Record findings, fixes, validation evidence, and external blockers in a production-readiness report.

## Authoritative Customer Identity

Introduce one backend resolver used by every customer-facing projection. Its display-name precedence is:

1. verified KYC legal name;
2. entered registration/profile name;
3. a non-sensitive deterministic fallback only if neither name exists.

Orders, received and accepted orders, dispatch, challans, invoices, history, notifications, and chat consume the backend projection. Frontend code may format the returned value but may not infer KYC status or rebuild identity precedence. Existing `Customer ####` values are fixed at their resolver/query source rather than hidden in individual screens.

The selected site name and address are snapshotted onto the order at creation. Downstream dispatch, driver, challan, invoice, and history projections use the snapshot so later site edits do not alter historical records.

## KYC State Machine

The backend owns these states: `pending`, `submitted`, `under_review`, `verified`, `rejected`, `suspended`, `expired`, and `revoked`. It validates transitions, actor permissions, required reasons, timestamps, and role applicability for customer, driver, plant owner, and plant staff.

Normal review progresses from pending through submission and review to verification or rejection. Resubmission is explicit. Suspension/reactivation, expiry, and revocation are administrative or lifecycle transitions. Every transition appends an immutable history record. APIs return current status and permitted actions; the frontend renders them without deciding verification.

## DigiLocker and Identity Uniqueness

Each DigiLocker authorization creates a server-side, account-bound transaction with cryptographically strong state and nonce hashes, an expiry, one-time consumption data, and callback attempt metadata. Callback processing atomically validates and consumes the transaction, rejects mismatches and replay, handles duplicate delivery idempotently, applies timeouts, and classifies retryable and permanent provider errors. Sensitive tokens and documents are not logged.

Aadhaar matching uses a normalized keyed fingerprint rather than plaintext identity storage for uniqueness. DigiLocker provider subject identifiers are unique. One identity may have one active canonical account. Conflicts enter an admin-review queue rather than being silently linked or overwritten.

Account merging is transactional, rejects self/recursive or already-conflicting merges, transfers supported ownership to a canonical account, deactivates the duplicate, and records actor, reason, before/after references, and affected entities. Contract tests mock provider endpoints and cover success, nonce/state mismatch, expiry, replay, duplicate callback, malformed response, timeout, retry, conflict, and authorization.

## Super Admin

Backend-authorized Super Admin operations cover approve, reject, suspend, reactivate, revoke, document review, duplicate review, merge, reason history, and audit filtering. Mutations use validated schemas, tenant/role checks, reason requirements, safe document metadata, and auditable actor attribution. Hiding controls in the UI is never treated as authorization.

## Orders, Recurrence, and Plant Visibility

One shared backend eligibility service governs one-time and recurring order creation. It validates customer KYC/order eligibility, plant publication eligibility, authorization, quantities, identity snapshot, and delivery-site snapshot.

Nearby plants only include approved, active, KYC-verified, location-verified, non-suspended plants with finite in-range coordinates. A legitimate no-results query returns HTTP 200 and an empty collection. Operational database failures are safely handled and logged, not falsely reported as no results. Queries avoid N+1 access and use appropriate indexes.

## GPS, Maps, Web, and Native Runtime

Tracking authorization restricts drivers to assigned work and customers to their own active delivery. Position handling validates coordinates and staleness. Polling, streams, timers, and listeners clean up on unmount/logout. Background tracking follows Android foreground-service and permission requirements, degrades safely when permission is absent, and uses battery-conscious intervals.

The UI audit covers navigation, safe areas, header/bottom-bar overlap, tablet layout, dark/gold/green themes, widgets, reduced motion, loading and skeleton states, errors, and empty states. Changes reuse existing tokens and components. Perceptible runnable UI changes receive browser validation and screenshots.

Capacitor and Android validation covers sync, package `com.trackmyrmc.concreteking`, manifest permissions, widget payloads, unit tests, lint, debug and release compilation, version metadata, and release workflow configuration. A signed AAB is produced only when signing secrets are available; otherwise signing configuration and unsigned release compilation are validated without committing secrets.

## Database Safety

Migrations are additive and production-safe: add nullable structures, backfill legacy data, validate conflicts, then add constraints or partial unique indexes. They never truncate or silently overwrite production data. Audit/history records remain append-only. Each migration includes a rollback or forward-recovery procedure that preserves existing records, plus checks for legacy rows that cannot be automatically classified.

## Security and Performance

The audit covers JWT verification, OTP lifetime/replay/rate limits, role and tenant authorization, SQL parameterization, XSS/output handling, CSRF/CORS assumptions, environment validation, secret leakage, upload type/size controls, callback security, and least-privilege permissions.

Performance work is evidence-led and limited to relevant defects: duplicate requests, missing cleanup, N+1 queries, absent indexes, oversized eager imports, unnecessary payloads, and render-blocking work. Unrelated architectural rewrites are excluded.

## Validation and Evidence

Run all available server and web type checks, lint, tests, and production builds; migration/static database validation; Capacitor build/sync; Android tests, lint, and bundle/release compilation where the installed SDK permits; workflow/config validation; and tracked-secret/artifact scans. Fix code-caused failures and rerun until they pass.

Mocked or contract tests validate external integrations without real secrets. The final report separates passed checks, agent-caused failures, and external blockers. Only live DigiLocker credentials, production database/deployment access, Android signing secrets, Play Console access, GitHub check status, and network-dependent push/PR operations may be externally blocked.

The report includes changed files and modules, security fixes, migrations, exact commands and outcomes, Android version code/name, local commit SHA, push/PR status, merge SHA and release tag only if actually created, AAB path and SHA-256 only if actually generated, and Play Store readiness. No unavailable artifact or external result is claimed.

## Completion Criteria

- Credential-independent behavior and checks pass.
- Backend authority controls identity, KYC, eligibility, and admin mutations.
- Migrations preserve production data and have recovery guidance.
- No dependency directories, secrets, or signing materials are committed.
- Every external blocker is precise and supported by local validation evidence.
- The branch is committed, push is retried, and PR metadata targets `main`; merge occurs only with accessible green checks and no conflicts.
