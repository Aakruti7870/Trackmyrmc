import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';
import { proofPhotoStore, isObjectStoragePath } from '../lib/proofPhoto.js';
// One-off migration: move legacy proof-of-delivery photos that are still stored
// as base64 image data URLs in the database into object storage, replacing the
// row's value with the returned /objects/... entity path.
//
// Historically a proof photo lived inline (originally challans.proof_photo, now
// challan_proof_photos.photo) as a `data:image/...;base64,...` payload, which
// bloats the database and every backup. New photos already go straight to
// object storage; this script back-fills the old ones so the database is lean.
//
// Idempotent: it only touches rows whose photo is still a base64 data URL, so
// rows already migrated to an /objects/... path are skipped and re-running is
// safe.
const { Pool } = pg;
async function migrate() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    console.log('📦 Migrating legacy base64 proof photos to object storage...');
    // Only base64 data URLs need migrating. Selecting on the prefix keeps the scan
    // narrow and makes re-runs no-ops once everything is an /objects/... path.
    const rows = await db.select({
        id: schema.challanProofPhotos.id,
        challanId: schema.challanProofPhotos.challanId,
        photo: schema.challanProofPhotos.photo,
    })
        .from(schema.challanProofPhotos)
        .where(like(schema.challanProofPhotos.photo, 'data:image/%'));
    if (rows.length === 0) {
        console.log('✅ Nothing to migrate — no base64 proof photos found.');
        await pool.end();
        return;
    }
    console.log(`Found ${rows.length} base64 proof photo(s) to migrate.`);
    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
        // Defensive: the SQL filter already excludes these, but guard anyway so a
        // value that slipped through is never re-uploaded.
        if (isObjectStoragePath(row.photo)) {
            skipped++;
            continue;
        }
        try {
            const entityPath = await proofPhotoStore.store(row.photo);
            await db.update(schema.challanProofPhotos)
                .set({ photo: entityPath })
                .where(eq(schema.challanProofPhotos.id, row.id));
            migrated++;
            console.log(`  ✔ photo #${row.id} (challan ${row.challanId}) → ${entityPath}`);
        }
        catch (err) {
            failed++;
            console.error(`  ✘ photo #${row.id} (challan ${row.challanId}) failed:`, err instanceof Error ? err.message : err);
        }
    }
    console.log(`\n✅ Migration complete. Migrated: ${migrated}, skipped: ${skipped}, failed: ${failed}.`);
    await pool.end();
    if (failed > 0)
        process.exit(1);
}
migrate().catch(e => { console.error(e); process.exit(1); });
