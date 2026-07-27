# RMC Plant Discovery — Staging Verification Checklist

This checklist is for the staging Google Cloud project only. Do not run it against production until PR #5 is merged, CI is green, and staging validation is signed off.

## Variables

```bash
export PROJECT_ID="trackmyrmc-production"              # replace with staging project ID
export REGION="asia-south1"
export SERVICE="trackmyrmc-staging"                    # replace with staging Cloud Run service
export INSTANCE="trackmyrmc-prod-db"                   # replace with staging Cloud SQL instance
export DATABASE="trackmyrmc"
export DB_USER="postgres"                              # replace when different
export REPO_DIR="$HOME/Trackmyrmc"
```

## 1. Select the staging project

```bash
gcloud config set project "$PROJECT_ID"
gcloud auth list
gcloud config get-value project
```

Confirm the printed project is the staging project before continuing.

## 2. Capture pre-migration counts

Connect through Cloud SQL Auth Proxy in terminal 1:

```bash
cloud-sql-proxy "$PROJECT_ID:$REGION:$INSTANCE" --port 5433
```

In terminal 2:

```bash
export DATABASE_URL="postgresql://$DB_USER:<STAGING_DB_PASSWORD>@127.0.0.1:5433/$DATABASE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS rmc_discovery_migration_baseline (
  captured_at timestamptz NOT NULL DEFAULT now(),
  total_plants integer NOT NULL,
  legacy_approved integer NOT NULL,
  legacy_customer_visible integer NOT NULL
);
INSERT INTO rmc_discovery_migration_baseline(total_plants, legacy_approved, legacy_customer_visible)
SELECT
  count(*)::int,
  count(*) FILTER (WHERE plant_status = 'approved' OR verified = true)::int,
  count(*) FILTER (
    WHERE show_on_network = true
      AND (network_status = 'active' OR (plant_status = 'approved' AND is_active = true AND location_verified = true AND verified = true))
  )::int
FROM plants;
TABLE rmc_discovery_migration_baseline ORDER BY captured_at DESC LIMIT 1;
SQL
```

Expected baseline: one row. Record the three numbers in the staging evidence ticket.

## 3. Back up the affected tables

```bash
gcloud sql export sql "$INSTANCE" "gs://<STAGING_BACKUP_BUCKET>/rmc-discovery-pre-migration-$(date +%Y%m%d-%H%M%S).sql" \
  --database="$DATABASE" \
  --table=plants,users \
  --offload
```

Also take an on-demand Cloud SQL backup:

```bash
gcloud sql backups create --instance="$INSTANCE" --description="Before PR5 RMC discovery migration"
```

## 4. Apply the migration

```bash
cd "$REPO_DIR/server"
pnpm install --frozen-lockfile
DATABASE_URL="$DATABASE_URL" pnpm db:migrate-rmc-discovery
```

Migration filename:

```text
server/src/db/migrate-rmc-discovery.ts
```

Repeatability check — run the same command a second time:

```bash
DATABASE_URL="$DATABASE_URL" pnpm db:migrate-rmc-discovery
```

The second run must complete without duplicate-column, duplicate-index, duplicate-constraint, or duplicate-seed errors.

## 5. Verify schema and backfill counts

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'plants'
  AND column_name IN (
    'google_place_id','locality','district','state','postal_code',
    'operational_status','onboarding_status','publication_status',
    'verification_level','source','candidate_id','owner_user_id',
    'approved_by_user_id','approved_at','activated_by_user_id','activated_at'
  )
ORDER BY column_name;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'rmc_market_areas','rmc_plant_candidates','rmc_plant_import_runs',
    'rmc_plant_import_queries','rmc_plant_status_history',
    'rmc_plant_onboarding_invites'
  )
ORDER BY table_name;

WITH baseline AS (
  SELECT * FROM rmc_discovery_migration_baseline ORDER BY captured_at DESC LIMIT 1
), current_counts AS (
  SELECT
    count(*)::int AS total_plants,
    count(*) FILTER (WHERE onboarding_status = 'APPROVED')::int AS approved_after,
    count(*) FILTER (
      WHERE onboarding_status = 'APPROVED'
        AND publication_status = 'PUBLISHED'
        AND is_active = true
        AND operational_status IN ('ACCEPTING_ORDERS','BUSY','LIMITED_CAPACITY')
    )::int AS customer_visible_after
  FROM plants
)
SELECT
  b.total_plants AS expected_total_plants,
  c.total_plants AS actual_total_plants,
  b.legacy_approved AS minimum_expected_approved_after,
  c.approved_after,
  b.legacy_customer_visible AS expected_customer_visible_after,
  c.customer_visible_after,
  (b.total_plants = c.total_plants) AS plant_count_preserved,
  (c.approved_after >= b.legacy_approved) AS approved_backfill_preserved,
  (b.legacy_customer_visible = c.customer_visible_after) AS customer_visibility_preserved
