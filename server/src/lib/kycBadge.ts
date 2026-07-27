import { sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';

// Trust-badge predicates shared by the order/client/plant listing routes.
//
// A CUSTOMER counts as KYC-verified when any live login account linked to the
// client record has either completed Aadhaar eKYC (users.kyc_status='verified')
// or holds an verified enterprise KYC profile. Evaluated as an EXISTS subquery
// so list endpoints can project it without extra round-trips.
//
// NOTE: the correlated column is written as a fully-qualified raw identifier
// ("clients"."id"). Interpolating the drizzle column object here renders the
// UNQUALIFIED "id", which inside the subquery silently resolves to users.id
// and makes the predicate always-false. Callers must therefore select FROM
// (or JOIN) the clients table un-aliased.
export function clientKycVerifiedSql(): SQL<boolean> {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM users u
    WHERE u.linked_client_id = "clients"."id"
      AND u.deleted_at IS NULL
      AND (
        u.kyc_status = 'verified'
        OR EXISTS (
          SELECT 1 FROM kyc_profiles kp
          WHERE kp.user_id = u.id AND kp.status IN ('verified', 'approved')
        )
      )
  )`;
}

// A PLANT earns the "GST & PAN Verified" badge when an VERIFIED KYC profile is
// scoped to it and that profile carries BOTH a GST and a PAN — either as a
// recorded number or an uploaded document. Returns the set of qualifying plant
// ids in one query so the JS-mapped plant listing routes can flag rows cheaply.
export async function getGstPanVerifiedPlantIds(): Promise<Set<number>> {
  const rows = await db.execute(sql`
    SELECT DISTINCT kp.plant_id AS plant_id
    FROM kyc_profiles kp
    WHERE kp.status IN ('verified', 'approved')
      AND kp.plant_id IS NOT NULL
      AND (
        (kp.gst_number IS NOT NULL AND kp.gst_number <> '')
        OR EXISTS (SELECT 1 FROM kyc_documents kd WHERE kd.profile_id = kp.id AND kd.doc_type = 'gst')
      )
      AND (
        (kp.pan_number IS NOT NULL AND kp.pan_number <> '')
        OR EXISTS (SELECT 1 FROM kyc_documents kd WHERE kd.profile_id = kp.id AND kd.doc_type = 'pan')
      )
  `);
  const out = new Set<number>();
  for (const r of rows.rows as { plant_id: number }[]) out.add(Number(r.plant_id));
  return out;
}
