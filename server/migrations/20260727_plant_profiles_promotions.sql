BEGIN;

CREATE TABLE IF NOT EXISTS plant_profiles (
  id serial PRIMARY KEY,
  plant_id integer NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  profile_status text NOT NULL DEFAULT 'draft',
  production_capacity_m3_per_hour numeric(8,2),
  maximum_daily_supply_capacity_m3 numeric(10,2),
  number_of_transit_mixers integer,
  number_of_pumps integer,
  inhouse_concrete_pump_available boolean,
  external_pump_arrangement_available boolean,
  works_24_hours boolean NOT NULL DEFAULT false,
  working_hours_start time,
  working_hours_end time,
  minimum_order_quantity_m3 numeric(8,2),
  laboratory_available boolean,
  laboratory_details text,
  quality_engineer_available boolean,
  cube_testing_available boolean,
  cube_testing_reports_available boolean,
  cube_testing_frequency text,
  batching_cabin_camera_available boolean,
  batch_report_available boolean,
  batch_report_linked_with_tm boolean,
  challan_available boolean,
  challan_linked_with_tm boolean,
  diesel_generator_available boolean,
  diesel_generator_capacity_kva numeric(8,2),
  supporting_plant_available boolean,
  supporting_plant_name text,
  supporting_plant_distance_km numeric(8,2),
  breakdown_backup_description text,
  plant_make text,
  plant_model text,
  number_of_silos integer,
  cement_storage_capacity_mt numeric(10,2),
  fly_ash_storage_capacity_mt numeric(10,2),
  aggregate_storage_capacity_mt numeric(10,2),
  weighbridge_available boolean,
  gps_tracking_available boolean,
  plant_manager_available boolean,
  safety_officer_available boolean,
  emergency_support_available boolean,
  cash_payment_available boolean,
  small_quantity_cash_payment_available boolean,
  credit_payment_available boolean,
  credit_days_min integer,
  credit_days_max integer,
  advance_payment_required boolean,
  payment_terms_notes text,
  additional_information text,
  completion_percentage integer NOT NULL DEFAULT 0,
  rejection_reason text,
  submitted_at timestamp,
  reviewed_at timestamp,
  reviewed_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT plant_profiles_plant_unique UNIQUE (plant_id),
  CONSTRAINT plant_profiles_status_check CHECK (profile_status IN ('draft','submitted','changes_requested','verified','suspended')),
  CONSTRAINT plant_profiles_nonnegative_check CHECK (
    COALESCE(number_of_transit_mixers,0) >= 0 AND
    COALESCE(number_of_pumps,0) >= 0 AND
    COALESCE(number_of_silos,0) >= 0 AND
    COALESCE(credit_days_min,0) >= 0 AND
    COALESCE(credit_days_max,0) >= 0
  ),
  CONSTRAINT plant_profiles_credit_range_check CHECK (credit_days_max IS NULL OR credit_days_min IS NULL OR credit_days_max >= credit_days_min)
);
CREATE INDEX IF NOT EXISTS plant_profiles_status_idx ON plant_profiles(profile_status);

CREATE TABLE IF NOT EXISTS plant_certificates (
  id serial PRIMARY KEY,
  plant_id integer NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  certificate_type text NOT NULL,
  certificate_name text NOT NULL,
  certificate_status text NOT NULL DEFAULT 'available',
  certificate_number text,
  issuing_authority text,
  issue_date date,
  expiry_date date,
  document_url text,
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_method text NOT NULL DEFAULT 'not_verified',
  is_visible_to_customer boolean NOT NULL DEFAULT false,
  owner_notes text,
  verified_by integer REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT plant_certificates_status_check CHECK (certificate_status IN ('available','not_available','applied','expired','not_applicable')),
  CONSTRAINT plant_certificates_verification_check CHECK (verification_status IN ('unverified','pending','verified','rejected','expired'))
);
CREATE INDEX IF NOT EXISTS plant_certificates_plant_idx ON plant_certificates(plant_id);
CREATE INDEX IF NOT EXISTS plant_certificates_verification_idx ON plant_certificates(verification_status);
CREATE INDEX IF NOT EXISTS plant_certificates_expiry_idx ON plant_certificates(expiry_date);

CREATE TABLE IF NOT EXISTS plant_promotions (
  id serial PRIMARY KEY,
  plant_id integer NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  package_type text NOT NULL DEFAULT 'standard',
  promotion_radius_km numeric(8,2) NOT NULL DEFAULT 20,
  priority_rank integer NOT NULL DEFAULT 1,
  banner_title text NOT NULL DEFAULT 'Featured RMC Plant',
  banner_subtitle text,
  show_glowing_effect boolean NOT NULL DEFAULT true,
  payment_status text NOT NULL DEFAULT 'pending',
  start_at timestamp NOT NULL,
  end_at timestamp NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  amount_paid numeric(12,2),
  payment_reference text,
  internal_notes text,
  created_by integer REFERENCES users(id) ON DELETE SET NULL,
  updated_by integer REFERENCES users(id) ON DELETE SET NULL,
  approved_by integer REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamp,
  suspended_at timestamp,
  suspension_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT plant_promotions_package_check CHECK (package_type IN ('standard','featured','premium','custom')),
  CONSTRAINT plant_promotions_payment_check CHECK (payment_status IN ('pending','paid','waived','refunded','cancelled')),
  CONSTRAINT plant_promotions_range_check CHECK (promotion_radius_km > 0 AND priority_rank >= 1 AND end_at > start_at)
);
CREATE INDEX IF NOT EXISTS plant_promotions_plant_idx ON plant_promotions(plant_id);
CREATE INDEX IF NOT EXISTS plant_promotions_active_idx ON plant_promotions(is_active);
CREATE INDEX IF NOT EXISTS plant_promotions_start_idx ON plant_promotions(start_at);
CREATE INDEX IF NOT EXISTS plant_promotions_end_idx ON plant_promotions(end_at);
CREATE UNIQUE INDEX IF NOT EXISTS plant_promotions_one_active_per_plant
  ON plant_promotions(plant_id)
  WHERE is_active = true;

COMMIT;

-- Verification:
-- SELECT plant_id, profile_status, completion_percentage FROM plant_profiles ORDER BY plant_id;
-- SELECT plant_id, certificate_name, verification_status, document_url FROM plant_certificates ORDER BY plant_id, id;
-- SELECT plant_id, package_type, priority_rank, start_at, end_at FROM plant_promotions WHERE is_active = true;
-- Rollback (run only after confirming no required production data exists):
-- DROP TABLE IF EXISTS plant_promotions;
-- DROP TABLE IF EXISTS plant_certificates;
-- DROP TABLE IF EXISTS plant_profiles;
