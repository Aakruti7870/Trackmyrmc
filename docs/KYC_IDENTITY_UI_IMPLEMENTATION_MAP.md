# TrackMyRMC KYC, Identity, Order Gating and UI Implementation Map

Branch: `fix/kyc-identity-order-gating-ui`

This document records the collision-safe implementation plan before the remaining production changes are applied. Existing modules must be extended rather than duplicated.

## Existing implementation discovered

- Authentication/session entry: `rmc-app/src/main.tsx`, `rmc-app/src/lib/auth`, `rmc-app/src/lib/clerk`
- Existing KYC domain helper: `server/src/lib/kyc.ts`
- Existing KYC routes: `server/src/routes/kyc.ts`, `server/src/routes/kycVerification.ts`
- Existing KYC tests: `server/src/test/kyc.test.ts`
- Database schema: `server/src/db/schema.ts`
- Customer/driver profile UI: `rmc-app/src/pages/ProfileSettings.tsx`
- Existing Super Admin route area: `server/src/routes/admin.ts`
- Shared application layout/header/navigation: `rmc-app/src/components/Layout.tsx`
- Existing delivery mobile chrome/navigation: current `rmc-app/src/components` mobile shell components
- Registration flow: `rmc-app/src/pages/Register.tsx`
- Environment template: `deploy/env.example`

## Collision controls

1. Do not create a second KYC router, user table, profile store, assistance page, header, bottom navigation or theme selector.
2. Keep mobile OTP/Clerk compatibility and the Android package `com.trackmyrmc.concreteking` unchanged.
3. Extend existing KYC statuses and DTOs with backward-compatible translations.
4. Apply the final customer order gate in the existing backend order creation service/route, while preserving drafts and plant/admin workflows.
5. Centralise display identity resolution and KYC policy in shared backend/domain helpers.
6. Migrate callers before removing or narrowing any existing API response field.
7. Add database uniqueness only after a legacy duplicate report and use a partial unique index where supported.
8. Keep all document uploads private and return no provider token, Aadhaar value, fingerprint or reviewer identity to customer/driver clients.

## Automatic visual mode decision

There is no user-facing Appearance/theme setting.

- Sunrise to sunset: `concrete-gold`
- Sunset to sunrise: `infra-green`
- Offline/location-denied fallback: Gold from 06:00 to 18:00 local time; Green otherwise
- Re-evaluate when the app resumes and at least once per minute near a transition
- Theme changes visual tokens only

Implemented foundation:

- `rmc-app/src/lib/autoTheme.ts`
- `rmc-app/src/automatic-theme.css`
- startup integration in `rmc-app/src/main.tsx`

## Remaining production work before merge

- Complete repository route/caller map for order creation, DigiLocker callback, offline upload, Super Admin KYC and widget implementation.
- Add one reusable masked-mobile/verified-name resolver and remove generated `Customer ####` identity.
- Add safe Customer/Driver profile DTO and capabilities.
- Add backend Customer order KYC enforcement and draft restoration UI.
- Harden DigiLocker state, callback, idempotency and uniqueness handling.
- Add secure offline KYC submission and Super Admin decision workflow.
- Add migration/reporting for legacy identity data and database uniqueness.
- Remove editable verified identity fields and visible role for Customer/Driver only.
- Correct Site name propagation through received order, accept order, challan and dispatch.
- Reuse Assistance in the authenticated header.
- Consolidate bottom safe-area spacing in the existing shell.
- Replace only the second-screen top media area with the four-slide lazy carousel.
- Add the TrackMyRMC logo to the existing widget.
- Add backend, frontend, migration and Android validation tests.

This branch must remain unmerged until type checking, tests, production build, migration validation and Android validation all succeed.
