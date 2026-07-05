import {
  pgTable, serial, text, integer, decimal, boolean,
  timestamp, date, time, pgEnum, uniqueIndex, jsonb, index,
  type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Role hierarchy (high → low): authority (Super Owner) → plant_owner → admin →
// supervisor / dispatcher / plant_operator / driver, plus the marketplace
// `client`. `plant_owner` and `supervisor` were added for the owner-onboarding
// hierarchy; the original six are kept in place (additive) so existing rows and
// the enum's stored order are untouched.
// `accountant` is additive (appended last so the enum's stored order and every
// existing row are untouched): a finance-facing staff role provisioned like any
// other plant staff.
export const userRoleEnum = pgEnum('user_role', ['authority', 'admin', 'dispatcher', 'plant_operator', 'client', 'driver', 'plant_owner', 'supervisor', 'accountant', 'quality_engineer', 'fleet_manager', 'store_manager']);
// `pending_approval`/`approved`/`rejected` are appended (never reordered) for the
// customer order → staff approval → challan workflow. Legacy `pending` remains a
// valid, dispatchable state so existing rows and staff-created orders are untouched.
export const orderStatusEnum = pgEnum('order_status', ['pending', 'in_progress', 'completed', 'cancelled', 'pending_approval', 'approved', 'rejected']);
export const challanStatusEnum = pgEnum('challan_status', ['pending', 'dispatched', 'delivered', 'cancelled']);
export const vehicleStatusEnum = pgEnum('vehicle_status', ['active', 'maintenance', 'inactive']);
export const ledgerTypeEnum = pgEnum('ledger_type', ['debit', 'credit']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['weekly', 'monthly']);
export const plantStatusEnum = pgEnum('plant_status', ['pending', 'approved', 'rejected']);
// Billing lifecycle for a plant's platform subscription. `trial`/`active` allow
// normal login; `past_due` still logs in (a soft warning, grace period);
// `suspended`/`cancelled` block plant-scoped staff at login (defence in depth).
export const subscriptionStatusEnum = pgEnum('subscription_status', ['trial', 'active', 'past_due', 'suspended', 'cancelled']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'basic', 'pro', 'enterprise']);
// Customer Aadhaar KYC (DigiLocker via aggregator). 'unverified' is the default;
// 'pending' while a consent session is open; 'verified' once eKYC returns;
// 'failed' if the aggregator rejects or the session errors out.
export const kycStatusEnum = pgEnum('kyc_status', ['unverified', 'pending', 'verified', 'failed']);

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  // The plant that owns this customer record. NULL only for legacy rows before
  // the multi-tenant backfill; every new client is owned by exactly one plant so
  // one plant can never see (or join to) another plant's customers.
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'cascade' }),
  // Per-plant human customer code (e.g. NMH-C0001). Unique within a plant, never
  // global — the same marketplace user gets a different code at each plant.
  customerCode: text('customer_code'),
  name: text('name').notNull(),
  contactPerson: text('contact_person').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  gstNo: text('gst_no'),
  address: text('address'),
  city: text('city'),
  creditLimit: decimal('credit_limit', { precision: 12, scale: 2 }).default('0'),
  outstandingAmount: decimal('outstanding_amount', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('clients_plant_customer_code_unique')
    .on(t.plantId, t.customerCode)
    .where(sql`${t.plantId} IS NOT NULL AND ${t.customerCode} IS NOT NULL`),
]);

