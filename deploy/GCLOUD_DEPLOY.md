# Deploying CONCRETE KING / TrackMyRMC to Google Cloud

This is a runbook for moving the existing app to **Google Cloud Run + Cloud SQL**
with **zero application code changes**. The repo already contains everything the
build needs; you run the `gcloud` / DNS / billing steps on your Google Cloud
account.

The app is a single deployable service: the Express backend serves both the API
(`/api/*`) and the built React frontend (same origin), so one Cloud Run service
covers the whole web app. The Android app is unaffected — as long as
`trackmyrmc.com` keeps pointing at the (new) backend, the published `.aab` keeps
working.

---

## What's in this package (all new files, no app code touched)

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: installs deps, builds backend + frontend, runs the server. Preserves the monorepo layout the server expects. |
| `.dockerignore` | Keeps the image lean; stops host `node_modules`/build outputs from leaking in. |
| `.gcloudignore` | Same idea for `gcloud`/Cloud Build source uploads. |
| `cloudbuild.yaml` | Build → Artifact Registry → Cloud Run pipeline (single-container / public-IP DB path). |
| `deploy/service.yaml` | Multi-container Cloud Run manifest: app + Cloud SQL Auth Proxy sidecar (the `localhost` DB path). |
| `deploy/env.example` | Every env var the server reads, grouped and annotated. |
| `deploy/GCLOUD_DEPLOY.md` | This runbook. |

---

## Google Cloud services you'll use

- **Cloud Run** — runs the container (the web app + API).
- **Cloud SQL for PostgreSQL** — the database (the app uses the standard `pg`
  driver, so no code change).
- **Artifact Registry** — stores the built container image.
- **Cloud Build** — builds & deploys (optional; you can also build locally).
- **Secret Manager** — holds secrets (JWT, SMTP, WhatsApp, Twilio, VAPID, …).
- **Cloud Storage** — *only needed when you later wire up file uploads* (see
  "Known limitations").

---

## Prerequisites

- A GCP project with **billing enabled** and the `gcloud` CLI installed & logged in.
- Access to **DNS** for `trackmyrmc.com`.
- A **database dump** of the current Postgres data to import into Cloud SQL.
- Enable the APIs:
  ```bash
  gcloud services enable \
    run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
    cloudbuild.googleapis.com secretmanager.googleapis.com
  ```

---

## Step 1 — Cloud SQL (PostgreSQL)

```bash
gcloud sql instances create concreteking-db \
  --database-version=POSTGRES_16 --tier=db-custom-1-3840 --region=asia-south1
gcloud sql databases create trackmyrmc --instance=concreteking-db
gcloud sql users create appuser --instance=concreteking-db --password='STRONG_PASSWORD'
```

Note the **instance connection name** (`PROJECT:REGION:INSTANCE`) — Cloud Run uses it.

**Connecting without a code change.** The app turns TLS *off* only when the
`DATABASE_URL` host is the literal string `localhost`. Pick **one** of these two
paths and keep it consistent — do **not** mix them:

- **Path 1 — Auth Proxy sidecar (recommended, private).** Deploy the multi-container
  manifest `deploy/service.yaml`, which runs the Cloud SQL Auth Proxy on
  `localhost:5432` alongside the app. Then use host `localhost`:
  ```
  DATABASE_URL=postgres://appuser:STRONG_PASSWORD@localhost:5432/trackmyrmc
  ```
  The app connects with TLS off to the local proxy; the proxy encrypts the hop to
  Cloud SQL. The runtime service account needs `roles/cloudsql.client`.

- **Path 2 — Public IP + SSL (simplest).** Give the instance a public IP and use
  that IP as the host; the app negotiates SSL automatically:
  ```
  DATABASE_URL=postgres://appuser:STRONG_PASSWORD@PUBLIC_IP:5432/trackmyrmc
  ```
  This works with the single-container `cloudbuild.yaml` / `gcloud run deploy`.

> Do **not** use Cloud Run's built-in `--add-cloudsql-instances` (it exposes a Unix
> socket at `/cloudsql/INSTANCE`, which does not match the `localhost` TLS-off rule).

**Import your data:**
```bash
# Export from the current DB, then:
gcloud sql import sql concreteking-db gs://YOUR_BUCKET/dump.sql --database=trackmyrmc
```

