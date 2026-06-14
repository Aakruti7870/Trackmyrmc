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
export class GeminiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = 'GeminiError';
        this.status = status;
    }
}
export function isGeminiConfigured() {
    return !!(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL && process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
}
function fallbackReply(req) {
    const ctx = req.context.trim();
    if (ctx && ctx !== NO_DATA_MARKER) {
        return `Here's what I found on your account:\n\n${ctx}\n\nIf you need anything else, just ask — or I can connect you with the team.`;
    }
    return "I can help with your orders, deliveries, account balance and plant info. Could you tell me a little more about what you need? If you'd prefer, I can connect you with a person.";
}
// Sentinel the retrieval layer uses when there is no scoped data to share.
export const NO_DATA_MARKER = '(no matching data available for your account)';
export async function chatComplete(req) {
    const base = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (!base || !key) {
        return { text: fallbackReply(req), source: 'fallback' };
    }
    const messages = [
        {
            role: 'system',
            content: `${req.system}\n\n` +
                `Grounded context — this is the ONLY information you may use to answer. ` +
                `Never invent data, never reveal credentials/secrets, and if the answer ` +
                `is not in this context say you don't have that information and offer to ` +
                `connect a human:\n${req.context}`,
        },
        ...req.history,
        { role: 'user', content: req.message },
    ];
    let res;
    try {
        res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model: GEMINI_MODEL, messages, temperature: 0.3, max_tokens: 700 }),
        });
    }
    catch (err) {
        throw new GeminiError(`Could not reach the AI service: ${err.message}`, 502);
    }
    if (!res.ok) {
        throw new GeminiError(`AI service returned an error (${res.status}).`, res.status);
    }
    const data = (await res.json());
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
        throw new GeminiError('The AI service returned an empty response.', 502);
    }
    return { text: content.trim(), source: 'gemini' };
}
