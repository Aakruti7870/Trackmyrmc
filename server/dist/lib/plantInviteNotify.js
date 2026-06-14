import { getSettings } from './settings.js';
export const PLANT_INVITE_NOTIFY_KEYS = {
    emailEnabled: 'plant_invite_email_enabled',
    recipients: 'plant_invite_email_recipients',
};
// By default a new onboarding request emails every active admin/authority.
export const DEFAULT_PLANT_INVITE_EMAIL_ENABLED = true;
function parseBool(value, fallback) {
    if (value == null || value.trim() === '')
        return fallback;
    return value.trim().toLowerCase() === 'true';
}
// Split a stored comma/newline/semicolon-separated list into trimmed emails.
export function parseRecipients(value) {
    if (!value)
        return [];
    return value
        .split(/[\s,;]+/)
        .map(e => e.trim())
        .filter(Boolean);
}
// Resolve the effective new-plant-request notification config: persisted
// database settings take precedence, falling back to the built-in defaults.
export async function getPlantInviteNotifyConfig() {
    const persisted = await getSettings(Object.values(PLANT_INVITE_NOTIFY_KEYS));
    return {
        emailEnabled: parseBool(persisted[PLANT_INVITE_NOTIFY_KEYS.emailEnabled], DEFAULT_PLANT_INVITE_EMAIL_ENABLED),
        recipients: parseRecipients(persisted[PLANT_INVITE_NOTIFY_KEYS.recipients]),
    };
}
