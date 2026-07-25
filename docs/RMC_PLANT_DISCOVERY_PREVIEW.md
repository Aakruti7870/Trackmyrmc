# RMC Plant Network UI Preview and Test Instructions

The implemented Super Admin route is:

```text
/rmc-plant-network
```

It is available only to the existing `authority` role. Runtime screenshots must come from a real staging deployment connected to the migrated staging database. Mock screenshots and fabricated Google results are not acceptable.

## Screen structure

The page contains these views:

- Dashboard metric cards
- Discover Plants
- Review Queue
- Onboarding
- Active Plants
- Inactive Plants
- Import History
- Market Coverage

The implementation uses the existing TrackMyRMC layout, cards, theme tokens, typography, buttons, responsive grids and mobile overflow behavior.

## Admin test prerequisites

- PR #5 CI is green.
- Staging Cloud SQL migration has completed twice successfully.
- `GOOGLE_PLACES_API_KEY` is configured as a Cloud Run secret.
- `RMC_IMPORT_ENABLE_BULK_SCOPES=false`.
- The tester is signed in as `authority`.
- The first test uses one non-MIDC market only.

Follow `docs/RMC_PLANT_DISCOVERY_STAGING.md` for exact commands.

## Admin testing — access and permissions

1. Sign in with the staging Super Admin account.
2. Open the Command Center.
3. Confirm the **RMC Plant Network** entry is present.
4. Open `/rmc-plant-network` directly.
5. Confirm the page loads without a permission error.
6. Sign in as a plant owner, plant-bound admin, dispatcher and customer.
7. Attempt to open `/rmc-plant-network` for each non-authority role.
8. Confirm each user is redirected or receives an authorization error.
9. Call one Super Admin API with a non-authority token and confirm HTTP `403`.

## Admin testing — Dashboard

1. Open the Dashboard tab.
2. Record the displayed values for total candidates, high-confidence candidates, pending review, approved plants, onboarding pending, active plants, temporarily closed plants, rejected candidates, possible duplicates and district coverage.
3. Compare the counts with the corresponding API response:

```text
GET /api/super-admin/rmc-discovery/dashboard
```

4. Confirm the last import status and counters match the Import History record.

## Admin testing — Discover Plants

1. Open **Discover Plants**.
2. Confirm Market is the safe initial scope.
3. Confirm district-wide and Maharashtra-wide imports are unavailable or rejected while `RMC_IMPORT_ENABLE_BULK_SCOPES=false`.
4. Select the Panvel market.
5. Start the import once.
6. Confirm the API returns an `importRunId` without waiting for all Google calls.
7. Confirm the start button cannot create a second queued/running import.
8. Watch the query progress and counters update.
9. Confirm the run records total queries, completed queries, raw results, inserted candidates, updated candidates, duplicates, rejected candidates and errors.
10. Confirm the completed market receives a cooldown timestamp.
11. Attempt the same market again and confirm cooldown enforcement.

## Admin testing — Review Queue

1. Open **Review Queue** after the first import completes.
2. Confirm Google-listed records appear only here and not in customer discovery.
3. Search by plant name and address.
4. Filter by confidence threshold.
5. Open a candidate.
6. Confirm the detail view includes:
   - discovered name
   - address/locality/district
   - Google Place ID
   - Google business status
   - confidence score
   - stored confidence reasons
   - possible duplicate plant ID
   - nearby existing plants
   - Google Maps link when supplied
7. Open the Google Maps link and compare the business identity and coordinates.
8. Edit an incorrect locality, district, address or coordinate and save.
9. Reject a non-RMC result and provide a reason.
10. Confirm it leaves the pending queue and appears as rejected.
11. Mark a confirmed duplicate and link the existing plant ID.
12. Confirm duplicate candidates cannot be approved as new plants.
13. Approve one valid candidate as a draft.
14. Confirm approval creates a plant with:

```text
verificationLevel = GOOGLE_LISTED
onboardingStatus = NOT_INVITED
publicationStatus = DRAFT
operationalStatus = UNCONFIRMED
isActive = false
```

15. Confirm that plant still does not appear in Find RMC Plants.

## Admin testing — Onboarding

1. Open **Onboarding**.
2. Locate the approved Google-listed draft.
3. Send an onboarding invitation to a staging email address.
4. Confirm the UI reports the invite status and expiration.
5. Confirm the database stores only the token hash, not the raw token.
6. Open the invite email and verify that the link points to the staging application.
7. Submit the claim/onboarding form using staging-only business data.
8. Confirm the plant moves to `CLAIM_PENDING` or the expected review state.
9. Confirm claim submission forces:

```text
publicationStatus = DRAFT
isActive = false
```

10. Review identity, GST, contact, address, location, delivery radius and operational details.
11. Approve onboarding.
12. Confirm the plant reaches `APPROVED` but remains absent from customer discovery until separately activated and published.

## Admin testing — activation

1. Select the approved onboarding record.
2. Start activation.
3. Confirm activation requires all explicit confirmations:
   - identity checked
   - contact checked
   - location checked
   - operational status checked
   - authority to receive orders checked
   - delivery radius checked
4. Confirm a reason is mandatory.
5. Confirm activation is rejected when onboarding is not `APPROVED`.
6. Confirm activation is rejected when delivery radius is missing or invalid.
7. Activate with `ACCEPTING_ORDERS` and `TRACKMYRMC_REGISTERED`.
8. Confirm the resulting status is:

