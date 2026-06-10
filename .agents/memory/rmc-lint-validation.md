---
name: RMC lint validation gate
description: How the rmc-app `lint` gate stays green and the patterns that satisfy the strict react-hooks/react-refresh rules.
---

The `lint` validation step runs `cd rmc-app && pnpm lint` (= `eslint .`).

**Decision:** In `rmc-app/eslint.config.js`, `react-hooks/set-state-in-effect`,
`react-hooks/purity`, and `react-refresh/only-export-components` are enforced as
`error`. The codebase was refactored to comply, so the gate is fully clean
(0 warnings). Do not silently downgrade these back to `warn` — fix the code.

**Why:** eslint-plugin-react-hooks@7 + react-refresh promote these to errors.
They catch real fast-refresh and render-purity problems; keeping them at error
prevents regressions.

**How to apply — the compliant patterns (mirror these for new code):**
- *only-export-components:* a context file may export only hooks/context/data.
  Providers/components live in a sibling `*-provider(s)` file. See
  `auth.tsx`+`auth-provider.tsx`, `theme.tsx`+`theme-providers.tsx`,
  `toast.tsx`+`toast-provider.tsx`.
- *set-state-in-effect:* never call setState synchronously in an effect body.
  The rule does NOT trace into a function DEFINED locally inside the effect, but
  DOES flag a synchronous call to an external `useCallback`. So: put data loads
  in a local `async function` declared inside the effect (with a `cancelled`
  guard); for refresh buttons, bump a `reload` counter state that's in the
  effect deps instead of calling a setState-heavy callback from the effect.
  setState in `.then`/callbacks/timers/event-handlers is fine. "Reset on prop
  change" → adjust state during render (the `if (x !== synced) setSynced(x)`
  pattern), not an effect.
- *purity:* no `Date.now()`/impurity during render. Use lazy `useState(() => …)`
  or a mount-captured `const [now] = useState(() => Date.now())`. NOTE: the rule
  special-cases `Date.now()` even in component-body event handlers but does NOT
  flag `new Date()` — prefer capturing a `new Date()` once and using
  `.getTime()`.
