---
name: RMC AI voice (STT server-side, TTS browser-only)
description: Why the help agent's voice input is server-side but voice output stays browser-native
---

The AI Help Agent voice feature is split by what the Replit Gemini integration (modelfarm proxy at `localhost:1106/modelfarm/gemini`) actually supports.

- **Speech-to-text (input) IS server-side.** Gemini `generateContent` accepts audio `inlineData` and transcribes every MediaRecorder container (webm/ogg/mp4/wav/mpeg) — one consistent recogniser on every browser, including Firefox/older mobile that lack the native Web Speech API. Route: `POST /api/ai/stt`, gated by `isGeminiConfigured()`; `/api/ai/config` advertises `voiceInput`. Client records, base64s, posts; falls back to browser `SpeechRecognition` when `voiceInput` is false, hides the mic when neither exists.
- **Text-to-speech (output) is STILL browser-native.** modelfarm Gemini is "not allowlisted to request audio output" and the TTS model is unsupported; OpenAI modelfarm has no audio endpoint either.

**Why:** this is a genuine infra constraint, not a choice — there is no server TTS provider available, so the task's "single consistent spoken voice" goal is only partly met (input unified, output still per-browser via `speechSynthesis` with a stable English-voice pick).

**How to apply:** if asked for a truly consistent spoken reply, you must add a dedicated TTS provider (e.g. ElevenLabs/OpenAI direct) — do NOT expect modelfarm to do audio output. Keep the browser-native fallback as the graceful path whenever the audio service is unconfigured.
