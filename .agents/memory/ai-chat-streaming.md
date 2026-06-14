---
name: AI chat streaming + shared security prep
description: How the AI help agent's buffered and streaming chat endpoints share their security boundary.
---
The AI help agent has TWO chat endpoints that MUST stay behaviourally identical on
security: `POST /api/ai/chat` (buffered JSON) and `POST /api/ai/chat/stream` (SSE).

**Rule:** the entire security boundary — enabled check, body validation, plant
scoping (`resolveScopePlantId`), refusal detection (`buildAiContext`), audit-log
write, conversation row, and history — lives in one shared `prepareChat(user, body)`
helper in `server/src/routes/ai.ts`. Both routes call it; never re-implement scoping
inline in one endpoint.

**Why:** any divergence (e.g. forgetting the audit write or the scope clamp on the
stream path) silently opens a tenant-isolation hole that the `/chat` tests would not
catch. Streaming has its own suite `server/src/test/ai.stream.test.ts` mirroring
`ai.isolation.test.ts`.

**Streaming shape:** SSE frames `event: meta|delta|done`. `chatCompleteStream` in
`lib/gemini.ts` is an async generator yielding text deltas, returning the final
`ChatResult`; when the Gemini integration is unconfigured it yields the deterministic
fallback as a single delta (so tests run with no network). Frontend reader is
`aiApi.chatStream` in `rmc-app/src/lib/api.ts` (manual fetch + ReadableStream, since
the shared `api` helper only does JSON).

**Validation gotcha:** the canonical `pnpm test` runner provisions a template DB and
clones it; manual single-file runs need a hand-pushed DB. `drizzle-kit push` reads
DATABASE_URL via the config's `dotenv/config` — pass it inline
(`DATABASE_URL=... pnpm exec drizzle-kit push --force`) in the SAME shell, then run
`node --import tsx --test --test-force-exit <file>` with the same DATABASE_URL.
