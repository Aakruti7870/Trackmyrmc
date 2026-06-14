import { getSettings } from './settings.js';

export const PLANT_INVITE_NOTIFY_KEYS = {
  emailEnabled: 'plant_invite_email_enabled',
  recipients: 'plant_invite_email_recipients',
  roles: 'plant_invite_notify_roles',
} as const;

// By default a new onboarding request emails every active admin/authority.
export const DEFAULT_PLANT_INVITE_EMAIL_ENABLED = true;

// Staff roles an admin may pick as the notification audience. `client`/`driver`
// are deliberately excluded — they are never alerted about onboarding requests.
export const PLANT_INVITE_NOTIFY_ROLES = ['admin', 'authority', 'dispatcher', 'plant_operator'] as const;
export type PlantInviteNotifyRole = (typeof PLANT_INVITE_NOTIFY_ROLES)[number];

// When the role setting has never been configured we fall back to the original
// behaviour: alert every active admin + authority.
export const DEFAULT_PLANT_INVITE_NOTIFY_ROLES: PlantInviteNotifyRole[] = ['admin', 'authority'];

export interface PlantInviteNotifyConfig {
  /** Whether the email notification for new plant requests is sent at all. */
  emailEnabled: boolean;
  /**
   * Staff roles to notify. Every active user in one of these roles receives the
   * email, and the in-app SSE toast is scoped to them too. Defaults to
   * admin + authority when never configured; an explicit empty list means "no
   * role-based audience" (only the explicit recipients below, if any).
   */
  roles: PlantInviteNotifyRole[];
  /**
   * Explicit extra recipient mailboxes, ADDED on top of the role-based audience.
   * Useful for a shared inbox or an external address that has no user account.
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

const VALID_ROLES = new Set<string>(PLANT_INVITE_NOTIFY_ROLES);

// Parse the stored role list. `null` (key never set) returns null so callers can
// apply the default audience; an empty string returns [] (an explicit "none").
export function parseRoles(value: string | null | undefined): PlantInviteNotifyRole[] | null {
  if (value == null) return null;
  const seen = new Set<PlantInviteNotifyRole>();
  for (const raw of value.split(/[\s,;]+/)) {
    const r = raw.trim();
    if (VALID_ROLES.has(r)) seen.add(r as PlantInviteNotifyRole);
  }
  // Preserve the canonical role order rather than insertion order.
  return PLANT_INVITE_NOTIFY_ROLES.filter(r => seen.has(r));
}

// Normalise an incoming role array to the canonical, de-duplicated order, ready
// to persist. Returns a comma-joined string ('' when empty so the explicit
// "none" choice is stored rather than reverting to the default).
export function serializeRoles(roles: PlantInviteNotifyRole[]): string {
  const seen = new Set(roles);
  return PLANT_INVITE_NOTIFY_ROLES.filter(r => seen.has(r)).join(',');
}

// Resolve the effective new-plant-request notification config: persisted
// database settings take precedence, falling back to the built-in defaults.
export async function getPlantInviteNotifyConfig(): Promise<PlantInviteNotifyConfig> {
  const persisted = await getSettings(Object.values(PLANT_INVITE_NOTIFY_KEYS));
  const parsedRoles = parseRoles(persisted[PLANT_INVITE_NOTIFY_KEYS.roles]);
  return {
    emailEnabled: parseBool(persisted[PLANT_INVITE_NOTIFY_KEYS.emailEnabled], DEFAULT_PLANT_INVITE_EMAIL_ENABLED),
    roles: parsedRoles ?? DEFAULT_PLANT_INVITE_NOTIFY_ROLES,
    recipients: parseRecipients(persisted[PLANT_INVITE_NOTIFY_KEYS.recipients]),
  };
}
