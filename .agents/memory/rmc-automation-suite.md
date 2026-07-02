---
name: RMC automation suite invariants
description: Scheduled-automation design rules — once-only ledger, plant-override scoping, and why "run now" must be platform-only.
---

# Automation suite invariants

- **Once-only sends**: every notification-ish side effect must be arbitrated by the `automation_sends` claim ledger (insert-first `onConflictDoNothing().returning()` = winner). This makes overlapping ticks, boot ticks, and multi-instance runs safe. Destructive-but-audited actions (auto user purge) also claim once so audit rows can't duplicate under overlap.
- **Scope model**: `automation_settings` plant row overrides the global row overrides the code default; scope is always derived from the actor's token `plantId`, never the request body. `cleanup` is platform-managed — plant-scoped staff get 403 on edit.
- **"Run now" must be platform-only.** A manual tick endpoint runs jobs across EVERY plant, so exposing it to plant-scoped admins is a tenant-isolation escalation (architect flagged this as a release blocker). Guard: `req.user.plantId != null → 403`, and hide the button when `scope === 'plant'`.
**Why:** the tick is inherently global; per-plant "run now" would need a scoped runner that skips cleanup/global work.
**How to apply:** any future manual trigger for a cross-tenant scheduler gets the same platform-scope gate + a test (plant admin 403, authority 200).
