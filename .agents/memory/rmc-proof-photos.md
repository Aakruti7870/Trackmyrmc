---
name: RMC proof-of-delivery photos
description: How multi-photo proof-of-delivery is modeled and served in the RMC app
---

Proof-of-delivery photos are a one-to-many child table `challan_proof_photos`
(challanId FK ON DELETE cascade, photo text, createdAt), NOT an array column.

**Why:** a delivery can have multiple photos; child table keeps each row small
and lets list endpoints avoid shipping base64 payloads.

**How to apply:**
- Driver PUT /challans/:id accepts `proofPhotos: string[]` (new) AND legacy
  single `proofPhoto` (validateProofPhotos merges them). null/empty clears all.
  Cap MAX_PROOF_PHOTOS=8, 8MB each. Replace child rows inside a db.transaction.
- List selects expose only `hasProofPhoto` (an EXISTS subquery) — never the
  base64. Detail GET returns the full `proofPhotos` array. SSE/response carry
  only the hasProofPhoto flag.
- Frontend Challan type uses `proofPhotos?: string[]`. Optimistic updates must
  read `hasProofPhoto`, not a photo field.
