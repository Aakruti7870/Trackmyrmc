---
name: RMC AI Help Agent isolation + tests
description: How the plant-scoped AI Help Agent enforces tenant isolation and the non-obvious test setup it requires.
---

# AI Help Agent — isolation boundary & test setup

The real security boundary for the AI agent is **`buildAiContext()`** in `server/src/lib/aiContext.ts`, NOT the model reply. It assembles the only data block sent to Gemini, applies plant/customer/driver scoping, role→allowed-function gating, and a refusal gate that returns `refused=true` (route then returns `REFUSAL` without ever calling the model). Scope is derived purely from `req.user`; a body `selectedPlantId` is honoured only for platform staff and validated against real plants.

## The test trap (cost >1 attempt)
The isolation tests assert "own data present / other-tenant data absent" by inspecting the chat **reply**. That only works because `chatComplete()` (`gemini.ts`) returns a deterministic, context-echoing **fallback** when the Gemini env vars are unset.

**Once the Replit Gemini integration is configured** (`AI_INTEGRATIONS_GEMINI_BASE_URL` + `AI_INTEGRATIONS_GEMINI_API_KEY` present in the test process), `/chat` makes a real API call that fails in the test env → reply becomes the generic "having trouble reaching the assistant" message. Result: the positive `match` assertions fail AND the negative `doesNotMatch` assertions pass *trivially* (false-positive isolation tests).

**Fix / rule:** any test that asserts on the assistant reply content MUST force the fallback by deleting both Gemini env vars in a `before()` hook. `chatComplete` reads `process.env` at call time, and node:test runs each file in its own worker process, so the deletion is local and safe.

**Better long-term:** assert on `buildAiContext().context` directly for scoping, and reserve HTTP `/chat` tests for refusal/auth/logging/ticket flows.

## Known sharp edges (MVP follow-ups, non-blocking)
- `ai_conversations.session_id` has a **global unique** index but conversations are per-user. If user B reuses user A's sessionId, `getOrCreateConversation` 500s on the unique violation (fails safe — no leak). Proper fix = make the unique key `(session_id, user_id)`.
- FLEET (`vehicles`) and PRODUCTION (`batch_records`) are now plant-scoped: both carry a nullable `plantId`, every direct-enumeration read/write is scoped via `plantScope()` (null-plant legacy admin stays unscoped). `vehicles.ts` still has NO blanket staff-only read gate — clients/drivers keep redacted reads (diesel baselines hidden), blocked only from writes. Fuel logs have no own plantId; scoped through their vehicle's plant. `nextBatchNo` remains global.
