---
name: RMC KYC & Verification module
description: Conventions for the document-based KYC module (kyc_profiles/kyc_documents) — audit tagging, one-profile-per-subject, Aadhaar rule, badge scoping.
---

The broad KYC module (/api/kyc-verification) is ADDITIVE on top of the legacy Aadhaar/DigiLocker eKYC (routes/kyc.ts). Conventions future changes must keep:

- **Audit history is the canonical audit_logs table**, rows tagged `[kyc#<profileId>]` at the START of `detail`; the profile-detail endpoint reads history via `LIKE '[kyc#<id>]%'`. Never invent a separate kyc_history table, and never change the tag format without migrating the reader.
  **Why:** one audit reader/UI across the app (see audit-log-canonical-reader).
- **One live profile per subject** via partial unique indexes on userId / vehicleId. Exactly one of userId/vehicleId is set.
- **Aadhaar:** server accepts ONLY 4 digits and persists `XXXX-XXXX-<last4>`; a 12-digit input is a 400, never truncated silently.
- **Approved = immutable** for the subject (409 on edit/doc change); editing a *submitted* profile drops it back to draft so reviewers only see final submissions.
- **/badges is the bulk status endpoint** for list screens (users or vehicles). It admits sub-admin roles (supervisor/fleet_manager/dispatcher), so it MUST keep the `requireFleetScope` unbound-actor 403 — plantScope(null) is global (architect caught this leak once already).
- **Expiry alerts** claim docs atomically (UPDATE … RETURNING stamping expiry_alerted_at) so the 6h tick + boot overlap can't double-alert.
- New tables were pushed to the DEV db only; prod (Cloud SQL) needs its own `db:push` at deploy time.
