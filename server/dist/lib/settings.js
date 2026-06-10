import { inArray, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { appSettings } from '../db/schema.js';
export async function getSetting(key) {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value ?? null;
}
export async function getSettings(keys) {
    const out = {};
    for (const k of keys)
        out[k] = null;
    if (keys.length === 0)
        return out;
    const rows = await db.select().from(appSettings).where(inArray(appSettings.key, keys));
    for (const row of rows)
        out[row.key] = row.value;
    return out;
}
export async function setSetting(key, value) {
    if (value === null) {
        await db.delete(appSettings).where(eq(appSettings.key, key));
        return;
    }
    await db
        .insert(appSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: new Date() },
    });
}
