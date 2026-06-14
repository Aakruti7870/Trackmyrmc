// Self-contained Gemini client for the AI Help Agent.
//
// Talks to the OpenAI-compatible endpoint provisioned by the Replit Gemini AI
// integration (env: AI_INTEGRATIONS_GEMINI_BASE_URL + AI_INTEGRATIONS_GEMINI_API_KEY,
// billed to the project's Replit credits — no API key to manage). We deliberately
// use a raw fetch against the chat-completions endpoint rather than an SDK to
// avoid a runtime dependency.
//
// When the integration is not configured (e.g. local dev or the test suite) we
// fall back to a deterministic, context-grounded reply so the whole agent flow
// — scoping, logging, audit, support tickets — is exercisable end-to-end without
// any external dependency or network call.

export const GEMINI_MODEL = 'gemini-2.5-flash';

export interface ChatRequest {
  // The system persona + guardrail rules.
  system: string;
  // The pre-scoped grounding data block. The model is told this is the ONLY data
  // it may use; it is assembled exclusively by the scoped retrieval layer.
  context: string;
  // Prior turns of this conversation (already trimmed by the caller).
  history: { role: 'user' | 'assistant'; content: string }[];
  // The user's current message.
  message: string;
}

export interface ChatResult {
  text: string;
  source: 'gemini' | 'fallback';
}

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

export function isGeminiConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
}

// Server-side speech-to-text. The Replit Gemini integration supports audio INPUT
// (transcription) — but NOT audio output — so we can give every browser one
// consistent voice-input path even where the native Web Speech API is missing
// (e.g. Firefox). Unlike chat, the multimodal generateContent path lives at
// `/models/<model>:generateContent` and authenticates with x-goog-api-key.
export const STT_MODEL = 'gemini-2.5-flash';

// The model accepts all the containers MediaRecorder emits across browsers
// (webm/ogg with opus on Chrome/Firefox, mp4/aac on Safari) plus common uploads.
export const STT_ALLOWED_MIME = new Set([
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/flac',
]);

// Base64 cap (~9MB encoded ≈ ~6.7MB of audio) — comfortably under the 12mb JSON
// body limit, and far more than a short spoken question needs.
export const MAX_AUDIO_BASE64_LEN = 9_000_000;

// Transcribe a single spoken clip to text. Throws GeminiError (with a status) so
// the route can map failures to a graceful 503 and let the client fall back to
// the browser-native recogniser.
export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const base = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!base || !key) throw new GeminiError('Speech-to-text is not configured.', 503);

  const url = `${base.replace(/\/$/, '')}/models/${STT_MODEL}:generateContent`;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        {
          text:
            'Transcribe the spoken words in this audio to plain text. Return ONLY ' +
            'the words that were spoken, with normal punctuation and capitalisation, ' +
            'and nothing else — no labels, quotes, or commentary. If there is no ' +
            'intelligible speech, return an empty string.',
        },
        { inlineData: { mimeType, data: audioBase64 } },
      ],
    }],
    generationConfig: { temperature: 0 },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new GeminiError(`Could not reach the speech service: ${(err as Error).message}`, 502);
  }
  if (!res.ok) {
    throw new GeminiError(`Speech service returned an error (${res.status}).`, res.status);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map(p => p.text ?? '').join('').trim();
}

function fallbackReply(req: ChatRequest): string {
  const ctx = req.context.trim();
  if (ctx && ctx !== NO_DATA_MARKER) {
    return `Here's what I found on your account:\n\n${ctx}\n\nIf you need anything else, just ask — or I can connect you with the team.`;
  }
  return "I can help with your orders, deliveries, account balance and plant info. Could you tell me a little more about what you need? If you'd prefer, I can connect you with a person.";
}

// Sentinel the retrieval layer uses when there is no scoped data to share.
export const NO_DATA_MARKER = '(no matching data available for your account)';

export async function chatComplete(req: ChatRequest): Promise<ChatResult> {
  const base = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!base || !key) {
    return { text: fallbackReply(req), source: 'fallback' };
  }

  const messages = [
    {
      role: 'system' as const,
      content:
        `${req.system}\n\n` +
        `Grounded context — this is the ONLY information you may use to answer. ` +
        `Never invent data, never reveal credentials/secrets, and if the answer ` +
        `is not in this context say you don't have that information and offer to ` +
        `connect a human:\n${req.context}`,
    },
    ...req.history,
    { role: 'user' as const, content: req.message },
  ];

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: GEMINI_MODEL, messages, temperature: 0.3, max_tokens: 700 }),
    });
  } catch (err) {
    throw new GeminiError(`Could not reach the AI service: ${(err as Error).message}`, 502);
  }

  if (!res.ok) {
    throw new GeminiError(`AI service returned an error (${res.status}).`, res.status);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new GeminiError('The AI service returned an empty response.', 502);
  }
  return { text: content.trim(), source: 'gemini' };
}

// Streaming variant of chatComplete. Yields incremental text deltas as they
// arrive from the model and returns the final ChatResult when complete. When the
// integration is not configured it yields the deterministic fallback as a single
// delta so the streaming UI behaves identically end-to-end without a network
// dependency (the test suite relies on this).
export async function* chatCompleteStream(
  req: ChatRequest,
): AsyncGenerator<string, ChatResult, void> {
  const base = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!base || !key) {
    const text = fallbackReply(req);
    yield text;
    return { text, source: 'fallback' };
  }

  const messages = [
    {
      role: 'system' as const,
      content:
        `${req.system}\n\n` +
        `Grounded context — this is the ONLY information you may use to answer. ` +
        `Never invent data, never reveal credentials/secrets, and if the answer ` +
        `is not in this context say you don't have that information and offer to ` +
        `connect a human:\n${req.context}`,
    },
    ...req.history,
    { role: 'user' as const, content: req.message },
  ];

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: GEMINI_MODEL, messages, temperature: 0.3, max_tokens: 700, stream: true }),
    });
  } catch (err) {
    throw new GeminiError(`Could not reach the AI service: ${(err as Error).message}`, 502);
  }

  if (!res.ok) {
    throw new GeminiError(`AI service returned an error (${res.status}).`, res.status);
  }
  if (!res.body) {
    throw new GeminiError('The AI service returned an empty response.', 502);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  function* drain(lines: string[]): Generator<string> {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          full += delta;
          yield delta;
        }
      } catch {
        // Ignore partial/non-JSON keep-alive frames.
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are separated by blank lines; process complete lines only.
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    yield* drain(lines);
  }

  // Flush any trailing line left in the buffer if the stream ended without a
  // final newline (some providers omit it on the last frame).
  buffer += decoder.decode();
  if (buffer.trim()) {
    yield* drain([buffer]);
  }

  if (!full.trim()) {
    throw new GeminiError('The AI service returned an empty response.', 502);
  }
  return { text: full.trim(), source: 'gemini' };
}
