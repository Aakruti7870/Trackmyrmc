import { sql, type SQL } from 'drizzle-orm';

/** Authoritative name projection for queries joined to the unaliased clients table. */
export function resolvedClientNameSql(): SQL<string> {
  return sql<string>`coalesce(
    (SELECT nullif(trim(kv.full_name), '')
       FROM users identity_user JOIN kyc_verifications kv ON kv.user_id = identity_user.id
      WHERE identity_user.linked_client_id = "clients"."id"
        AND identity_user.deleted_at IS NULL AND identity_user.kyc_status = 'verified'
        AND kv.status = 'verified' AND nullif(trim(kv.full_name), '') IS NOT NULL
      ORDER BY kv.completed_at DESC NULLS LAST, kv.id DESC LIMIT 1),
    (SELECT nullif(trim(kp.legal_name), '')
       FROM users identity_user JOIN kyc_profiles kp ON kp.user_id = identity_user.id
      WHERE identity_user.linked_client_id = "clients"."id"
        AND identity_user.deleted_at IS NULL AND kp.status IN ('verified', 'approved')
        AND nullif(trim(kp.legal_name), '') IS NOT NULL
      ORDER BY kp.reviewed_at DESC NULLS LAST, kp.id DESC LIMIT 1),
    nullif(trim("clients"."name"), ''),
    'Customer ' || "clients"."id"::text
  )`;
}

export function resolveCustomerName(input: { verifiedKycName?: string | null; registrationName?: string | null; clientId: number }): string {
  return input.verifiedKycName?.trim() || input.registrationName?.trim() || `Customer ${input.clientId}`;
}
