-- Production-safe forward migration. Legacy labels are renamed in place (preserving every row); new PostgreSQL
-- enum values are additive. No profile or audit record is deleted. Application writes use the canonical lifecycle after deployment.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='kyc_profile_status' AND e.enumlabel='draft') THEN
    ALTER TYPE kyc_profile_status RENAME VALUE 'draft' TO 'pending';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='kyc_profile_status' AND e.enumlabel='approved') THEN
    ALTER TYPE kyc_profile_status RENAME VALUE 'approved' TO 'verified';
  END IF;
END $$;
ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE kyc_profile_status ADD VALUE IF NOT EXISTS 'revoked';

-- PostgreSQL requires newly added enum labels to be committed before they are
-- referenced by defaults, data, constraints, or index predicates. Those
-- operations intentionally live in the next migration so transactional
-- migration runners cannot hit "unsafe use of new value".

-- Rollback guidance: deploy the prior application, map canonical `pending` to
-- `draft` and `verified` to `approved`, and manually review the other lifecycle
-- states before mapping them. Do not delete profiles or history. Added enum
-- labels intentionally remain because PostgreSQL cannot safely remove them.
