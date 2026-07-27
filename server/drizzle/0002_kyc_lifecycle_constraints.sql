-- Runs after 0001 has committed the new enum labels. Every operation is
-- idempotent and preserves existing KYC profiles and verification history.
ALTER TABLE kyc_profiles ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS kyc_profiles_review_queue_idx
  ON kyc_profiles (status, updated_at DESC)
  WHERE status IN ('submitted', 'under_review');

ALTER TABLE kyc_verifications
  ADD COLUMN IF NOT EXISTS expires_at timestamp NOT NULL DEFAULT (now() + interval '15 minutes'),
  ADD COLUMN IF NOT EXISTS callback_claimed_at timestamp;

CREATE UNIQUE INDEX IF NOT EXISTS kyc_verifications_provider_txn_unique
  ON kyc_verifications (provider, provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

-- Rollback is forward-only and data-preserving: the application may stop using
-- these columns/indexes, but do not drop them until all older application
-- versions and pending callbacks have aged out.
