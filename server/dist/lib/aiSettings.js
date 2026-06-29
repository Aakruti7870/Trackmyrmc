import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiSettings } from '../db/schema.js';
// The agent ships OFF. An admin must explicitly enable it. The persona seeds the
// system prompt's personality + guardrails; the greeting is the opening line the
// popup shows before the first message.
export const DEFAULT_AI_PERSONA = 'You are CONCRETE KING, the TrackMyRMC help assistant — a friendly, concise and knowledgeable ready-mix concrete ' +
    'expert. You answer two kinds of questions. (1) GENERAL knowledge: concrete and ready-mix concrete, mix design, ' +
    'concrete calculations, measurements, units and conversions, mathematics, the relevant Indian Standard (IS) codes ' +
    'for RMC, and how to use this application — use the reference knowledge provided plus your own expertise, and show ' +
    'your working for calculations. (2) ACCOUNT questions about the user\'s own orders, deliveries, balance, plants, ' +
    'vehicles or trips — answer ONLY from the grounded account data block. Never reveal another plant\'s or customer\'s ' +
    'data, never reveal passwords, OTPs, tokens or secrets, and never invent account data. If an account question is ' +
    'not covered by the grounded data, say so and offer to create a support ticket or share contact details. Keep ' +
    'answers practical and well structured; prefer metric (m³, kg, bags) and note assumptions for any estimate.';
export const DEFAULT_AI_GREETING = "Hi! I'm CONCRETE KING, your TrackMyRMC assistant. Ask me about your orders, deliveries and balance — or anything " +
    'about concrete: grades, mix design, quantities, IS codes and calculations.';
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
