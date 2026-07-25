# Maharashtra RMC Plant Discovery and Onboarding

## Purpose

TrackMyRMC discovers likely ready-mix concrete plants from Google Places, stores them in a private Super Admin review queue, and publishes a plant only after separate review, onboarding, verification, activation, and publication decisions.

```text
Super Admin
  → RMC Plant Network
  → Discover Plants
  → Maharashtra / District / Market
  → Start Import
  → Google-listed candidates
  → Confidence + duplicate filtering
  → Review Queue
  → Approve as Draft
  → Invite or manually onboard
  → Verify details
  → Activate and Publish
  → Customer discovery
```

Google discovery is never treated as proof that a plant is operating or authorised to receive orders.

## Existing architecture extended

- Backend: Express and TypeScript
- Validation: Zod
- Database: PostgreSQL with Drizzle ORM conventions and an idempotent SQL migration
- Authentication: Bearer JWT with database-reloaded roles; `authority` is the existing Super Admin role
- Frontend: React, TypeScript, Vite and wouter
- Android: existing Capacitor wrapper
- Hosting: existing Google Cloud Run service and Cloud SQL PostgreSQL
- Google integration: existing backend-only Google Places API (New) integration

No second plant entity, auth system, frontend application, or API key path is introduced.

## State model

### Discovery

- `DISCOVERED`
- `NEEDS_REVIEW`
- `DUPLICATE`
- `REJECTED`

### Onboarding

- `NOT_INVITED`
- `INVITED`
- `CLAIM_PENDING`
- `DOCUMENTS_PENDING`
- `ADMIN_REVIEW`
- `APPROVED`

### Operational

- `UNCONFIRMED`
- `ACCEPTING_ORDERS`
- `BUSY`
- `LIMITED_CAPACITY`
- `MAINTENANCE`
- `TEMPORARILY_CLOSED`
- `PERMANENTLY_CLOSED`

### Publication

- `DRAFT`
- `PUBLISHED`
- `HIDDEN`

### Verification

- `GOOGLE_LISTED`
- `TRACKMYRMC_REGISTERED`
- `TRACKMYRMC_VERIFIED`

A customer-visible plant must satisfy all of the following:

```text
onboarding_status = APPROVED
publication_status = PUBLISHED
is_active = true
operational_status ∈ {ACCEPTING_ORDERS, BUSY, LIMITED_CAPACITY}
```

## Database

The migration extends the existing `plants` table and creates:

- `rmc_market_areas`
- `rmc_plant_candidates`
- `rmc_plant_import_runs`
- `rmc_plant_import_queries`
- `rmc_plant_status_history`
- `rmc_plant_onboarding_invites`

Run:

```bash
cd server
pnpm install --frozen-lockfile
pnpm db:migrate-rmc-discovery
```

The migration is idempotent and also seeds the maintained Maharashtra market catalogue.

## Market strategy

Imports operate one locality at a time. Each enabled market produces six searches:

- `RMC plant in <locality>, Maharashtra`
- `ready mix concrete plant in <locality>, Maharashtra`
- `ready mixed concrete supplier in <locality>, Maharashtra`
- `concrete batching plant in <locality>, Maharashtra`
- `commercial RMC plant in <locality>, Maharashtra`
- `RMC supplier in <locality>, Maharashtra`

MIDC/industrial markets add:

- `RMC plant near <MIDC>`
- `concrete plant near <MIDC>`

Market coordinates are locality-centre bias points, not plant coordinates. Google-returned coordinates are the candidate source of truth and remain unverified until review.

## Google Places request

Endpoint:

```text
POST https://places.googleapis.com/v1/places:searchText
```

The backend requests only:

```text
places.id
places.displayName
places.formattedAddress
places.location
places.businessStatus
places.googleMapsUri
places.types
nextPageToken
```

The client follows all available pages, uses a timeout, retries transient failures with exponential backoff (maximum three retries), honours cancellation, and never logs the API key.

## Confidence scoring

Positive and negative evidence is stored as JSON with every score. Scores 70+ are high confidence, 45–69 are medium confidence, and lower scores are rejected automatically. Permanently closed businesses, missing Place IDs and missing coordinates are excluded.

## Duplicate prevention

Checks use:

1. Google Place ID
2. Existing plant external ID
3. Coordinate proximity and normalized name similarity
4. Matching locality and high normalized-name similarity
5. Super Admin confirmation

Uncertain records are marked for review and are never automatically merged.

## Import execution

Starting an import immediately returns an `importRunId`. Query work and progress are persisted in PostgreSQL. The worker uses bounded concurrency and updates query/run counters after every query. A running job can be cancelled from the UI. A market cooldown prevents repeated paid scans.

Cloud Run can horizontally scale because rate-limit, cache, candidate and run state are stored in PostgreSQL. Queued runs are resumed after process restart. A run is claimed atomically before processing.

## APIs

Super Admin (`authority`) only:

