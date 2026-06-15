---
name: RMC Place Order plant default
description: How the customer's Place Order modal decides which plant to pre-select, and the endpoints behind it.
---
The Place Order modal in MyOrders.tsx pre-selects a plant in this strict priority order:
1. Marketplace handoff (sessionStorage `rmc_selected_plant`) and reorder — both set `selectedPlantId` directly and bypass `defaultPlant()`, so they always win.
2. Pinned default plant (the customer's `preferredPlantId`), if still in the orderable directory.
3. The only option, when the directory has exactly one plant.
4. The most-recently-ordered plant (orders are newest-first), if still in the directory.
5. Blank.

`defaultPlant()` encodes steps 2–5; steps 1 win simply by setting the selection before/instead of calling it.

**Why:** the pin must override the "last ordered" heuristic but never override an explicit in-the-moment choice (handoff/reorder).

**Backend:** `GET /api/plants/directory` (client-only) lists approved+active+locationVerified+verified plants — this route was historically MISSING from the server even though the frontend already called it (so last-ordered default was silently non-functional until added). `GET/PUT /api/me/preferred-plant` read/set `users.preferredPlantId` (FK ON DELETE SET NULL); PUT re-validates the plant is orderable before saving, rejecting non-orderable with 400 so a stale pin can't strand the modal. PUT with null/empty clears.
