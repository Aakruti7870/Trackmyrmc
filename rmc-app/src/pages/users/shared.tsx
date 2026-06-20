// Shared types, constants, styles and tiny helpers for the User Management page.
// These were lifted out of the former ~2,100-line Users.tsx so the page and its
// child components (table, activity log, modals) can each import only what they
// need — keeping every file small and cheap to transform/load (and test).

export type SkippedRestoreItem = {
  id: number;
  email: string;
  reason: string;
  conflictUserId?: number;
  conflictUserName?: string;
  conflictLinkType?: 'client' | 'driver';
};

// Shown under each kept admin in the skipped-purge panel so the admin knows why
// the delete was blocked and how the inline "Delete forever" retry will unblock.
export const PURGE_KEPT_ADMIN_REASON =
  'Kept so the system always has at least one admin. Once another admin account is active, delete it forever here.';

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
  createdAt: string;
  deletedAt: string | null;
  auditCount: number;
  suspensionReason?: string | null;
  suspendedBy?: number | null;
};

export type AuditEntry = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  targetUserId: number | null;
  targetUserEmail: string | null;
  detail: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

export type AuditPage = {
  rows: AuditEntry[];
  hasMore: boolean;
};

export type LinkOption = { id: number; name: string };

export const ROLES = ['authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'client', 'driver'] as const;
export type Role = typeof ROLES[number];

export const ROLE_LABEL: Record<Role, string> = {
  authority: 'Authority',
  plant_owner: 'Plant Owner',
  admin: 'Admin',
  supervisor: 'Supervisor',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant Operator',
  client: 'Client',
  driver: 'Driver',
};

export const ROLE_COLOR: Record<Role, string> = {
  authority: '#e879f9',
  plant_owner: '#f59e0b',
  admin: 'var(--gold)',
  supervisor: '#14b8a6',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  client: '#a78bfa',
  driver: '#f97316',
};

export const ACTION_LABEL: Record<string, string> = {
  password_reset: 'Password Reset',
  password_reset_email: 'Password-Reset Email',
  welcome_email: 'Welcome Email',
  lockout_cleared: 'Lockout Cleared',
  name_change: 'Name Changed',
  role_change: 'Role Changed',
  account_activated: 'Account Activated',
  account_deactivated: 'Account Deactivated',
  client_link_change: 'Client Link Changed',
  driver_link_change: 'Driver Link Changed',
  'user.created': 'Account Created',
  'user.deleted': 'Account Deleted',
  'user.restored': 'Account Restored',
  'user.purged': 'Account Purged',
};

export const ACTION_COLOR: Record<string, string> = {
  password_reset: '#38bdf8',
  password_reset_email: '#38bdf8',
  welcome_email: '#a78bfa',
  lockout_cleared: '#22c55e',
  name_change: '#a78bfa',
  role_change: '#f7c948',
  account_activated: '#22c55e',
  account_deactivated: '#ef4444',
  client_link_change: '#38bdf8',
  driver_link_change: '#f97316',
  'user.created': '#22c55e',
  'user.deleted': '#ef4444',
  'user.restored': '#22c55e',
  'user.purged': '#ef4444',
};

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'var(--chip-bg)', border: '1px solid var(--line)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
};

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px',
};

export type LockoutInfo = { locked: boolean; lockedUntil: number | null };

export type FormData = {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
};

export const emptyForm = (): FormData => ({
  name: '', email: '', password: '', role: 'dispatcher',
  isActive: true, linkedClientId: null, linkedDriverId: null,
});

export function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Format a remaining-time span (ms) as mm:ss, clamped at zero. */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Human-readable label for an audit account reference (actor or target). */
export function accountLabel(id: number | null, label: string | null) {
  const text = label?.trim();
  if (!text) return '[deleted]';
  return id === null ? `${text} (deleted)` : text;
}
