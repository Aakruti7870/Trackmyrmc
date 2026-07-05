---
name: Driver mobile app (expenses + SOS)
description: Structure of the mobile-first driver app (bottom tabs, expenses, SOS/emergency) and its wiring gotchas
---

Mobile-first driver experience with a fixed BOTTOM TAB BAR on mobile (Home · Trips · Expenses · SOS · Profile).

- **General Driver Expenses**: driver submits `{category, amount, description?, receiptPhoto?(objectPath), gpsLat, gpsLng}`; staff do a SINGLE-STEP review PATCH `{decision:'approved'|'rejected', reimbursed:bool, remark?}`. Amount comes back as a decimal string like `'500.00'` — wrap in `Number()`.
- **SOS/Emergency**: driver POSTs `{type, message?, lat, lng}`; supervisors get SSE + web push. Staff PATCH `{status:'acknowledged'|'resolved'}`. No delivery OTP anywhere — proof of delivery is photo-only.
- Status color convention: green=active/approved/delivered, yellow=pending, blue=in-progress, red=emergency/rejected.

**Wiring gotchas (all bit me / architect flagged):**
- The SSE event name is `emergency.raised`. It must be (1) registered as an `es.addEventListener` dispatch in `useSSE.ts` AND (2) subscribed by the consuming components (Layout toast + Emergencies page). Missing either = silent no-op.
- Expense receipt field is `receiptPhoto` on the backend — the driver form must POST that key, not `receipt`.
- Any new public client route (`/emergencies`, expense pages) must be added to the hardcoded prod `SPA_ROUTES` in `server/src/index.ts` or it 404s in production (dev Vite hides this).
- Expenses/SOS routes are ownership + `plantScope` scoped.
