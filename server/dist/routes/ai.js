import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiConversations, aiMessages, supportTickets, auditLogs, plants, } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import { isPlatformStaff } from '../lib/roleHierarchy.js';
import { getAiSettings } from '../lib/aiSettings.js';
import { buildAiContext, resolveScopePlantId, REFUSAL } from '../lib/aiContext.js';
import { chatComplete, GeminiError } from '../lib/gemini.js';
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
        ...(plantOptions ? { plants: plantOptions } : {}),
    });
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
router.post('/chat', rateLimit({ windowMs: 60_000, max: 20, name: 'ai_chat' }), async (req, res) => {
    const cfg = await getAiSettings();
    if (!cfg.enabled) {
        res.status(403).json({ error: 'The AI assistant is currently turned off.' });
        return;
    }
    const user = req.user;
    const { message, sessionId, inputType, outputType, selectedPlantId } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'A message is required.' });
        return;
    }
    if (message.length > MAX_MESSAGE_LEN) {
        res.status(400).json({ error: 'Message is too long.' });
        return;
    }
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
        res.status(400).json({ error: 'A session id is required.' });
        return;
    }
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
    // Disallowed topic: return the standard refusal without ever calling the model.
    if (built.refused) {
        await persistMessage(conversation.id, sessionId, user.id, scopePlantId, message, REFUSAL, inType, outType, 'refused');
        res.json({ reply: REFUSAL, refused: true, source: 'policy', outputType: outType });
        return;
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
    let reply;
    let source;
    try {
        const result = await chatComplete({ system: cfg.persona, context: built.context, history, message });
        reply = result.text;
        source = result.source;
    }
    catch (err) {
        // Graceful fallback: the chat stays usable even when the AI call fails.
        if (err instanceof GeminiError)
            console.error('[ai] gemini error', err.status, err.message);
        else
            console.error('[ai] unexpected error', err);
        reply = "I'm having trouble reaching the assistant right now. Your chat still works — please try again, or I can connect you with the team via a support ticket.";
        source = 'fallback';
    }
    await persistMessage(conversation.id, sessionId, user.id, scopePlantId, message, reply, inType, outType, built.functionsUsed.join(','));
    res.json({ reply, refused: false, source, functionsUsed: built.functionsUsed, outputType: outType });
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
