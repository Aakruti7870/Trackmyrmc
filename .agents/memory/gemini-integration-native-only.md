---
name: Gemini integration v2 is native-API only
description: Why the AI chat must call native Gemini endpoints, not OpenAI-compat, and the thinkingBudget gotcha for 2.5-flash
---

The Replit `javascript_gemini_ai_integrations` v2 sidecar ONLY supports the
NATIVE Gemini REST API. Chat/extraction/STT must hit:
- `${BASE}/models/${MODEL}:generateContent`
- `${BASE}/models/${MODEL}:streamGenerateContent?alt=sse`
with header `x-goog-api-key: ${KEY}`. Request body uses `systemInstruction`,
`contents[{role,parts:[{text}]}]` (assistant history maps to role **model**),
and `generationConfig`. Responses parse from `candidates[0].content.parts[].text`
(stream: same shape inside each `data:` SSE frame).

**Why:** the OpenAI-compat `/chat/completions` path is rejected by the
integration — 400 INVALID_ENDPOINT in dev, API_KEY_INVALID in prod logs. The key
is valid; only the endpoint format was wrong. The symptom was "AI agent never
replies" while STT (already native) worked fine.

**thinkingBudget gotcha:** `gemini-2.5-flash` spends output budget on hidden
"thinking" tokens. With a low `maxOutputTokens` (~1024) it can hit MAX_TOKENS
and return ZERO visible text. Set `generationConfig.thinkingConfig.thinkingBudget: 0`
on every call that wants prompt text back (chat + text/image extraction).

**How to apply:** never reintroduce `/chat/completions`. The regression test
`server/src/test/gemini.chat.test.ts` pins native endpoint + SSE parsing — keep
it green. Public reference knowledge rides in `systemInstruction` separately from
tenant-scoped account context; it must not weaken the pre-model refusal/scoping
boundary in `prepareChat`/`buildAiContext`.