- `GET /api/super-admin/rmc-discovery/dashboard`
- `GET /api/super-admin/rmc-discovery/markets`
- `POST /api/super-admin/rmc-discovery/import`
- `POST /api/super-admin/rmc-discovery/import-runs/:id/cancel`
- `GET /api/super-admin/rmc-discovery/import-runs`
- `GET /api/super-admin/rmc-discovery/import-runs/:id`
- `GET /api/super-admin/rmc-discovery/candidates`
- `GET /api/super-admin/rmc-discovery/candidates/:id`
- `PATCH /api/super-admin/rmc-discovery/candidates/:id`
- `POST /api/super-admin/rmc-discovery/candidates/:id/approve`
- `POST /api/super-admin/rmc-discovery/candidates/:id/reject`
- `POST /api/super-admin/rmc-discovery/candidates/:id/mark-duplicate`
- `GET /api/super-admin/rmc-discovery/plants`
- `POST /api/super-admin/rmc-discovery/plants/:id/send-onboarding-invite`
- `PATCH /api/super-admin/rmc-discovery/plants/:id/status`
- `POST /api/super-admin/rmc-discovery/plants/:id/activate`
- `POST /api/super-admin/rmc-discovery/plants/:id/deactivate`

Public/customer-safe:

- `GET /api/public/rmc-plants`
- `POST /api/public/rmc-plants/:id/claim` (authenticated)

Public responses omit review notes, import errors, token hashes, actor IDs, rejection reasons and private documents.

## Super Admin UI

Route: `/rmc-plant-network`

The existing `authority` Command Center exposes **RMC Plant Network**. Tabs include Dashboard, Discover Plants, Review Queue, Onboarding, Active Plants, Inactive Plants, Import History and Market Coverage.

Statewide import requires a warning confirmation. The action disables while a run is active, preventing accidental double submission. Review approval always creates a private draft with `UNCONFIRMED` operation.

## Onboarding and activation

Onboarding tokens are generated with cryptographic randomness; only SHA-256 hashes are stored. Email links expire after 48 hours. Activation requires:

- identity checked
- contact checked
- location checked
- operational confirmation
- authority to receive orders
- delivery radius checked
- an activation reason

Activation writes status history and also synchronizes the existing legacy network visibility fields so current customer screens remain compatible.

## Environment variables

```text
GOOGLE_PLACES_API_KEY=
RMC_IMPORT_MAX_CONCURRENCY=3
RMC_IMPORT_RETRY_LIMIT=3
RMC_IMPORT_MARKET_COOLDOWN_HOURS=168
RMC_IMPORT_MIN_CONFIDENCE_SCORE=45
RMC_DUPLICATE_RADIUS_METERS=200
RMC_IMPORT_MAX_QUERIES_PER_RUN=500
```

`GOOGLE_PLACES_API_KEY` must never use a `VITE_` prefix.

## Google Cloud configuration

Create/update the secret and grant the Cloud Run runtime service account Secret Manager access:

```bash
gcloud secrets create GOOGLE_PLACES_API_KEY --replication-policy=automatic
gcloud secrets versions add GOOGLE_PLACES_API_KEY --data-file=-
gcloud run services update trackmyrmc \
  --region=asia-south1 \
  --update-secrets=GOOGLE_PLACES_API_KEY=GOOGLE_PLACES_API_KEY:latest \
  --update-env-vars=RMC_IMPORT_MAX_CONCURRENCY=3,RMC_IMPORT_RETRY_LIMIT=3,RMC_IMPORT_MARKET_COOLDOWN_HOURS=168,RMC_IMPORT_MIN_CONFIDENCE_SCORE=45,RMC_DUPLICATE_RADIUS_METERS=200,RMC_IMPORT_MAX_QUERIES_PER_RUN=500
```

Use the project’s actual Cloud Run service name when it differs.

## Cost controls

- locality-based scans instead of unbounded statewide text search
- query cap per run
- market cooldown
- bounded concurrency
- narrow field mask
- maximum three retries
- duplicate upsert by Place ID
- paid import restricted to Super Admin
- rate-limited import start endpoint

## Testing

Automated tests mock `fetch`; they never call the real Places API.

```bash
cd server
pnpm install --frozen-lockfile
pnpm build
pnpm test

cd ../rmc-app
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm cap:sync
cd android && ./gradlew assembleDebug
```

Never run server test files directly against an ambient database. Use `pnpm test`, which provisions the repository’s isolated test database.

## Deployment

1. Back up Cloud SQL.
2. Deploy code with the secret/environment configuration.
3. Run `pnpm db:migrate-rmc-discovery` once against production Cloud SQL.
4. Verify `/api/health`.
5. Sign in as `authority` and run one low-cost market import first.
6. Approve a test candidate as Draft and confirm it does not appear publicly.
7. Complete onboarding, activate and verify the plant appears publicly.

## Rollback

1. Hide/deactivate newly published plants through Super Admin.
2. Roll back the Cloud Run revision.
3. New tables and additive columns may remain safely unused.
4. For a full schema rollback, export discovery tables first, remove foreign keys/indexes, then remove additive columns only after confirming no production workflow depends on them.

Do not drop discovery data during an emergency application rollback; hiding the route and reverting the Cloud Run revision is sufficient.
