import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiConversations, aiMessages, supportTickets, auditLogs, plants, } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';
import { getAiSettings } from '../lib/aiSettings.js';
import { buildAiContext, resolveScopePlantId, REFUSAL } from '../lib/aiContext.js';
import { chatComplete, chatCompleteStream, GeminiError, isGeminiConfigured, transcribeAudio, STT_ALLOWED_MIME, MAX_AUDIO_BASE64_LEN, } from '../lib/gemini.js';
const router = Router();
router.use(requireAuth);
const INPUT_TYPES = new Set(['text', 'voice']);
const OUTPUT_TYPES = new Set(['text', 'audio', 'video']);
const MAX_MESSAGE_LEN = 2000;
// Lightweight config the frontend uses to decide whether to show the agent and
// what to greet with. Platform staff also get the plant list so they can pick a
// plant before asking for private data.
router.get('/config', async (req, res) => {
    const cfg = await getAiSettings();
    const user = req.user;
    const requiresPlantSelection = isPlatformStaff(user);
    let plantOptions;
    if (requiresPlantSelection) {
        plantOptions = await db.select({ id: plants.id, name: plants.name, plantCode: plants.plantCode })
            .from(plants).orderBy(asc(plants.name));
    }
    res.json({
        enabled: cfg.enabled,
        greeting: cfg.greeting,
        requiresPlantSelection,
        // When true the client can use the server speech-to-text path (one consistent
        // recogniser on every browser); when false it falls back to the browser's
        // native SpeechRecognition, which simply hides the mic where unavailable.
        voiceInput: isGeminiConfigured(),
        ...(plantOptions ? { plants: plantOptions } : {}),
    });
});
// Server-side speech-to-text. Accepts a single recorded clip (base64 + its mime
// type) and returns the transcript. This gives every browser one consistent
// voice-input path — including Firefox/older mobile that lack the native Web
// Speech API. Returns 503 when the audio service is unavailable so the client
// can fall back gracefully to the browser-native recogniser.
router.post('/stt', rateLimit({ windowMs: 60_000, max: 30, name: 'ai_stt' }), async (req, res) => {
    if (!isGeminiConfigured()) {
        res.status(503).json({ error: 'Speech input is unavailable.' });
        return;
    }
    const { audio, mimeType } = (req.body ?? {});
    if (typeof audio !== 'string' || !audio.trim()) {
        res.status(400).json({ error: 'Audio data is required.' });
        return;
    }
    if (audio.length > MAX_AUDIO_BASE64_LEN) {
        res.status(400).json({ error: 'Audio clip is too long.' });
        return;
    }
    // MediaRecorder mime types carry codec params (e.g. "audio/webm;codecs=opus");
    // the model only needs the container type.
    const mt = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
    if (!STT_ALLOWED_MIME.has(mt)) {
        res.status(400).json({ error: 'Unsupported audio format.' });
        return;
    }
    try {
        const text = await transcribeAudio(audio, mt);
        res.json({ text });
    }
    catch (err) {
        if (err instanceof GeminiError) {
            console.error('[ai] stt error', err.status, err.message);
            res.status(503).json({ error: 'Could not transcribe the audio. Please type your message instead.' });
            return;
        }
        console.error('[ai] unexpected stt error', err);
        res.status(500).json({ error: 'Something went wrong transcribing your audio.' });
    }
});
// Resolve (or lazily create) this user's conversation row for a session key. The
// session is always bound to the server-derived user id — a body-supplied user
// or plant id can never reassign it.
async function getOrCreateConversation(userId, sessionId, role, scopePlantId) {
    const [existing] = await db.select().from(aiConversations)
        .where(and(eq(aiConversations.sessionId, sessionId), eq(aiConversations.userId, userId)));
    if (existing)
        return existing;
    // Uniqueness is on (sessionId, userId): two different users may legitimately
    // reuse the same client-generated sessionId, so onConflictDoNothing only fires
    // when THIS user races itself (concurrent first turns on one session) — in
    // which case we fall back to reading the row the other request just created.
    const [created] = await db.insert(aiConversations).values({
        sessionId, userId, plantId: scopePlantId, role,
    }).onConflictDoNothing({ target: [aiConversations.sessionId, aiConversations.userId] }).returning();
    if (created)
        return created;
    const [raced] = await db.select().from(aiConversations)
        .where(and(eq(aiConversations.sessionId, sessionId), eq(aiConversations.userId, userId)));
    return raced;
}
// Shared graceful-fallback line when the model can't be reached.
const STREAM_FALLBACK = "I'm having trouble reaching the assistant right now. Your chat still works — please try again, or I can connect you with the team via a support ticket.";
// Validate, scope, audit, persist the conversation row and gather history. Shared
// by both the buffered (/chat) and streaming (/chat/stream) endpoints so the
// security boundary (scoping, refusal, audit, logging) is identical for both.
async function prepareChat(user, body) {
    const cfg = await getAiSettings();
    if (!cfg.enabled)
        return { kind: 'error', status: 403, error: 'The AI assistant is currently turned off.' };
    const { message, sessionId, inputType, outputType, selectedPlantId } = (body ?? {});
    if (typeof message !== 'string' || !message.trim())
        return { kind: 'error', status: 400, error: 'A message is required.' };
    if (message.length > MAX_MESSAGE_LEN)
        return { kind: 'error', status: 400, error: 'Message is too long.' };
    if (typeof sessionId !== 'string' || !sessionId.trim())
        return { kind: 'error', status: 400, error: 'A session id is required.' };
    const inType = INPUT_TYPES.has(inputType) ? inputType : 'text';
    const outType = OUTPUT_TYPES.has(outputType) ? outputType : 'text';
    // SECURITY: scope is derived purely from req.user. selectedPlantId is honoured
    // only for platform staff and is validated against real plants; plant-bound
    // staff are always hard-scoped to their own plant regardless of the body.
    const scopePlantId = await resolveScopePlantId(user, selectedPlantId);
    const built = await buildAiContext(user, message, scopePlantId);
    // Audit every AI data access: who, role, plant scope, and the retrieval
    // functions used (or that it was refused).
    const auditDetail = built.refused
        ? `AI query refused (out-of-scope topic). role=${user.role}, scopePlant=${scopePlantId ?? 'none'}.`
        : `AI query. role=${user.role}, scopePlant=${scopePlantId ?? 'none'}, functions=[${built.functionsUsed.join(', ') || 'none'}].`;
    try {
        await db.insert(auditLogs).values({
            actorId: user.id, actorName: user.name, action: 'ai_query',
            status: built.refused ? 'refused' : 'success', detail: auditDetail, emailSent: null,
        });
    }
    catch (err) {
        console.error('[ai] failed to write audit log', err);
    }
    const conversation = await getOrCreateConversation(user.id, sessionId, user.role, scopePlantId);
    if (built.refused) {
        return { kind: 'refused', conversationId: conversation.id, sessionId, userId: user.id, scopePlantId, message, inType, outType };
    }
    // Prior turns for continuity (cap to recent history).
    const prior = await db.select({ message: aiMessages.message, response: aiMessages.response })
        .from(aiMessages).where(eq(aiMessages.conversationId, conversation.id))
        .orderBy(desc(aiMessages.id)).limit(6);
    const history = prior.reverse().flatMap(p => {
        const turns = [{ role: 'user', content: p.message }];
        if (p.response)
            turns.push({ role: 'assistant', content: p.response });
        return turns;
    });
    return {
        kind: 'ready', conversationId: conversation.id, sessionId, userId: user.id, scopePlantId,
        message, inType, outType, persona: cfg.persona, context: built.context,
        functionsUsed: built.functionsUsed, history,
    };
}
router.post('/chat', rateLimit({ windowMs: 60_000, max: 20, name: 'ai_chat' }), async (req, res) => {
    const prep = await prepareChat(req.user, req.body ?? {});
    if (prep.kind === 'error') {
        res.status(prep.status).json({ error: prep.error });
        return;
    }
    if (prep.kind === 'refused') {
        await persistMessage(prep.conversationId, prep.sessionId, prep.userId, prep.scopePlantId, prep.message, REFUSAL, prep.inType, prep.outType, 'refused');
        res.json({ reply: REFUSAL, refused: true, source: 'policy', outputType: prep.outType });
        return;
    }
    let reply;
    let source;
    try {
        const result = await chatComplete({ system: prep.persona, context: prep.context, history: prep.history, message: prep.message });
        reply = result.text;
        source = result.source;
    }
    catch (err) {
        // Graceful fallback: the chat stays usable even when the AI call fails.
        if (err instanceof GeminiError)
            console.error('[ai] gemini error', err.status, err.message);
        else
            console.error('[ai] unexpected error', err);
        reply = STREAM_FALLBACK;
        source = 'fallback';
    }
    await persistMessage(prep.conversationId, prep.sessionId, prep.userId, prep.scopePlantId, prep.message, reply, prep.inType, prep.outType, prep.functionsUsed.join(','));
    res.json({ reply, refused: false, source, functionsUsed: prep.functionsUsed, outputType: prep.outType });
});
// Streaming variant: emits the reply incrementally over Server-Sent Events so the
// UI can render the answer as the model produces it. Events:
//   meta  { refused, source?, functionsUsed?, outputType }
//   delta { text }            (zero or more)
//   done  { reply, source }
// Validation errors are returned as a normal JSON status BEFORE the stream opens.
router.post('/chat/stream', rateLimit({ windowMs: 60_000, max: 20, name: 'ai_chat' }), async (req, res) => {
    const prep = await prepareChat(req.user, req.body ?? {});
    if (prep.kind === 'error') {
        res.status(prep.status).json({ error: prep.error });
        return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    // Guard writes: once the client disconnects (Stop button / closed tab) the
    // socket is gone, so writing would throw "write after end".
    const sse = (event, data) => {
        if (res.writableEnded)
            return;
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
        catch { /* client gone */ }
    };
    if (prep.kind === 'refused') {
        sse('meta', { refused: true, source: 'policy', outputType: prep.outType });
        sse('delta', { text: REFUSAL });
        await persistMessage(prep.conversationId, prep.sessionId, prep.userId, prep.scopePlantId, prep.message, REFUSAL, prep.inType, prep.outType, 'refused');
        sse('done', { reply: REFUSAL, source: 'policy' });
        res.end();
        return;
    }
    sse('meta', { refused: false, functionsUsed: prep.functionsUsed, outputType: prep.outType });
    // The client may hang up mid-stream (Stop button or closed tab). When that
    // happens we stop pulling from the model, persist the partial text, and skip
    // the closing frame since there's no one left to read it.
    let aborted = false;
    res.on('close', () => { if (!res.writableEnded)
        aborted = true; });
    let reply = '';
    let source = 'gemini';
    const gen = chatCompleteStream({ system: prep.persona, context: prep.context, history: prep.history, message: prep.message });
    try {
        let next = await gen.next();
        while (!next.done) {
            if (aborted)
                break;
            reply += next.value;
            sse('delta', { text: next.value });
            next = await gen.next();
        }
        if (!aborted && next.done) {
            reply = next.value.text;
            source = next.value.source;
        }
    }
    catch (err) {
        if (err instanceof GeminiError)
            console.error('[ai] gemini stream error', err.status, err.message);
        else
            console.error('[ai] unexpected stream error', err);
        source = 'fallback';
        // If nothing streamed yet, surface the fallback; otherwise keep partial text.
        if (!aborted && !reply.trim()) {
            reply = STREAM_FALLBACK;
            sse('delta', { text: reply });
        }
    }
    finally {
        // Release the upstream reader when we bailed out early.
        if (aborted)
            await gen.return({ text: reply.trim(), source }).catch(() => undefined);
    }
    // Persist whatever was generated, even on an interrupted stream.
    await persistMessage(prep.conversationId, prep.sessionId, prep.userId, prep.scopePlantId, prep.message, reply, prep.inType, prep.outType, prep.functionsUsed.join(','));
    if (!aborted) {
        sse('done', { reply, source });
        res.end();
    }
});
async function persistMessage(conversationId, sessionId, userId, plantId, message, response, inputType, outputType, functionsUsed) {
    try {
        await db.insert(aiMessages).values({
            conversationId, sessionId, userId, plantId, message, response, inputType, outputType, functionsUsed,
        });
        await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
    }
    catch (err) {
        console.error('[ai] failed to persist message', err);
    }
}
// Raise a support ticket when the AI can't help or the user asks for a human.
// Plant-scoped to the user's derived identity; clientId is attached when the
// user is a linked customer.
router.post('/support-ticket', rateLimit({ windowMs: 60_000, max: 5, name: 'ai_support_ticket' }), async (req, res) => {
    const user = req.user;
    const { subject, message, contactInfo, selectedPlantId } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'A message is required.' });
        return;
    }
    if (message.length > MAX_MESSAGE_LEN) {
        res.status(400).json({ error: 'Message is too long.' });
        return;
    }
    const scopePlantId = await resolveScopePlantId(user, selectedPlantId);
    // Bind the ticket to the user's plant: their own plant if staff, or the
    // selected plant for platform staff. clientId ties it to a linked customer.
    const plantId = scopePlantId ?? user.plantId ?? null;
    const clientId = user.linkedClientId ?? null;
    const [ticket] = await db.insert(supportTickets).values({
        userId: user.id,
        plantId,
        clientId,
        subject: typeof subject === 'string' && subject.trim() ? subject.trim() : null,
        message: message.trim(),
        contactInfo: typeof contactInfo === 'string' && contactInfo.trim() ? contactInfo.trim() : null,
        status: 'open',
    }).returning({ id: supportTickets.id });
    try {
        await db.insert(auditLogs).values({
            actorId: user.id, actorName: user.name, action: 'ai_support_ticket',
            status: 'success', detail: `Support ticket #${ticket.id} raised via AI agent (plant=${plantId ?? 'none'}).`, emailSent: null,
        });
    }
    catch (err) {
        console.error('[ai] failed to write support-ticket audit log', err);
    }
    res.status(201).json({ id: ticket.id, status: 'open' });
});
export default router;