**Schema (if starting empty):** from a machine with `DATABASE_URL` set to the new
DB, run `cd server && pnpm db:push` (drizzle-kit is included in the image too).

---

## Step 2 — Secrets

Create a secret per sensitive value and grant the Cloud Run service account
access. Example:
```bash
printf '%s' 'YOUR_JWT_SECRET' | gcloud secrets create JWT_SECRET --data-file=-
# repeat for SMTP_PASS, WHATSAPP_META_ACCESS_TOKEN, TWILIO_AUTH_TOKEN, VAPID_PRIVATE_KEY, ...
```
Use `deploy/env.example` as the checklist of what to create. Non-secret config
(URLs, ports, flags) can be plain env vars.

---

## Step 3 — Build & deploy

Choose the deploy style that matches your DB path from Step 1.

**Option A — single container (use with DB Path 2, public IP):**
```bash
gcloud run deploy concreteking \
  --source . \
  --region=asia-south1 \
  --allow-unauthenticated \
  --min-instances=1 \
  --timeout=3600 \
  --set-env-vars=NODE_ENV=production,APP_URL=https://trackmyrmc.com,PUBLIC_URL=https://trackmyrmc.com,CORS_ALLOWED_ORIGINS=https://trackmyrmc.com \
  --set-secrets=JWT_SECRET=JWT_SECRET:latest,SMTP_PASS=SMTP_PASS:latest,DATABASE_URL=DATABASE_URL:latest
```
(Extend `--set-env-vars` / `--set-secrets` with the rest from `deploy/env.example`.)
The `cloudbuild.yaml` pipeline (`gcloud builds submit --config cloudbuild.yaml`)
does the same build → push → deploy; attach env/secrets to the service afterward.

**Option B — sidecar (use with DB Path 1, `localhost`):** build & push the image
(steps 1–2 of `cloudbuild.yaml`, or `gcloud builds submit`), then edit
`deploy/service.yaml` (image tag, project, service account, env/secrets) and apply:
```bash
gcloud run services replace deploy/service.yaml --region=asia-south1
```
The manifest already sets `minScale=1`, `timeoutSeconds=3600`, and the Cloud SQL
Auth Proxy sidecar.

### Two settings that matter for THIS app
- **`--min-instances=1`** — the recurring scheduler (automations/reminders) runs on
  an in-process loop. If the service scales to zero, that loop stops. Keep at least
  one warm instance, **or** move the trigger to Cloud Scheduler hitting an endpoint.
- **`--timeout=3600`** — live updates use long-lived **SSE** connections; the
  default 5-minute request timeout would cut them off. 3600s (max) is safest.

Port is automatic: Cloud Run injects `PORT=8080` and the server already reads it.

---

## Step 4 — Domain & TLS

```bash
gcloud run domain-mappings create --service=concreteking \
  --domain=trackmyrmc.com --region=asia-south1
```
Add the DNS records it prints. Google provisions a managed TLS certificate
automatically. Repeat for `www.` if you use it, and keep both in
`CORS_ALLOWED_ORIGINS`.

---

## Step 5 — Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://trackmyrmc.com/api/health   # expect 200
```
Then smoke-test: login (email + OTP), place an order, live tracking (SSE),
notifications/email. If email/WhatsApp/Maps misbehave, re-check their env values.

---

## Known limitations (the "no code change" boundary)

These two features are wired to the Replit environment and need a small,
**deferred** code change to work fully on GCP. Everything else runs unchanged.

1. **File uploads / photos (proof photos, bills, attachments).** The object-storage
   layer fetches GCS credentials from a Replit sidecar at `127.0.0.1:1106`
   (hardcoded, not configurable via env). Off Replit this endpoint doesn't exist,
   so uploads/serving won't work until that layer is repointed at a real Cloud
   Storage bucket + service account. When you're ready, this is a focused change to
   `server/src/replit_integrations/object_storage/` only.
2. **AI Help Agent (Gemini).** Its endpoint and key ARE env-configurable
   (`AI_INTEGRATIONS_GEMINI_BASE_URL`, `AI_INTEGRATIONS_GEMINI_API_KEY`), so it may
   work with a real Google AI Studio key pointed at the native `generateContent`
   endpoint — test it. If left unset, the feature simply stays disabled and nothing
   else is affected.

All other integrations (Google Maps/Places, WhatsApp via Meta, Twilio SMS, SMTP
email) are configured purely through env vars and carry over as-is.
