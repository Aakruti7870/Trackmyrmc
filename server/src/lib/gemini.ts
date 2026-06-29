// Self-contained Gemini client for the AI Help Agent.
//
// Talks to the NATIVE Gemini API exposed by the Replit Gemini AI integration
// (env: AI_INTEGRATIONS_GEMINI_BASE_URL + AI_INTEGRATIONS_GEMINI_API_KEY, billed
// to the project's Replit credits — no API key to manage). The integration only
// supports the native `:generateContent` / `:streamGenerateContent` surface
// (authenticated with `x-goog-api-key`); the older OpenAI-compatible
// `/chat/completions` path is NOT supported and returns 400. We deliberately use
// a raw fetch rather than an SDK to avoid a runtime dependency.
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
  // it may use for the user's personal/account/plant data; it is assembled
  // exclusively by the scoped retrieval layer.
  context: string;
  // Optional PUBLIC domain reference (concrete/RMC/IS codes/units/calculations +
  // how to use the app). Unlike `context`, the model MAY answer general questions
  // from this block and its own expertise — it carries no private account data.
  knowledge?: string;
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

// Build the native-API systemInstruction text. The public knowledge block is
// kept clearly separate from the strictly-scoped private account context so the
// model answers general domain questions freely while never inventing or leaking
// account data.
function buildSystemText(req: ChatRequest): string {
  const parts = [req.system];
  const knowledge = req.knowledge?.trim();
  if (knowledge) {
    parts.push(
      'REFERENCE KNOWLEDGE (public) — you MAY use this, together with your own ' +
      'general expertise, to answer questions about concrete, ready-mix concrete, ' +
      'mix design, IS codes, measurements, units, mathematics and how to use this ' +
      'application. This is general knowledge, not account data:\n' + knowledge,
    );
  }
  parts.push(
    'ACCOUNT & PLANT DATA — this block is the ONLY source for the user\'s ' +
    'personal, account, order, delivery, balance or plant-specific data. Never ' +
    'invent account data, never reveal another plant\'s data, and never reveal ' +
    'passwords, OTPs, tokens or secrets. If a personal/account question is not ' +
    'answered by this block, say you don\'t have that information and offer to ' +
    'connect a human:\n' + req.context,
  );
  return parts.join('\n\n');
}

// Map our ChatRequest into a native generateContent request body. Roles are
// translated to the native vocabulary (assistant → model) and the persona +
// knowledge + scoped context ride in systemInstruction. Thinking is disabled so
// the (limited) output-token budget is spent on the visible answer, not hidden
// reasoning tokens.
function buildNativePayload(req: ChatRequest): Record<string, unknown> {
  const contents = [
    ...req.history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    })),
    { role: 'user', parts: [{ text: req.message }] },
  ];
  return {
    systemInstruction: { parts: [{ text: buildSystemText(req) }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
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

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(buildNativePayload(req)),
    });
  } catch (err) {
    throw new GeminiError(`Could not reach the AI service: ${(err as Error).message}`, 502);
  }

  if (!res.ok) {
    throw new GeminiError(`AI service returned an error (${res.status}).`, res.status);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
  if (!content.trim()) {
    throw new GeminiError('The AI service returned an empty response.', 502);
  }
  return { text: content.trim(), source: 'gemini' };
}

// ---------------------------------------------------------------------------
// AI document field extraction — used by the plant-onboarding pipeline to pull
// legal name, GST number, contact number, and email from a uploaded registration
// certificate / GST document (image or pasted text). The model is constrained
// to output ONLY a JSON object so the caller can parse it deterministically.
// ---------------------------------------------------------------------------

export interface ExtractedFields {
  legalName: string | null;
  gstNo: string | null;
  contactNumber: string | null;
  email: string | null;
  /** How confident the model is that the extracted data is correct. */
  confidence: 'high' | 'low' | 'none';
  /** Human-readable warning set when extraction succeeds but confidence is low. */
  warning?: string;
}

type DocInput =
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'text'; data: string };

const EXTRACT_SYSTEM_PROMPT = `You are a document parser for Indian business registration certificates and GST certificates.
Extract the following fields from the document and return ONLY a JSON object with no markdown, no explanation:
{
  "legalName": "Full legal company / business name or null",
  "gstNo": "15-character Indian GST number (format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric) or null",
  "contactNumber": "Primary contact/mobile number including country code if present, digits only, or null",
  "email": "Primary business email address or null",
  "confidence": "high if you are confident the document is a GST/registration certificate and data is clearly readable, low if partially readable or uncertain, none if no relevant data found"
}
Return ONLY valid JSON. No prose. No code block markers.`;

export async function extractDocumentFields(input: DocInput): Promise<ExtractedFields> {
  const base = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

  const fallback: ExtractedFields = {
    legalName: null, gstNo: null, contactNumber: null, email: null,
    confidence: 'none', warning: 'AI extraction is not available in this environment.',
  };
  if (!base || !key) return fallback;

  let responseText: string;

  if (input.type === 'image') {
    // Use the multimodal generateContent endpoint (same as STT).
    const url = `${base.replace(/\/$/, '')}/models/${GEMINI_MODEL}:generateContent`;
    const payload = {
      contents: [{
        role: 'user',
        parts: [
          { text: EXTRACT_SYSTEM_PROMPT },
          { inlineData: { mimeType: input.mimeType, data: input.data } },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new GeminiError(`Could not reach the extraction service: ${(err as Error).message}`, 502);
    }
    if (!res.ok) throw new GeminiError(`Extraction service returned an error (${res.status}).`, res.status);

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    responseText = (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
  } else {
    // Plain-text document — use the native generateContent endpoint with the
    // parser prompt carried in systemInstruction.
    const url = `${base.replace(/\/$/, '')}/models/${GEMINI_MODEL}:generateContent`;
    const payload = {
      systemInstruction: { parts: [{ text: EXTRACT_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: input.data.slice(0, 8000) }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 500, thinkingConfig: { thinkingBudget: 0 } },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new GeminiError(`Could not reach the extraction service: ${(err as Error).message}`, 502);
    }
    if (!res.ok) throw new GeminiError(`Extraction service returned an error (${res.status}).`, res.status);

    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    responseText = (data?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
  }

  // Strip any accidental markdown fences the model may add.
  const cleaned = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<ExtractedFields>;
    return {
      legalName: typeof parsed.legalName === 'string' && parsed.legalName.trim() ? parsed.legalName.trim() : null,
      gstNo: typeof parsed.gstNo === 'string' && parsed.gstNo.trim() ? parsed.gstNo.trim().toUpperCase() : null,
      contactNumber: typeof parsed.contactNumber === 'string' && parsed.contactNumber.trim() ? parsed.contactNumber.trim() : null,
      email: typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email.trim().toLowerCase() : null,
      confidence: (['high', 'low', 'none'] as const).includes(parsed.confidence as never) ? parsed.confidence! : 'low',
    };
  } catch {
    throw new GeminiError('The AI service returned an unreadable response. Please try again.', 502);
  }
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

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, '')}/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(buildNativePayload(req)),
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
        const json = JSON.parse(payload) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const delta = (json?.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('');
        if (delta) {
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
