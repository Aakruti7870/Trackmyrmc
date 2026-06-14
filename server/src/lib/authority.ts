// AUTHORITY is the highest role, above admin. Only a short, explicit allow-list
// of email addresses may ever hold it. The list lives in the AUTHORITY_EMAILS
// env var (comma-separated) rather than the DB so it can't be edited from inside
// the app — a defence-in-depth control around who can grant themselves god-mode.

// The two permanent platform Super Owners. They always hold AUTHORITY
// eligibility regardless of the AUTHORITY_EMAILS env var, so a mis-set (or
// cleared) env var can never lock the platform owners out. Additional
// authorities can still be added through AUTHORITY_EMAILS.
export const PERMANENT_AUTHORITY_EMAILS = [
  'krushnabade54@gmail.com',
  'support@goldetech.com',
];

export function getAuthorityEmails(): string[] {
  const fromEnv = (process.env.AUTHORITY_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Permanent owners first, then env additions, de-duplicated.
  return Array.from(new Set([...PERMANENT_AUTHORITY_EMAILS, ...fromEnv]));
}

export function isAuthorityEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAuthorityEmails().includes(email.trim().toLowerCase());
}
