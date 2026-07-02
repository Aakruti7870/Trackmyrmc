import { setSetting } from './settings.js';
import { SMTP_KEYS, verifySmtpConnection } from './email.js';

/**
 * One-time SMTP recovery hatch, run at boot.
 *
 * The effective SMTP configuration prefers values persisted in app_settings
 * (managed from the admin Settings UI) over SMTP_* environment variables.
 * That is normally the right precedence, but it creates a lockout when the
 * persisted credentials go bad: staff/authority login depends on emailed OTP
 * codes, so nobody can reach the Settings UI to fix the very credentials that
 * are broken.
 *
 * When SMTP_SYNC_FROM_ENV=1 is set, every SMTP_* environment variable that is
 * present and non-empty is copied INTO app_settings at boot, overwriting the
 * persisted value. Values are written into the database (rather than merely
 * preferred at read time) so the Settings UI shows the live configuration and
 * later UI edits keep working. The flag should be removed once recovery is
 * complete — while it stays set, every restart/redeploy re-overwrites the
 * synced keys from the environment.
 */
export async function syncSmtpFromEnv(): Promise<void> {
  if (process.env.SMTP_SYNC_FROM_ENV !== '1') return;

  const envByKey: Record<string, string | undefined> = {
    [SMTP_KEYS.host]: process.env.SMTP_HOST,
    [SMTP_KEYS.port]: process.env.SMTP_PORT,
    [SMTP_KEYS.user]: process.env.SMTP_USER,
    [SMTP_KEYS.pass]: process.env.SMTP_PASS,
    [SMTP_KEYS.from]: process.env.SMTP_FROM,
  };

  const synced: string[] = [];
  for (const [key, raw] of Object.entries(envByKey)) {
    const value = raw?.trim();
    if (!value) continue; // absent/blank env vars leave the persisted value untouched
    await setSetting(key, value);
    synced.push(key);
  }

  if (synced.length > 0) {
    console.warn(
      `[smtp-recovery] SMTP_SYNC_FROM_ENV=1: overwrote persisted settings from environment: ${synced.join(', ')}. ` +
        'Remove SMTP_SYNC_FROM_ENV once recovery is complete, or these keys will be re-overwritten on every boot.',
    );
    // Prove the recovered credentials actually authenticate so the outcome is
    // visible in boot logs (never logs credential values, only the result).
    try {
      let check = await verifySmtpConnection();
      // Common paste error: Gmail displays App Passwords as "abcd efgh ijkl mnop".
      // If auth fails and the password contains whitespace, retry without it and
      // persist the working variant.
      const pass = envByKey[SMTP_KEYS.pass]?.trim();
      if (!check.ok && pass && /\s/.test(pass)) {
        const stripped = pass.replace(/\s+/g, '');
        const retry = await verifySmtpConnection({ pass: stripped });
        if (retry.ok) {
          await setSetting(SMTP_KEYS.pass, stripped);
          console.warn('[smtp-recovery] SMTP password contained spaces; the space-stripped variant authenticated and was persisted instead.');
          check = retry;
        }
      }
      if (check.ok) {
        console.warn('[smtp-recovery] SMTP connection verified OK with the synced credentials.');
      } else {
        const user = envByKey[SMTP_KEYS.user]?.trim() ?? '';
        const [local = '', domain = ''] = user.split('@');
        const maskedUser = user ? `${local.slice(0, 3)}***@${domain}` : '(not set)';
        const passHint = pass
          ? `length ${pass.length}${/\s/.test(pass) ? ' (contains spaces)' : ''}${/^[a-z]{16}$/i.test(pass.replace(/\s+/g, '')) ? ', looks like an App Password' : ', does NOT look like a 16-letter App Password'}`
          : '(not set)';
        console.error(
          `[smtp-recovery] SMTP verification FAILED after sync: ${check.error ?? 'unknown error'} ` +
            `[diagnostic: user=${maskedUser}, password ${passHint}]`,
        );
      }
    } catch (e) {
      console.error('[smtp-recovery] SMTP verification threw after sync:', e instanceof Error ? e.message : e);
    }
  } else {
    console.warn(
      '[smtp-recovery] SMTP_SYNC_FROM_ENV=1 is set but no SMTP_* environment variables are present — nothing synced.',
    );
  }
}
