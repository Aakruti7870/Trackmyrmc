CREATE TYPE "public"."challan_status" AS ENUM('pending', 'dispatched', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."plant_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('authority', 'admin', 'dispatcher', 'plant_operator', 'client', 'driver', 'plant_owner', 'supervisor');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'maintenance', 'inactive');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"plant_id" integer,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"plant_id" integer,
	"message" text NOT NULL,
	"response" text,
	"input_type" text DEFAULT 'text' NOT NULL,
	"output_type" text DEFAULT 'text' NOT NULL,
	"functions_used" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"persona" text,
	"greeting" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"action" text NOT NULL,
	"target_user_id" integer,
	"target_user_email" text,
	"status" text,
	"detail" text,
	"email_sent" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer,
	"batch_no" text NOT NULL,
	"grade" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"cement_bags" integer,
	"water_liters" integer,
	"sand_kg" integer,
	"aggregate_kg" integer,
	"operator" text,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "batch_records_batch_no_unique" UNIQUE("batch_no")
);
--> statement-breakpoint
CREATE TABLE "challan_proof_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"challan_id" integer NOT NULL,
	"photo" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challans" (
	"id" serial PRIMARY KEY NOT NULL,
	"challan_no" text NOT NULL,
	"plant_id" integer,
	"order_id" integer,
	"client_id" integer NOT NULL,
	"site_id" integer,
	"vehicle_id" integer,
	"driver_id" integer,
	"grade" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"delivered_quantity" numeric(8, 2),
	"pump_required" boolean DEFAULT false NOT NULL,
	"dispatch_time" timestamp,
	"delivery_time" timestamp,
	"site_arrival_time" timestamp,
	"site_release_time" timestamp,
	"odometer_start" integer,
	"odometer_end" integer,
	"status" "challan_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challans_challan_no_unique" UNIQUE("challan_no")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer,
	"customer_code" text,
	"name" text NOT NULL,
	"contact_person" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"gst_no" text,
	"address" text,
	"city" text,
	"credit_limit" numeric(12, 2) DEFAULT '0',
	"outstanding_amount" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"license_no" text,
	"license_expiry" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"litres" numeric(8, 2) NOT NULL,
	"amount" numeric(10, 2),
	"odometer" integer,
	"filled_at" timestamp NOT NULL,
	"bill_photo" text,
	"notes" text,
	"recorded_by" integer,
	"recorded_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"reference_no" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"plant_id" integer,
	"client_id" integer NOT NULL,
	"site_id" integer,
	"grade" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"pump_required" boolean DEFAULT false NOT NULL,
	"delivery_date" date,
	"delivery_time" time,
	"notes" text,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_setup_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plant_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plant_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"contact_number" text,
	"request_count" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"first_requested_by_id" integer,
	"first_requested_by_name" text,
	"last_requested_by_id" integer,
	"last_requested_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plants" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_code" text,
	"name" text NOT NULL,
	"legal_name" text,
	"gst_no" text,
	"email" text,
	"address" text,
	"city" text,
	"contact_number" text,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"plant_status" "plant_status" DEFAULT 'pending' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"location_verified" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"place_id" text,
	"delivery_radius_km" integer DEFAULT 25 NOT NULL,
	"grades" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"open_time" text,
	"close_time" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"site_id" integer,
	"grade" text NOT NULL,
	"quantity" numeric(8, 2) NOT NULL,
	"pump_required" boolean DEFAULT false NOT NULL,
	"delivery_time" time,
	"notes" text,
	"frequency" "recurring_frequency" NOT NULL,
	"anchor" integer NOT NULL,
	"next_run_date" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"plant_id" integer,
	"client_id" integer,
	"subject" text,
	"message" text NOT NULL,
	"contact_info" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'dispatcher' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"plant_id" integer,
	"linked_client_id" integer,
	"linked_driver_id" integer,
	"preferred_plant_id" integer,
	"created_by" integer,
	"suspended_by" integer,
	"suspension_reason" text,
	"permissions" jsonb,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicle_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"challan_id" integer,
	"vehicle_id" integer,
	"driver_id" integer,
	"type" text NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"distance_m" integer,
	"detail" text,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"plant_id" integer,
	"vehicle_no" text NOT NULL,
	"type" text DEFAULT 'Transit Mixer' NOT NULL,
	"capacity" numeric(6, 2) NOT NULL,
	"driver_id" integer,
	"insurance_expiry" date,
	"last_service" date,
	"mileage_kmpl" numeric(5, 2),
	"idle_burn_lph" numeric(5, 2),
	"status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_vehicle_no_unique" UNIQUE("vehicle_no")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_sid" text,
	"event" text NOT NULL,
	"order_id" integer,
	"challan_id" integer,
	"plant_id" integer,
	"to_phone" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_code" text,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_retries" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_phone" text NOT NULL,
	"template_sid" text NOT NULL,
	"variables" jsonb NOT NULL,
	"event" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_records" ADD CONSTRAINT "batch_records_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challan_proof_photos" ADD CONSTRAINT "challan_proof_photos_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challans" ADD CONSTRAINT "challans_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_customers" ADD CONSTRAINT "plant_customers_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_customers" ADD CONSTRAINT "plant_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_customers" ADD CONSTRAINT "plant_customers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_invites" ADD CONSTRAINT "plant_invites_first_requested_by_id_users_id_fk" FOREIGN KEY ("first_requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plant_invites" ADD CONSTRAINT "plant_invites_last_requested_by_id_users_id_fk" FOREIGN KEY ("last_requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_orders" ADD CONSTRAINT "recurring_orders_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_linked_client_id_clients_id_fk" FOREIGN KEY ("linked_client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_linked_driver_id_drivers_id_fk" FOREIGN KEY ("linked_driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_plant_id_plants_id_fk" FOREIGN KEY ("preferred_plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_alerts" ADD CONSTRAINT "vehicle_alerts_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_alerts" ADD CONSTRAINT "vehicle_alerts_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_alerts" ADD CONSTRAINT "vehicle_alerts_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_challan_id_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."challans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_plant_id_plants_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_conversations_session_user_unique" ON "ai_conversations" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_idx" ON "ai_conversations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_plant_customer_code_unique" ON "clients" USING btree ("plant_id","customer_code") WHERE "clients"."plant_id" IS NOT NULL AND "clients"."customer_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "otp_codes_phone_unique" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "password_setup_tokens_hash_unique" ON "password_setup_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "plant_customers_plant_user_unique" ON "plant_customers" USING btree ("plant_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plant_invites_place_id_unique" ON "plant_invites" USING btree ("place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plants_name_unique" ON "plants" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "plants_code_unique" ON "plants" USING btree ("plant_code");--> statement-breakpoint
CREATE INDEX "rate_limit_hits_reset_at_idx" ON "rate_limit_hits" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "response_cache_expires_at_idx" ON "response_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "support_tickets_plant_idx" ON "support_tickets" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_linked_client_unique" ON "users" USING btree ("linked_client_id") WHERE "users"."deleted_at" IS NULL AND "users"."linked_client_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_linked_driver_unique" ON "users" USING btree ("linked_driver_id") WHERE "users"."deleted_at" IS NULL AND "users"."linked_driver_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone") WHERE "users"."deleted_at" IS NULL AND "users"."phone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_sid_unique" ON "whatsapp_messages" USING btree ("message_sid") WHERE "whatsapp_messages"."message_sid" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "whatsapp_messages_plant_idx" ON "whatsapp_messages" USING btree ("plant_id");--> statement-breakpoint
CREATE INDEX "whatsapp_messages_created_at_idx" ON "whatsapp_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "whatsapp_retries_next_attempt_at_idx" ON "whatsapp_retries" USING btree ("next_attempt_at");