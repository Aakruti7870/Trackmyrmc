--
-- PostgreSQL database dump
--

\restrict jGmtSsoataJfylW7ZxbZB0I36JV9htDhhqlyJ7dlbwGEUbnqSZA3uVoj2Wztyj9

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_order_id_orders_id_fk;
ALTER TABLE IF EXISTS ONLY public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.vehicle_alerts DROP CONSTRAINT IF EXISTS vehicle_alerts_vehicle_id_vehicles_id_fk;
ALTER TABLE IF EXISTS ONLY public.vehicle_alerts DROP CONSTRAINT IF EXISTS vehicle_alerts_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.vehicle_alerts DROP CONSTRAINT IF EXISTS vehicle_alerts_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_suspended_by_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_preferred_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_linked_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_linked_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_created_by_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_order_id_orders_id_fk;
ALTER TABLE IF EXISTS ONLY public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_vehicle_id_vehicles_id_fk;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_order_id_orders_id_fk;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.tracking_tokens DROP CONSTRAINT IF EXISTS tracking_tokens_created_by_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.tracking_tokens DROP CONSTRAINT IF EXISTS tracking_tokens_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.staff_otp_codes DROP CONSTRAINT IF EXISTS staff_otp_codes_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.sites DROP CONSTRAINT IF EXISTS sites_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.recurring_orders DROP CONSTRAINT IF EXISTS recurring_orders_site_id_sites_id_fk;
ALTER TABLE IF EXISTS ONLY public.recurring_orders DROP CONSTRAINT IF EXISTS recurring_orders_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.rate_cards DROP CONSTRAINT IF EXISTS rate_cards_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.plant_invites DROP CONSTRAINT IF EXISTS plant_invites_last_requested_by_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.plant_invites DROP CONSTRAINT IF EXISTS plant_invites_first_requested_by_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.plant_customers DROP CONSTRAINT IF EXISTS plant_customers_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.plant_customers DROP CONSTRAINT IF EXISTS plant_customers_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.plant_customers DROP CONSTRAINT IF EXISTS plant_customers_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.password_setup_tokens DROP CONSTRAINT IF EXISTS password_setup_tokens_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_site_id_sites_id_fk;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.kyc_verifications DROP CONSTRAINT IF EXISTS kyc_verifications_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_vehicle_id_vehicles_id_fk;
ALTER TABLE IF EXISTS ONLY public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_recorded_by_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.emergencies DROP CONSTRAINT IF EXISTS emergencies_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.emergencies DROP CONSTRAINT IF EXISTS emergencies_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.emergencies DROP CONSTRAINT IF EXISTS emergencies_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.emergencies DROP CONSTRAINT IF EXISTS emergencies_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.emergencies DROP CONSTRAINT IF EXISTS emergencies_acknowledged_by_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_vehicle_id_vehicles_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_trip_id_trip_sessions_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_attendance_id_attendance_records_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_vehicle_id_vehicles_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_reviewed_by_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.clients DROP CONSTRAINT IF EXISTS clients_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_vehicle_id_vehicles_id_fk;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_site_id_sites_id_fk;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_order_id_orders_id_fk;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_driver_id_drivers_id_fk;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_client_id_clients_id_fk;
ALTER TABLE IF EXISTS ONLY public.challan_proof_photos DROP CONSTRAINT IF EXISTS challan_proof_photos_challan_id_challans_id_fk;
ALTER TABLE IF EXISTS ONLY public.batch_records DROP CONSTRAINT IF EXISTS batch_records_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_target_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_plant_id_plants_id_fk;
ALTER TABLE IF EXISTS ONLY public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_conversation_id_ai_conversations_id_fk;
ALTER TABLE IF EXISTS ONLY public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_user_id_users_id_fk;
ALTER TABLE IF EXISTS ONLY public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_plant_id_plants_id_fk;
DROP INDEX IF EXISTS public.whatsapp_retries_next_attempt_at_idx;
DROP INDEX IF EXISTS public.whatsapp_messages_to_phone_idx;
DROP INDEX IF EXISTS public.whatsapp_messages_sid_unique;
DROP INDEX IF EXISTS public.whatsapp_messages_plant_idx;
DROP INDEX IF EXISTS public.whatsapp_messages_created_at_idx;
DROP INDEX IF EXISTS public.users_phone_unique;
DROP INDEX IF EXISTS public.users_linked_driver_unique;
DROP INDEX IF EXISTS public.users_linked_client_unique;
DROP INDEX IF EXISTS public.uploaded_files_type_idx;
DROP INDEX IF EXISTS public.uploaded_files_plant_idx;
DROP INDEX IF EXISTS public.uploaded_files_path_unique;
DROP INDEX IF EXISTS public.trip_sessions_plant_idx;
DROP INDEX IF EXISTS public.trip_sessions_challan_unique;
DROP INDEX IF EXISTS public.tracking_tokens_hash_unique;
DROP INDEX IF EXISTS public.support_tickets_user_idx;
DROP INDEX IF EXISTS public.support_tickets_plant_idx;
DROP INDEX IF EXISTS public.staff_otp_codes_user_unique;
DROP INDEX IF EXISTS public.response_cache_expires_at_idx;
DROP INDEX IF EXISTS public.rate_limit_hits_reset_at_idx;
DROP INDEX IF EXISTS public.rate_cards_plant_grade_unique;
DROP INDEX IF EXISTS public.push_subscriptions_user_idx;
DROP INDEX IF EXISTS public.plants_name_unique;
DROP INDEX IF EXISTS public.plants_code_unique;
DROP INDEX IF EXISTS public.plant_invites_place_id_unique;
DROP INDEX IF EXISTS public.plant_customers_plant_user_unique;
DROP INDEX IF EXISTS public.password_setup_tokens_hash_unique;
DROP INDEX IF EXISTS public.otp_codes_phone_unique;
DROP INDEX IF EXISTS public.kyc_verifications_user_idx;
DROP INDEX IF EXISTS public.kyc_verifications_provider_ref_unique;
DROP INDEX IF EXISTS public.emergencies_status_idx;
DROP INDEX IF EXISTS public.emergencies_plant_idx;
DROP INDEX IF EXISTS public.driver_locations_user_idx;
DROP INDEX IF EXISTS public.driver_locations_recorded_at_idx;
DROP INDEX IF EXISTS public.driver_locations_plant_idx;
DROP INDEX IF EXISTS public.driver_expenses_user_idx;
DROP INDEX IF EXISTS public.driver_expenses_status_idx;
DROP INDEX IF EXISTS public.driver_expenses_plant_idx;
DROP INDEX IF EXISTS public.clients_plant_customer_code_unique;
DROP INDEX IF EXISTS public.automation_settings_scope_unique;
DROP INDEX IF EXISTS public.automation_sends_sent_at_idx;
DROP INDEX IF EXISTS public.automation_sends_once_unique;
DROP INDEX IF EXISTS public.attendance_open_unique;
DROP INDEX IF EXISTS public.ai_messages_conversation_idx;
DROP INDEX IF EXISTS public.ai_conversations_user_idx;
DROP INDEX IF EXISTS public.ai_conversations_session_user_unique;
ALTER TABLE IF EXISTS ONLY public.whatsapp_retries DROP CONSTRAINT IF EXISTS whatsapp_retries_pkey;
ALTER TABLE IF EXISTS ONLY public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_no_unique;
ALTER TABLE IF EXISTS ONLY public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pkey;
ALTER TABLE IF EXISTS ONLY public.vehicle_alerts DROP CONSTRAINT IF EXISTS vehicle_alerts_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_unique;
ALTER TABLE IF EXISTS ONLY public.uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_pkey;
ALTER TABLE IF EXISTS ONLY public.trip_sessions DROP CONSTRAINT IF EXISTS trip_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.tracking_tokens DROP CONSTRAINT IF EXISTS tracking_tokens_pkey;
ALTER TABLE IF EXISTS ONLY public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_pkey;
ALTER TABLE IF EXISTS ONLY public.staff_otp_codes DROP CONSTRAINT IF EXISTS staff_otp_codes_pkey;
ALTER TABLE IF EXISTS ONLY public.sites DROP CONSTRAINT IF EXISTS sites_pkey;
ALTER TABLE IF EXISTS ONLY public.response_cache DROP CONSTRAINT IF EXISTS response_cache_pkey;
ALTER TABLE IF EXISTS ONLY public.recurring_orders DROP CONSTRAINT IF EXISTS recurring_orders_pkey;
ALTER TABLE IF EXISTS ONLY public.rate_limit_hits DROP CONSTRAINT IF EXISTS rate_limit_hits_pkey;
ALTER TABLE IF EXISTS ONLY public.rate_cards DROP CONSTRAINT IF EXISTS rate_cards_pkey;
ALTER TABLE IF EXISTS ONLY public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_pkey;
ALTER TABLE IF EXISTS ONLY public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_unique;
ALTER TABLE IF EXISTS ONLY public.plants DROP CONSTRAINT IF EXISTS plants_pkey;
ALTER TABLE IF EXISTS ONLY public.plant_invites DROP CONSTRAINT IF EXISTS plant_invites_pkey;
ALTER TABLE IF EXISTS ONLY public.plant_customers DROP CONSTRAINT IF EXISTS plant_customers_pkey;
ALTER TABLE IF EXISTS ONLY public.password_setup_tokens DROP CONSTRAINT IF EXISTS password_setup_tokens_pkey;
ALTER TABLE IF EXISTS ONLY public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_pkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_pkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_order_no_unique;
ALTER TABLE IF EXISTS ONLY public.login_attempts DROP CONSTRAINT IF EXISTS login_attempts_pkey;
ALTER TABLE IF EXISTS ONLY public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_pkey;
ALTER TABLE IF EXISTS ONLY public.kyc_verifications DROP CONSTRAINT IF EXISTS kyc_verifications_pkey;
ALTER TABLE IF EXISTS ONLY public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.emergencies DROP CONSTRAINT IF EXISTS emergencies_pkey;
ALTER TABLE IF EXISTS ONLY public.drivers DROP CONSTRAINT IF EXISTS drivers_pkey;
ALTER TABLE IF EXISTS ONLY public.driver_locations DROP CONSTRAINT IF EXISTS driver_locations_pkey;
ALTER TABLE IF EXISTS ONLY public.driver_expenses DROP CONSTRAINT IF EXISTS driver_expenses_pkey;
ALTER TABLE IF EXISTS ONLY public.clients DROP CONSTRAINT IF EXISTS clients_pkey;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_pkey;
ALTER TABLE IF EXISTS ONLY public.challans DROP CONSTRAINT IF EXISTS challans_challan_no_unique;
ALTER TABLE IF EXISTS ONLY public.challan_proof_photos DROP CONSTRAINT IF EXISTS challan_proof_photos_pkey;
ALTER TABLE IF EXISTS ONLY public.batch_records DROP CONSTRAINT IF EXISTS batch_records_pkey;
ALTER TABLE IF EXISTS ONLY public.batch_records DROP CONSTRAINT IF EXISTS batch_records_batch_no_unique;
ALTER TABLE IF EXISTS ONLY public.automation_settings DROP CONSTRAINT IF EXISTS automation_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.automation_sends DROP CONSTRAINT IF EXISTS automation_sends_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.attendance_records DROP CONSTRAINT IF EXISTS attendance_records_pkey;
ALTER TABLE IF EXISTS ONLY public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_settings DROP CONSTRAINT IF EXISTS ai_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_pkey;
ALTER TABLE IF EXISTS ONLY public.ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_pkey;
ALTER TABLE IF EXISTS public.whatsapp_retries ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.whatsapp_messages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vehicles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.vehicle_alerts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.uploaded_files ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.trip_sessions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.tracking_tokens ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.support_tickets ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.staff_otp_codes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.sites ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.recurring_orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rate_cards ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.push_subscriptions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.plants ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.plant_invites ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.plant_customers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.password_setup_tokens ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.otp_codes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ledger_entries ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.kyc_verifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.fuel_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.emergencies ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.drivers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.driver_locations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.driver_expenses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.clients ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.challans ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.challan_proof_photos ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.batch_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.automation_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.automation_sends ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.attendance_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ai_messages ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ai_conversations ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.whatsapp_retries_id_seq;
DROP TABLE IF EXISTS public.whatsapp_retries;
DROP SEQUENCE IF EXISTS public.whatsapp_messages_id_seq;
DROP TABLE IF EXISTS public.whatsapp_messages;
DROP SEQUENCE IF EXISTS public.vehicles_id_seq;
DROP TABLE IF EXISTS public.vehicles;
DROP SEQUENCE IF EXISTS public.vehicle_alerts_id_seq;
DROP TABLE IF EXISTS public.vehicle_alerts;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.uploaded_files_id_seq;
DROP TABLE IF EXISTS public.uploaded_files;
DROP SEQUENCE IF EXISTS public.trip_sessions_id_seq;
DROP TABLE IF EXISTS public.trip_sessions;
DROP SEQUENCE IF EXISTS public.tracking_tokens_id_seq;
DROP TABLE IF EXISTS public.tracking_tokens;
DROP SEQUENCE IF EXISTS public.support_tickets_id_seq;
DROP TABLE IF EXISTS public.support_tickets;
DROP SEQUENCE IF EXISTS public.staff_otp_codes_id_seq;
DROP TABLE IF EXISTS public.staff_otp_codes;
DROP SEQUENCE IF EXISTS public.sites_id_seq;
DROP TABLE IF EXISTS public.sites;
DROP TABLE IF EXISTS public.response_cache;
DROP SEQUENCE IF EXISTS public.recurring_orders_id_seq;
DROP TABLE IF EXISTS public.recurring_orders;
DROP TABLE IF EXISTS public.rate_limit_hits;
DROP SEQUENCE IF EXISTS public.rate_cards_id_seq;
DROP TABLE IF EXISTS public.rate_cards;
DROP SEQUENCE IF EXISTS public.push_subscriptions_id_seq;
DROP TABLE IF EXISTS public.push_subscriptions;
DROP SEQUENCE IF EXISTS public.plants_id_seq;
DROP TABLE IF EXISTS public.plants;
DROP SEQUENCE IF EXISTS public.plant_invites_id_seq;
DROP TABLE IF EXISTS public.plant_invites;
DROP SEQUENCE IF EXISTS public.plant_customers_id_seq;
DROP TABLE IF EXISTS public.plant_customers;
DROP SEQUENCE IF EXISTS public.password_setup_tokens_id_seq;
DROP TABLE IF EXISTS public.password_setup_tokens;
DROP SEQUENCE IF EXISTS public.otp_codes_id_seq;
DROP TABLE IF EXISTS public.otp_codes;
DROP SEQUENCE IF EXISTS public.orders_id_seq;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.login_attempts;
DROP SEQUENCE IF EXISTS public.ledger_entries_id_seq;
DROP TABLE IF EXISTS public.ledger_entries;
DROP SEQUENCE IF EXISTS public.kyc_verifications_id_seq;
DROP TABLE IF EXISTS public.kyc_verifications;
DROP SEQUENCE IF EXISTS public.fuel_logs_id_seq;
DROP TABLE IF EXISTS public.fuel_logs;
DROP SEQUENCE IF EXISTS public.emergencies_id_seq;
DROP TABLE IF EXISTS public.emergencies;
DROP SEQUENCE IF EXISTS public.drivers_id_seq;
DROP TABLE IF EXISTS public.drivers;
DROP SEQUENCE IF EXISTS public.driver_locations_id_seq;
DROP TABLE IF EXISTS public.driver_locations;
DROP SEQUENCE IF EXISTS public.driver_expenses_id_seq;
DROP TABLE IF EXISTS public.driver_expenses;
DROP SEQUENCE IF EXISTS public.clients_id_seq;
DROP TABLE IF EXISTS public.clients;
DROP SEQUENCE IF EXISTS public.challans_id_seq;
DROP TABLE IF EXISTS public.challans;
DROP SEQUENCE IF EXISTS public.challan_proof_photos_id_seq;
DROP TABLE IF EXISTS public.challan_proof_photos;
DROP SEQUENCE IF EXISTS public.batch_records_id_seq;
DROP TABLE IF EXISTS public.batch_records;
DROP SEQUENCE IF EXISTS public.automation_settings_id_seq;
DROP TABLE IF EXISTS public.automation_settings;
DROP SEQUENCE IF EXISTS public.automation_sends_id_seq;
DROP TABLE IF EXISTS public.automation_sends;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
DROP SEQUENCE IF EXISTS public.attendance_records_id_seq;
DROP TABLE IF EXISTS public.attendance_records;
DROP TABLE IF EXISTS public.app_settings;
DROP TABLE IF EXISTS public.ai_settings;
DROP SEQUENCE IF EXISTS public.ai_messages_id_seq;
DROP TABLE IF EXISTS public.ai_messages;
DROP SEQUENCE IF EXISTS public.ai_conversations_id_seq;
DROP TABLE IF EXISTS public.ai_conversations;
DROP TYPE IF EXISTS public.vehicle_status;
DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.trip_status;
DROP TYPE IF EXISTS public.subscription_status;
DROP TYPE IF EXISTS public.subscription_plan;
DROP TYPE IF EXISTS public.reimbursement_status;
DROP TYPE IF EXISTS public.recurring_frequency;
DROP TYPE IF EXISTS public.plant_status;
DROP TYPE IF EXISTS public.order_status;
DROP TYPE IF EXISTS public.ledger_type;
DROP TYPE IF EXISTS public.kyc_status;
DROP TYPE IF EXISTS public.expense_status;
DROP TYPE IF EXISTS public.emergency_status;
DROP TYPE IF EXISTS public.challan_status;
--
-- Name: challan_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.challan_status AS ENUM (
    'pending',
    'dispatched',
    'delivered',
    'cancelled'
);


