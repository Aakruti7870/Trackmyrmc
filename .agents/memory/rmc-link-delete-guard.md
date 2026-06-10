---
name: RMC client/driver delete guard
description: Why deleting a client/driver is blocked when a login still links to it
---
# Client/Driver delete guard

`users.linkedClientId` / `users.linkedDriverId` use `ON DELETE SET NULL`, so deleting a
client/driver would silently null the link and break that user's "My Orders"/"My Trips".

The DELETE handlers in `server/src/routes/clients.ts` and `drivers.ts` block with **409**
when any user has the link set AND `deletedAt IS NULL`, naming the account(s) in the message.

**Why:** soft-deleted users (deletedAt set) must NOT block deletion, or trashed accounts
would permanently pin live records. Always scope the link check with `isNull(users.deletedAt)`.

**How to apply:** this is the inverse of the one-account-per-link rule (other direction).
Frontend `remove()` in Clients.tsx/Drivers.tsx catches the 409 and shows it via `showToast`
because deletion happens outside the edit modal (modal `error` state isn't visible there).