FROM baseline b CROSS JOIN current_counts c;

SELECT onboarding_status, publication_status, operational_status, verification_level, count(*)
FROM plants
GROUP BY 1,2,3,4
ORDER BY 1,2,3,4;

SELECT count(*) AS seeded_markets FROM rmc_market_areas;
SQL
```

Expected results:

- `actual_total_plants = expected_total_plants`.
- `plant_count_preserved = true`.
- `approved_backfill_preserved = true`.
- `customer_visibility_preserved = true`.
- No existing plant row is deleted.
- Existing customer-visible TrackMyRMC plants remain visible under the new four-field contract.
- The seeded market count equals the number of entries in `MAHARASHTRA_RMC_MARKETS` at the tested commit.

## 6. Verify no destructive SQL

```bash
git grep -nE '\b(DROP TABLE|TRUNCATE|DELETE FROM plants|ALTER TABLE plants DROP|UPDATE plants SET .*NULL)\b' \
  -- server/src/db/migrate-rmc-discovery.ts docs/RMC_PLANT_DISCOVERY_ROLLBACK.sql
```

The migration must not contain destructive operations. The rollback file is intentionally separate and must not be run during normal deployment.

## 7. Configure Secret Manager

Secret name:

```text
GOOGLE_PLACES_API_KEY
```

Value format: the raw Google Cloud API key only, for example:

```text
AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Do not include quotes, JSON, `GOOGLE_PLACES_API_KEY=`, whitespace, or a `VITE_` prefix.

Create the secret once:

```bash
printf '%s' '<RAW_GOOGLE_PLACES_API_KEY>' | \
  gcloud secrets create GOOGLE_PLACES_API_KEY \
    --replication-policy=automatic \
    --data-file=-
```

When the secret already exists, add a version:

```bash
printf '%s' '<RAW_GOOGLE_PLACES_API_KEY>' | \
  gcloud secrets versions add GOOGLE_PLACES_API_KEY --data-file=-
```

Grant the Cloud Run runtime service account access:

```bash
export RUNTIME_SA="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(spec.template.spec.serviceAccountName)')"
[ -n "$RUNTIME_SA" ] || export RUNTIME_SA="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding GOOGLE_PLACES_API_KEY \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor"
```

## 8. Update the staging Cloud Run service

District and Maharashtra scopes are disabled by default. Keep `RMC_IMPORT_ENABLE_BULK_SCOPES=false` for the first staging test.

```bash
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --update-secrets=GOOGLE_PLACES_API_KEY=GOOGLE_PLACES_API_KEY:latest \
  --update-env-vars=RMC_IMPORT_MAX_CONCURRENCY=1,RMC_IMPORT_RETRY_LIMIT=2,RMC_IMPORT_MARKET_COOLDOWN_HOURS=168,RMC_IMPORT_MIN_CONFIDENCE_SCORE=45,RMC_DUPLICATE_RADIUS_METERS=200,RMC_IMPORT_MAX_QUERIES_PER_RUN=8,RMC_IMPORT_ENABLE_BULK_SCOPES=false
```

Verify the effective configuration:

```bash
gcloud run services describe "$SERVICE" --region="$REGION" --format=yaml \
  | sed -n '/env:/,/resources:/p'
```

## 9. Obtain an authority token

Use the staging Super Admin account in the UI, open browser developer tools, and copy the Bearer token used by an authenticated `/api/me` request.

```bash
export STAGING_URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
export AUTHORITY_TOKEN='<STAGING_AUTHORITY_JWT>'
```

Never store the token in Git or shell history on a shared computer.

## 10. Find the first low-cost market ID

Panvel is the recommended first market because it is the primary operating area and is a non-MIDC market, producing six queries.

```bash
curl -fsS \
  -H "Authorization: Bearer $AUTHORITY_TOKEN" \
  "$STAGING_URL/api/super-admin/rmc-discovery/markets?district=Raigad" \
  | jq '.[] | select(.marketName == "Panvel") | {id,marketName,district,nextScanEligibleAt}'
```

Set the returned ID:

```bash
export MARKET_ID='<PANVEL_MARKET_ID>'
```