--
-- Name: emergency_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.emergency_status AS ENUM (
    'open',
    'acknowledged',
    'resolved'
);


--
-- Name: expense_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: kyc_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.kyc_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'failed'
);


--
-- Name: ledger_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ledger_type AS ENUM (
    'debit',
    'credit'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled',
    'pending_approval',
    'approved',
    'rejected'
);


--
-- Name: plant_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plant_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: recurring_frequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurring_frequency AS ENUM (
    'weekly',
    'monthly'
);


--
-- Name: reimbursement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reimbursement_status AS ENUM (
    'pending',
    'reimbursed'
);


--
-- Name: subscription_plan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_plan AS ENUM (
    'free',
    'basic',
    'pro',
    'enterprise'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'trial',
    'active',
    'past_due',
    'suspended',
    'cancelled'
);


--
-- Name: trip_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trip_status AS ENUM (
    'dispatched',
    'in_transit',
    'reached_site',
    'unloading',
    'delivered',
    'cancelled'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'authority',
    'admin',
    'dispatcher',
    'plant_operator',
    'client',
    'driver',
    'plant_owner',
    'supervisor',
    'accountant',
    'quality_engineer',
    'fleet_manager',
    'store_manager'
);


--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_status AS ENUM (
    'active',
    'maintenance',
    'inactive'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id integer NOT NULL,
    session_id text NOT NULL,
    user_id integer NOT NULL,
    plant_id integer,
    role text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_conversations_id_seq OWNED BY public.ai_conversations.id;


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    session_id text NOT NULL,
    user_id integer NOT NULL,
    plant_id integer,
    message text NOT NULL,
    response text,
    input_type text DEFAULT 'text'::text NOT NULL,
    output_type text DEFAULT 'text'::text NOT NULL,
    functions_used text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ai_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_messages_id_seq OWNED BY public.ai_messages.id;


--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_settings (
    id integer DEFAULT 1 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    persona text,
    greeting text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id integer NOT NULL,
    plant_id integer,
    user_id integer NOT NULL,
    check_in_at timestamp without time zone DEFAULT now() NOT NULL,
    check_out_at timestamp without time zone,
    check_in_note text,
    check_out_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    check_in_lat numeric(10,7),
    check_in_lng numeric(10,7),
    check_out_lat numeric(10,7),
    check_out_lng numeric(10,7)
);


--
-- Name: attendance_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_records_id_seq OWNED BY public.attendance_records.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    actor_id integer,
    actor_name text,
    action text NOT NULL,
    target_user_id integer,
    target_user_email text,
    email_sent boolean,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    status text,
    detail text
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: automation_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_sends (
    id integer NOT NULL,
    automation text NOT NULL,
    plant_id integer,
    target_type text NOT NULL,
    target_id integer NOT NULL,
    window_key text NOT NULL,
    detail text,
    sent_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_sends_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automation_sends_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: automation_sends_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automation_sends_id_seq OWNED BY public.automation_sends.id;


--
-- Name: automation_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_settings (
    id integer NOT NULL,
    automation text NOT NULL,
    plant_id integer DEFAULT 0 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.automation_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: automation_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.automation_settings_id_seq OWNED BY public.automation_settings.id;


--
-- Name: batch_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_records (
    id integer NOT NULL,
    batch_no text NOT NULL,
    grade text NOT NULL,
    quantity numeric(8,2) NOT NULL,
    cement_bags integer,
    water_liters integer,
    sand_kg integer,
    aggregate_kg integer,
    operator text,
    remarks text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    plant_id integer
);


--
-- Name: batch_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_records_id_seq OWNED BY public.batch_records.id;


--
-- Name: challan_proof_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challan_proof_photos (
    id integer NOT NULL,
    challan_id integer NOT NULL,
    photo text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: challan_proof_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.challan_proof_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: challan_proof_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.challan_proof_photos_id_seq OWNED BY public.challan_proof_photos.id;


--
-- Name: challans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challans (
    id integer NOT NULL,
    challan_no text NOT NULL,
    order_id integer,
    client_id integer NOT NULL,
    site_id integer,
    vehicle_id integer,
    driver_id integer,
    grade text NOT NULL,
    quantity numeric(8,2) NOT NULL,
    pump_required boolean DEFAULT false NOT NULL,
    dispatch_time timestamp without time zone,
    delivery_time timestamp without time zone,
    status public.challan_status DEFAULT 'pending'::public.challan_status NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    delivered_quantity numeric(8,2),
    site_arrival_time timestamp without time zone,
    site_release_time timestamp without time zone,
    odometer_start integer,
    odometer_end integer,
    plant_id integer
);


--
-- Name: challans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.challans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: challans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.challans_id_seq OWNED BY public.challans.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name text NOT NULL,
    contact_person text NOT NULL,
    phone text NOT NULL,
    email text,
    gst_no text,
    address text,
    city text,
    credit_limit numeric(12,2) DEFAULT '0'::numeric,
    outstanding_amount numeric(12,2) DEFAULT '0'::numeric,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    plant_id integer,
    customer_code text
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: driver_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_expenses (
    id integer NOT NULL,
    driver_id integer,
    user_id integer NOT NULL,
    plant_id integer,
    challan_id integer,
    vehicle_id integer,
    category text NOT NULL,
    amount numeric(10,2) NOT NULL,
    description text,
    receipt_photo text,
    gps_lat numeric(10,7),
    gps_lng numeric(10,7),
    expense_at timestamp without time zone NOT NULL,
    status public.expense_status DEFAULT 'pending'::public.expense_status NOT NULL,
    reviewer_remark text,
    reviewed_by integer,
    reviewed_by_name text,
    reviewed_at timestamp without time zone,
    reimbursement_status public.reimbursement_status DEFAULT 'pending'::public.reimbursement_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: driver_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.driver_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: driver_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.driver_expenses_id_seq OWNED BY public.driver_expenses.id;


--
-- Name: driver_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_locations (
    id integer NOT NULL,
    user_id integer NOT NULL,
    attendance_id integer,
    driver_id integer,
    vehicle_id integer,
    plant_id integer,
    trip_id integer,
    lat numeric(10,7) NOT NULL,
    lng numeric(10,7) NOT NULL,
    accuracy integer,
    speed numeric(6,2),
    heading numeric(6,2),
    battery integer,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: driver_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.driver_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: driver_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.driver_locations_id_seq OWNED BY public.driver_locations.id;


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    license_no text,
    license_expiry date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- Name: emergencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergencies (
    id integer NOT NULL,
    driver_id integer,
    user_id integer NOT NULL,
    plant_id integer,
    challan_id integer,
    type text NOT NULL,
    message text,
    lat numeric(10,7),
    lng numeric(10,7),
    status public.emergency_status DEFAULT 'open'::public.emergency_status NOT NULL,
    acknowledged_by integer,
    acknowledged_by_name text,
    acknowledged_at timestamp without time zone,
    resolved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: emergencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergencies_id_seq OWNED BY public.emergencies.id;


--
-- Name: fuel_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fuel_logs (
    id integer NOT NULL,
    vehicle_id integer NOT NULL,
    litres numeric(8,2) NOT NULL,
    amount numeric(10,2),
    odometer integer,
    filled_at timestamp without time zone NOT NULL,
    bill_photo text,
    notes text,
    recorded_by integer,
    recorded_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: fuel_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fuel_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fuel_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fuel_logs_id_seq OWNED BY public.fuel_logs.id;


--
-- Name: kyc_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kyc_verifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider text NOT NULL,
    provider_ref text NOT NULL,
    provider_txn_id text,
    status public.kyc_status DEFAULT 'pending'::public.kyc_status NOT NULL,
    masked_aadhaar text,
    full_name text,
    dob text,
    gender text,
    error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    completed_at timestamp without time zone
);


--
-- Name: kyc_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kyc_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kyc_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kyc_verifications_id_seq OWNED BY public.kyc_verifications.id;


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id integer NOT NULL,
    client_id integer NOT NULL,
    type public.ledger_type NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    reference_no text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_entries_id_seq OWNED BY public.ledger_entries.id;


--
-- Name: login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_attempts (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    locked_until timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    order_no text NOT NULL,
    client_id integer NOT NULL,
    site_id integer,
    grade text NOT NULL,
    quantity numeric(8,2) NOT NULL,
    pump_required boolean DEFAULT false NOT NULL,
    delivery_date date,
    delivery_time time without time zone,
    notes text,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    plant_id integer,
    pump_line_length numeric(6,2),
    contact_person text,
    contact_number text,
    site_name text,
    site_address text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    payment_type text,
    po_number text,
    site_photo text,
    rejection_reason text,
    cancellation_reason text,
    place_id text
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    phone text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_codes_id_seq OWNED BY public.otp_codes.id;


--
-- Name: password_setup_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_setup_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'invite'::text NOT NULL
);


--
-- Name: password_setup_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_setup_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_setup_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_setup_tokens_id_seq OWNED BY public.password_setup_tokens.id;


--
-- Name: plant_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_customers (
    id integer NOT NULL,
    plant_id integer NOT NULL,
    user_id integer NOT NULL,
    client_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: plant_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plant_customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plant_customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plant_customers_id_seq OWNED BY public.plant_customers.id;


--
-- Name: plant_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_invites (
    id integer NOT NULL,
    place_id text NOT NULL,
    name text NOT NULL,
    address text,
    latitude numeric(10,7),
    longitude numeric(10,7),
    contact_number text,
    request_count integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    first_requested_by_id integer,
    first_requested_by_name text,
    last_requested_by_id integer,
    last_requested_by_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: plant_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plant_invites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plant_invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plant_invites_id_seq OWNED BY public.plant_invites.id;


--
-- Name: plants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plants (
    id integer NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    contact_number text,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    plant_status public.plant_status DEFAULT 'pending'::public.plant_status NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    location_verified boolean DEFAULT false NOT NULL,
    delivery_radius_km integer DEFAULT 25 NOT NULL,
    grades text[] DEFAULT ARRAY[]::text[] NOT NULL,
    open_time text,
    close_time text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    plant_code text,
    legal_name text,
    gst_no text,
    email text,
    verified boolean DEFAULT false NOT NULL,
    place_id text,
    subscription_status public.subscription_status DEFAULT 'trial'::public.subscription_status NOT NULL,
    subscription_plan public.subscription_plan DEFAULT 'free'::public.subscription_plan NOT NULL,
    commission_pct numeric(5,2),
    owner_name text,
    whatsapp_number text,
    network_status text DEFAULT 'pending'::text NOT NULL,
    show_on_network boolean DEFAULT true NOT NULL,
    invite_status text,
    invite_sent_at timestamp without time zone
);


--
-- Name: plants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plants_id_seq OWNED BY public.plants.id;


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_subscriptions_id_seq OWNED BY public.push_subscriptions.id;


--
-- Name: rate_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_cards (
    id integer NOT NULL,
    plant_id integer NOT NULL,
    grade text NOT NULL,
    rate_per_m3 numeric(12,2) NOT NULL,
    effective_from timestamp without time zone,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: rate_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rate_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rate_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rate_cards_id_seq OWNED BY public.rate_cards.id;


--
-- Name: rate_limit_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_hits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp without time zone NOT NULL
);


--
-- Name: recurring_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_orders (
    id integer NOT NULL,
    client_id integer NOT NULL,
    site_id integer,
    grade text NOT NULL,
    quantity numeric(8,2) NOT NULL,
    pump_required boolean DEFAULT false NOT NULL,
    delivery_time time without time zone,
    notes text,
    frequency public.recurring_frequency NOT NULL,
    anchor integer NOT NULL,
    next_run_date date NOT NULL,
    active boolean DEFAULT true NOT NULL,
    last_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recurring_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recurring_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recurring_orders_id_seq OWNED BY public.recurring_orders.id;


--
-- Name: response_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.response_cache (
    key text NOT NULL,
    value jsonb NOT NULL,
    expires_at timestamp without time zone NOT NULL
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id integer NOT NULL,
    client_id integer NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7)
);


--
-- Name: sites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sites_id_seq OWNED BY public.sites.id;


--
-- Name: staff_otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_otp_codes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    code_hash text NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_otp_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_otp_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_otp_codes_id_seq OWNED BY public.staff_otp_codes.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    user_id integer,
    plant_id integer,
    client_id integer,
    subject text,
    message text NOT NULL,
    contact_info text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: tracking_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tracking_tokens (
    id integer NOT NULL,
    challan_id integer NOT NULL,
    token_hash text NOT NULL,
    created_by integer,
    expires_at timestamp without time zone,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tracking_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tracking_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tracking_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tracking_tokens_id_seq OWNED BY public.tracking_tokens.id;


--
-- Name: trip_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_sessions (
    id integer NOT NULL,
    challan_id integer NOT NULL,
    order_id integer,
    client_id integer,
    driver_id integer,
    vehicle_id integer,
    plant_id integer,
    status public.trip_status DEFAULT 'dispatched'::public.trip_status NOT NULL,
    customer_tracking_active boolean DEFAULT true NOT NULL,
    delivery_lat numeric(10,7),
    delivery_lng numeric(10,7),
    last_lat numeric(10,7),
    last_lng numeric(10,7),
    last_updated_at timestamp without time zone,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    delivered_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: trip_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trip_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trip_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trip_sessions_id_seq OWNED BY public.trip_sessions.id;


--
-- Name: uploaded_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploaded_files (
    id integer NOT NULL,
    plant_id integer,
    user_id integer,
    order_id integer,
    challan_id integer,
    file_type text NOT NULL,
    file_name text,
    storage_path text NOT NULL,
    access_level text DEFAULT 'plant'::text NOT NULL,
    uploaded_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: uploaded_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.uploaded_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: uploaded_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.uploaded_files_id_seq OWNED BY public.uploaded_files.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text,
    role public.user_role DEFAULT 'dispatcher'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    linked_client_id integer,
    linked_driver_id integer,
    deleted_at timestamp without time zone,
    plant_id integer,
    phone text,
    created_by integer,
    suspended_by integer,
    suspension_reason text,
    permissions jsonb,
    preferred_plant_id integer,
    session_version integer DEFAULT 0 NOT NULL,
    kyc_status public.kyc_status DEFAULT 'unverified'::public.kyc_status NOT NULL,
    kyc_verified_at timestamp without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicle_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_alerts (
    id integer NOT NULL,
    challan_id integer,
    vehicle_id integer,
    driver_id integer,
    type text NOT NULL,
    lat numeric(10,7),
    lng numeric(10,7),
    distance_m integer,
    detail text,
    acknowledged_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: vehicle_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicle_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicle_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicle_alerts_id_seq OWNED BY public.vehicle_alerts.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    vehicle_no text NOT NULL,
    type text DEFAULT 'Transit Mixer'::text NOT NULL,
    capacity numeric(6,2) NOT NULL,
    driver_id integer,
    insurance_expiry date,
    last_service date,
    status public.vehicle_status DEFAULT 'active'::public.vehicle_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    mileage_kmpl numeric(5,2),
    idle_burn_lph numeric(5,2),
    plant_id integer
);


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_messages (
    id integer NOT NULL,
    message_sid text,
    event text NOT NULL,
    order_id integer,
    challan_id integer,
    plant_id integer,
    to_phone text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    error_code text,
    channel text DEFAULT 'whatsapp'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    direction text DEFAULT 'outbound'::text NOT NULL,
    body text,
    profile_name text
);


--
-- Name: whatsapp_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: whatsapp_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_messages_id_seq OWNED BY public.whatsapp_messages.id;


--
-- Name: whatsapp_retries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_retries (
    id integer NOT NULL,
    to_phone text NOT NULL,
    template_sid text NOT NULL,
    variables jsonb NOT NULL,
    event text,
    attempts integer DEFAULT 1 NOT NULL,
    last_error text,
    next_attempt_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_retries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.whatsapp_retries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: whatsapp_retries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.whatsapp_retries_id_seq OWNED BY public.whatsapp_retries.id;


--
-- Name: ai_conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations ALTER COLUMN id SET DEFAULT nextval('public.ai_conversations_id_seq'::regclass);


--
-- Name: ai_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages ALTER COLUMN id SET DEFAULT nextval('public.ai_messages_id_seq'::regclass);


--
-- Name: attendance_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records ALTER COLUMN id SET DEFAULT nextval('public.attendance_records_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: automation_sends id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_sends ALTER COLUMN id SET DEFAULT nextval('public.automation_sends_id_seq'::regclass);


--
-- Name: automation_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings ALTER COLUMN id SET DEFAULT nextval('public.automation_settings_id_seq'::regclass);


--
-- Name: batch_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_records ALTER COLUMN id SET DEFAULT nextval('public.batch_records_id_seq'::regclass);


--
-- Name: challan_proof_photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challan_proof_photos ALTER COLUMN id SET DEFAULT nextval('public.challan_proof_photos_id_seq'::regclass);


--
-- Name: challans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans ALTER COLUMN id SET DEFAULT nextval('public.challans_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: driver_expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses ALTER COLUMN id SET DEFAULT nextval('public.driver_expenses_id_seq'::regclass);


--
-- Name: driver_locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations ALTER COLUMN id SET DEFAULT nextval('public.driver_locations_id_seq'::regclass);


--
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- Name: emergencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies ALTER COLUMN id SET DEFAULT nextval('public.emergencies_id_seq'::regclass);


--
-- Name: fuel_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs ALTER COLUMN id SET DEFAULT nextval('public.fuel_logs_id_seq'::regclass);


--
-- Name: kyc_verifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_verifications ALTER COLUMN id SET DEFAULT nextval('public.kyc_verifications_id_seq'::regclass);


--
-- Name: ledger_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries ALTER COLUMN id SET DEFAULT nextval('public.ledger_entries_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otp_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);


--
-- Name: password_setup_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_setup_tokens_id_seq'::regclass);


--
-- Name: plant_customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_customers ALTER COLUMN id SET DEFAULT nextval('public.plant_customers_id_seq'::regclass);


--
-- Name: plant_invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_invites ALTER COLUMN id SET DEFAULT nextval('public.plant_invites_id_seq'::regclass);


--
-- Name: plants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants ALTER COLUMN id SET DEFAULT nextval('public.plants_id_seq'::regclass);


--
-- Name: push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.push_subscriptions_id_seq'::regclass);


--
-- Name: rate_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards ALTER COLUMN id SET DEFAULT nextval('public.rate_cards_id_seq'::regclass);


--
-- Name: recurring_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_orders ALTER COLUMN id SET DEFAULT nextval('public.recurring_orders_id_seq'::regclass);


--
-- Name: sites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites ALTER COLUMN id SET DEFAULT nextval('public.sites_id_seq'::regclass);


--
-- Name: staff_otp_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_otp_codes ALTER COLUMN id SET DEFAULT nextval('public.staff_otp_codes_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: tracking_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_tokens ALTER COLUMN id SET DEFAULT nextval('public.tracking_tokens_id_seq'::regclass);


--
-- Name: trip_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions ALTER COLUMN id SET DEFAULT nextval('public.trip_sessions_id_seq'::regclass);


--
-- Name: uploaded_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files ALTER COLUMN id SET DEFAULT nextval('public.uploaded_files_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicle_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_alerts ALTER COLUMN id SET DEFAULT nextval('public.vehicle_alerts_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Name: whatsapp_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_messages_id_seq'::regclass);


--
-- Name: whatsapp_retries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_retries ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_retries_id_seq'::regclass);


--
-- Data for Name: ai_conversations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_conversations (id, session_id, user_id, plant_id, role, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ai_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_messages (id, conversation_id, session_id, user_id, plant_id, message, response, input_type, output_type, functions_used, created_at) FROM stdin;
\.


--
-- Data for Name: ai_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ai_settings (id, enabled, persona, greeting, updated_at) FROM stdin;
1	t	\N	\N	2026-06-29 02:08:25.559602
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_settings (key, value, updated_at) FROM stdin;
whatsapp_order_template_sid	order_confirmation	2026-07-05 09:52:00.833
whatsapp_dispatch_template_sid	dispatch_update	2026-07-05 09:52:00.833
whatsapp_delivery_template_sid	delivery_confirmation	2026-07-05 09:52:00.833
automation_last_run	{"orderReminders":"2026-07-06T22:46:17.557Z","deliveryFollowUp":"2026-07-06T22:46:17.557Z","digest":"2026-07-06T22:46:17.557Z","fuelAnomaly":"2026-07-06T22:46:17.557Z","winBack":"2026-07-06T22:46:17.557Z","idleVehicle":"2026-07-06T22:46:17.557Z","cleanup":"2026-07-06T22:46:17.557Z"}	2026-07-06 22:46:17.584
smtp_host	smtpout.secureserver.net	2026-07-06 19:01:12.966
smtp_port	465	2026-07-06 19:01:13.054
smtp_user	notification@trackmyrmc.com	2026-07-06 19:01:13.058
smtp_pass	Krushna@1208	2026-07-06 19:01:13.061
smtp_from	notification@trackmyrmc.com	2026-07-06 19:01:13.065
\.


--
-- Data for Name: attendance_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendance_records (id, plant_id, user_id, check_in_at, check_out_at, check_in_note, check_out_note, created_at, check_in_lat, check_in_lng, check_out_lat, check_out_lng) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_id, actor_name, action, target_user_id, target_user_email, email_sent, created_at, status, detail) FROM stdin;
\.


--
-- Data for Name: automation_sends; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.automation_sends (id, automation, plant_id, target_type, target_id, window_key, detail, sent_at) FROM stdin;
\.


--
-- Data for Name: automation_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.automation_settings (id, automation, plant_id, enabled, config, updated_at) FROM stdin;
\.


--
-- Data for Name: batch_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.batch_records (id, batch_no, grade, quantity, cement_bags, water_liters, sand_kg, aggregate_kg, operator, remarks, created_at, plant_id) FROM stdin;
\.


--
-- Data for Name: challan_proof_photos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challan_proof_photos (id, challan_id, photo, created_at) FROM stdin;
\.


--
-- Data for Name: challans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.challans (id, challan_no, order_id, client_id, site_id, vehicle_id, driver_id, grade, quantity, pump_required, dispatch_time, delivery_time, status, notes, created_at, delivered_quantity, site_arrival_time, site_release_time, odometer_start, odometer_end, plant_id) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (id, name, contact_person, phone, email, gst_no, address, city, credit_limit, outstanding_amount, created_at, plant_id, customer_code) FROM stdin;
1	Acme Co	Jane	1112223333	\N	\N	\N	\N	0.00	0.00	2026-07-06 19:01:44.990222	\N	\N
\.


--
-- Data for Name: driver_expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_expenses (id, driver_id, user_id, plant_id, challan_id, vehicle_id, category, amount, description, receipt_photo, gps_lat, gps_lng, expense_at, status, reviewer_remark, reviewed_by, reviewed_by_name, reviewed_at, reimbursement_status, created_at) FROM stdin;
\.


--
-- Data for Name: driver_locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_locations (id, user_id, attendance_id, driver_id, vehicle_id, plant_id, trip_id, lat, lng, accuracy, speed, heading, battery, recorded_at) FROM stdin;
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drivers (id, name, phone, license_no, license_expiry, is_active, created_at) FROM stdin;
1	Gus Driver	0000000000	\N	\N	t	2026-07-05 08:20:46.094157
\.


--
-- Data for Name: emergencies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.emergencies (id, driver_id, user_id, plant_id, challan_id, type, message, lat, lng, status, acknowledged_by, acknowledged_by_name, acknowledged_at, resolved_at, created_at) FROM stdin;
\.


--
-- Data for Name: fuel_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fuel_logs (id, vehicle_id, litres, amount, odometer, filled_at, bill_photo, notes, recorded_by, recorded_by_name, created_at) FROM stdin;
\.


--
-- Data for Name: kyc_verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kyc_verifications (id, user_id, provider, provider_ref, provider_txn_id, status, masked_aadhaar, full_name, dob, gender, error, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ledger_entries (id, client_id, type, amount, description, reference_no, created_at) FROM stdin;
\.


--
-- Data for Name: login_attempts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.login_attempts (key, count, locked_until, updated_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, order_no, client_id, site_id, grade, quantity, pump_required, delivery_date, delivery_time, notes, status, created_at, plant_id, pump_line_length, contact_person, contact_number, site_name, site_address, latitude, longitude, payment_type, po_number, site_photo, rejection_reason, cancellation_reason, place_id) FROM stdin;
\.


--
-- Data for Name: otp_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_codes (id, phone, code_hash, expires_at, attempts, created_at) FROM stdin;
\.


--
-- Data for Name: password_setup_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_setup_tokens (id, user_id, token_hash, expires_at, used_at, created_at, kind) FROM stdin;
\.


--
-- Data for Name: plant_customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plant_customers (id, plant_id, user_id, client_id, created_at) FROM stdin;
\.


--
-- Data for Name: plant_invites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plant_invites (id, place_id, name, address, latitude, longitude, contact_number, request_count, status, first_requested_by_id, first_requested_by_name, last_requested_by_id, last_requested_by_name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: plants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.plants (id, name, address, city, contact_number, latitude, longitude, plant_status, is_active, location_verified, delivery_radius_km, grades, open_time, close_time, created_at, updated_at, plant_code, legal_name, gst_no, email, verified, place_id, subscription_status, subscription_plan, commission_pct, owner_name, whatsapp_number, network_status, show_on_network, invite_status, invite_sent_at) FROM stdin;
10	Thane Skyline RMC (Pending Approval)	Wagle Estate, Thane	Thane	9820011010	19.1972000	72.9722000	pending	t	f	25	{M-20,M-25}	08:00	18:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-010	\N	\N	\N	f	\N	trial	free	\N	\N	\N	pending	t	\N	\N
11	Airoli ReadyMix (Inactive)	Sector 4, Airoli	Navi Mumbai	9820011011	19.1500000	72.9990000	approved	f	t	25	{M-20,M-25,M-30}	07:00	20:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-011	\N	\N	\N	t	\N	trial	free	\N	\N	\N	pending	t	\N	\N
1	CONCRETE KING — Navi Mumbai Hub	Sector 19, Nerul	Navi Mumbai	9820011001	19.0330000	73.0297000	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-001	Concrete King Navi Mumbai Pvt Ltd	27AAKCK0001A1Z5	navimumbai@concreteking.example	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
2	ShreeMix RMC — Vashi	Plot 21, Sector 19, Vashi	Vashi	9820011002	19.0760000	72.9986000	approved	t	t	30	{M-15,M-20,M-25,M-30}	06:30	19:30	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-002	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
3	Belapur ReadyMix — CBD	Sector 11, CBD Belapur	Belapur	9820011003	19.0152000	73.0359000	approved	t	t	30	{M-20,M-25,M-30,M-35}	07:00	20:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-003	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
4	Thane Premix — Ghodbunder	Ghodbunder Road	Thane	9820011004	19.2183000	72.9781000	approved	t	t	35	{M-20,M-25,M-30,M-35}	07:00	19:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-004	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
5	Uran Coastal RMC	JNPT Road, Uran	Uran	9820011005	18.8833000	72.9447000	approved	t	t	40	{M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-005	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
6	Karjat Hills Concrete	Karjat–Murbad Road	Karjat	9820011006	18.9107000	73.3239000	approved	t	t	40	{M-15,M-20,M-25,M-30}	06:30	20:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-006	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
7	Lonavla Ghat RMC	Mumbai–Pune Highway, Lonavla	Lonavla	9820011007	18.7546000	73.4062000	approved	t	t	40	{M-20,M-25,M-30,M-35}	06:00	20:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-007	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
8	Deccan RMC — Pune	Hadapsar Industrial Estate	Pune	9820011008	18.5204000	73.8567000	approved	t	t	40	{M-25,M-30,M-35,M-40,M-45}	05:30	22:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-008	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
9	PCMC UltraReady Concrete	MIDC Bhosari, Pimpri Chinchwad	Pimpri Chinchwad	9820011009	18.6298000	73.7997000	approved	t	t	40	{M-25,M-30,M-35,M-40}	05:00	23:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-009	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
12	AAKRUTI INFRA RMC	JNPT Rd, near Nilesh dhaba parking, Karanjade, Panvel, Karanjade, Maharashtra 410206, India	Karanjade	\N	18.9724111	73.1026611	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-012	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
13	Sai Construction RMC Plant	Sr. No. 69, Karanjade, Panvel, Karanjade, Maharashtra 410206, India	Karanjade	\N	18.9698582	73.1028335	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-013	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
14	Godrej & Boyce RMC Plant Panvel	X4C3+GMW, Karanjade, Maharashtra 410206, India	Karanjade	\N	18.9721367	73.1032320	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-014	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
15	VAIBHAV CONSTRUCTION (RMC- Plant)	X4F2+7P, Karanjade, Maharashtra 410206, India	Karanjade	\N	18.9732448	73.1017771	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-015	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
16	Nexoos RMC Plant	X4F2+6XQ Gat No-77/1,Near Nilesh Dhaba, Palaspe, JNPT Rd, Karanjade, Panvel, Karanjade, Maharashtra 410206, India	Karanjade	\N	18.9727676	73.1030178	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-016	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
17	LTPS INFRA PVT. LTD. (RMC PLANT)	X4F2+253, Karanjade, Maharashtra 410206, India	Karanjade	\N	18.9725548	73.1012199	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-017	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
18	RMC PLANT PUSHPAK NAGAR	Pushpak nagar, Sector-6, near Manghar, Panvel, Navi Mumbai, Maharashtra 401221, India	Navi Mumbai	\N	18.9627833	73.0725536	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-018	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
19	RMC PLANT - ULTRA STRUCTURAL SOLUTION PVT LTD	Sr. No. 50/51, Mouje Manghar, Post Kundevahal, Taluka Panvel, District Raigad, PIN code, Maharashtra 410206, India	Panvel	\N	18.9596008	73.0694981	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-019	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
20	Vishvamukh RMC Plant	W4VH+Q3, Palaspa, Panvel, Navi Mumbai, Shirdhon, Maharashtra 410221, India	Shirdhon	\N	18.9443687	73.1277173	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-020	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
21	Shree Balaji Infra Associates	X35C+QPV, Manghar, Ulwe, Manghar, Maharashtra 410206, India	Manghar	\N	18.9594794	73.0717929	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-021	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
22	Inframarket Ready Mix Concrete Batching Plant - Ulwe	S No. 17/3, Gavhanphata - Chirner Rd, next to Dhyaneshwar shipping Yard Tal, Gaonthan, Near, Uran, Jambhulpada, Navi Mumbai, Maharashtra 410206, India	Navi Mumbai	\N	18.9335621	73.0445122	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-022	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
23	RMC PLANT GAAMUP INFRA	SURVEY NO. 203, DR PATIL CRUSHER, GAAMUP INFRA RMC PLANT, VILLAGE,RIKONDA, BONSARI, MIDC Industrial Area, Turbhe, Maharashtra 400703, India	Turbhe	\N	19.0630755	73.0337589	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-023	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
24	Bangur RMC Plant	X25V+GCW, Ulwe, Padeghar, Maharashtra 410206, India	Padeghar	\N	18.9588683	73.0435903	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-024	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
25	PAM INFRACON (RMC PLANT)	PLOT NO 78/8, Valvali Village, Panvel, Maharashtra 410208, India	Panvel	\N	19.0338659	73.1292781	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-025	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
26	Gurukrupa Readymix Concrete	JNPT Rd, Ulwe, Bambavi, Maharashtra 410206, India	Bambavi	\N	18.9640000	73.0548000	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-026	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
27	JMMIPL Plant	X374+F55, Ulwe, Bambavi, Navi Mumbai, Maharashtra 410206, India	Navi Mumbai	\N	18.9636405	73.0554948	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-027	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
28	Ultratech RMC Panvel	X522+2QH, Road, near Gemco company, Rasayani, Ariwali, Maharashtra 410221, India	Ariwali	\N	18.9500644	73.1519836	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-028	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
29	Inframarket RMC Plant - Godrej Panvel	Godrej City, Old, Mumbai - Pune Expy, Panvel, Khanavale, Maharashtra 410206, India	Khanavale	\N	18.9302622	73.1870944	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-029	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
30	TNA RMC Plant	V3X5+GQ2, Dighode, Pohi, Maharashtra 410206, India	Pohi	\N	18.8987731	73.0593765	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-030	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
31	Kharghar plant RDC Concrete INDIA PVT LTD.	Kharghar Railway Station Complex, Sector 2, Kharghar, Panvel, Maharashtra 410210, India	Panvel	\N	19.0261123	73.0609173	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-031	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
32	R k madhani RMC Plant	V3X5+6V8, Pohi, Maharashtra 410206, India	Pohi	\N	18.8980397	73.0597177	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-032	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
33	SRP INFRA SOLUTIONS RMC PLANT	Survey No. 203, Vill - Bonsari, M/s. Jai Balaji Infraprojects, Turbhe, Navi Mumbai, Maharashtra 400703, India	Navi Mumbai	\N	19.0711754	73.0345751	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-033	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
34	Chaitrali RMC Plant	W5FX+6CR, Pen, Bhokarpada, Maharashtra 410207, India	Bhokarpada	\N	18.9231228	73.1985263	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-034	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
35	Prism Johnson Limited (RMC India Division)	JNPT Rd, Ulwe, Kundevahal, Maharashtra 410206, India	Kundevahal	\N	18.9623892	73.0580900	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-035	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
36	Omkar Enterprises RMC Plant Vindhane	V3X5+MQ Tiranga Farm, Pohi, Maharashtra 410206, India	Pohi	\N	18.8985833	73.0595000	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-036	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
37	Yashraj Infrastructure Plant	Indira Nagar, MIDC Industrial Area, Turbhe, Navi Mumbai, Maharashtra 400703, India	Navi Mumbai	\N	19.0758596	73.0327143	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-037	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
38	MANSI-OM (JV)/Infratech Concrete Solutions1(RMC Plant)	45/1, phase 'A, Electronic Zone, MIDC Industrial Area, Sector 1, Mahape, Navi Mumbai, Maharashtra 400710, India	Navi Mumbai	\N	19.1066399	73.0224696	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-038	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
39	Manoj InfraWork Pvt. Ltd.	21/22, Vishrali Naka, Panvel, Maharashtra 410206, India	Panvel	\N	18.9808902	73.1152644	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-039	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
40	Harshal Deshmukh Infra (RMC PLANT)	Near takedevi mandir, at- dandphata, post - barvai Tal, dist, Panvel, Barvai, Maharashtra 410207, India	Barvai	\N	18.9113763	73.2096738	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-040	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
41	Inframarket RMC Plant - Turbhe	C3A, situated at, Savita Chemical Rd, adjacent Asian Paints, opp. Star 2 Chemicals, Turbhe MIDC, Turbhe, Navi Mumbai, Maharashtra 400703, India	Navi Mumbai	\N	19.0834983	73.0210477	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-041	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
42	Aparna Enterprises Limited - Ulwe	Survey No. 431/2, 429/0, Gavhanphata - Chirner Rd, Wahal, Maharashtra 410206, India	Wahal	\N	18.9482700	73.0404949	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-042	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
43	Inframarket RMC Plant - Mahape	Q-5/1, Q-8, Plot No - Q-5, TTC Industrial Area, MIDC Mahape, Pawne, Navi Mumbai, Maharashtra 400710, India	Navi Mumbai	\N	19.0976306	73.0262286	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-043	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
44	Ultratech cement bulk Terminal	Industrial Area, Kalamboli, Panvel, Maharashtra 410218, India	Panvel	\N	19.0235335	73.1113053	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-044	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
45	GaamUP Infra Pvt. Ltd.	Akshar Business Park, Y-3120, Janta Market Rd, opposite APMC Fruit & Vegetable Market, Sector 25, Vashi, Navi Mumbai, Maharashtra 400703, India	Navi Mumbai	\N	19.0790660	73.0134099	approved	t	t	40	{M-15,M-20,M-25,M-30,M-35,M-40}	06:00	21:00	2026-07-05 09:52:00.909169	2026-07-05 09:52:00.909169	PLT-045	\N	\N	\N	t	\N	trial	free	\N	\N	\N	active	t	\N	\N
\.


--
-- Data for Name: push_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: rate_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rate_cards (id, plant_id, grade, rate_per_m3, effective_from, notes, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rate_limit_hits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rate_limit_hits (key, count, reset_at) FROM stdin;
\.


--
-- Data for Name: recurring_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recurring_orders (id, client_id, site_id, grade, quantity, pump_required, delivery_time, notes, frequency, anchor, next_run_date, active, last_run_at, created_at) FROM stdin;
\.


--
-- Data for Name: response_cache; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.response_cache (key, value, expires_at) FROM stdin;
\.


--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sites (id, client_id, name, address, city, created_at, latitude, longitude) FROM stdin;
\.


--
-- Data for Name: staff_otp_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff_otp_codes (id, user_id, code_hash, channel, expires_at, attempts, created_at) FROM stdin;
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, plant_id, client_id, subject, message, contact_info, status, created_at) FROM stdin;
\.


--
-- Data for Name: tracking_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tracking_tokens (id, challan_id, token_hash, created_by, expires_at, revoked_at, created_at) FROM stdin;
\.


--
-- Data for Name: trip_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trip_sessions (id, challan_id, order_id, client_id, driver_id, vehicle_id, plant_id, status, customer_tracking_active, delivery_lat, delivery_lng, last_lat, last_lng, last_updated_at, started_at, delivered_at, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: uploaded_files; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.uploaded_files (id, plant_id, user_id, order_id, challan_id, file_type, file_name, storage_path, access_level, uploaded_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password_hash, role, is_active, created_at, linked_client_id, linked_driver_id, deleted_at, plant_id, phone, created_by, suspended_by, suspension_reason, permissions, preferred_plant_id, session_version, kyc_status, kyc_verified_at) FROM stdin;
1	client user	client3@test.com	$2a$10$B0Ky2sBn3R.0xCtQ0BI/iOz25LG9Ly2ukuVWdbuFQtwsf8qVHuAhS	client	t	2026-07-06 19:01:45.063919	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	unverified	\N
\.


--
-- Data for Name: vehicle_alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicle_alerts (id, challan_id, vehicle_id, driver_id, type, lat, lng, distance_m, detail, acknowledged_at, created_at) FROM stdin;
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicles (id, vehicle_no, type, capacity, driver_id, insurance_expiry, last_service, status, created_at, mileage_kmpl, idle_burn_lph, plant_id) FROM stdin;
\.


--
-- Data for Name: whatsapp_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_messages (id, message_sid, event, order_id, challan_id, plant_id, to_phone, status, error_code, channel, created_at, updated_at, direction, body, profile_name) FROM stdin;
\.


--
-- Data for Name: whatsapp_retries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.whatsapp_retries (id, to_phone, template_sid, variables, event, attempts, last_error, next_attempt_at, created_at) FROM stdin;
\.


--
-- Name: ai_conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_conversations_id_seq', 1, false);


--
-- Name: ai_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ai_messages_id_seq', 1, false);


--
-- Name: attendance_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.attendance_records_id_seq', 1, false);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 1, false);


--
-- Name: automation_sends_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.automation_sends_id_seq', 1, false);


--
-- Name: automation_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.automation_settings_id_seq', 1, false);


--
-- Name: batch_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.batch_records_id_seq', 1, false);


--
-- Name: challan_proof_photos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.challan_proof_photos_id_seq', 1, false);


--
-- Name: challans_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.challans_id_seq', 1, false);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clients_id_seq', 1, true);


--
-- Name: driver_expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.driver_expenses_id_seq', 1, false);


--
-- Name: driver_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.driver_locations_id_seq', 1, false);


--
-- Name: drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drivers_id_seq', 1, true);


--
-- Name: emergencies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.emergencies_id_seq', 1, false);


--
-- Name: fuel_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fuel_logs_id_seq', 1, false);


--
-- Name: kyc_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.kyc_verifications_id_seq', 1, false);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ledger_entries_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_codes_id_seq', 56, true);


--
-- Name: password_setup_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_setup_tokens_id_seq', 1, false);


--
-- Name: plant_customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plant_customers_id_seq', 1, false);


--
-- Name: plant_invites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plant_invites_id_seq', 1, false);


--
-- Name: plants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.plants_id_seq', 225, true);


--
-- Name: push_subscriptions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.push_subscriptions_id_seq', 1, false);


--
-- Name: rate_cards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.rate_cards_id_seq', 1, false);


--
-- Name: recurring_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.recurring_orders_id_seq', 1, false);


--
-- Name: sites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sites_id_seq', 1, false);


--
-- Name: staff_otp_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.staff_otp_codes_id_seq', 1, false);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 1, false);


--
-- Name: tracking_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tracking_tokens_id_seq', 1, false);


--
-- Name: trip_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trip_sessions_id_seq', 1, false);


--
-- Name: uploaded_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.uploaded_files_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: vehicle_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicle_alerts_id_seq', 1, false);


--
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 1, false);


--
-- Name: whatsapp_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.whatsapp_messages_id_seq', 1, false);


--
-- Name: whatsapp_retries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.whatsapp_retries_id_seq', 1, false);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_sends automation_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_sends
    ADD CONSTRAINT automation_sends_pkey PRIMARY KEY (id);


--
-- Name: automation_settings automation_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_settings
    ADD CONSTRAINT automation_settings_pkey PRIMARY KEY (id);


--
-- Name: batch_records batch_records_batch_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_records
    ADD CONSTRAINT batch_records_batch_no_unique UNIQUE (batch_no);


--
-- Name: batch_records batch_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_records
    ADD CONSTRAINT batch_records_pkey PRIMARY KEY (id);


--
-- Name: challan_proof_photos challan_proof_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challan_proof_photos
    ADD CONSTRAINT challan_proof_photos_pkey PRIMARY KEY (id);


--
-- Name: challans challans_challan_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_challan_no_unique UNIQUE (challan_no);


--
-- Name: challans challans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: driver_expenses driver_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_pkey PRIMARY KEY (id);


--
-- Name: driver_locations driver_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: emergencies emergencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_pkey PRIMARY KEY (id);


--
-- Name: fuel_logs fuel_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs
    ADD CONSTRAINT fuel_logs_pkey PRIMARY KEY (id);


--
-- Name: kyc_verifications kyc_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: login_attempts login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_attempts
    ADD CONSTRAINT login_attempts_pkey PRIMARY KEY (key);


--
-- Name: orders orders_order_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_no_unique UNIQUE (order_no);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: password_setup_tokens password_setup_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_tokens
    ADD CONSTRAINT password_setup_tokens_pkey PRIMARY KEY (id);


--
-- Name: plant_customers plant_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_customers
    ADD CONSTRAINT plant_customers_pkey PRIMARY KEY (id);


--
-- Name: plant_invites plant_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_invites
    ADD CONSTRAINT plant_invites_pkey PRIMARY KEY (id);


--
-- Name: plants plants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plants
    ADD CONSTRAINT plants_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: rate_cards rate_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_hits rate_limit_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_hits
    ADD CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (key);


--
-- Name: recurring_orders recurring_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_orders
    ADD CONSTRAINT recurring_orders_pkey PRIMARY KEY (id);


--
-- Name: response_cache response_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.response_cache
    ADD CONSTRAINT response_cache_pkey PRIMARY KEY (key);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: staff_otp_codes staff_otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_otp_codes
    ADD CONSTRAINT staff_otp_codes_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: tracking_tokens tracking_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_tokens
    ADD CONSTRAINT tracking_tokens_pkey PRIMARY KEY (id);


--
-- Name: trip_sessions trip_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_pkey PRIMARY KEY (id);


--
-- Name: uploaded_files uploaded_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_alerts vehicle_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_alerts
    ADD CONSTRAINT vehicle_alerts_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_vehicle_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vehicle_no_unique UNIQUE (vehicle_no);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_retries whatsapp_retries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_retries
    ADD CONSTRAINT whatsapp_retries_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations_session_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_conversations_session_user_unique ON public.ai_conversations USING btree (session_id, user_id);


--
-- Name: ai_conversations_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_conversations_user_idx ON public.ai_conversations USING btree (user_id);


--
-- Name: ai_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_messages_conversation_idx ON public.ai_messages USING btree (conversation_id);


--
-- Name: attendance_open_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX attendance_open_unique ON public.attendance_records USING btree (user_id) WHERE (check_out_at IS NULL);


--
-- Name: automation_sends_once_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX automation_sends_once_unique ON public.automation_sends USING btree (automation, target_type, target_id, window_key);


--
-- Name: automation_sends_sent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_sends_sent_at_idx ON public.automation_sends USING btree (sent_at);


--
-- Name: automation_settings_scope_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX automation_settings_scope_unique ON public.automation_settings USING btree (automation, plant_id);


--
-- Name: clients_plant_customer_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clients_plant_customer_code_unique ON public.clients USING btree (plant_id, customer_code) WHERE ((plant_id IS NOT NULL) AND (customer_code IS NOT NULL));


--
-- Name: driver_expenses_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_expenses_plant_idx ON public.driver_expenses USING btree (plant_id);


--
-- Name: driver_expenses_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_expenses_status_idx ON public.driver_expenses USING btree (status);


--
-- Name: driver_expenses_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_expenses_user_idx ON public.driver_expenses USING btree (user_id);


--
-- Name: driver_locations_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_locations_plant_idx ON public.driver_locations USING btree (plant_id);


--
-- Name: driver_locations_recorded_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_locations_recorded_at_idx ON public.driver_locations USING btree (recorded_at);


--
-- Name: driver_locations_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_locations_user_idx ON public.driver_locations USING btree (user_id);


--
-- Name: emergencies_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emergencies_plant_idx ON public.emergencies USING btree (plant_id);


--
-- Name: emergencies_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emergencies_status_idx ON public.emergencies USING btree (status);


--
-- Name: kyc_verifications_provider_ref_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kyc_verifications_provider_ref_unique ON public.kyc_verifications USING btree (provider_ref);


--
-- Name: kyc_verifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kyc_verifications_user_idx ON public.kyc_verifications USING btree (user_id);


--
-- Name: otp_codes_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX otp_codes_phone_unique ON public.otp_codes USING btree (phone);


--
-- Name: password_setup_tokens_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX password_setup_tokens_hash_unique ON public.password_setup_tokens USING btree (token_hash);


--
-- Name: plant_customers_plant_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plant_customers_plant_user_unique ON public.plant_customers USING btree (plant_id, user_id);


--
-- Name: plant_invites_place_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plant_invites_place_id_unique ON public.plant_invites USING btree (place_id);


--
-- Name: plants_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plants_code_unique ON public.plants USING btree (plant_code);


--
-- Name: plants_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX plants_name_unique ON public.plants USING btree (name);


--
-- Name: push_subscriptions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);


--
-- Name: rate_cards_plant_grade_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rate_cards_plant_grade_unique ON public.rate_cards USING btree (plant_id, grade);


--
-- Name: rate_limit_hits_reset_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limit_hits_reset_at_idx ON public.rate_limit_hits USING btree (reset_at);


--
-- Name: response_cache_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX response_cache_expires_at_idx ON public.response_cache USING btree (expires_at);


--
-- Name: staff_otp_codes_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX staff_otp_codes_user_unique ON public.staff_otp_codes USING btree (user_id);


--
-- Name: support_tickets_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_plant_idx ON public.support_tickets USING btree (plant_id);


--
-- Name: support_tickets_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_tickets_user_idx ON public.support_tickets USING btree (user_id);


--
-- Name: tracking_tokens_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tracking_tokens_hash_unique ON public.tracking_tokens USING btree (token_hash);


--
-- Name: trip_sessions_challan_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trip_sessions_challan_unique ON public.trip_sessions USING btree (challan_id);


--
-- Name: trip_sessions_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trip_sessions_plant_idx ON public.trip_sessions USING btree (plant_id);


--
-- Name: uploaded_files_path_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uploaded_files_path_unique ON public.uploaded_files USING btree (storage_path);


--
-- Name: uploaded_files_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uploaded_files_plant_idx ON public.uploaded_files USING btree (plant_id);


--
-- Name: uploaded_files_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX uploaded_files_type_idx ON public.uploaded_files USING btree (file_type);


--
-- Name: users_linked_client_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_linked_client_unique ON public.users USING btree (linked_client_id) WHERE ((deleted_at IS NULL) AND (linked_client_id IS NOT NULL));


--
-- Name: users_linked_driver_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_linked_driver_unique ON public.users USING btree (linked_driver_id) WHERE ((deleted_at IS NULL) AND (linked_driver_id IS NOT NULL));


--
-- Name: users_phone_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_phone_unique ON public.users USING btree (phone) WHERE ((deleted_at IS NULL) AND (phone IS NOT NULL));


--
-- Name: whatsapp_messages_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_messages_created_at_idx ON public.whatsapp_messages USING btree (created_at);


--
-- Name: whatsapp_messages_plant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_messages_plant_idx ON public.whatsapp_messages USING btree (plant_id);


--
-- Name: whatsapp_messages_sid_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX whatsapp_messages_sid_unique ON public.whatsapp_messages USING btree (message_sid) WHERE (message_sid IS NOT NULL);


--
-- Name: whatsapp_messages_to_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_messages_to_phone_idx ON public.whatsapp_messages USING btree (to_phone);


--
-- Name: whatsapp_retries_next_attempt_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_retries_next_attempt_at_idx ON public.whatsapp_retries USING btree (next_attempt_at);


--
-- Name: ai_conversations ai_conversations_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: ai_conversations ai_conversations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_conversation_id_ai_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_ai_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: ai_messages ai_messages_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: attendance_records attendance_records_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_actor_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_users_id_fk FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_target_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_target_user_id_users_id_fk FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: batch_records batch_records_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_records
    ADD CONSTRAINT batch_records_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: challan_proof_photos challan_proof_photos_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challan_proof_photos
    ADD CONSTRAINT challan_proof_photos_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE CASCADE;


--
-- Name: challans challans_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: challans challans_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: challans challans_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: challans challans_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: challans challans_site_id_sites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_site_id_sites_id_fk FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: challans challans_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challans
    ADD CONSTRAINT challans_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: clients clients_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;


--
-- Name: driver_expenses driver_expenses_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE SET NULL;


--
-- Name: driver_expenses driver_expenses_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: driver_expenses driver_expenses_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: driver_expenses driver_expenses_reviewed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: driver_expenses driver_expenses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: driver_expenses driver_expenses_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_expenses
    ADD CONSTRAINT driver_expenses_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: driver_locations driver_locations_attendance_id_attendance_records_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_attendance_id_attendance_records_id_fk FOREIGN KEY (attendance_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE;


--
-- Name: driver_locations driver_locations_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: driver_locations driver_locations_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: driver_locations driver_locations_trip_id_trip_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_trip_id_trip_sessions_id_fk FOREIGN KEY (trip_id) REFERENCES public.trip_sessions(id) ON DELETE SET NULL;


--
-- Name: driver_locations driver_locations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: driver_locations driver_locations_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_locations
    ADD CONSTRAINT driver_locations_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: emergencies emergencies_acknowledged_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_acknowledged_by_users_id_fk FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: emergencies emergencies_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE SET NULL;


--
-- Name: emergencies emergencies_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: emergencies emergencies_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: emergencies emergencies_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergencies
    ADD CONSTRAINT emergencies_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fuel_logs fuel_logs_recorded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs
    ADD CONSTRAINT fuel_logs_recorded_by_users_id_fk FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: fuel_logs fuel_logs_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fuel_logs
    ADD CONSTRAINT fuel_logs_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: kyc_verifications kyc_verifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kyc_verifications
    ADD CONSTRAINT kyc_verifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ledger_entries ledger_entries_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: orders orders_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: orders orders_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: orders orders_site_id_sites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_site_id_sites_id_fk FOREIGN KEY (site_id) REFERENCES public.sites(id);


--
-- Name: password_setup_tokens password_setup_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_setup_tokens
    ADD CONSTRAINT password_setup_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plant_customers plant_customers_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_customers
    ADD CONSTRAINT plant_customers_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: plant_customers plant_customers_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_customers
    ADD CONSTRAINT plant_customers_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;


--
-- Name: plant_customers plant_customers_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_customers
    ADD CONSTRAINT plant_customers_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: plant_invites plant_invites_first_requested_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_invites
    ADD CONSTRAINT plant_invites_first_requested_by_id_users_id_fk FOREIGN KEY (first_requested_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: plant_invites plant_invites_last_requested_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_invites
    ADD CONSTRAINT plant_invites_last_requested_by_id_users_id_fk FOREIGN KEY (last_requested_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: push_subscriptions push_subscriptions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: rate_cards rate_cards_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_cards
    ADD CONSTRAINT rate_cards_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE CASCADE;


--
-- Name: recurring_orders recurring_orders_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_orders
    ADD CONSTRAINT recurring_orders_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: recurring_orders recurring_orders_site_id_sites_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_orders
    ADD CONSTRAINT recurring_orders_site_id_sites_id_fk FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;


--
-- Name: sites sites_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: staff_otp_codes staff_otp_codes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_otp_codes
    ADD CONSTRAINT staff_otp_codes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tracking_tokens tracking_tokens_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_tokens
    ADD CONSTRAINT tracking_tokens_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE CASCADE;


--
-- Name: tracking_tokens tracking_tokens_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tracking_tokens
    ADD CONSTRAINT tracking_tokens_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: trip_sessions trip_sessions_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE CASCADE;


--
-- Name: trip_sessions trip_sessions_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: trip_sessions trip_sessions_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: trip_sessions trip_sessions_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: trip_sessions trip_sessions_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: trip_sessions trip_sessions_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_sessions
    ADD CONSTRAINT trip_sessions_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: uploaded_files uploaded_files_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE SET NULL;


--
-- Name: uploaded_files uploaded_files_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: uploaded_files uploaded_files_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: uploaded_files uploaded_files_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploaded_files
    ADD CONSTRAINT uploaded_files_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users users_linked_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_linked_client_id_clients_id_fk FOREIGN KEY (linked_client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: users users_linked_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_linked_driver_id_drivers_id_fk FOREIGN KEY (linked_driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: users users_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: users users_preferred_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_preferred_plant_id_plants_id_fk FOREIGN KEY (preferred_plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- Name: users users_suspended_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_suspended_by_users_id_fk FOREIGN KEY (suspended_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: vehicle_alerts vehicle_alerts_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_alerts
    ADD CONSTRAINT vehicle_alerts_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE SET NULL;


--
-- Name: vehicle_alerts vehicle_alerts_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_alerts
    ADD CONSTRAINT vehicle_alerts_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL;


--
-- Name: vehicle_alerts vehicle_alerts_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_alerts
    ADD CONSTRAINT vehicle_alerts_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;


--
-- Name: vehicles vehicles_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: vehicles vehicles_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id);


--
-- Name: whatsapp_messages whatsapp_messages_challan_id_challans_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_challan_id_challans_id_fk FOREIGN KEY (challan_id) REFERENCES public.challans(id) ON DELETE SET NULL;


--
-- Name: whatsapp_messages whatsapp_messages_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: whatsapp_messages whatsapp_messages_plant_id_plants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_plant_id_plants_id_fk FOREIGN KEY (plant_id) REFERENCES public.plants(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict jGmtSsoataJfylW7ZxbZB0I36JV9htDhhqlyJ7dlbwGEUbnqSZA3uVoj2Wztyj9

