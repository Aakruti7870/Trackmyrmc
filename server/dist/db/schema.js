import { pgTable, serial, text, integer, decimal, boolean, timestamp, date, time, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
export const userRoleEnum = pgEnum('user_role', ['authority', 'admin', 'dispatcher', 'plant_operator', 'client', 'driver']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'in_progress', 'completed', 'cancelled']);
export const challanStatusEnum = pgEnum('challan_status', ['pending', 'dispatched', 'delivered', 'cancelled']);
export const vehicleStatusEnum = pgEnum('vehicle_status', ['active', 'maintenance', 'inactive']);
export const ledgerTypeEnum = pgEnum('ledger_type', ['debit', 'credit']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['weekly', 'monthly']);
export const plantStatusEnum = pgEnum('plant_status', ['pending', 'approved', 'rejected']);
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
        .where(sql `${t.plantId} IS NOT NULL AND ${t.customerCode} IS NOT NULL`),
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
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('dispatcher'),
    isActive: boolean('is_active').notNull().default(true),
    // For plant-scoped staff/owner accounts: the single plant this user may see and
    // manage. NULL means a legacy global/superuser or marketplace authority (not
    // bound to one plant). Plant owners provisioned at onboarding always have it.
    plantId: integer('plant_id').references(() => plants.id, { onDelete: 'set null' }),
    linkedClientId: integer('linked_client_id').references(() => clients.id, { onDelete: 'set null' }),
    linkedDriverId: integer('linked_driver_id').references(() => drivers.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    // Enforce one-account-per-client/driver at the DB level. Partial unique
    // indexes only constrain live links (a soft-deleted account or a NULL link
    // never collides), mirroring findLinkConflict's application-level guard so a
    // direct write or a race between two requests can't create a duplicate link.
    uniqueIndex('users_linked_client_unique')
        .on(t.linkedClientId)
        .where(sql `${t.deletedAt} IS NULL AND ${t.linkedClientId} IS NOT NULL`),
    uniqueIndex('users_linked_driver_unique')
        .on(t.linkedDriverId)
        .where(sql `${t.deletedAt} IS NULL AND ${t.linkedDriverId} IS NOT NULL`),
    // One live account per phone number (the phone-OTP login key). A soft-deleted
    // account or a NULL phone never collides, so staff/email accounts are exempt.
    uniqueIndex('users_phone_unique')
        .on(t.phone)
        .where(sql `${t.deletedAt} IS NULL AND ${t.phone} IS NOT NULL`),
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
    deliveryDate: date('delivery_date'),
    deliveryTime: time('delivery_time'),
    notes: text('notes'),
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
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
    uniqueIndex('password_setup_tokens_hash_unique').on(t.tokenHash),
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
    isActive: boolean('is_active').notNull().default(true),
    locationVerified: boolean('location_verified').notNull().default(false),
    // Partner verification, distinct from locationVerified (which only attests the
    // GPS pin). A row stays an onboarding *lead* until staff confirm the company
    // details (contact, GST, legal name) and flip this true. Customers only ever
    // see verified partners — a lead is never exposed by /nearby.
    verified: boolean('verified').notNull().default(false),
    deliveryRadiusKm: integer('delivery_radius_km').notNull().default(25),
    grades: text('grades').array().notNull().default(sql `ARRAY[]::text[]`),
    openTime: text('open_time'), // 'HH:MM' 24h local
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
export const plantsRelations = relations(plants, ({ many }) => ({
    clients: many(clients),
    orders: many(orders),
    challans: many(challans),
    plantCustomers: many(plantCustomers),
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