## 11. Start exactly one low-cost market import

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $AUTHORITY_TOKEN" \
  -H 'Content-Type: application/json' \
  "$STAGING_URL/api/super-admin/rmc-discovery/import" \
  --data "{\"scope\":\"MARKET\",\"marketAreaIds\":[$MARKET_ID],\"district\":null}" \
  | tee /tmp/rmc-first-import.json
```

Capture the run ID:

```bash
export IMPORT_RUN_ID="$(jq -r '.importRunId' /tmp/rmc-first-import.json)"
```

Monitor:

```bash
watch -n 5 "curl -fsS -H 'Authorization: Bearer $AUTHORITY_TOKEN' '$STAGING_URL/api/super-admin/rmc-discovery/import-runs/$IMPORT_RUN_ID' | jq"
```

## 12. First-import cost and record guardrails

For the Panvel non-MIDC test:

- Maximum generated queries: `6`.
- Google page size requested: `20`.
- The code follows pagination when Google returns a page token.
- First staging service limit: `RMC_IMPORT_MAX_QUERIES_PER_RUN=8`.
- Concurrency: `1`.
- Retry limit: `2`; retries occur only after transient `429` or `5xx`/network failures.
- Import endpoint rate limit: maximum `5` starts per minute, while the database also allows only one queued/running import.
- Market cooldown: `168` hours after completion.
- Candidate table is unique by Google Place ID, so repeat results update rather than multiply records.
- The Google Places API price is determined by the Google Cloud billing SKU and requested fields at execution time. Before running, inspect the current Google Maps Platform pricing page and the project quota dashboard. Do not enter a fixed rupee estimate in approval records because Google can change SKU prices.
- For the first run, set a project quota/budget alert appropriate to six Text Search queries plus possible pagination/retries.

Maximum candidate rows newly inserted by the first import cannot exceed the number of unique Place IDs returned across those six searches. With the API request page size of 20, a single page per query gives an upper observation bound of 120 raw results before Place-ID deduplication. Pagination can increase raw results, so the persisted import counters are the authoritative record. `RMC_IMPORT_MAX_QUERIES_PER_RUN` limits queries, not Google results.

## 13. Validate private-candidate behavior

```bash
curl -fsS \
  -H "Authorization: Bearer $AUTHORITY_TOKEN" \
  "$STAGING_URL/api/super-admin/rmc-discovery/candidates?limit=100&reviewed=false" \
  | jq 'map({id,discoveredName,discoveryStatus,confidenceScore,googlePlaceId})'

curl -fsS "$STAGING_URL/api/public/rmc-plants?radiusKm=250" | jq
```

Expected: candidates exist only in the Super Admin queue. None appears publicly until approved, onboarded, activated and published.

## 14. Confirm bulk scopes remain disabled

```bash
curl -i -X POST \
  -H "Authorization: Bearer $AUTHORITY_TOKEN" \
  -H 'Content-Type: application/json' \
  "$STAGING_URL/api/super-admin/rmc-discovery/import" \
  --data '{"scope":"DISTRICT","marketAreaIds":[],"district":"Raigad"}'

curl -i -X POST \
  -H "Authorization: Bearer $AUTHORITY_TOKEN" \
  -H 'Content-Type: application/json' \
  "$STAGING_URL/api/super-admin/rmc-discovery/import" \
  --data '{"scope":"MAHARASHTRA","marketAreaIds":[],"district":null}'
```

Expected: both return a non-2xx response until `RMC_IMPORT_ENABLE_BULK_SCOPES=true` is deliberately applied.

## 15. Rollback

Preferred rollback before any candidate approval is application rollback plus the provided database rollback script.

1. Stop imports and prevent new requests:

```bash
gcloud run services update "$SERVICE" --region="$REGION" \
  --update-env-vars=RMC_IMPORT_ENABLE_BULK_SCOPES=false,RMC_IMPORT_MAX_QUERIES_PER_RUN=1
```

2. Cancel any queued/running import through the Admin UI or API.

3. Roll back the Cloud Run revision:

```bash
gcloud run revisions list --service="$SERVICE" --region="$REGION"
gcloud run services update-traffic "$SERVICE" --region="$REGION" --to-revisions='<PREVIOUS_REVISION>=100'
```

4. Run the repository rollback only after confirming no approved RMC-discovery plant must be retained:

```bash
cd "$REPO_DIR"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/RMC_PLANT_DISCOVERY_ROLLBACK.sql
```

5. For a complete database restore, use the on-demand Cloud SQL backup instead of partial SQL rollback:

```bash
gcloud sql backups list --instance="$INSTANCE"
gcloud sql backups restore '<BACKUP_ID>' --restore-instance="$INSTANCE"
```

Cloud SQL restore replaces the target instance state and therefore requires an explicit maintenance decision.

## Sign-off evidence

Attach:

- CI run links and conclusions.
- Migration command output from both runs.
- Baseline/backfill verification query output.
- Cloud SQL backup ID.
- Cloud Run revision name.
- Effective environment-variable output with secret values redacted.
- First import JSON and final run counters.
- Review Queue screenshot from the real staging deployment.
- Customer result before approval, after activation, and after deactivation.

Do not fabricate screenshots or candidate data.
