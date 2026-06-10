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
