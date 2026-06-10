import {
  pgTable, serial, text, integer, decimal, boolean,
  timestamp, date, time, pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum('user_role', ['admin', 'dispatcher', 'plant_operator', 'client', 'driver']);
export const orderStatusEnum = pgEnum('order_status', ['pending', 'in_progress', 'completed', 'cancelled']);
export const challanStatusEnum = pgEnum('challan_status', ['pending', 'dispatched', 'delivered', 'cancelled']);
export const vehicleStatusEnum = pgEnum('vehicle_status', ['active', 'maintenance', 'inactive']);
export const ledgerTypeEnum = pgEnum('ledger_type', ['debit', 'credit']);

export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
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
});

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
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('dispatcher'),
  isActive: boolean('is_active').notNull().default(true),
  linkedClientId: integer('linked_client_id').references(() => clients.id, { onDelete: 'set null' }),
  linkedDriverId: integer('linked_driver_id').references(() => drivers.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
  status: vehicleStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNo: text('order_no').notNull().unique(),
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
  orderId: integer('order_id').references(() => orders.id),
  clientId: integer('client_id').notNull().references(() => clients.id),
  siteId: integer('site_id').references(() => sites.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  driverId: integer('driver_id').references(() => drivers.id),
  grade: text('grade').notNull(),
  quantity: decimal('quantity', { precision: 8, scale: 2 }).notNull(),
  pumpRequired: boolean('pump_required').notNull().default(false),
  dispatchTime: timestamp('dispatch_time'),
  deliveryTime: timestamp('delivery_time'),
  status: challanStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
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

export const clientsRelations = relations(clients, ({ many }) => ({
  sites: many(sites),
  orders: many(orders),
  challans: many(challans),
  ledgerEntries: many(ledgerEntries),
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

export const challansRelations = relations(challans, ({ one }) => ({
  client: one(clients, { fields: [challans.clientId], references: [clients.id] }),
  site: one(sites, { fields: [challans.siteId], references: [sites.id] }),
  vehicle: one(vehicles, { fields: [challans.vehicleId], references: [vehicles.id] }),
  driver: one(drivers, { fields: [challans.driverId], references: [drivers.id] }),
  order: one(orders, { fields: [challans.orderId], references: [orders.id] }),
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
