import { setSetting } from './settings.js';
import { KYC_KEYS } from './kyc.js';

/**
 * Boot-time KYC credential sync.
 *
 * app_settings wins over env vars at read time (intentional — lets admins
 * override via the Settings UI). But that precedence breaks when the DB still
 * holds stale test/placeholder values from a development environment:
 * the real live secrets in KYC_API_KEY / KYC_API_SECRET are silently ignored
 * and every DigiLocker call goes to a fake URL.
 *
 * This function runs at server start whenever KYC_API_KEY is present in the
 * environment. It writes each non-empty KYC_* env var into app_settings,
 * overwriting any placeholder. Values that contain obvious test strings
 * (test-key, test-secret, kyc.test) are also cleared so the env wins.
 *
 * No flag is required — the presence of KYC_API_KEY in the environment is
 * itself the signal that the operator wants the env vars to be canonical.
 */
export async function syncKycFromEnv(): Promise<void> {
  const apiKey = process.env.KYC_API_KEY?.trim();
  if (!apiKey) return; // no env creds → leave app_settings as-is

  const envByKey: Record<string, string | undefined> = {
    [KYC_KEYS.apiKey]: apiKey,
    [KYC_KEYS.apiSecret]: process.env.KYC_API_SECRET?.trim(),
    [KYC_KEYS.baseUrl]: process.env.KYC_BASE_URL?.trim(),
    [KYC_KEYS.provider]: process.env.KYC_PROVIDER?.trim(),
  };

  // Placeholder strings that sneak in from test environments.
  const TEST_VALUES = new Set(['test-key', 'test-secret', 'https://kyc.test', 'test-base-url']);

  const synced: string[] = [];
  for (const [key, value] of Object.entries(envByKey)) {
    if (!value) continue;
    await setSetting(key, value);
    synced.push(key);
  }

  // Clear any remaining test placeholders (e.g. set before env vars existed).
  // We do this after writing the real values so a partially-set env doesn't
  // leave a test value in place for keys we didn't overwrite above.
  const { getSettings } = await import('./settings.js');
  const current = await getSettings(Object.values(KYC_KEYS));
  for (const [key, val] of Object.entries(current)) {
    if (val && TEST_VALUES.has(val.trim())) {
      await setSetting(key, null);
      if (!synced.includes(key)) synced.push(`${key}(cleared)`);
    }
  }

  if (synced.length > 0) {
    console.log(`[kyc-sync] Synced KYC credentials from environment: ${synced.join(', ')}`);
  }
}
