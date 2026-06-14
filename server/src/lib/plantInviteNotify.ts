import { getSettings } from './settings.js';

export const PLANT_INVITE_NOTIFY_KEYS = {
  emailEnabled: 'plant_invite_email_enabled',
  recipients: 'plant_invite_email_recipients',
} as const;

// By default a new onboarding request emails every active admin/authority.
export const DEFAULT_PLANT_INVITE_EMAIL_ENABLED = true;

export interface PlantInviteNotifyConfig {
  /** Whether the email notification for new plant requests is sent at all. */
  emailEnabled: boolean;
  /**
   * Explicit recipient mailboxes. When non-empty these REPLACE the default
   * all-admins audience (e.g. route everything to a single shared inbox or add
   * dispatchers). When empty, every active admin/authority is notified.
   */
  recipients: string[];
}

function parseBool(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return value.trim().toLowerCase() === 'true';
}

// Split a stored comma/newline/semicolon-separated list into trimmed emails.
export function parseRecipients(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\s,;]+/)
    .map(e => e.trim())
    .filter(Boolean);
}

// Resolve the effective new-plant-request notification config: persisted
// database settings take precedence, falling back to the built-in defaults.
export async function getPlantInviteNotifyConfig(): Promise<PlantInviteNotifyConfig> {
  const persisted = await getSettings(Object.values(PLANT_INVITE_NOTIFY_KEYS));
  return {
    emailEnabled: parseBool(persisted[PLANT_INVITE_NOTIFY_KEYS.emailEnabled], DEFAULT_PLANT_INVITE_EMAIL_ENABLED),
    recipients: parseRecipients(persisted[PLANT_INVITE_NOTIFY_KEYS.recipients]),
  };
}