```text
onboardingStatus = APPROVED
publicationStatus = PUBLISHED
isActive = true
operationalStatus = ACCEPTING_ORDERS
verificationLevel = TRACKMYRMC_REGISTERED
```

9. Confirm the existing legacy visibility fields are synchronized for compatibility.
10. Check the audit log and RMC plant status history for actor, previous state, new state, reason and timestamp.

## Admin testing — Publish and Unpublish

1. Confirm a draft plant cannot become customer-visible merely by changing one status field.
2. Publish only through the guarded activation flow.
3. Change an active plant to `BUSY`; confirm it remains visible.
4. Change it to `LIMITED_CAPACITY`; confirm it remains visible.
5. Deactivate/unpublish it with a reason.
6. Confirm deactivation sets `isActive=false` and removes it from customer discovery immediately.
7. Confirm the status history records the transition.
8. Reactivate only after repeating the required confirmations.

## Admin testing — existing TrackMyRMC plants

1. Before migration, record all currently customer-visible plant IDs.
2. After migration, run the backfill verification query in `docs/RMC_PLANT_DISCOVERY_STAGING.md`.
3. Confirm the total plant count is unchanged.
4. Confirm every previously customer-visible plant remains visible.
5. Confirm no existing plant name, GST number, phone number, coordinates, grades, delivery radius or ownership field was deleted.
6. Open existing plant order flows and confirm customer ordering still works.

## Customer testing — visibility contract

Use a customer account and the public/customer discovery APIs.

A plant must appear only when all conditions are true:

```text
onboardingStatus = APPROVED
publicationStatus = PUBLISHED
isActive = true
operationalStatus ∈ {ACCEPTING_ORDERS, BUSY, LIMITED_CAPACITY}
```

Test matrix:

| Onboarding | Publication | Active | Operational | Expected |
|---|---|---:|---|---|
| NOT_INVITED | DRAFT | false | UNCONFIRMED | Hidden |
| APPROVED | DRAFT | false | UNCONFIRMED | Hidden |
| APPROVED | PUBLISHED | false | ACCEPTING_ORDERS | Hidden |
| APPROVED | HIDDEN | true | ACCEPTING_ORDERS | Hidden |
| ADMIN_REVIEW | PUBLISHED | true | ACCEPTING_ORDERS | Hidden |
| APPROVED | PUBLISHED | true | MAINTENANCE | Hidden |
| APPROVED | PUBLISHED | true | TEMPORARILY_CLOSED | Hidden |
| APPROVED | PUBLISHED | true | PERMANENTLY_CLOSED | Hidden |
| APPROVED | PUBLISHED | true | ACCEPTING_ORDERS | Visible |
| APPROVED | PUBLISHED | true | BUSY | Visible |
| APPROVED | PUBLISHED | true | LIMITED_CAPACITY | Visible |

## Customer testing — Find RMC Plants

1. Sign in as a customer.
2. Open **Find Plants** before the candidate is approved.
3. Confirm the Google-listed candidate is absent.
4. Approve it as a draft and refresh.
5. Confirm it is still absent.
6. Approve onboarding and refresh.
7. Confirm it is still absent.
8. Activate and publish it.
9. Refresh Find Plants.
10. Confirm it appears with the correct name, address, coordinates, grades, delivery radius, operational status and verification label.
11. Confirm the displayed source distinction is one of:
    - `GOOGLE_LISTED`
    - `TRACKMYRMC_REGISTERED`
    - `TRACKMYRMC_VERIFIED`
12. Confirm no Admin notes, confidence reasons, rejection reasons, candidate IDs, invitation hashes or internal actor IDs are returned.
13. Set the plant to `BUSY` and confirm it remains listed.
14. Set it to `LIMITED_CAPACITY` and confirm it remains listed.
15. Set it to `MAINTENANCE` and confirm it disappears.
16. Deactivate/unpublish and confirm it disappears immediately.
17. Restore it through the guarded activation flow and confirm it returns.

## Customer testing — ordering compatibility

1. Select an existing TrackMyRMC verified plant.
2. Place a staging order.
3. Confirm plant selection, grades and delivery-radius behavior are unchanged.
4. Confirm the order is routed to the selected existing plant.
5. Repeat with the newly activated staging plant.
6. Confirm a draft, hidden or inactive plant cannot be selected through direct API manipulation.

## API evidence to capture

Capture redacted outputs from:

```text
GET  /api/super-admin/rmc-discovery/dashboard
GET  /api/super-admin/rmc-discovery/import-runs/:id
GET  /api/super-admin/rmc-discovery/candidates/:id
GET  /api/super-admin/rmc-discovery/plants
GET  /api/public/rmc-plants
GET  /api/plants/nearby
GET  /api/plants/directory
```

For each public response, confirm private fields are absent.

## Real screenshot evidence required before production

Capture only from the actual staging deployment:

1. RMC Plant Network Dashboard.
2. Single-market import in progress.
3. Completed import counters.
4. Review Queue candidate detail with sensitive information redacted.
5. Approved private draft absent from customer discovery.
6. Onboarding status screen.
7. Activation confirmation screen.
8. Active plant visible to customer.
9. Deactivated plant absent from customer results.
10. Existing TrackMyRMC plant still available for ordering.

Do not fabricate runtime screenshots, Google businesses, CI results or database counts.
