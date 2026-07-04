---
name: RMC Aadhaar KYC (DigiLocker via aggregator)
description: How customer Aadhaar KYC works, the masking guarantee, and the config/callback boundaries.
---

# Aadhaar KYC for customers (client role)

DigiLocker eKYC brokered by an aggregator (default **Sandbox / sandbox.co.in**). The vendor wire format lives ONLY in `server/src/lib/kyc.ts` (`SandboxKycProvider`); routes talk to the abstract `KycProvider` interface so swapping aggregators is one file.

## Masking guarantee (the core rule)
- We must NEVER persist a full Aadhaar. `toMaskedAadhaar()` in `lib/kyc.ts` normalises EVERY candidate before it can leave the provider: a 12-digit value collapses to `XXXXXXXX####`; an already-masked value canonicalises to Xs+last4; anything without a recoverable last-4 is rejected.
- **Why:** aggregators disagree on field names and a misbehaving one can return the raw number in `aadhaar_number`. Masking at the provider (not the route) means the raw number can never reach `kyc_verifications.masked_aadhaar`.
- A verification is `verified` ONLY when a valid masked Aadhaar came back. Demographics alone (name/dob) must NOT flip the badge — else you get a "verified" user with no Aadhaar.

## Boundaries
- `POST /api/kyc/start` & `GET /api/kyc/status` are `requireAuth` + `requireRole('client')`. Unconfigured `start` returns **503** and creates NO attempt row (never a fake pass).
- `GET /api/kyc/callback` is PUBLIC (the returning browser has no app token) and correlates strictly by our own opaque `?ref=<providerRef>` (24 random bytes), never by trusting the vendor to echo an id. Idempotent: a settled row just re-reports its outcome.
- `configured` = toggle on AND baseUrl+apiKey+apiSecret all present. Config in `app_settings` (keys `kyc_*`) with env fallback (`KYC_*`); admin panel edits via platform-staff-only `/api/admin/kyc-settings`, which NEVER echoes the raw secrets (only `hasApiKey`/`hasApiSecret`).

## Testing
- Stub `global.fetch` keyed by URL (authenticate → session → aadhaar); do NOT `mock.module` the whatsapp/kyc modules (tsx makes .ts/.js the same module). Snapshot+delete `KYC_*`/`APP_URL`/`PUBLIC_URL` env in `before()`. A plant-scoped user needs a real `plants` row (FK) — insert one, don't use a literal id.
