import 'dotenv/config';
import { pool } from './index.js';
import { MAHARASHTRA_RMC_MARKETS } from './maharashtraRmcMarkets.js';

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE plants
        ADD COLUMN IF NOT EXISTS google_place_id text,
        ADD COLUMN IF NOT EXISTS locality text,
        ADD COLUMN IF NOT EXISTS district text,
        ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'Maharashtra',
        ADD COLUMN IF NOT EXISTS postal_code text,
        ADD COLUMN IF NOT EXISTS contact_person_name text,
        ADD COLUMN IF NOT EXISTS alternate_mobile_number text,
        ADD COLUMN IF NOT EXISTS capacity_m3_per_hour numeric(8,2),
        ADD COLUMN IF NOT EXISTS minimum_order_m3 numeric(8,2),
        ADD COLUMN IF NOT EXISTS transit_mixer_count integer,
        ADD COLUMN IF NOT EXISTS pump_available boolean,
        ADD COLUMN IF NOT EXISTS operating_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'UNCONFIRMED',
        ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'NOT_INVITED',
        ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS verification_level text NOT NULL DEFAULT 'TRACKMYRMC_REGISTERED',
        ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'TRACKMYRMC',
        ADD COLUMN IF NOT EXISTS candidate_id integer,
        ADD COLUMN IF NOT EXISTS owner_user_id integer,
        ADD COLUMN IF NOT EXISTS approved_by_user_id integer,
        ADD COLUMN IF NOT EXISTS approved_at timestamptz,
        ADD COLUMN IF NOT EXISTS activated_by_user_id integer,
        ADD COLUMN IF NOT EXISTS activated_at timestamptz,
        ADD COLUMN IF NOT EXISTS last_operational_confirmation_at timestamptz
    `);

    await client.query(`UPDATE plants SET google_place_id = place_id WHERE google_place_id IS NULL AND place_id IS NOT NULL`);
    await client.query(`
      UPDATE plants SET
        onboarding_status = CASE WHEN verified = true OR plant_status = 'approved' THEN 'APPROVED' ELSE onboarding_status END,
        publication_status = CASE WHEN show_on_network = true AND (network_status = 'active' OR (plant_status = 'approved' AND is_active = true AND location_verified = true AND verified = true)) THEN 'PUBLISHED' ELSE publication_status END,
        operational_status = CASE WHEN is_active = true AND (network_status = 'active' OR plant_status = 'approved') THEN 'ACCEPTING_ORDERS' ELSE operational_status END,
        verification_level = CASE WHEN verified = true THEN 'TRACKMYRMC_VERIFIED' ELSE verification_level END
    `);

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS plants_google_place_id_unique ON plants(google_place_id) WHERE google_place_id IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS plants_rmc_publication_idx ON plants(publication_status, onboarding_status, operational_status, is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS plants_rmc_district_idx ON plants(state, district, locality)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rmc_market_areas (
        id serial PRIMARY KEY,
        state text NOT NULL DEFAULT 'Maharashtra',
        district text NOT NULL,
        market_name text NOT NULL,
        locality text NOT NULL,
        latitude numeric(10,7) NOT NULL,
        longitude numeric(10,7) NOT NULL,
        search_radius_meters integer NOT NULL DEFAULT 50000,
        is_enabled boolean NOT NULL DEFAULT true,
        priority integer NOT NULL DEFAULT 100,
        last_scanned_at timestamptz,
        next_scan_eligible_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rmc_market_areas_state_district_market_unique UNIQUE(state, district, market_name)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_market_areas_state_idx ON rmc_market_areas(state)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_market_areas_district_idx ON rmc_market_areas(district)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_market_areas_market_name_idx ON rmc_market_areas(market_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_market_areas_enabled_idx ON rmc_market_areas(is_enabled)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rmc_plant_import_runs (
        id serial PRIMARY KEY,
        started_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        scope_type text NOT NULL,
        market_area_id integer REFERENCES rmc_market_areas(id) ON DELETE SET NULL,
        district text,
        state text NOT NULL DEFAULT 'Maharashtra',
        status text NOT NULL DEFAULT 'QUEUED',
        cancel_requested boolean NOT NULL DEFAULT false,
        total_queries integer NOT NULL DEFAULT 0,
        completed_queries integer NOT NULL DEFAULT 0,
        total_results integer NOT NULL DEFAULT 0,
        inserted_candidates integer NOT NULL DEFAULT 0,
        updated_candidates integer NOT NULL DEFAULT 0,
        duplicate_candidates integer NOT NULL DEFAULT 0,
        rejected_candidates integer NOT NULL DEFAULT 0,
        error_count integer NOT NULL DEFAULT 0,
        error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_import_runs_status_idx ON rmc_plant_import_runs(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_import_runs_market_idx ON rmc_plant_import_runs(market_area_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rmc_plant_import_queries (
        id serial PRIMARY KEY,
        import_run_id integer NOT NULL REFERENCES rmc_plant_import_runs(id) ON DELETE CASCADE,
        market_area_id integer NOT NULL REFERENCES rmc_market_areas(id) ON DELETE RESTRICT,
        query_text text NOT NULL,
        status text NOT NULL DEFAULT 'QUEUED',
        page_count integer NOT NULL DEFAULT 0,
        result_count integer NOT NULL DEFAULT 0,
        error_message text,
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT rmc_plant_import_queries_run_market_query_unique UNIQUE(import_run_id, market_area_id, query_text)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_import_queries_run_idx ON rmc_plant_import_queries(import_run_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rmc_plant_candidates (
        id serial PRIMARY KEY,
        google_place_id text NOT NULL UNIQUE,
        discovered_name text NOT NULL,
        normalized_name text NOT NULL,
        formatted_address text,
        locality text,
        district text,
        state text NOT NULL DEFAULT 'Maharashtra',
        latitude numeric(10,7) NOT NULL,
        longitude numeric(10,7) NOT NULL,
        google_maps_uri text,
        google_business_status text,
        google_types jsonb NOT NULL DEFAULT '[]'::jsonb,
        source text NOT NULL DEFAULT 'GOOGLE_PLACES',
        confidence_score integer NOT NULL,
        confidence_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
        discovery_status text NOT NULL DEFAULT 'DISCOVERED',
        possible_duplicate_of_plant_id integer REFERENCES plants(id) ON DELETE SET NULL,
        first_discovered_at timestamptz NOT NULL DEFAULT now(),
        last_discovered_at timestamptz NOT NULL DEFAULT now(),
        last_google_checked_at timestamptz NOT NULL DEFAULT now(),
        import_run_id integer REFERENCES rmc_plant_import_runs(id) ON DELETE SET NULL,
        reviewed_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at timestamptz,
        rejection_reason text,
        reviewer_notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_candidates_status_idx ON rmc_plant_candidates(discovery_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_candidates_district_idx ON rmc_plant_candidates(district)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_candidates_locality_idx ON rmc_plant_candidates(locality)`);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_candidates_confidence_idx ON rmc_plant_candidates(confidence_score)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rmc_plant_status_history (
        id serial PRIMARY KEY,
        plant_id integer NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        changed_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        previous_operational_status text,
        new_operational_status text,
        previous_publication_status text,
        new_publication_status text,
        reason text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_status_history_plant_idx ON rmc_plant_status_history(plant_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rmc_plant_onboarding_invites (
        id serial PRIMARY KEY,
        plant_id integer NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
        invited_mobile_number text NOT NULL,
        invited_email text,
        invite_token_hash text NOT NULL UNIQUE,
        invite_status text NOT NULL DEFAULT 'INVITED',
        expires_at timestamptz NOT NULL,
        sent_at timestamptz NOT NULL DEFAULT now(),
        accepted_at timestamptz,
        created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS rmc_plant_onboarding_invites_plant_idx ON rmc_plant_onboarding_invites(plant_id)`);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plants_candidate_id_fkey') THEN
          ALTER TABLE plants ADD CONSTRAINT plants_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES rmc_plant_candidates(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plants_owner_user_id_fkey') THEN
          ALTER TABLE plants ADD CONSTRAINT plants_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plants_approved_by_user_id_fkey') THEN
          ALTER TABLE plants ADD CONSTRAINT plants_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plants_activated_by_user_id_fkey') THEN
          ALTER TABLE plants ADD CONSTRAINT plants_activated_by_user_id_fkey FOREIGN KEY (activated_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `);

    for (const market of MAHARASHTRA_RMC_MARKETS) {
      await client.query(
        `INSERT INTO rmc_market_areas
          (state, district, market_name, locality, latitude, longitude, search_radius_meters, is_enabled, priority)
         VALUES ('Maharashtra', $1, $2, $3, $4, $5, 50000, true, $6)
         ON CONFLICT (state, district, market_name) DO UPDATE SET
           locality = EXCLUDED.locality,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           priority = EXCLUDED.priority,
           updated_at = now()`,
        [market.district, market.marketName, market.locality, market.latitude, market.longitude, market.priority],
      );
    }

    await client.query('COMMIT');
    console.log(`RMC discovery migration complete; ${MAHARASHTRA_RMC_MARKETS.length} Maharashtra markets seeded.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error('RMC discovery migration failed', error);
  process.exitCode = 1;
});
