# Production Readiness Report — 2026-07-27

## Scope completed on this branch

- Added repository-wide dependency, build-output, cache, temporary-file, environment-file, and signing-secret exclusions.
- Centralized backend customer display-name precedence so verified DigiLocker/document KYC names override registration names, while unverified customers retain their registration names.
- Applied the authoritative identity projection to orders, customer order history, recurring orders, challans, batch reports, and reports.
- Snapshotted staff-selected site name, address, and coordinates onto new orders and made historical projections prefer the snapshot.
- Added the production KYC state model (`pending`, `submitted`, `under_review`, `verified`, `rejected`, `suspended`, `expired`, `revoked`) with backend transition and reason policy.
- Added reviewer-only lifecycle operations, self-review prevention, audit entries, and Super Admin suspend/reactivate/revoke controls.
- Added backend customer and plant order-eligibility policy. Customer-created orders require verified KYC; plants must satisfy every publication, activity, location, subscription, and network gate.
- Hardened DigiLocker callbacks with a 15-minute expiry, atomic callback claiming, duplicate/replay suppression, idempotent settled callbacks, and retryable provider-outage behavior.
- Made Nearby Plants use strict visibility gates and degrade to HTTP 200 with an empty collection if the directory lookup is unavailable.
- Added an additive, data-preserving KYC lifecycle/DigiLocker migration and rollback guidance.
- Fixed a React 19 cascading-render lint failure in the RMC network screen.

## Security changes

- KYC state is mutated only by authorized backend routes; subjects cannot approve or administratively transition themselves.
- Adverse transitions and reactivation require a recorded reason.
- DigiLocker callbacks expire, are claimed atomically, and do not call the provider twice for concurrent duplicate deliveries.
- Provider outages release the callback claim for bounded offline retry instead of falsely rejecting the customer.
- Customer order creation is denied by backend policy when KYC or account eligibility is absent.
- Plant ordering and discovery exclude suspended/cancelled subscriptions and any plant missing an approval, verification, active, location, or publication gate.
- Dependency trees, local secrets, service-account files, keystores, and signed packages are excluded from commits.

## Database migration

`server/drizzle/0001_kyc_lifecycle_authority.sql` renames legacy KYC labels in place and adds lifecycle labels. `server/drizzle/0002_kyc_lifecycle_constraints.sql` runs after those labels commit, then adds the review-queue index, DigiLocker callback expiry/claim columns, and provider transaction uniqueness. Splitting these phases avoids PostgreSQL's unsafe-new-enum-value failure under transactional migration runners. Neither migration deletes rows; rollback guidance preserves profiles and audit history.

## Validation results

### Passed

- `pnpm --dir server build`
- `pnpm --dir server exec tsx --test src/test/kycStateMachine.test.ts src/test/customerIdentity.test.ts src/test/orderEligibility.test.ts` — 9 passed, 0 failed.
- `pnpm --dir rmc-app build`
- `pnpm --dir rmc-app lint`
- `pnpm --dir rmc-app test` — 69 files and 319 tests passed.
- `pnpm --dir rmc-app build:native`
- `pnpm --dir rmc-app exec cap sync android`
- `git diff --check`
- Tracked dependency/signing-secret scan found no `node_modules`, keystore, AAB, APK, P12, or PFX paths. Tracked `.env` paths are documented non-secret configuration/example files.

### Credential/environment blocked

- Full server integration tests: `pnpm --dir server test` exits before execution because `DATABASE_URL` is not configured. No production or test database credentials were added.
- Android Gradle `clean test lint bundleRelease`: JDK 17 is available and was selected successfully, but Gradle dependency resolution is blocked by the environment network proxy. Requests for Android Gradle Plugin 8.7.2 and Google Services 4.4.2 from Google's Maven repository and Maven Central returned HTTP 403. No release AAB was generated.
- Live DigiLocker callback/provider validation: provider credentials are unavailable; secure local state-machine and callback behavior are covered by code/build checks and mockable provider boundaries.
- Production migration execution: no production/staging database access is available.
- GitHub Actions/check status, branch push, PR readiness, merge, release tagging, and Play Console upload: GitHub network access previously failed with `CONNECT tunnel failed, response 403`; Play/signing credentials are unavailable.

### Incomplete external artifacts

- Signed AAB: not generated; no signing keys are available.
- AAB SHA-256: unavailable because no signed AAB exists.
- Merge commit SHA: not created.
- Release tag: not created.

## Android release metadata

- Package: `com.trackmyrmc.concreteking`
- Version code: `18`
- Version name: `1.17`
- Play Store upload readiness: source/native bundle validation passes, but Gradle dependency resolution, signing, and Play upload must be completed in a network-enabled release environment.

## Release-environment commands

```bash
git switch fix/kyc-identity-order-gating-ui
git push -u origin fix/kyc-identity-order-gating-ui
gh pr create --base main --head fix/kyc-identity-order-gating-ui \
  --title "Harden KYC identity and order gating for production" \
  --body-file .github/PULL_REQUEST_BODY.md
```

Run the production migration against a verified backup/staging clone before deployment. Use the repository's supported CI JDK and GitHub signing secrets to generate the signed release AAB; never copy signing material into the repository.
