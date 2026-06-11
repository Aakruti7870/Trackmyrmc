import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
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

/** A photo row that could not be migrated and remains base64 in the database. */
export interface FailedPhoto {
  id: number;
  challanId: number;
  error: string;
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
  /**
   * Detail for every row whose upload threw — these still hold base64 in the
   * database and need attention. Empty on a fully successful run.
   */
  failures: FailedPhoto[];
}

/**
 * Runs the legacy-photo migration against the given database. Returns a tally of
 * how many rows were migrated, skipped (already an object path), and failed.
 *
 * Exported (and parameterized over the db) so tests can drive it against the
 * isolated test database with `proofPhotoStore.store` stubbed.
 */
export async function migrateProofPhotos(
  db: NodePgDatabase<typeof schema>,
  log: (msg: string) => void = () => {},
): Promise<MigrationResult> {
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

  let migrated = 0;
  let skipped = 0;
  const failures: FailedPhoto[] = [];

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
      log(`  ✔ photo #${row.id} (challan ${row.challanId}) → ${entityPath}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failures.push({ id: row.id, challanId: row.challanId, error });
      log(`  ✘ photo #${row.id} (challan ${row.challanId}) failed: ${error}`);
    }
  }

  log(`\n✅ Migration complete. Migrated: ${migrated}, skipped: ${skipped}, failed: ${failures.length}.`);
  return { migrated, skipped, failed: failures.length, failures };
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
export async function writeFailureReport(
  result: MigrationResult,
  dir: string = process.cwd(),
): Promise<string | null> {
  if (result.failures.length === 0) return null;

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

  console.log('📦 Migrating legacy base64 proof photos to object storage...');
  try {
    const result = await migrateProofPhotos(db, (msg) => console.log(msg));
    if (result.failed > 0) {
      const reportPath = await writeFailureReport(result);
      console.error(
        `\n⚠️  ${result.failed} photo(s) failed to migrate and remain as base64 in the database.`,
      );
      if (reportPath) {
        console.error(`   A durable failure report was written to: ${reportPath}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

// Only run the migration when executed directly as a script, not when imported
// (e.g. by tests). import.meta.url matches the invoked file path under tsx/node.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  main().catch(e => { console.error(e); process.exit(1); });
}