export const drivers = pgTable('drivers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  licenseNo: text('license_no'),
  licenseExpiry: date('license_expiry'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  // Optional mobile number — the login key for phone-first (WhatsApp OTP)
  // customers. Staff/owner accounts created by email keep this NULL. Stored in
  // normalized E.164 form (e.g. +919876543210). Uniqueness across LIVE accounts
  // is enforced by the partial index below.
  phone: text('phone'),
  // Nullable: only the Super Admin (authority) and legacy accounts carry a
  // password. Provisioned staff/owner accounts are PASSWORDLESS — they sign in
  // with a one-time code (email or WhatsApp), so their hash stays NULL.
  passwordHash: text('password_hash'),
  role: userRoleEnum('role').notNull().default('dispatcher'),
  isActive: boolean('is_active').notNull().default(true),
  // Monotonic counter bumped on every successful login so only the most recent
  // session's token stays valid (single active session). requireAuth rejects a
  // token whose embedded sessionVersion is behind the row's current value.
  sessionVersion: integer('session_version').notNull().default(0),
  // For plant-scoped staff/owner accounts: the single plant this user may see and
  // manage. NULL means a legacy global/superuser or marketplace authority (not
  // bound to one plant). Plant owners provisioned at onboarding always have it.
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
  linkedClientId: integer('linked_client_id').references(() => clients.id, { onDelete: 'set null' }),
  linkedDriverId: integer('linked_driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  // A customer's explicitly pinned default plant for the Place Order modal. NULL
  // means "no pin" — the modal then falls back to the last-ordered heuristic.
  // ON DELETE SET NULL so removing a plant simply clears the pin (and the
  // customer falls back to the heuristic) rather than blocking the delete.
  preferredPlantId: integer('preferred_plant_id').references(() => plants.id, { onDelete: 'set null' }),
  // --- Role-hierarchy / onboarding fields (all nullable & additive) ----------
  // Who provisioned this account (the actor in the creation chain). NULL for
  // legacy rows and self-service registrations. Self-reference, ON DELETE SET
  // NULL so purging the creator never cascades to their staff.
  createdBy: integer('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  // Who suspended this account, and why — captured when isActive flips to false
  // and cleared on reactivation. Surfaced on the suspended-login error message.
  suspendedBy: integer('suspended_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  suspensionReason: text('suspension_reason'),
  // Optional per-account permission overrides (reserved for fine-grained grants
  // on top of the role). NULL means "use the role defaults".
  permissions: jsonb('permissions'),
  // Customer Aadhaar KYC (DigiLocker). Denormalized here for an O(1) profile
  // badge; the audit trail of attempts lives in kycVerifications. Only staff/
  // owner accounts leave these at their defaults — KYC is a customer feature.
  kycStatus: kycStatusEnum('kyc_status').notNull().default('unverified'),
  kycVerifiedAt: timestamp('kyc_verified_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  // Enforce one-account-per-client/driver at the DB level. Partial unique
  // indexes only constrain live links (a soft-deleted account or a NULL link
  // never collides), mirroring findLinkConflict's application-level guard so a
  // direct write or a race between two requests can't create a duplicate link.
  uniqueIndex('users_linked_client_unique')
    .on(t.linkedClientId)
    .where(sql`${t.deletedAt} IS NULL AND ${t.linkedClientId} IS NOT NULL`),
  uniqueIndex('users_linked_driver_unique')
    .on(t.linkedDriverId)
    .where(sql`${t.deletedAt} IS NULL AND ${t.linkedDriverId} IS NOT NULL`),
  // One live account per phone number (the phone-OTP login key). A soft-deleted
  // account or a NULL phone never collides, so staff/email accounts are exempt.
  uniqueIndex('users_phone_unique')
    .on(t.phone)
    .where(sql`${t.deletedAt} IS NULL AND ${t.phone} IS NOT NULL`),
]);

// Audit trail of Aadhaar KYC (DigiLocker) attempts. One row per verification
// session so an async consent flow can be correlated back on the callback by
// providerRef. We persist ONLY the aggregator-masked Aadhaar (never the full
// number) plus the consented demographics needed to prove identity.
export const kycVerifications = pgTable('kyc_verifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Aggregator name (e.g. 'sandbox') — recorded so a later provider switch stays
  // auditable and old rows remain interpretable.
  provider: text('provider').notNull(),
  // OUR opaque correlation id, embedded in the callback URL we hand the
  // aggregator, so the public callback maps to exactly one attempt without
  // trusting the vendor to echo its own id back. Unique.
  providerRef: text('provider_ref').notNull(),
  // The aggregator's own session/transaction id, needed to fetch the eKYC result
  // after consent. NULL until create-session returns.
  providerTxnId: text('provider_txn_id'),
  status: kycStatusEnum('status').notNull().default('pending'),
  maskedAadhaar: text('masked_aadhaar'),
  fullName: text('full_name'),
  dob: text('dob'),
  gender: text('gender'),
  // Populated on a failed/errored attempt for staff diagnostics.
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (t) => [
  uniqueIndex('kyc_verifications_provider_ref_unique').on(t.providerRef),
  index('kyc_verifications_user_idx').on(t.userId),
]);

export const sites = pgTable('sites', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  // The plant that owns this vehicle. Fleet reads/writes are hard-scoped by it so
  // no plant can see or mutate another plant's trucks. NULL only for legacy
  // pre-backfill rows (visible solely to a null-plant global admin).
  plantId: integer('plant_id').references(() => plants.id),
  vehicleNo: text('vehicle_no').notNull().unique(),
  type: text('type').notNull().default('Transit Mixer'),
  capacity: decimal('capacity', { precision: 6, scale: 2 }).notNull(),
  driverId: integer('driver_id').references(() => drivers.id),
  insuranceExpiry: date('insurance_expiry'),
  lastService: date('last_service'),
  // Diesel-reconciliation baselines. mileageKmpl is the expected running
  // efficiency (km per litre); idleBurnLph is the optional litres burnt per hour
  // of standing/idle time. Both are nullable — a vehicle without a baseline is
  // simply excluded from expected-vs-actual reconciliation.
  mileageKmpl: decimal('mileage_kmpl', { precision: 5, scale: 2 }),
  idleBurnLph: decimal('idle_burn_lph', { precision: 5, scale: 2 }),
  status: vehicleStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNo: text('order_no').notNull().unique(),
  // The plant this order is placed with. Every plant-facing read is scoped by it
  // so no plant can see another plant's orders. NULL only for legacy pre-backfill.
  plantId: integer('plant_id').references(() => plants.id),
  clientId: integer('client_id').notNull().references(() => clients.id),
  siteId: integer('site_id').references(() => sites.id),
  grade: text('grade').notNull(),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).notNull(),
  pumpRequired: boolean('pump_required').notNull().default(false),
  // Length of pump line/boom required (metres). Only meaningful when pumpRequired.
  pumpLineLength: decimal('pump_line_length', { precision: 6, scale: 2 }),
  deliveryDate: date('delivery_date'),
  deliveryTime: time('delivery_time'),
  notes: text('notes'),
  // Customer-supplied order details captured at placement. Contact + site fields
  // are SNAPSHOTS taken when the order is placed so the auto-generated challan can
  // pre-fill reliably even if the linked client/site row is later edited.
  contactPerson: text('contact_person'),
  contactNumber: text('contact_number'),
  siteName: text('site_name'),
  siteAddress: text('site_address'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  paymentType: text('payment_type'),
  poNumber: text('po_number'),
  // Optional site photo (object-storage entity path, never base64 in the DB).
  sitePhoto: text('site_photo'),
  // Populated when staff reject the order, surfaced back to the customer.
  rejectionReason: text('rejection_reason'),
  status: orderStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const challans = pgTable('challans', {
  id: serial('id').primaryKey(),
  challanNo: text('challan_no').notNull().unique(),
  // The issuing plant. Drives both plant-scoping of reads and the company
  // identity printed on the challan/receipt. NULL only for legacy pre-backfill.
  plantId: integer('plant_id').references(() => plants.id),
  orderId: integer('order_id').references(() => orders.id),
  clientId: integer('client_id').notNull().references(() => clients.id),
  siteId: integer('site_id').references(() => sites.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  driverId: integer('driver_id').references(() => drivers.id),
  grade: text('grade').notNull(),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).notNull(),
  deliveredQuantity: decimal('delivered_quantity', { precision: 8, scale: 2 }),
  pumpRequired: boolean('pump_required').notNull().default(false),
  dispatchTime: timestamp('dispatch_time'),
  deliveryTime: timestamp('delivery_time'),
  siteArrivalTime: timestamp('site_arrival_time'),
  siteReleaseTime: timestamp('site_release_time'),
  // Odometer readings captured by the driver: at dispatch and on return. Their
  // difference gives reliable per-trip kilometres for diesel reconciliation,
  // independent of the ephemeral in-memory GPS stream.
  odometerStart: integer('odometer_start'),
  odometerEnd: integer('odometer_end'),
  status: challanStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Proof-of-delivery photos. A delivery can have several photos (the pour, the
// signed slip, the site board), so each lives as its own child row linked to a
// challan rather than packed into a single text column.
export const challanProofPhotos = pgTable('challan_proof_photos', {
  id: serial('id').primaryKey(),
  challanId: integer('challan_id').notNull().references(() => challans.id, { onDelete: 'cascade' }),
  photo: text('photo').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// One row per WhatsApp business notification we hand to Twilio (order/dispatch/
// delivery update). Lets staff see whether a customer's message was actually
// queued/sent/delivered/read or silently failed (wrong number, no WhatsApp,
// opt-out), instead of the old fire-and-forget behaviour. `messageSid` is the
// Twilio SID returned by the send (NULL when delivery wasn't possible, e.g. dev
// fallback or a send error); `status` starts at the send-time state and is later
// advanced by Twilio's status-callback webhook. Linked to the originating order
// or challan (one of them set) and plant-scoped for the staff list.
export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  messageSid: text('message_sid'),
  // 'order' | 'dispatch' | 'delivery'
  event: text('event').notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  challanId: integer('challan_id').references(() => challans.id, { onDelete: 'set null' }),
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
  toPhone: text('to_phone').notNull(),
  // Twilio MessageStatus: queued/sent/delivered/read/failed/undelivered, plus our
  // synthetic 'error' (send rejected before a SID existed) and 'dev' (logged-only
  // dev fallback). Advanced in place by the status-callback webhook.
  status: text('status').notNull().default('queued'),
  // Twilio error code (e.g. 63016 "no WhatsApp account") when a message fails.
  errorCode: text('error_code'),
  // 'whatsapp' (handed to Twilio) | 'dev' (console-logged dev fallback).
  channel: text('channel').notNull().default('whatsapp'),
  // Two-way chat support. 'outbound' = we sent it (notification or staff chat
  // reply); 'inbound' = the customer messaged our WhatsApp number (stored by
  // the Meta webhook). toPhone always holds the CUSTOMER's number regardless of
  // direction so a conversation is simply all rows sharing one toPhone.
  direction: text('direction').notNull().default('outbound'),
  // Free-text message body. Populated for inbound messages and staff chat
  // replies; NULL for template notifications (their content lives in Meta).
  body: text('body'),
  // WhatsApp profile name Meta reports for an inbound sender (display only).
  profileName: text('profile_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // The webhook looks a message up by its Twilio SID, so it must be unique. NULL
  // SIDs (dev/error sends Twilio never callbacks for) never collide. For Meta
  // inbound messages the wamid is stored here too, which also dedupes webhook
  // retries (insert with onConflictDoNothing).
  uniqueIndex('whatsapp_messages_sid_unique')
    .on(t.messageSid)
    .where(sql`${t.messageSid} IS NOT NULL`),
  index('whatsapp_messages_plant_idx').on(t.plantId),
  index('whatsapp_messages_created_at_idx').on(t.createdAt),
  // Chat views group and page by customer phone.
  index('whatsapp_messages_to_phone_idx').on(t.toPhone),
]);

// Every refuel/diesel fill for a vehicle. Litres + optional cost and odometer
// reading; an optional photo of the fuel bill or odometer is stored exactly
// like proof-of-delivery photos (object-storage entity path, signed on read).
export const fuelLogs = pgTable('fuel_logs', {
  id: serial('id').primaryKey(),
  vehicleId: integer('vehicle_id').notNull().references(() => vehicles.id, { onDelete: 'cascade' }),
  litres: decimal('litres', { precision: 8, scale: 2 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  odometer: integer('odometer'),
  filledAt: timestamp('filled_at').notNull(),
  billPhoto: text('bill_photo'),
  notes: text('notes'),
  recordedBy: integer('recorded_by').references(() => users.id, { onDelete: 'set null' }),
  recordedByName: text('recorded_by_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Persisted theft/route alerts raised from the GPS ingest path. Live positions
// are in-memory and ephemeral, so an alert must be stored when first detected —
// it cannot be reconstructed later. Surfaced to staff/owner only.
export const vehicleAlerts = pgTable('vehicle_alerts', {
  id: serial('id').primaryKey(),
  challanId: integer('challan_id').references(() => challans.id, { onDelete: 'set null' }),
  vehicleId: integer('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
  driverId: integer('driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  // 'unscheduled_stop' | 'route_deviation'
  type: text('type').notNull(),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  distanceM: integer('distance_m'),
  detail: text('detail'),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const batchRecords = pgTable('batch_records', {
  id: serial('id').primaryKey(),
  // The producing plant. Production reads/writes are hard-scoped by it. NULL only
  // for legacy pre-backfill rows — batch records carry no order/challan linkage,
  // so legacy rows cannot be attributed and stay visible only to a global admin.
  plantId: integer('plant_id').references(() => plants.id),
  batchNo: text('batch_no').notNull().unique(),
  grade: text('grade').notNull(),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).notNull(),
  cementBags: integer('cement_bags'),
  waterLiters: integer('water_liters'),
  sandKg: integer('sand_kg'),
  aggregateKg: integer('aggregate_kg'),
  operator: text('operator'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Staff/driver attendance — a check-in opens a row, a check-out closes it. Each
// record is stamped with the actor's plant so the report stays plant-private
// (a null-plant global admin sees all). A partial unique index allows only one
// OPEN (not-yet-checked-out) record per user at a time, so the DB itself blocks
// a double check-in even under a race.
export const attendanceRecords = pgTable('attendance_records', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').references(() => plants.id),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  checkInAt: timestamp('check_in_at').defaultNow().notNull(),
  checkOutAt: timestamp('check_out_at'),
  checkInNote: text('check_in_note'),
  checkOutNote: text('check_out_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('attendance_open_unique').on(t.userId).where(sql`${t.checkOutAt} IS NULL`),
]);

export const ledgerEntries = pgTable('ledger_entries', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: ledgerTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  referenceNo: text('reference_no'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Customer-defined recurring order templates. A background scheduler
// materialises a real `orders` row whenever `nextRunDate` is due, then advances
// the schedule. `anchor` is the day-of-week (0=Sun..6=Sat) for weekly templates
// or the day-of-month (1..28) for monthly ones.
export const recurringOrders = pgTable('recurring_orders', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  siteId: integer('site_id').references(() => sites.id, { onDelete: 'set null' }),
  grade: text('grade').notNull(),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).notNull(),
  pumpRequired: boolean('pump_required').notNull().default(false),
  deliveryTime: time('delivery_time'),
  notes: text('notes'),
  frequency: recurringFrequencyEnum('frequency').notNull(),
  anchor: integer('anchor').notNull(),
  nextRunDate: date('next_run_date').notNull(),
  active: boolean('active').notNull().default(true),
  lastRunAt: timestamp('last_run_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  lockedUntil: timestamp('locked_until'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Shared, fixed-window rate-limit counters. Lives in Postgres (not in-process
// memory) so the limit holds across every server instance under horizontal
// scaling — otherwise each instance keeps its own count and the effective limit
// is multiplied by the instance count. `key` is `${name}:${ip}`; `resetAt` is
// when the current window expires and `count` rolls back to zero.
export const rateLimitHits = pgTable('rate_limit_hits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: timestamp('reset_at').notNull(),
}, (t) => [
  index('rate_limit_hits_reset_at_idx').on(t.resetAt),
]);

// Shared response cache for paid upstream lookups (currently Google Places
// discovery). Stored in Postgres so identical nearby queries reuse a single
// upstream call regardless of which instance serves them, instead of each
// instance maintaining its own in-memory cache and re-billing the upstream.
export const responseCache = pgTable('response_cache', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (t) => [
  index('response_cache_expires_at_idx').on(t.expiresAt),
]);

// Single-use, time-limited invite tokens that let a newly-provisioned account
// (e.g. a plant owner) set their OWN password via an emailed link, instead of
// staff typing and sharing a temporary password. Only the SHA-256 hash of the
// token is stored — the plaintext lives only in the emailed link — so a DB read
// never exposes a usable token. A token is consumed (usedAt set) on first use
// and is rejected once used or past expiresAt.
export const passwordSetupTokens = pgTable('password_setup_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  // 'invite' (owner onboarding — redeeming activates the account) vs 'reset'
  // (forgot-password — redeeming only changes the password and must NEVER
  // reactivate a suspended account). Defaults to 'invite' for legacy rows.
  kind: text('kind').notNull().default('invite'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('password_setup_tokens_hash_unique').on(t.tokenHash),
]);

// Public, shareable live-tracking links for a single challan (trip). A staff
// member mints a token for a challan; anyone holding the link can watch that one
// trip on a no-login map. Only a hash of the token is stored (the raw token
// lives only in the shared URL); links can be revoked or time-limited.
export const trackingTokens = pgTable('tracking_tokens', {
  id: serial('id').primaryKey(),
  challanId: integer('challan_id').notNull().references(() => challans.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('tracking_tokens_hash_unique').on(t.tokenHash),
]);

// Marketplace directory of RMC plants. A customer only ever sees rows that are
// approved + active + location-verified, filtered by Haversine distance.
export const plants = pgTable('plants', {
  id: serial('id').primaryKey(),
  // Unique human plant code (e.g. PLT-001). Customer codes are namespaced under
  // it. NULL only for legacy rows before the multi-tenant backfill assigns one.
  plantCode: text('plant_code'),
  name: text('name').notNull(),
  // Company identity printed on this plant's challans/receipts — replaces all
  // previously hardcoded branding. legalName falls back to name when unset.
  legalName: text('legal_name'),
  gstNo: text('gst_no'),
  email: text('email'),
  address: text('address'),
  city: text('city'),
  contactNumber: text('contact_number'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  plantStatus: plantStatusEnum('plant_status').notNull().default('pending'),
  // Platform billing lifecycle. New plants start on a trial; staff move them
  // through active/past_due/suspended/cancelled from the admin plant editor.
  subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('trial'),
  subscriptionPlan: subscriptionPlanEnum('subscription_plan').notNull().default('free'),
  // Per-plant platform-commission override (percent). NULL = use the global
  // platform_commission_pct app setting. Lets staff negotiate a bespoke rate
  // for a single partner without changing the platform default.
  commissionPct: decimal('commission_pct', { precision: 5, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  locationVerified: boolean('location_verified').notNull().default(false),
  // Partner verification, distinct from locationVerified (which only attests the
  // GPS pin). A row stays an onboarding *lead* until staff confirm the company
  // details (contact, GST, legal name) and flip this true. Customers only ever
  // see verified partners — a lead is never exposed by /nearby.
  verified: boolean('verified').notNull().default(false),
  // Authority "MAPPING PLANT" onboarding contact fields — the person who runs the
  // plant, captured while pinning it on the map (distinct from the plant's
  // company email/contactNumber above).
  ownerName: text('owner_name'),
  whatsappNumber: text('whatsapp_number'),
  // Network onboarding lifecycle, driven by the Authority MAPPING PLANT module:
  //   pending  — pinned/created, not yet acted on
  //   invited  — owner-onboarding invite has been sent
  //   verified — details confirmed by staff
  //   active   — live on the customer network dashboard
  // A plant is shown to customers ONLY when networkStatus === 'active' AND
  // showOnNetwork is true (see the customerVisible() gate in routes/plants.ts).
  networkStatus: text('network_status').notNull().default('pending'),
  // Authority master switch to show/hide a plant on the customer network map/list
  // without changing its lifecycle status. Defaults true so existing partners stay
  // visible after this column is added.
  showOnNetwork: boolean('show_on_network').notNull().default(true),
  // Onboarding-invite tracking for the MAPPING PLANT "Send Invite to Plant Owner"
  // action: last invite status ('invited') and when it was sent.
  inviteStatus: text('invite_status'),
  inviteSentAt: timestamp('invite_sent_at'),
  // Google Places placeId for plants that entered via the discovery/invite pipeline.
  // Null for plants added directly by staff without a Places origin.
  // Used as a first-class duplicate guard on top of coordinate proximity.
  placeId: text('place_id'),
  deliveryRadiusKm: integer('delivery_radius_km').notNull().default(25),
  grades: text('grades').array().notNull().default(sql`ARRAY[]::text[]`),
  openTime: text('open_time'),   // 'HH:MM' 24h local
  closeTime: text('close_time'), // 'HH:MM' 24h local
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  nameUnique: uniqueIndex('plants_name_unique').on(table.name),
  plantCodeUnique: uniqueIndex('plants_code_unique').on(table.plantCode),
}));

// Maps a global user to a single plant's customer record. The same user ordering
// at two plants gets two rows pointing at two different per-plant clients (and so
// two different customer codes). uniqueIndex(plantId,userId) makes the per-plant
// customer identity exactly one. This is the ONLY table that links a global user
// to a plant's customer — plants never see it, only the customer's own /me view.
export const plantCustomers = pgTable('plant_customers', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').notNull().references(() => plants.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('plant_customers_plant_user_unique').on(t.plantId, t.userId),
]);

// Customer/staff-submitted requests to onboard a real-world concrete plant that
// was discovered live on the map directory (Google Places) but is not yet a
// partner. One row per Google placeId — repeated requests for the same plant are
// de-duplicated by incrementing requestCount and recording the latest requester,
// so staff see demand without a flood of duplicate leads.
export const plantInvites = pgTable('plant_invites', {
  id: serial('id').primaryKey(),
  placeId: text('place_id').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  contactNumber: text('contact_number'),
  // How many times this plant has been requested (across all users).
  requestCount: integer('request_count').notNull().default(1),
  // 'pending' (awaiting staff action) | 'onboarded' | 'dismissed'.
  status: text('status').notNull().default('pending'),
  // Who first requested it, and who requested it most recently. Both nullable so
  // the row survives the requester's account being deleted.
  firstRequestedById: integer('first_requested_by_id').references(() => users.id, { onDelete: 'set null' }),
  firstRequestedByName: text('first_requested_by_name'),
  lastRequestedById: integer('last_requested_by_id').references(() => users.id, { onDelete: 'set null' }),
  lastRequestedByName: text('last_requested_by_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('plant_invites_place_id_unique').on(t.placeId),
]);

// Per-plant rate card: the price (₹ per m³) a plant charges for each concrete
// grade it sells on the marketplace. One active row per (plant, grade) — staff
// edit these from the plant editor; customers see them when ordering.
export const rateCards = pgTable('rate_cards', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').notNull().references(() => plants.id, { onDelete: 'cascade' }),
  grade: text('grade').notNull(),
  ratePerM3: decimal('rate_per_m3', { precision: 12, scale: 2 }).notNull(),
  // Optional date the rate takes effect (informational; the active row is the
  // current price regardless). Nullable.
  effectiveFrom: timestamp('effective_from'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('rate_cards_plant_grade_unique').on(t.plantId, t.grade),
]);

// Unified registry of every file uploaded across the platform (proof-of-delivery
// photos, fuel bills, and future document types). This is an ADDITIVE catalogue:
// the source tables (challan_proof_photos.photo, fuel_logs.bill_photo) remain the
// authoritative owners of each storage path; a row is mirrored here on upload so
// staff get one searchable vault and super-admins can see storage usage. The
// storage path format matches the source (`/objects/<uuid>`).
export const uploadedFiles = pgTable('uploaded_files', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  challanId: integer('challan_id').references(() => challans.id, { onDelete: 'set null' }),
  // 'proof_photo' | 'fuel_bill' (extensible)
  fileType: text('file_type').notNull(),
  fileName: text('file_name'),
  storagePath: text('storage_path').notNull(),
  // 'plant' (plant staff) | 'admin' (platform staff only)
  accessLevel: text('access_level').notNull().default('plant'),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (t) => [
  index('uploaded_files_plant_idx').on(t.plantId),
  index('uploaded_files_type_idx').on(t.fileType),
  uniqueIndex('uploaded_files_path_unique').on(t.storagePath),
]);

export const plantsRelations = relations(plants, ({ many }) => ({
  clients: many(clients),
  orders: many(orders),
  challans: many(challans),
  plantCustomers: many(plantCustomers),
  rateCards: many(rateCards),
  uploadedFiles: many(uploadedFiles),
}));

export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  plant: one(plants, { fields: [uploadedFiles.plantId], references: [plants.id] }),
  user: one(users, { fields: [uploadedFiles.userId], references: [users.id] }),
  order: one(orders, { fields: [uploadedFiles.orderId], references: [orders.id] }),
  challan: one(challans, { fields: [uploadedFiles.challanId], references: [challans.id] }),
}));

export const rateCardsRelations = relations(rateCards, ({ one }) => ({
  plant: one(plants, { fields: [rateCards.plantId], references: [plants.id] }),
}));

export const plantCustomersRelations = relations(plantCustomers, ({ one }) => ({
  plant: one(plants, { fields: [plantCustomers.plantId], references: [plants.id] }),
  user: one(users, { fields: [plantCustomers.userId], references: [users.id] }),
  client: one(clients, { fields: [plantCustomers.clientId], references: [clients.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  plant: one(plants, { fields: [clients.plantId], references: [plants.id] }),
  sites: many(sites),
  orders: many(orders),
  challans: many(challans),
  ledgerEntries: many(ledgerEntries),
  recurringOrders: many(recurringOrders),
}));

export const recurringOrdersRelations = relations(recurringOrders, ({ one }) => ({
  client: one(clients, { fields: [recurringOrders.clientId], references: [clients.id] }),
  site: one(sites, { fields: [recurringOrders.siteId], references: [sites.id] }),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  vehicles: many(vehicles),
  challans: many(challans),
}));

export const sitesRelations = relations(sites, ({ one }) => ({
  client: one(clients, { fields: [sites.clientId], references: [clients.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, { fields: [orders.clientId], references: [clients.id] }),
  site: one(sites, { fields: [orders.siteId], references: [sites.id] }),
  challans: many(challans),
}));

export const vehiclesRelations = relations(vehicles, ({ one }) => ({
  driver: one(drivers, { fields: [vehicles.driverId], references: [drivers.id] }),
}));

export const challansRelations = relations(challans, ({ one, many }) => ({
  client: one(clients, { fields: [challans.clientId], references: [clients.id] }),
  site: one(sites, { fields: [challans.siteId], references: [sites.id] }),
  vehicle: one(vehicles, { fields: [challans.vehicleId], references: [vehicles.id] }),
  driver: one(drivers, { fields: [challans.driverId], references: [drivers.id] }),
  order: one(orders, { fields: [challans.orderId], references: [orders.id] }),
  proofPhotos: many(challanProofPhotos),
}));

export const challanProofPhotosRelations = relations(challanProofPhotos, ({ one }) => ({
  challan: one(challans, { fields: [challanProofPhotos.challanId], references: [challans.id] }),
}));

export const fuelLogsRelations = relations(fuelLogs, ({ one }) => ({
  vehicle: one(vehicles, { fields: [fuelLogs.vehicleId], references: [vehicles.id] }),
  recorder: one(users, { fields: [fuelLogs.recordedBy], references: [users.id] }),
}));

export const vehicleAlertsRelations = relations(vehicleAlerts, ({ one }) => ({
  challan: one(challans, { fields: [vehicleAlerts.challanId], references: [challans.id] }),
  vehicle: one(vehicles, { fields: [vehicleAlerts.vehicleId], references: [vehicles.id] }),
  driver: one(drivers, { fields: [vehicleAlerts.driverId], references: [drivers.id] }),
}));

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorName: text('actor_name'),
  action: text('action').notNull(),
  targetUserId: integer('target_user_id').references(() => users.id, { onDelete: 'set null' }),
  targetUserEmail: text('target_user_email'),
  status: text('status'),
  detail: text('detail'),
  emailSent: boolean('email_sent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ledgerRelations = relations(ledgerEntries, ({ one }) => ({
  client: one(clients, { fields: [ledgerEntries.clientId], references: [clients.id] }),
}));

// Durable retry queue for business WhatsApp notifications (order/dispatch/
// delivery) whose first, inline send failed *transiently* (provider unreachable
// or a 5xx/429 from Twilio). Permanent failures (invalid number, template
// error) are never enqueued. A background tick re-sends due rows with
// exponential backoff and deletes them on success or once attempts are
// exhausted, so a brief provider outage no longer silently drops a customer
// update. `variables` holds the template's numbered placeholder map verbatim so
// the row is self-contained — the retry needs no access to the originating
// order/challan. `attempts` counts sends made so far (1 = the inline attempt).
export const whatsappRetries = pgTable('whatsapp_retries', {
  id: serial('id').primaryKey(),
  toPhone: text('to_phone').notNull(),
  templateSid: text('template_sid').notNull(),
  variables: jsonb('variables').notNull(),
  event: text('event'),
  attempts: integer('attempts').notNull().default(1),
  lastError: text('last_error'),
  nextAttemptAt: timestamp('next_attempt_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('whatsapp_retries_next_attempt_at_idx').on(t.nextAttemptAt),
]);

// Dev-mode fallback store for phone-OTP codes. When a real provider (Twilio
// Verify) is configured the codes live in Twilio and this table is unused; when
// it is NOT configured we generate and verify codes locally so the whole flow
// is testable end-to-end without any external dependency. Only the SHA-256 hash
// of the code is stored, never the plaintext. One live row per phone (latest
// send wins) — see the unique index.
export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('otp_codes_phone_unique').on(t.phone),
]);

// Staff/owner passwordless login codes. Kept SEPARATE from otp_codes (which is
// the customer phone-OTP store) so the customer flow is untouched. Keyed by the
// provisioned user id (one live code per account, latest send wins). Only the
// SHA-256 hash of the code is stored, never the plaintext. `channel` records how
// the code was delivered (email/whatsapp) for the audit trail.
export const staffOtpCodes = pgTable('staff_otp_codes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  channel: text('channel').notNull().default('email'),
  expiresAt: timestamp('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('staff_otp_codes_user_unique').on(t.userId),
]);

// ---- AI Virtual Help Agent -------------------------------------------------

// Singleton configuration for the AI Help Agent (one row, id = 1). The agent is
// OFF unless `enabled` is true — the feature must be explicitly turned on by an
// admin. `persona` seeds the system-prompt personality and `greeting` is the
// opening line shown when the popup first opens. Kept as its own typed table
// (rather than the key/value app_settings) per the feature spec.
export const aiSettings = pgTable('ai_settings', {
  id: integer('id').primaryKey().default(1),
  enabled: boolean('enabled').notNull().default(false),
  persona: text('persona'),
  greeting: text('greeting'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// One row per chat session opened from the Help popup. `plantId` is the plant
// scope the conversation ran under (NULL for a marketplace customer not bound to
// a plant, or platform staff with no plant selected); `userId` is the owning
// account; `sessionId` is the client-generated session key. Conversations are
// always tied to the server-derived identity — never a plant_id from the body.
export const aiConversations = pgTable('ai_conversations', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
  role: text('role'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  // Conversations are per-user: the same client-generated sessionId may legitimately
  // be reused by two different accounts, so uniqueness is scoped to (sessionId,
  // userId) rather than sessionId alone. A global unique on sessionId would make
  // getOrCreateConversation throw a 500 when two users collide on a session key.
  uniqueIndex('ai_conversations_session_user_unique').on(t.sessionId, t.userId),
  index('ai_conversations_user_idx').on(t.userId),
]);

// Each message turn: the user's `message` and the assistant's `response`, with
// the input/output modality and the scoped retrieval functions invoked (for the
// audit trail). Scoped by `plantId` + `userId`, mirroring the conversation.
export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => aiConversations.id, { onDelete: 'cascade' }).notNull(),
  sessionId: text('session_id').notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  response: text('response'),
  // Modality of the turn. inputType: 'text' | 'voice'. outputType: 'text' |
  // 'audio' | 'video' (video reserved for the deferred talking-avatar phase).
  inputType: text('input_type').notNull().default('text'),
  outputType: text('output_type').notNull().default('text'),
  // Comma-separated list of the scoped retrieval functions used to ground this
  // answer; recorded so every AI data access is auditable.
  functionsUsed: text('functions_used'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ai_messages_conversation_idx').on(t.conversationId),
]);

// A support ticket raised from the agent when it can't answer or the user asks
// for a human. `plantId` + `userId` scope it; `clientId` ties it to the
// customer's per-plant client row when known. Plant-scoped so a plant only ever
// sees tickets raised against it.
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  subject: text('subject'),
  message: text('message').notNull(),
  contactInfo: text('contact_info'),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('support_tickets_plant_idx').on(t.plantId),
  index('support_tickets_user_idx').on(t.userId),
]);

// A browser/PWA Web Push subscription belonging to a user. One row per push
// endpoint; a user may hold several (one per device/browser). Used to deliver
// order/delivery notifications that pop up even when the app is closed. The
// endpoint is globally unique, so re-subscribing the same browser upserts in
// place. Rows are pruned automatically when the push service reports the
// endpoint as gone (404/410).
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('push_subscriptions_user_idx').on(t.userId),
]);

// ---- Configurable automations -----------------------------------------------

// Per-automation on/off + tuning knobs. One row per (automation, plantId) where
// plantId = 0 means the PLATFORM-WIDE default row (a plain 0 sentinel instead of
// NULL so the unique index actually enforces one row per scope — Postgres treats
// NULLs as distinct in unique indexes). A plant row overrides the global row;
// missing rows fall back to the code defaults (everything OFF except cleanup).
export const automationSettings = pgTable('automation_settings', {
  id: serial('id').primaryKey(),
  automation: text('automation').notNull(),
  plantId: integer('plant_id').notNull().default(0),
  enabled: boolean('enabled').notNull().default(false),
  config: jsonb('config').notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('automation_settings_scope_unique').on(t.automation, t.plantId),
]);

// Once-only send ledger for the automation suite. Before an automation notifies
// anyone about a target it INSERTs a claim row here; the unique index is the
// arbiter, so across restarts and overlapping ticks at most ONE tick wins the
// claim (onConflictDoNothing → empty returning = someone else already sent it).
// windowKey scopes the "once": a fixed key means once-ever per target, a date or
// period-index key means once per recurrence window.
export const automationSends = pgTable('automation_sends', {
  id: serial('id').primaryKey(),
  automation: text('automation').notNull(),
  plantId: integer('plant_id'),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  windowKey: text('window_key').notNull(),
  detail: text('detail'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('automation_sends_once_unique').on(t.automation, t.targetType, t.targetId, t.windowKey),
  index('automation_sends_sent_at_idx').on(t.sentAt),
]);
