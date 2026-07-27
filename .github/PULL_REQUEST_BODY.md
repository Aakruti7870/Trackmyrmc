## Summary

- centralize verified customer identity and historical site projections
- enforce backend-owned KYC lifecycle and customer/plant order eligibility
- harden DigiLocker callbacks against expiry, replay, and duplicate processing
- add production-safe migration, tests, repository hygiene, and release evidence

## Validation

- server TypeScript build
- focused KYC/identity/eligibility tests (9 passing)
- frontend build and lint
- native Capacitor build and Android sync

See `docs/PRODUCTION_READINESS_REPORT_2026-07-27.md` for commands, results, and external blockers.
