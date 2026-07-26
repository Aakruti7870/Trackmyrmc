-- Emergency application rollback does not require dropping additive discovery data.
-- First deactivate/hide affected listings, then roll Cloud Run back to the prior revision.
-- This file intentionally performs no destructive DROP statements.

UPDATE plants
SET is_active = false,
    show_on_network = false,
    publication_status = 'HIDDEN',
    operational_status = 'TEMPORARILY_CLOSED',
    updated_at = now()
WHERE source = 'GOOGLE_PLACES'
  AND candidate_id IS NOT NULL;
