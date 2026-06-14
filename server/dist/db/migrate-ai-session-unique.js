import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';
// One-off, idempotent migration that converts the ai_conversations uniqueness
// from a GLOBAL unique on session_id to a per-user composite unique on
// (session_id, user_id).
//
// Conversations are per-user: two different accounts may legitimately reuse the
// same client-generated sessionId. The old global unique would make
// getOrCreateConversation throw a unique violation (surfaced as a 500) the
// moment two users collided on a session key. Scoping the constraint to
// (session_id, user_id) lets each user own their own session namespace.
//
// Because the old constraint was global, no two rows could ever have shared a
// session_id, so there are no duplicates to reconcile before the new composite
// index can be created — the swap is purely a constraint change.
//
// Re-running is safe: the old index is dropped IF EXISTS and the new one created
// IF NOT EXISTS, so a second run is a no-op.
const { Pool } = pg;
const OLD_INDEX = 'ai_conversations_session_unique';
const NEW_INDEX = 'ai_conversations_session_user_unique';
async function indexExists(db, name) {
    const res = await db.execute(sql `SELECT 1 FROM pg_indexes WHERE indexname = ${name}`);
    return res.rows.length > 0;
}
export async function migrateAiSessionUnique(db, log = () => { }) {
    const hadOld = await indexExists(db, OLD_INDEX);
    const hadNew = await indexExists(db, NEW_INDEX);
    // Create the composite unique first so the table is never left without a
    // uniqueness guard mid-migration.
    if (!hadNew) {
        await db.execute(sql `CREATE UNIQUE INDEX IF NOT EXISTS ${sql.identifier(NEW_INDEX)} ON ai_conversations (session_id, user_id)`);
        log(`  ✔ created composite unique index ${NEW_INDEX} (session_id, user_id)`);
    }
    else {
        log(`  – composite unique index ${NEW_INDEX} already present; skipping`);
    }
    if (hadOld) {
        await db.execute(sql `DROP INDEX IF EXISTS ${sql.identifier(OLD_INDEX)}`);
        log(`  ✔ dropped legacy global unique index ${OLD_INDEX}`);
    }
    else {
        log(`  – legacy global unique index ${OLD_INDEX} not present; skipping`);
    }
    const result = {
        droppedOldIndex: hadOld,
        createdNewIndex: !hadNew,
    };
    log(`\n✅ ai_conversations session uniqueness migration complete: ${JSON.stringify(result)}`);
    return result;
}
async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    try {
        console.log('🔑 Migrating ai_conversations to per-user session uniqueness...');
        await migrateAiSessionUnique(db, (msg) => console.log(msg));
    }
    finally {
        await pool.end();
    }
}
// Only run when executed directly as a script, not when imported by tests.
const invokedDirectly = process.argv[1] !== undefined &&
    import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
    main().catch(e => { console.error(e); process.exit(1); });
}
