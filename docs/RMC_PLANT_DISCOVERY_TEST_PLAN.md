# RMC Plant Discovery Acceptance Test Plan

## Super Admin

1. Sign in with an `authority` account and open `/rmc-plant-network`.
2. Confirm non-authority roles are redirected and receive no API data.
3. Start a single-market import and verify an `importRunId` is returned immediately.
4. Verify progress updates without keeping the start request open.
5. Start the same scope again while active and confirm HTTP 409.
6. Confirm permanently closed, missing-coordinate and low-score results do not enter the review queue.
7. Confirm a repeated Google Place ID updates one candidate instead of inserting another.
8. Review confidence reasons and nearby possible duplicates.
9. Approve a valid candidate and verify the plant is `DRAFT`, `UNCONFIRMED`, `NOT_INVITED`, `GOOGLE_LISTED`, and inactive.
10. Confirm the draft is absent from `/api/public/rmc-plants` and customer Find Plants.
11. Send an onboarding invite; confirm only a token hash is persisted.
12. Set onboarding to `APPROVED` after verification.
13. Activate with all six confirmations and an audit reason.
14. Confirm status history and platform audit records exist.
15. Deactivate the plant and verify it disappears publicly immediately.

## Customer

1. Call `/api/public/rmc-plants` before activation and confirm the draft is absent.
2. After activation, confirm the plant appears with the correct source badge.
3. Verify directions and details use the reviewed plant coordinates.
4. Confirm order actions appear only for `ACCEPTING_ORDERS`, `BUSY`, or `LIMITED_CAPACITY`.
5. Change status to `MAINTENANCE`, `TEMPORARILY_CLOSED`, `PERMANENTLY_CLOSED`, `DRAFT`, or `HIDDEN` and verify the listing disappears.
6. Confirm no review notes, import errors, invite hashes, actor IDs or rejection reasons are returned.
