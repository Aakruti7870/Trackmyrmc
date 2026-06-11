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

**How to apply / provision the key:**
- It is an *internal signing key*, not a user-owned credential — any long random string works. Do NOT
  `requestEnvVar` it from the user. Generate one (`crypto.randomBytes(48).toString('base64url')`) and
  set it via `setEnvVars({ values: { JWT_SECRET }, environment: "shared" })` in code_execution, without
  printing the value. `shared` scope is essential — it covers both dev and the deploy/prod build.
- Rotating it invalidates all existing localStorage `rmc_token` sessions (users just re-login) — fine for this app.
- **Pitfall that cost a boot cycle:** the agent's interactive bash shell does NOT receive secrets or
  shared env vars — `printenv JWT_SECRET` shows missing even when it's correctly set. Verify presence
  with `viewEnvVars({ keys: ["JWT_SECRET"] })`, never with `printenv` in the bash tool.
- **Pitfall:** "secret" (global) and "shared env var" are two different stores. A secret showing
  `false` in `viewEnvVars` means it does NOT exist; reconciling a duplicate can accidentally leave the
  runtime with neither. Always re-verify with `viewEnvVars` after any secret/env reconciliation.

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
