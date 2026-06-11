---
name: RMC proof-photo object storage
description: How delivery proof photos are stored/served via object storage, and the testability + serving constraints behind the design.
---

# Proof-of-delivery photos use object storage, served via signed URLs

Proof photos are uploaded to Replit object storage; the `challans.proof_photo`
column stores only an entity path (`/objects/uploads/<uuid>`), never base64.

**Serving:** the app uses Bearer-token auth, so an `<img src>` cannot carry the
token. Do NOT expose the blueprint's unauthenticated `GET /objects/:path(*)`
route — it would leak private photos. Instead the already-authenticated
`GET /api/challans/:id` resolves the stored path to a short-lived **signed GCS
GET URL** that the browser loads directly. The list endpoint still returns only
`hasProofPhoto`.

**Why signed URLs:** self-authenticating + time-limited, so no token needed on
the image request and the bucket stays private.

**Transition:** `proofPhotoStore.resolve()` passes legacy `data:image/...`
values through unchanged, so pre-migration rows still render. No bulk migration
was run (task allowed "remain viewable").

**Driver upload path (presigned direct upload):** drivers no longer POST base64
through the API. MyTrips requests a presigned PUT URL from
`POST /api/challans/proof-upload-url`, PUTs the blob straight to object storage,
then sends only the `/objects/...` path to `PUT /api/challans/:id`. The driver
PUT branch accepts EITHER an object path (validated via `isObjectStoragePath`,
existence-checked with `proofPhotoStore.verifyExists()` → 400 if missing) OR a
legacy base64 data URL (uploaded server-side via `store()` as before). Tests that
exercise the base64 branch but assert the persisted value must stub
`proofPhotoStore.store` to identity, else the live sidecar rewrites it to an
object path and the assertion mismatches.

**Integration must live under `server/src/`** — server `tsconfig.json` sets
`rootDir: ./src` + `include: ["src/**/*"]`, so the blueprint's default
`server/replit_integrations/` (outside src) breaks `tsc`. Files were moved to
`server/src/replit_integrations/object_storage/`.

**Testability:** `proofPhotoStore` (in `server/src/lib/proofPhoto.ts`) is a
single exported mutable object with `store`/`resolve`. Tests stub it in place
with `t.mock.method(proofPhotoStore, 'store', ...)`. This avoids the ESM
import-ordering trap of `mock.module` (the route already imported the module
before any top-level mock runs); patching methods on a shared object identity
works regardless of import order and needs no sidecar.

## Object cleanup on delete & env-dependent PUT tests
- Deleting a challan must also delete its object-storage proof files (collect /objects/ paths before the row delete, then best-effort remove via proofPhotoStore.remove + Promise.allSettled). FK cascade only drops the child rows, not the bucket objects.
- proofPhotoStore.remove()/ObjectStorageService.deleteObjectEntity() are idempotent (file.delete ignoreNotFound) and skip legacy base64 (no separate object).
- WATCH OUT: two driver PUT tests ("replaces an existing proof photo", "omits proof-photo fields leaves an existing stored photo untouched") do NOT mock store() and assert the child table holds raw base64. They PASS only when object storage is unconfigured; with PRIVATE_OBJECT_DIR set, real store() returns an /objects/ path and they FAIL. Pre-existing/env-dependent, not a regression.

## Dev DB can be missing challan_proof_photos (Bad gateway crash)
- Symptom: preview shows "Bad gateway"; Backend API crashes on boot with `relation "challan_proof_photos" does not exist` (42P01) at the first /api/challans query — an unhandled DB error kills the Node process so vite proxy gets ECONNREFUSED on :3001.
- Tests stay green because `pnpm test` provisions an isolated `<db>_test` and pushes schema; only the real dev DB drifts (post-merge `drizzle-kit push` can fail).
- Fix WITHOUT data loss: do NOT `pnpm db:push` non-interactively — it aborts on a TTY prompt because it also wants to DROP the legacy `proof_photo` column (data-loss). Instead create the table manually (`CREATE TABLE IF NOT EXISTS challan_proof_photos ...` per schema), then run `pnpm db:migrate-proof-photos`, then restart Backend API.
