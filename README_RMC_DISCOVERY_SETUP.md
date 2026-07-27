# RMC Plant Discovery Setup

The Maharashtra RMC Plant Discovery and Super Admin onboarding documentation is maintained at [`docs/RMC_PLANT_DISCOVERY.md`](docs/RMC_PLANT_DISCOVERY.md).

Quick setup:

```bash
cd server
pnpm install --frozen-lockfile
pnpm db:migrate-rmc-discovery
pnpm build
pnpm test
```

Configure `GOOGLE_PLACES_API_KEY` as a backend-only Google Cloud Secret Manager secret and attach it to the Cloud Run service. Never expose it through a `VITE_` variable.
