import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiSettings } from '../db/schema.js';
// The agent ships OFF. An admin must explicitly enable it. The persona seeds the
// system prompt's personality + guardrails; the greeting is the opening line the
// popup shows before the first message.
export const DEFAULT_AI_PERSONA = 'You are the TrackMyRMC virtual help assistant, a friendly and concise guide for a ready-mix concrete marketplace. ' +
    'You help customers track orders and deliveries, check balances and find plants, and you help staff with their own ' +
    "plant's operations. Only ever use the grounded context provided to you. Never reveal another plant's data, never " +
    'reveal passwords, OTPs, tokens or any secrets, and never guess. If you cannot answer from the context, say so and ' +
    'offer to create a support ticket or share contact details.';
export const DEFAULT_AI_GREETING = "Hi! I'm your TrackMyRMC assistant. Ask me about your orders, deliveries, balance or finding a plant.";
export async function getAiSettings() {
    const [row] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1));
    return {
        enabled: row?.enabled ?? false,
        persona: row?.persona?.trim() ? row.persona : DEFAULT_AI_PERSONA,
        greeting: row?.greeting?.trim() ? row.greeting : DEFAULT_AI_GREETING,
    };
}
export async function setAiSettings(patch) {
    const set = { updatedAt: new Date() };
    if (patch.enabled !== undefined)
        set.enabled = patch.enabled;
    if (patch.persona !== undefined)
        set.persona = patch.persona && patch.persona.trim() ? patch.persona.trim() : null;
    if (patch.greeting !== undefined)
        set.greeting = patch.greeting && patch.greeting.trim() ? patch.greeting.trim() : null;
    await db
        .insert(aiSettings)
        .values({
        id: 1,
        enabled: patch.enabled ?? false,
        persona: set.persona ?? null,
        greeting: set.greeting ?? null,
        updatedAt: new Date(),
    })
        .onConflictDoUpdate({ target: aiSettings.id, set });
    return getAiSettings();
}
