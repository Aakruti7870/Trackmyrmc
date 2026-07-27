-- Keep legacy KYC rows readable during the migration to the canonical
-- `verified` lifecycle status. PostgreSQL enum additions are irreversible but
-- additive, so this is safe to apply to both upgraded and fresh databases.
ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'approved';
