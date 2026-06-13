---
name: RMC test bcrypt cost factor
description: Why password hashing uses a low bcrypt cost under NODE_ENV=test and where the single source of truth lives.
---

Password hashing goes through `hashPassword()` / `BCRYPT_ROUNDS` in `server/src/lib/password.ts`. Cost is 10 in production, 4 (bcrypt minimum) under `NODE_ENV=test`.

**Why:** bcrypt cost 10 ≈ 71ms per hash vs ≈ 1.7ms at cost 4 (~42x). The server suite hashes a user (sometimes two) in nearly every test's setup across ~360 cases, so cost-10 hashing alone added roughly 35–50s of pure CPU to the run. The cost factor is embedded in each hash, so `bcrypt.compare` still verifies a cost-4 test hash exactly like a production one — login/lockout tests pass unchanged.

**How to apply:** Never hardcode a bcrypt cost. Production routes and test setup helpers must call `hashPassword()` (or `BCRYPT_ROUNDS`) from `lib/password.ts`. Do not assert on the hash's cost/prefix in tests. If a test seems slow, the bottleneck is now per-test TRUNCATE + supertest round-trips (~70–180ms each) and real SMTP connection attempts in POST /users / resend-welcome / password-reset paths (SMTP env vars are set, so unmocked email tests hit Gmail and fail EAUTH), not bcrypt.
