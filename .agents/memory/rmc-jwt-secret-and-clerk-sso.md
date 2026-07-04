---
name: RMC JWT_SECRET requirement & Clerk SSO token-exchange
description: How auth signing keys are provisioned in this repl and how Clerk SSO coexists with legacy JWT.
---

## JWT_SECRET is required at boot — the server throws on import if missing
`server/src/middleware/auth.ts` reads `process.env.JWT_SECRET` at module top-level and throws
(`JWT_SECRET environment variable is required`) when absent, so the **whole server crashes on boot**
and the workflow reports `DIDNT_OPEN_A_PORT`. There is no fallback.

**Why:** a hardcoded fallback secret was removed as a security hardening; the tradeoff is that the
secret must always be present in every environment (dev + prod) or the app won't start.

**How it is provisioned (updated July 2026):**
- JWT_SECRET, VAPID_PRIVATE_KEY, WHATSAPP_META_VERIFY_TOKEN, REVIEW_DEMO_OTP were MIGRATED out of the
  plaintext `.replit` `[userenv.shared]` into **managed Secrets** (global store) at the user's explicit
  request, to pass code review + prep the AAB build. `.replit` now holds only non-sensitive config
  (VITE_CLERK_PUBLISHABLE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, TWILIO_VERIFY_SERVICE_SID, APP_URL,
  WHATSAPP_META_PHONE_NUMBER_ID, SMTP_SYNC_FROM_ENV, REVIEW_DEMO_EMAIL).
- Secrets inject into `process.env` for both dev + deploy, so boot reads JWT_SECRET from the Secret now.
- The agent CANNOT set a secret value directly (`setEnvVars` is env-only; "Cannot be used for secrets").
  To migrate a value that MUST be preserved, `requestEnvVar({requestType:"secret",...})` and instruct the
  user to paste the EXACT current value (copy from `.replit`) BEFORE deleting the plaintext copy.
- Safe migration order: (1) create Secrets, (2) verify existence via `viewEnvVars`, (3)
  `deleteEnvVars({environment:"shared"})` to strip plaintext, (4) restart backend, (5) verify boot 200 +
  `/api/me` returns 401 (not 500) to confirm JWT verify works.
- **Manual secret paste silently truncates/mangles** — a user pasting long random values (esp. via the
  Secrets "Edit as .env" box, which some users can't even find) produced wrong-length values that only
  surfaced as a test failure ("Vapid private key should be 32 bytes"). ALWAYS verify each migrated secret
  against a known-good source: the pre-deletion value survives in git (`git show <prev-commit>:.replit`),
  so compare `process.env[k].trim() === gitOriginal.trim()` (print booleans/lengths, never the value).
  `requestEnvVar({requestType:"secret",...})` renders paste boxes right in the agent tab and is far more
  reliable than sending the user hunting for the Secrets UI. `viewEnvVars` reports existence only, so it
  will NOT catch a wrong value — behavior/length probes are the only real check.
- Behavior probes to confirm the live value matches the original (no value printed): WHATSAPP verify =
  GET `/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<orig>&hub.challenge=X` → 200 body==X;
  VAPID = base64url-decode → 32 bytes; JWT = compare `process.env` to git-original (demo-login token
  verify is unreliable because the reviewer demo account may be absent from the dev DB → 401 even when
  REVIEW_DEMO_OTP is correct).
- Rotating/changing JWT_SECRET invalidates all existing localStorage `rmc_token` sessions (users re-login).
  Preserving the exact value keeps everyone logged in.
- **Env visibility is inconsistent, verify per-session:** shared env vars have been observed BOTH
  visible and invisible to the agent's bash shell across sessions (July 2026: `node -e` in bash read
  `process.env.JWT_SECRET` fine and minted a token; earlier sessions saw it missing). Don't trust a
  cached assumption either way — probe with a quick `node -e "console.log(!!process.env.JWT_SECRET)"`
  and fall back to `viewEnvVars({ keys: ["JWT_SECRET"] })` if absent.
- **Pitfall:** "secret" (global) and "shared env var" are two different stores. A secret showing
  `false` in `viewEnvVars` means it does NOT exist; reconciling a duplicate can accidentally leave the
  runtime with neither. Always re-verify with `viewEnvVars` after any secret/env reconciliation.
- **Shared env vars are plaintext in `.replit`** (`[userenv.shared]`, a committed file). Code reviewers
  flag secrets there as an exposure. RESOLVED (July 2026): the sensitive ones were migrated to managed
  Secrets (see provisioning section above). Only non-sensitive config remains in `[userenv.shared]`.
  Never unilaterally ROTATE (change the value of) JWT_SECRET to "fix" this — that logs out every user;
  migrate the SAME value to a Secret instead. Surface any value change to the user first.

## TS narrowing for a required module-level const
Writing `const JWT_SECRET = process.env.JWT_SECRET; if(!JWT_SECRET) throw…` does NOT narrow the const to
`string` inside later closures (signToken/verifyToken) — `tsc` still sees `string | undefined` and the
deploy build fails (TS2769 on `jwt.sign`/`jwt.verify`). Fix: assign with an IIFE that throws —
`const JWT_SECRET: string = process.env.JWT_SECRET ?? (() => { throw new Error(...) })();`.

## Clerk SSO = token-exchange, not dual-token middleware
Clerk authenticates STAFF + the AUTHORITY super-role in the browser; the app POSTs the Clerk session
token to `POST /api/auth/clerk`, which verifies it with `@clerk/backend`, requires a **verified PRIMARY
email** (no `emailAddresses[0]` fallback), resolves to a staff/authority user, and issues the **legacy
JWT**. Everything downstream (requireAuth, Bearer, localStorage, 401 handling, SSE, tests) is untouched.
Clients & drivers keep email/password. AUTHORITY allow-list lives in `AUTHORITY_EMAILS` (see
`server/src/lib/authority.ts` `isAuthorityEmail`); `PUT /auth/me` blocks an authority account from
changing to a non-allow-listed email (403). `clerkEnabled` (rmc-app/src/lib/clerk.ts) gates ClerkProvider
so the app/tests run without keys. Interactive Google/Phone e2e requires the user to enable those
providers in the Clerk Dashboard and a real account — cannot be fully automated here.
