import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray, like } from 'drizzle-orm';
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
/**
 * Returns the proof-photo rows still stored as base64 data URLs — the ones that
 * never made it into object storage and remain "stuck". This is the same set the
 * full migration would target, exposed so the admin UI can show what is stuck
 * and offer a targeted retry without running the whole scan from a shell.
 */
export async function findStuckPhotos(db) {
    return db.select({
        id: schema.challanProofPhotos.id,
        challanId: schema.challanProofPhotos.challanId,
    })
        .from(schema.challanProofPhotos)
        .where(like(schema.challanProofPhotos.photo, 'data:image/%'))
        .orderBy(schema.challanProofPhotos.id);
}
/**
 * Runs the legacy-photo migration against the given database. Returns a tally of
 * how many rows were migrated, skipped (already an object path), and failed.
 *
 * Exported (and parameterized over the db) so tests can drive it against the
 * isolated test database with `proofPhotoStore.store` stubbed.
 */
export async function migrateProofPhotos(db, log = () => { }) {
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
        log('✅ Nothing to migrate — no base64 proof photos found.');
        return { migrated: 0, skipped: 0, failed: 0, failures: [] };
    }
    log(`Found ${rows.length} base64 proof photo(s) to migrate.`);
    const result = await uploadRows(db, rows, log);
    log(`\n✅ Migration complete. Migrated: ${result.migrated}, skipped: ${result.skipped}, failed: ${result.failed}.`);
    return result;
}
/**
 * Uploads each still-base64 row to object storage and rewrites the row to the
 * returned /objects/... entity path. Rows already holding an object path are
 * counted as skipped (never re-uploaded), and any upload that throws is recorded
 * as a failure with the row left as-is so it can be retried.
 *
 * Shared by the full migration and the targeted retry so both behave identically.
 */
async function uploadRows(db, rows, log) {
    let migrated = 0;
    let skipped = 0;
    const failures = [];
    for (const row of rows) {
        // A row may already be an /objects/... path: the full migration's SQL filter
        // excludes these, and a retry may target a row that succeeded out-of-band.
        // Either way, never re-upload it.
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
            log(`  ✔ photo #${row.id} (challan ${row.challanId}) → ${entityPath}`);
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            failures.push({ id: row.id, challanId: row.challanId, error });
            log(`  ✘ photo #${row.id} (challan ${row.challanId}) failed: ${error}`);
        }
    }
    return { migrated, skipped, failed: failures.length, failures };
}
/**
 * Re-attempts the upload for only the given photo row ids — the targeted
 * recovery path for a partial migration. Unlike {@link migrateProofPhotos}, it
 * does not rescan every base64 row in the table; it touches just the rows that
 * previously failed, so recovery from a storage outage is fast.
 *
 * Behaviour per row:
 * - still base64 → re-uploaded and rewritten to an /objects/... path on success
 * - already an /objects/... path (succeeded out-of-band) → counted as skipped
 * - id no longer in the table → counted as skipped (nothing to retry)
 * - upload throws again → recorded in the returned result's `failures`
 *
 * The returned result can be passed to {@link writeFailureReport} to write a
 * fresh report of whatever still failed.
 */
export async function retryFailedPhotos(db, ids, log = () => { }) {
    // De-duplicate while preserving order so a report listing a row twice does not
    // retry it twice.
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
        log('✅ Nothing to retry — no failed photo ids given.');
        return { migrated: 0, skipped: 0, failed: 0, failures: [] };
    }
    log(`Retrying ${uniqueIds.length} previously-failed proof photo(s).`);
    const rows = await db.select({
        id: schema.challanProofPhotos.id,
        challanId: schema.challanProofPhotos.challanId,
        photo: schema.challanProofPhotos.photo,
    })
        .from(schema.challanProofPhotos)
        .where(inArray(schema.challanProofPhotos.id, uniqueIds));
    // Ids in the report that no longer have a row (e.g. the challan was deleted)
    // are nothing to retry — count them as skipped so the tally stays accurate.
    const found = new Set(rows.map(r => r.id));
    const missing = uniqueIds.filter(id => !found.has(id));
    for (const id of missing) {
        log(`  – photo #${id} no longer exists; skipping.`);
    }
    const result = await uploadRows(db, rows, log);
    result.skipped += missing.length;
    log(`\n✅ Retry complete. Migrated: ${result.migrated}, skipped: ${result.skipped}, failed: ${result.failed}.`);
    return result;
}
/**
 * Reads a failure report previously written by {@link writeFailureReport} and
 * returns the photo row ids it recorded as failed. Used by the retry CLI so an
 * admin can point it straight at the JSON report from a partial run.
 */
export async function readFailedIds(reportPath) {
    const raw = await readFile(reportPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.failures)) {
        throw new Error(`Report ${reportPath} has no "failures" array`);
    }
    return parsed.failures.map(f => f.id);
}
/**
 * Writes a durable record of the rows that failed to migrate so an admin knows
 * exactly which photos remain stuck as base64 in the database after a partial
 * run. Returns the path of the written report, or null when there were no
 * failures (nothing to report).
 *
 * The report is JSON (machine- and human-readable) and named with a timestamp
 * so consecutive partial runs do not clobber each other's records.
 */
export async function writeFailureReport(result, dir = process.cwd()) {
    if (result.failures.length === 0)
        return null;
    const generatedAt = new Date();
    const stamp = generatedAt.toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `proof-photo-migration-failures-${stamp}.json`);
    const report = {
        generatedAt: generatedAt.toISOString(),
        migrated: result.migrated,
        skipped: result.skipped,
        failed: result.failed,
        failures: result.failures,
    };
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return file;
}
async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    // `--retry <report.json>` re-attempts only the rows from a previous failure
    // report; with no flag it runs the full base64 scan-and-migrate.
    const retryFlag = process.argv.indexOf('--retry');
    const retryReportPath = retryFlag !== -1 ? process.argv[retryFlag + 1] : undefined;
    try {
        let result;
        if (retryFlag !== -1) {
            if (!retryReportPath) {
                console.error('Usage: migrate-proof-photos --retry <failure-report.json>');
                process.exitCode = 1;
                return;
            }
            console.log(`♻️  Retrying failed proof photos from ${retryReportPath}...`);
            const ids = await readFailedIds(retryReportPath);
            result = await retryFailedPhotos(db, ids, (msg) => console.log(msg));
        }
        else {
            console.log('📦 Migrating legacy base64 proof photos to object storage...');
            result = await migrateProofPhotos(db, (msg) => console.log(msg));
        }
        if (result.failed > 0) {
            const reportPath = await writeFailureReport(result);
            console.error(`\n⚠️  ${result.failed} photo(s) failed and remain as base64 in the database.`);
            if (reportPath) {
                console.error(`   A durable failure report was written to: ${reportPath}`);
            }
            process.exitCode = 1;
        }
    }
    finally {
        await pool.end();
    }
}
// Only run the migration when executed directly as a script, not when imported
// (e.g. by tests). import.meta.url matches the invoked file path under tsx/node.
const invokedDirectly = process.argv[1] !== undefined &&
    import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
    main().catch(e => { console.error(e); process.exit(1); });
}
