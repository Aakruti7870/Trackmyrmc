// AUTHORITY is the highest role, above admin. Only a short, explicit allow-list
// of email addresses may ever hold it. The list lives in the AUTHORITY_EMAILS
// env var (comma-separated) rather than the DB so it can't be edited from inside
// the app — a defence-in-depth control around who can grant themselves god-mode.

export function getAuthorityEmails(): string[] {
  return (process.env.AUTHORITY_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAuthorityEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAuthorityEmails().includes(email.trim().toLowerCase());
}
