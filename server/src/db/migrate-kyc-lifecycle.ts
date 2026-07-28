import 'dotenv/config';
import { pool } from './index.js';

// One-off production migration for the KYC lifecycle rename (drizzle/0001-0003).
// This repo does not run `drizzle-kit migrate` in its deploy pipeline — schema
// sync is `pnpm db:push` (see Dockerfile) plus these hand-run scripts for
// changes push can't express safely. `db:push` alone cannot rename existing
// enum values, so a database that still has legacy `draft`/`approved` rows
// needs this run once before deploying code that expects the modern
// pending/verified lifecycle. Every statement is idempotent: safe to re-run,
// and a no-op against a database that was provisioned fresh from the current
// schema.ts (where `db:push` already created every label listed here).
async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    // Phase 1: enum label renames + additions. Postgres requires ALTER TYPE
    // ... ADD VALUE (and RENAME VALUE) to commit before the label can be
    // referenced by an expression (a default, a cast, a WHERE clause) in the
    // same session, so these run as autocommitted statements, not inside an
    // explicit transaction — before phase 2 touches anything that uses them.
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'kyc_profile_status' AND e.enumlabel = 'draft')
           AND NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'kyc_profile_status' AND e.enumlabel = 'pending') THEN
          ALTER TYPE kyc_profile_status RENAME VALUE 'draft' TO 'pending';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'kyc_profile_status' AND e.enumlabel = 'approved')
           AND NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'kyc_profile_status' AND e.enumlabel = 'verified') THEN
          ALTER TYPE kyc_profile_status RENAME VALUE 'approved' TO 'verified';
        END IF;
      END $$;
    `);
    await client.query(`ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'under_review'`);
    await client.query(`ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'suspended'`);
    await client.query(`ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'expired'`);
    await client.query(`ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'revoked'`);
    // Restored as a distinct, additive value after the rename above — kept
    // separate from `verified` going forward (see kycBadge.ts, which treats
    // both as verified-equivalent for legacy enterprise KYC profiles).
    await client.query(`ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'approved'`);

    // Phase 2: everything that can reference the (now-committed) enum labels.
    await client.query('BEGIN');
    await client.query(`ALTER TABLE kyc_profiles ALTER COLUMN status SET DEFAULT 'pending'`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS kyc_profiles_review_queue_idx
        ON kyc_profiles (status, updated_at DESC)
        WHERE status IN ('submitted', 'under_review')
    `);
    await client.query(`
      ALTER TABLE kyc_verifications
        ADD COLUMN IF NOT EXISTS expires_at timestamp NOT NULL DEFAULT (now() + interval '15 minutes'),
        ADD COLUMN IF NOT EXISTS callback_claimed_at timestamp
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS kyc_verifications_provider_txn_unique
        ON kyc_verifications (provider, provider_txn_id)
        WHERE provider_txn_id IS NOT NULL
    `);
    await client.query('COMMIT');
    console.log('KYC lifecycle migration complete.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('KYC lifecycle migration failed', error);
  process.exitCode = 1;
});
