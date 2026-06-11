---
name: Audit-log canonical reader
description: All audit-log readers go through /api/audit-logs; withTotal is opt-in
---

All audit-log UIs (Users page Activity Log, ActivityLog, standalone AuditLog)
read the single canonical `GET /api/audit-logs` (server/src/routes/audit.ts).
Do not reintroduce a per-page reader (the old `/api/admin/audit-logs` and
`/api/users/audit-log` were duplicates that drifted and were removed).

**Endpoint shape:** returns `{ rows, hasMore }` by default. Pass `withTotal=1`
(or `true`) to also get `{ total, limit, offset }` — used only by the numbered
prev/next pager on the standalone AuditLog page.
**Why:** the COUNT is an extra query, so infinite-scroll callers (ActivityLog,
Users) must NOT request it; only the numbered pager needs an absolute total.
**How to apply:** filter facets come from `/api/audit-logs/facets` (the canonical
response does not carry an `actions` list). `selectCols` includes `status` only
for the standalone view's Status column; other readers ignore it.
