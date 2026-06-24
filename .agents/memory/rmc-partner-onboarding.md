---
name: RMC plant-owner self-onboarding
description: How plant owners request to join, and the three public entry doors.
---

Plant-owner self-registration is **approve-first** and reuses the existing
`plantInvites` lead queue rather than a new table. The public `POST
/plants/partner-request` (rate-limited, zod-validated, no auth) inserts a
`pending` lead with a synthetic `placeId` of `partner:<hex>` so it never
collides with Places-derived `placeId`s, folds email into `contactNumber` and
city/note into the single `address` line (leads table has no dedicated columns),
and suffixes the owner name with "(plant owner)". Staff approve it through the
same onboarding queue UI as customer-submitted invites.

**Why:** leads already had a verify/approve workflow + admin notification; a
separate owner-applications table would duplicate it. Owners must be verified
before going live (`verified` gate), so a direct self-serve account is wrong.

**How to apply:** the admin-notify logic is the shared module-level
`notifyNewPlantRequest(row)` in routes/plants.ts — call it (fire-and-forget,
after the response) from any new lead-creating path; do NOT re-inline it.

Public entry has three deliberate doors (Landing nav + mobile menu): customer
"Get Started"/Register → `/register`; staff → `/login?staff=1` (the query param
opens Login's email/password mode directly instead of the phone-OTP default);
plant owners "List your plant"/"Register your plant" → `/partner`. Every public
auth page (Login/Register/PartnerRequest) has a Back-to-home control because the
installed Android/PWA shell has no browser back button.
