import { useState, useEffect } from 'react';
import { Plus, Edit2, X, Search, ShieldCheck, UserCog, Eye, EyeOff, ClipboardList, CheckCircle, XCircle, Send, LockOpen, Mail, History, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import SearchableSelect from '@/components/SearchableSelect';

type UserRecord = {
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
};

type AuditEntry = {
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

type LinkOption = { id: number; name: string };

const ROLES = ['admin', 'dispatcher', 'plant_operator', 'client', 'driver'] as const;
type Role = typeof ROLES[number];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  plant_operator: 'Plant Operator',
  client: 'Client',
  driver: 'Driver',
};

const ROLE_COLOR: Record<Role, string> = {
  admin: 'var(--gold)',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  client: '#a78bfa',
  driver: '#f97316',
};

const ACTION_LABEL: Record<string, string> = {
  password_reset: 'Password Reset',
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
};

const ACTION_COLOR: Record<string, string> = {
  password_reset: '#38bdf8',
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
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px',
};

type LockoutInfo = { locked: boolean; lockedUntil: number | null };

type FormData = {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  linkedClientId: number | null;
  linkedDriverId: number | null;
};

const emptyForm = (): FormData => ({
  name: '', email: '', password: '', role: 'dispatcher',
  isActive: true, linkedClientId: null, linkedDriverId: null,
});

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const deletedTagStyle: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
  background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)',
  textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};

/**
 * Render an audit-log account reference (actor or target). The FK may be null
 * because the account was deleted (ON DELETE SET NULL), but the human-readable
 * label is preserved at write time. Show the preserved label plus a "deleted"
 * tag, or "[deleted]" when no label was captured.
 */
function AccountRef({ id, label }: { id: number | null; label: string | null }) {
  const text = label?.trim();
  if (!text) {
    return <span style={{ color: '#6b7a90', fontStyle: 'italic' }}>[deleted]</span>;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {text}
      {id === null && <span style={deletedTagStyle}>deleted</span>}
    </span>
  );
}

