import 'dotenv/config';
import { pool } from './index.js';

// One-off migration: add sponsored/paid-ad placement columns to the plants table.
// All statements are idempotent — safe to re-run against an already-migrated DB.
// Run once before deploying code that reads promotionActive / promotionPriority etc.
async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE plants
        ADD COLUMN IF NOT EXISTS promotion_active     boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS promotion_start      timestamptz,
        ADD COLUMN IF NOT EXISTS promotion_end        timestamptz,
        ADD COLUMN IF NOT EXISTS promotion_radius_km  integer NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS promotion_priority   integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS promotion_ad_glow    boolean NOT NULL DEFAULT true
    `);

    await client.query('COMMIT');
    console.log('✅ migrate-sponsored-plants: done');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('migrate-sponsored-plants failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
