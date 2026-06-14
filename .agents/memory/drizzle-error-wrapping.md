---
name: drizzle error wrapping
description: drizzle-orm 0.45 wraps failed-query errors in DrizzleQueryError; the raw Postgres fields (code, constraint) live on `.cause`, not the top-level error.
---

# drizzle-orm wraps Postgres errors

When a `db.insert/update/...` query fails, drizzle-orm (0.45.x) throws a
`DrizzleQueryError` whose `message` is "Failed query: ..." and whose `.code` /
`.constraint` are **undefined**. The real Postgres error (with `code: '23505'`,
`constraint: '...'`, etc.) is on `error.cause`.

**Why:** any code that inspects `err.code === '23505'` or `err.constraint === '...'`
directly on the thrown value silently fails — it sees `undefined` and falls through.
This breaks both friendly-error mapping (e.g. turning a unique-violation into a 409)
and tests asserting a specific PG error code/constraint.

**How to apply:** read both levels — `const code = e?.code ?? e?.cause?.code` and
`const constraint = e?.constraint ?? e?.cause?.constraint`. Raw `pg` client queries
(not through drizzle) still expose the fields at the top level, so checking both keeps
either path working.

**Note on the partial link indexes:** `users_linked_client_unique` /
`users_linked_driver_unique` partial unique indexes ARE created correctly by
`drizzle-kit push` (verified empirically). If the linkUnique DB tests fail, suspect
the error-wrapping unwrap above, not a missing index.
