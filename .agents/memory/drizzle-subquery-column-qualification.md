---
name: Drizzle column interpolation inside sql`` subqueries
description: Interpolated drizzle columns render UNQUALIFIED inside raw sql`` fragments — correlated subqueries silently bind the wrong table.
---

Interpolating a drizzle column object (e.g. `${clients.id}`) inside a raw
``sql`` `` fragment renders the bare column name (`"id"`), NOT the qualified
`"clients"."id"`. Inside a correlated `EXISTS (SELECT … FROM other_table …)`
subquery, that bare `"id"` resolves to the INNER table's column, so the
predicate becomes self-referential and silently always-false/always-true —
no error, tests just fail with wrong values.

**Why:** discovered when a correlated EXISTS trust-flag returned false for
every row despite correct data; `q.toSQL().sql` showed the unqualified `"id"`.

**How to apply:** in any raw ``sql`` `` fragment that correlates with an outer
table, write the fully-qualified identifier by hand (`"clients"."id"`), and
note that callers must not alias that table. Debug suspicious fragments with
`q.toSQL().sql` before trusting test failures.
