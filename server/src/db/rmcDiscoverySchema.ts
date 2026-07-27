import {
  pgTable, serial, text, integer, decimal, boolean, timestamp, jsonb,
  uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { plants, users } from './schema.js';

export type RmcDiscoveryStatus = 'DISCOVERED' | 'NEEDS_REVIEW' | 'DUPLICATE' | 'REJECTED';
export type RmcOnboardingStatus = 'NOT_INVITED' | 'INVITED' | 'CLAIM_PENDING' | 'DOCUMENTS_PENDING' | 'ADMIN_REVIEW' | 'APPROVED';
export type RmcOperationalStatus = 'UNCONFIRMED' | 'ACCEPTING_ORDERS' | 'BUSY' | 'LIMITED_CAPACITY' | 'MAINTENANCE' | 'TEMPORARILY_CLOSED' | 'PERMANENTLY_CLOSED';
export type RmcPublicationStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
export type RmcVerificationLevel = 'GOOGLE_LISTED' | 'TRACKMYRMC_REGISTERED' | 'TRACKMYRMC_VERIFIED';
export type RmcImportStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export const rmcMarketAreas = pgTable('rmc_market_areas', {
  id: serial('id').primaryKey(),
  state: text('state').notNull().default('Maharashtra'),
  district: text('district').notNull(),
  marketName: text('market_name').notNull(),
  locality: text('locality').notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  searchRadiusMeters: integer('search_radius_meters').notNull().default(50000),
  isEnabled: boolean('is_enabled').notNull().default(true),
  priority: integer('priority').notNull().default(100),
  lastScannedAt: timestamp('last_scanned_at'),
  nextScanEligibleAt: timestamp('next_scan_eligible_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('rmc_market_areas_state_district_market_unique').on(t.state, t.district, t.marketName),
  index('rmc_market_areas_state_idx').on(t.state),
  index('rmc_market_areas_district_idx').on(t.district),
  index('rmc_market_areas_market_name_idx').on(t.marketName),
  index('rmc_market_areas_enabled_idx').on(t.isEnabled),
]);

export const rmcPlantImportRuns = pgTable('rmc_plant_import_runs', {
  id: serial('id').primaryKey(),
  startedByUserId: integer('started_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  scopeType: text('scope_type').notNull(),
  marketAreaId: integer('market_area_id').references(() => rmcMarketAreas.id, { onDelete: 'set null' }),
  district: text('district'),
  state: text('state').notNull().default('Maharashtra'),
  status: text('status').notNull().$type<RmcImportStatus>().default('QUEUED'),
  cancelRequested: boolean('cancel_requested').notNull().default(false),
  totalQueries: integer('total_queries').notNull().default(0),
  completedQueries: integer('completed_queries').notNull().default(0),
  totalResults: integer('total_results').notNull().default(0),
  insertedCandidates: integer('inserted_candidates').notNull().default(0),
  updatedCandidates: integer('updated_candidates').notNull().default(0),
  duplicateCandidates: integer('duplicate_candidates').notNull().default(0),
  rejectedCandidates: integer('rejected_candidates').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  errorSummary: jsonb('error_summary').notNull().default([]),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('rmc_plant_import_runs_status_idx').on(t.status),
  index('rmc_plant_import_runs_market_idx').on(t.marketAreaId),
  index('rmc_plant_import_runs_created_idx').on(t.createdAt),
]);

export const rmcPlantImportQueries = pgTable('rmc_plant_import_queries', {
  id: serial('id').primaryKey(),
  importRunId: integer('import_run_id').notNull().references(() => rmcPlantImportRuns.id, { onDelete: 'cascade' }),
  marketAreaId: integer('market_area_id').notNull().references(() => rmcMarketAreas.id, { onDelete: 'restrict' }),
  queryText: text('query_text').notNull(),
  status: text('status').notNull().default('QUEUED'),
  pageCount: integer('page_count').notNull().default(0),
  resultCount: integer('result_count').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('rmc_plant_import_queries_run_market_query_unique').on(t.importRunId, t.marketAreaId, t.queryText),
  index('rmc_plant_import_queries_run_idx').on(t.importRunId),
  index('rmc_plant_import_queries_status_idx').on(t.status),
]);

export const rmcPlantCandidates = pgTable('rmc_plant_candidates', {
  id: serial('id').primaryKey(),
  googlePlaceId: text('google_place_id').notNull(),
  discoveredName: text('discovered_name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  formattedAddress: text('formatted_address'),
  locality: text('locality'),
  district: text('district'),
  state: text('state').notNull().default('Maharashtra'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  googleMapsUri: text('google_maps_uri'),
  googleBusinessStatus: text('google_business_status'),
  googleTypes: jsonb('google_types').notNull().default([]),
  source: text('source').notNull().default('GOOGLE_PLACES'),
  confidenceScore: integer('confidence_score').notNull(),
  confidenceReasons: jsonb('confidence_reasons').notNull().default([]),
  discoveryStatus: text('discovery_status').notNull().$type<RmcDiscoveryStatus>().default('DISCOVERED'),
  possibleDuplicateOfPlantId: integer('possible_duplicate_of_plant_id').references(() => plants.id, { onDelete: 'set null' }),
  firstDiscoveredAt: timestamp('first_discovered_at').defaultNow().notNull(),
  lastDiscoveredAt: timestamp('last_discovered_at').defaultNow().notNull(),
  lastGoogleCheckedAt: timestamp('last_google_checked_at').defaultNow().notNull(),
  importRunId: integer('import_run_id').references(() => rmcPlantImportRuns.id, { onDelete: 'set null' }),
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  reviewerNotes: text('reviewer_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('rmc_plant_candidates_google_place_id_unique').on(t.googlePlaceId),
  index('rmc_plant_candidates_status_idx').on(t.discoveryStatus),
  index('rmc_plant_candidates_district_idx').on(t.district),
  index('rmc_plant_candidates_locality_idx').on(t.locality),
  index('rmc_plant_candidates_confidence_idx').on(t.confidenceScore),
  index('rmc_plant_candidates_import_run_idx').on(t.importRunId),
]);

export const rmcPlantStatusHistory = pgTable('rmc_plant_status_history', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').notNull().references(() => plants.id, { onDelete: 'cascade' }),
  changedByUserId: integer('changed_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  previousOperationalStatus: text('previous_operational_status'),
  newOperationalStatus: text('new_operational_status'),
  previousPublicationStatus: text('previous_publication_status'),
  newPublicationStatus: text('new_publication_status'),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('rmc_plant_status_history_plant_idx').on(t.plantId),
  index('rmc_plant_status_history_created_idx').on(t.createdAt),
]);

export const rmcPlantOnboardingInvites = pgTable('rmc_plant_onboarding_invites', {
  id: serial('id').primaryKey(),
  plantId: integer('plant_id').notNull().references(() => plants.id, { onDelete: 'cascade' }),
  invitedMobileNumber: text('invited_mobile_number').notNull(),
  invitedEmail: text('invited_email'),
  inviteTokenHash: text('invite_token_hash').notNull(),
  inviteStatus: text('invite_status').notNull().default('INVITED'),
  expiresAt: timestamp('expires_at').notNull(),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdByUserId: integer('created_by_user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('rmc_plant_onboarding_invites_token_hash_unique').on(t.inviteTokenHash),
  index('rmc_plant_onboarding_invites_plant_idx').on(t.plantId),
  index('rmc_plant_onboarding_invites_status_idx').on(t.inviteStatus),
]);