export default function Users() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [clientOptions, setClientOptions] = useState<LinkOption[]>([]);
  const [driverOptions, setDriverOptions] = useState<LinkOption[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [lockoutStatus, setLockoutStatus] = useState<Record<number, LockoutInfo>>({});
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [historyUser, setHistoryUser] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  const [softDeletedMatch, setSoftDeletedMatch] = useState<{ id: number; name: string } | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  function loadAudit(userId: number | null) {
    const url = userId ? `/users/audit-log?userId=${userId}` : '/users/audit-log';
    api.get<AuditEntry[]>(url).then(setAuditLog).catch(() => {});
  }

  function load() {
    api.get<UserRecord[]>(showDeleted ? '/users?deleted=true' : '/users').then(setUsers).catch(() => {});
    api.get<UserRecord[]>('/users?deleted=true').then(d => setDeletedCount(d.length)).catch(() => {});
    api.get<LinkOption[]>('/users/clients-list').then(setClientOptions).catch(() => {});
    api.get<LinkOption[]>('/users/drivers-list').then(setDriverOptions).catch(() => {});
    loadAudit(historyUser?.id ?? null);
    api.get<Record<number, LockoutInfo>>('/users/lockout-status').then(setLockoutStatus).catch(() => {});
  }
  useEffect(load, [showDeleted]);

  function viewHistory(u: UserRecord) {
    setHistoryUser(u);
    loadAudit(u.id);
    document.getElementById('activity-log')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearHistory() {
    setHistoryUser(null);
    loadAudit(null);
  }

  async function unlock(u: UserRecord) {
    setUnlocking(u.id);
    try {
      await api.post(`/users/${u.id}/unlock`, {});
      setLockoutStatus(prev => ({ ...prev, [u.id]: { locked: false, lockedUntil: null } }));
      showToast(`${u.name}'s account has been unlocked.`, 'success');
    } catch {
      showToast('Failed to unlock account.', 'error');
    } finally {
      setUnlocking(null);
    }
  }

  async function restore(u: UserRecord) {
    setRestoringId(u.id);
    try {
      await api.post(`/users/${u.id}/restore`, {});
      showToast(`${u.name}'s account has been restored.`, 'success');
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to restore account.', 'error');
    } finally {
      setRestoringId(null);
    }
  }

  async function restoreFromCreate() {
    if (!softDeletedMatch) return;
    setSaving(true); setError('');
    try {
      await api.post(`/users/${softDeletedMatch.id}/restore`, {});
      showToast(`${softDeletedMatch.name}'s account has been restored.`, 'success');
      setSoftDeletedMatch(null);
      setModal(null);
      setShowDeleted(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to restore account.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      showToast(`${deleteTarget.name}'s account has been deleted.`, 'success');
      if (historyUser?.id === deleteTarget.id) clearHistory();
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to delete account.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() {
    setForm(emptyForm());
    setEditing(null);
    setError('');
    setSoftDeletedMatch(null);
    setShowPassword(false);
    setModal('create');
  }

  function openEdit(u: UserRecord) {
    setForm({
      name: u.name, email: u.email, password: '',
      role: u.role as Role, isActive: u.isActive,
      linkedClientId: u.linkedClientId, linkedDriverId: u.linkedDriverId,
    });
    setEditing(u);
    setError('');
    setShowPassword(false);
    setModal('edit');
  }

  async function save() {
    setSaving(true); setError(''); setSoftDeletedMatch(null);
    try {
      if (modal === 'create') {
        if (!form.password || form.password.length < 6) {
          setError('Password must be at least 6 characters'); setSaving(false); return;
        }
        await api.post('/users', {
          name: form.name, email: form.email, password: form.password,
          role: form.role, linkedClientId: form.linkedClientId, linkedDriverId: form.linkedDriverId,
        });
      } else {
        if (form.password && form.password.length < 6) {
          setError('New password must be at least 6 characters'); setSaving(false); return;
        }
        const payload: Record<string, unknown> = {
          name: form.name, role: form.role, isActive: form.isActive,
          linkedClientId: form.linkedClientId, linkedDriverId: form.linkedDriverId,
        };
        if (form.password) payload.password = form.password;
        const result = await api.put<{ emailSent?: boolean }>(`/users/${editing!.id}`, payload);
        if (form.password) {
          if (result.emailSent) {
            showToast('Password updated — notification email sent to user.', 'info');
          } else {
            showToast('Password updated — email not sent (check SMTP config).', 'error');
          }
        }
      }
      load(); setModal(null);
    } catch (e: unknown) {
      if (e instanceof ApiError && e.data?.code === 'email_soft_deleted') {
        setSoftDeletedMatch({
          id: Number(e.data.deletedUserId),
          name: String(e.data.deletedUserName ?? 'this account'),
        });
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'An error occurred');
      }
    } finally { setSaving(false); }
  }

  async function toggleActive(u: UserRecord) {
    try {
      await api.put(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch {}
  }

  async function resendNotification(u: UserRecord) {
    try {
      const result = await api.post<{ emailSent: boolean }>(`/users/${u.id}/resend-notification`, {});
      if (result.emailSent) {
        showToast(`Notification email sent to ${u.email}.`, 'success');
      } else {
        showToast('Email not sent — check SMTP configuration.', 'error');
      }
    } catch {
      showToast('Failed to resend notification.', 'error');
    }
  }

  async function resendWelcome(u: UserRecord) {
    setResendingId(u.id);
    try {
      const result = await api.post<{ emailSent?: boolean }>(`/users/${u.id}/resend-welcome`, {});
      if (result.emailSent) {
        showToast(`Welcome email re-sent to ${u.email}.`, 'info');
      } else {
        showToast('Welcome email not sent (check SMTP config).', 'error');
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to resend welcome email.', 'error');
    } finally {
      setResendingId(null);
    }
  }

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const needsClientLink = form.role === 'client';
  const needsDriverLink = form.role === 'driver';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} style={{ color: 'var(--gold)' }} />
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>User Management</h2>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            {showDeleted
              ? `${users.length} deleted ${users.length === 1 ? 'account' : 'accounts'}`
              : `${users.filter(u => u.isActive).length} active · ${users.length} total accounts`}
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,var(--gold),#e6a817)', color: '#111827',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          <Plus size={15} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <select
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
        >
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <button
          onClick={() => setShowDeleted(s => !s)}
          title={showDeleted ? 'Show active accounts' : 'Show deleted accounts'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            background: showDeleted ? 'rgba(239,68,68,.14)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${showDeleted ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)'}`,
            color: showDeleted ? '#ef4444' : 'var(--muted)',
          }}
        >
          <Trash2 size={13} />
          {showDeleted ? 'Showing Deleted' : `Deleted${deletedCount ? ` (${deletedCount})` : ''}`}
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
        border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.15)' }}>
              {['User', 'Email', 'Role', 'Status', 'Linked To', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No users found</td>
              </tr>
            )}
            {filtered.map(u => {
              const roleColor = ROLE_COLOR[u.role as Role] || 'var(--muted)';
              const linked = u.linkedClientId
                ? `Client #${u.linkedClientId} — ${clientOptions.find(c => c.id === u.linkedClientId)?.name ?? '…'}`
                : u.linkedDriverId
                ? `Driver #${u.linkedDriverId} — ${driverOptions.find(d => d.id === u.linkedDriverId)?.name ?? '…'}`
                : '—';
              const lockout = lockoutStatus[u.id];
              const isLocked = lockout?.locked === true;
              const lockExpiry = lockout?.lockedUntil
                ? new Date(lockout.lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : null;
              return (
                <tr key={u.id} style={{
                  borderBottom: '1px solid rgba(255,255,255,.05)',
                  background: isLocked ? 'rgba(239,160,68,.04)' : u.isActive ? 'transparent' : 'rgba(239,68,68,.03)',
                  opacity: u.isActive ? 1 : 0.65,
                }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${roleColor} 21%, transparent)`,
                        display: 'grid', placeItems: 'center',
                        fontSize: 12, fontWeight: 800, color: roleColor,
                      }}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)' }}>{u.email}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, color: roleColor, border: `1px solid color-mix(in srgb, ${roleColor} 21%, transparent)`,
                    }}>
                      {ROLE_LABEL[u.role as Role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                      {showDeleted ? (
                        <span title={u.deletedAt ? `Deleted ${formatDate(u.deletedAt)}` : 'Deleted'} style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: '#ef444420', color: 'var(--red)', border: '1px solid #ef444435', whiteSpace: 'nowrap',
                        }}>
                          Deleted{u.deletedAt ? ` · ${formatDate(u.deletedAt)}` : ''}
                        </span>
                      ) : (
                      <button
                        onClick={() => toggleActive(u)}
                        style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          background: u.isActive ? '#22c55e20' : '#ef444420',
                          color: u.isActive ? 'var(--green)' : 'var(--red)',
                          border: `1px solid ${u.isActive ? '#22c55e35' : '#ef444435'}`,
                        }}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                      )}
                      {!showDeleted && isLocked && (
                        <span title={lockExpiry ? `Locked until ${lockExpiry}` : 'Locked'} style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: '#f9731620', color: '#f97316',
                          border: '1px solid #f9731635',
                          whiteSpace: 'nowrap',
                        }}>
                          🔒 Locked{lockExpiry ? ` until ${lockExpiry}` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>{linked}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {showDeleted ? (
                        <>
                          <button
                            onClick={() => restore(u)}
                            disabled={restoringId === u.id}
                            title="Restore account"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: restoringId === u.id ? 'rgba(34,197,94,.1)' : 'rgba(34,197,94,.15)',
                              border: '1px solid rgba(34,197,94,.3)',
                              borderRadius: 7, color: 'var(--green)',
                              cursor: restoringId === u.id ? 'not-allowed' : 'pointer',
                              padding: '5px 10px', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            <RotateCcw size={12} />
                            {restoringId === u.id ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            onClick={() => viewHistory(u)}
                            title={`View activity history (${u.auditCount} ${u.auditCount === 1 ? 'entry' : 'entries'})`}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              background: historyUser?.id === u.id ? 'rgba(247,201,72,.16)' : 'rgba(247,201,72,.08)',
                              border: `1px solid ${historyUser?.id === u.id ? 'rgba(247,201,72,.4)' : 'rgba(247,201,72,.18)'}`,
                              borderRadius: 7, color: 'var(--gold)', cursor: 'pointer', padding: '5px 8px', fontSize: 11, fontWeight: 700,
                            }}
                          >
                            <History size={13} />
                            {u.auditCount}
                          </button>
                        </>
                      ) : (
                      <>
                      {isLocked && (
                        <button
                          onClick={() => unlock(u)}
                          disabled={unlocking === u.id}
                          title="Unlock account"
                          style={{
                            background: unlocking === u.id ? 'rgba(249,115,22,.1)' : 'rgba(249,115,22,.15)',
                            border: '1px solid rgba(249,115,22,.3)',
                            borderRadius: 7, color: '#f97316', cursor: unlocking === u.id ? 'not-allowed' : 'pointer',
                            padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 700,
                          }}
                        >
                          <LockOpen size={12} />
                          {unlocking === u.id ? '…' : 'Unlock'}
                        </button>
                      )}
                      <button
                        onClick={() => viewHistory(u)}
                        title={`View activity history (${u.auditCount} ${u.auditCount === 1 ? 'entry' : 'entries'})`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          background: historyUser?.id === u.id ? 'rgba(247,201,72,.16)' : 'rgba(247,201,72,.08)',
                          border: `1px solid ${historyUser?.id === u.id ? 'rgba(247,201,72,.4)' : 'rgba(247,201,72,.18)'}`,
                          borderRadius: 7, color: 'var(--gold)', cursor: 'pointer', padding: '5px 8px', fontSize: 11, fontWeight: 700,
                        }}
                      >
                        <History size={13} />
                        {u.auditCount}
                      </button>
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit user"
                        style={{
                          background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)',
                          borderRadius: 7, color: 'var(--muted)', cursor: 'pointer', padding: '5px 8px',
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => resendNotification(u)}
                        title="Resend notification email"
                        style={{
                          background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)',
                          borderRadius: 7, color: 'var(--blue)', cursor: 'pointer', padding: '5px 8px',
                        }}
                      >
                        <Send size={13} />
                      </button>
                      <button
                        onClick={() => resendWelcome(u)}
                        disabled={resendingId === u.id}
                        title="Resend welcome email"
                        style={{
                          background: 'rgba(247,201,72,.1)', border: '1px solid rgba(247,201,72,.25)',
                          borderRadius: 7, color: 'var(--gold)',
                          cursor: resendingId === u.id ? 'not-allowed' : 'pointer',
                          padding: '5px 8px', opacity: resendingId === u.id ? 0.6 : 1,
                        }}
                      >
                        <Mail size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Delete user"
                        style={{
                          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
                          borderRadius: 7, color: 'var(--red)', cursor: 'pointer', padding: '5px 8px',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                      </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Audit Log */}
      <div id="activity-log" style={{ marginTop: 32, scrollMarginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, flexWrap: 'wrap' }}>
          <ClipboardList size={18} color="#f7c948" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            {historyUser ? `Activity Log — ${historyUser.name}` : 'Activity Log'}
          </h3>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(247,201,72,.12)', color: '#f7c948', border: '1px solid rgba(247,201,72,.25)',
          }}>
            {auditLog.length} {auditLog.length === 1 ? 'entry' : 'entries'}
          </span>
          {historyUser && (
            <button
              onClick={clearHistory}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', color: 'var(--muted)',
              }}
            >
              <X size={12} /> Showing {historyUser.email} — Show all
            </button>
          )}
        </div>

        <div style={{
          background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
          border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden',
        }}>
          {auditLog.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9fb0c7', fontSize: 13 }}>
              {historyUser
                ? `No activity recorded for ${historyUser.name} yet.`
                : 'No activity recorded yet. Account changes and password resets will appear here.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.15)' }}>
                  {['Timestamp', 'Action', 'Details', 'Target Account', 'Performed By', 'Email Sent'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLog.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(entry.createdAt)}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {(() => {
                        const c = ACTION_COLOR[entry.action] ?? '#9fb0c7';
                        return (
                          <span style={{
                            padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                            background: `color-mix(in srgb, ${c} 13%, transparent)`,
                            color: c, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`,
                          }}>
                            {ACTION_LABEL[entry.action] ?? entry.action}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12 }}>{entry.detail ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#eef5ff' }}>
                      <AccountRef id={entry.targetUserId} label={entry.targetUserEmail} />
                    </td>
                    <td style={{ padding: '11px 14px', color: '#9fb0c7' }}>
                      <AccountRef id={entry.actorId} label={entry.actorName} />
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {entry.emailSent === null ? (
                        <span style={{ color: '#9fb0c7', fontSize: 12 }}>—</span>
                      ) : entry.emailSent ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
                          <CheckCircle size={13} /> Sent
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                          <XCircle size={13} /> Not sent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(255,255,255,.1)', borderRadius: 18,
            width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24,
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCog size={18} style={{ color: 'var(--gold)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  {modal === 'create' ? 'Add New User' : `Edit — ${editing?.name}`}
                </h3>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {/* Name */}
              <label>
                <span style={labelStyle}>Full Name</span>
                <input
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rajesh Kumar"
                  style={inputStyle}
                />
              </label>

              {/* Email — editable only on create */}
              <label>
                <span style={labelStyle}>Email</span>
                <input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  type="email"
                  disabled={modal === 'edit'}
                  style={{ ...inputStyle, opacity: modal === 'edit' ? 0.5 : 1 }}
                />
              </label>

              {/* Password — required on create, optional on edit */}
              <label>
                <span style={labelStyle}>
                  {modal === 'create' ? 'Password' : 'New Password'}
                </span>
                <div style={{ position: 'relative' }}>
                  <input
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={modal === 'create' ? 'Min. 6 characters' : 'Leave blank to keep current password'}
                    style={{ ...inputStyle, paddingRight: 38 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {modal === 'edit' && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    Leave blank to keep current password. Must be at least 6 characters if changed.
                  </span>
                )}
              </label>

              {/* Role */}
              <label>
                <span style={labelStyle}>Role</span>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({
                    ...f, role: e.target.value as Role,
                    linkedClientId: null, linkedDriverId: null,
                  }))}
                  style={inputStyle}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
              </label>

              {/* Linked Client — shown for client role */}
              {needsClientLink && (
                <label>
                  <span style={labelStyle}>Linked Client Account</span>
                  <SearchableSelect
                    value={form.linkedClientId}
                    onChange={id => setForm(f => ({ ...f, linkedClientId: id }))}
                    options={clientOptions}
                    placeholder="Select a client…"
                    noneLabel="— No linked client —"
                    emptyLabel="No clients found"
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    Links this login to a client record so "My Orders" shows their data.
                  </span>
                </label>
              )}

              {/* Linked Driver — shown for driver role */}
              {needsDriverLink && (
                <label>
                  <span style={labelStyle}>Linked Driver Record</span>
                  <SearchableSelect
                    value={form.linkedDriverId}
                    onChange={id => setForm(f => ({ ...f, linkedDriverId: id }))}
                    options={driverOptions}
                    placeholder="Select a driver…"
                    noneLabel="— No linked driver —"
                    emptyLabel="No drivers found"
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    Links this login to a driver record so "My Trips" shows their assignments.
                  </span>
                </label>
              )}

              {/* Active toggle — edit only */}
              {modal === 'edit' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                    style={{
                      width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                      background: form.isActive ? 'var(--green)' : 'rgba(255,255,255,.12)',
                      position: 'relative', transition: 'background .2s', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: form.isActive ? 20 : 2,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', transition: 'left .2s',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {form.isActive ? 'Account Active' : 'Account Deactivated'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Deactivated accounts cannot log in but their data is preserved.
                    </div>
                  </div>
                </label>
              )}

              {error && (
                <div style={{ padding: '10px 14px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
                  {error}
                  {softDeletedMatch && (
                    <button
                      onClick={restoreFromCreate}
                      disabled={saving}
                      style={{
                        marginTop: 10, width: '100%', padding: '9px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.35)',
                        borderRadius: 8, color: 'var(--green)', fontWeight: 700, fontSize: 13,
                        cursor: saving ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <RotateCcw size={14} /> Restore {softDeletedMatch.name}'s account
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModal(null)} style={{
                  flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                  border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                  color: 'var(--muted)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button onClick={save} disabled={saving} style={{
                  flex: 2, padding: '10px', background: 'linear-gradient(135deg,var(--gold),#e6a817)',
                  border: 'none', borderRadius: 10, color: '#111827',
                  fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Saving…' : modal === 'create' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(5,9,20,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(145deg,var(--panel),var(--bg))',
            border: '1px solid rgba(239,68,68,.25)', borderRadius: 18,
            width: '100%', maxWidth: 420, padding: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
                display: 'grid', placeItems: 'center', color: 'var(--red)',
              }}>
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Delete Account</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> ({deleteTarget.email})?
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              The account will be removed and can no longer log in. Their activity history stays in the
              audit log for record-keeping.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} style={{
                flex: 1, padding: '10px', background: 'rgba(255,255,255,.07)',
                border: '1px solid rgba(255,255,255,.1)', borderRadius: 10,
                color: 'var(--muted)', fontWeight: 600, fontSize: 13,
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} style={{
                flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10,
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
              }}>
                <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
