# Concrete King account-deletion compliance design

## Goal

Provide the permanent public URL and verified in-app deletion process required by Google Play while preserving statutory concrete-order records and all existing role boundaries.

## Architecture

- Express serves `/account-deletion` as a public, server-rendered HTML response before the SPA fallback, so it returns 200 without authentication or JavaScript.
- A new `account_deletion_requests` table records the requester, matched customer, status, verification/completion timestamps, and administrative rejection reason. A partial unique index permits only one active request per identity.
- Public submission validates and normalizes identity data, rate limits by IP, matches an active customer by mobile or email, and sends best-effort administrator/user email notifications without leaking whether an unmatched identity exists.
- Authenticated deletion is customer-only. It sends an OTP to the caller's registered mobile, verifies it server-side, records the request, anonymizes eligible personal data, disables login, bumps the session version, removes device subscriptions and location-linked personal records, and retains transaction records.
- Authority administrators can list and transition requests through Pending verification, Verified, Processing, Completed, and Rejected with reason. Completed deletion requests are terminal.

## User experience

The public responsive page identifies the exact Google Play title and package, explains deletion and legally mandated retention, and provides a real form plus the required success statement. The authenticated Profile page exposes a clear Delete Account flow with the mandated warning, OTP verification, final confirmation, local credential clearing, and return to login.

## Retention and security

Eligible profile, contact, address, device, session, and non-essential location data is removed or anonymized. Orders, invoices, challans, payments, audit events, and tax/business records remain only for the period required by applicable law. Only the authenticated customer can run self-deletion; staff, drivers, owners, and administrators continue through existing offboarding rules. OTPs and tokens are never written to audit logs.

## Verification

Backend tests cover anonymous page access, identity text, form validation, duplicate prevention, customer-only ownership, OTP gating, session revocation, login blocking, retained transactions, and terminal completed requests. Frontend tests cover the public form and in-app path. Production verification must confirm the exact URL and capture desktop/mobile screenshots before a new AAB is built.
