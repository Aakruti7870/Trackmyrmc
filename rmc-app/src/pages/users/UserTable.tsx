import {
  Edit2, Send, LockOpen, Mail, History, Trash2, AlertTriangle, RotateCcw,
} from 'lucide-react';
import {
  ROLE_LABEL, ROLE_COLOR, formatDate, formatCountdown,
  type UserRecord, type LinkOption, type LockoutInfo, type Role,
} from './shared';

// The accounts table (active or deleted view). Purely presentational: all data
// and callbacks come from the parent page.
export default function UserTable({
  users,
  showDeleted,
  selectedIds,
  toggleSelectOne,
  toggleSelectAll,
  clientOptions,
  driverOptions,
  lockoutStatus,
  now,
  historyUserId,
  restoringId,
  unlocking,
  resendingId,
  onRestore,
  onViewHistory,
  onPurge,
  onUnlock,
  onEdit,
  onResendNotification,
  onResendWelcome,
  onDelete,
  onToggleActive,
}: {
  users: UserRecord[];
  showDeleted: boolean;
  selectedIds: Set<number>;
  toggleSelectOne: (id: number) => void;
  toggleSelectAll: () => void;
  clientOptions: LinkOption[];
  driverOptions: LinkOption[];
  lockoutStatus: Record<number, LockoutInfo>;
  now: number;
  historyUserId: number | null;
  restoringId: number | null;
  unlocking: number | null;
  resendingId: number | null;
  onRestore: (u: UserRecord) => void;
  onViewHistory: (u: UserRecord) => void;
  onPurge: (u: UserRecord) => void;
  onUnlock: (u: UserRecord) => void;
  onEdit: (u: UserRecord, focusLink?: boolean) => void;
  onResendNotification: (u: UserRecord) => void;
  onResendWelcome: (u: UserRecord) => void;
  onDelete: (u: UserRecord) => void;
  onToggleActive: (u: UserRecord) => void;
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--chip-bg)' }}>
            {showDeleted && (
              <th style={{ padding: '11px 14px', width: 1, whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  aria-label="Select all deleted accounts"
                  title="Select all"
                  checked={users.length > 0 && users.every(u => selectedIds.has(u.id))}
                  ref={el => {
                    if (el) {
                      const selectedVisible = users.filter(u => selectedIds.has(u.id)).length;
                      el.indeterminate = selectedVisible > 0 && selectedVisible < users.length;
                    }
                  }}
                  onChange={toggleSelectAll}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
                />
              </th>
            )}
            {['User', 'Email', 'Role', 'Status', 'Linked To', 'Actions'].map(h => (
              <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={showDeleted ? 7 : 6} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>No users found</td>
            </tr>
          )}
          {users.map(u => {
            const roleColor = ROLE_COLOR[u.role as Role] || 'var(--muted)';
            const linked = u.linkedClientId
              ? `Client #${u.linkedClientId} — ${clientOptions.find(c => c.id === u.linkedClientId)?.name ?? '…'}`
              : u.linkedDriverId
              ? `Driver #${u.linkedDriverId} — ${driverOptions.find(d => d.id === u.linkedDriverId)?.name ?? '…'}`
              : '—';
            const isUnlinked = (u.role === 'client' && !u.linkedClientId) ||
              (u.role === 'driver' && !u.linkedDriverId);
            const lockout = lockoutStatus[u.id];
            const isLocked = lockout?.locked === true;
            const lockExpiry = lockout?.lockedUntil
              ? new Date(lockout.lockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : null;
            // Warn admins when a lockout is about to lift (under ~2 min left).
            // Derived purely from lockedUntil vs. now, so the 30s poll re-render
            // moves the badge into its "expiring soon" state on its own.
            const lockMsLeft = lockout?.lockedUntil ? lockout.lockedUntil - now : 0;
            const lockExpiringSoon = isLocked && lockMsLeft > 0 && lockMsLeft <= 120000;
            const lockCountdown = isLocked && lockMsLeft > 0 ? formatCountdown(lockMsLeft) : null;
            return (
              <tr key={u.id} style={{
                borderBottom: '1px solid var(--line)',
                background: isLocked ? 'rgba(239,160,68,.04)' : u.isActive ? 'transparent' : 'rgba(239,68,68,.03)',
                opacity: u.isActive ? 1 : 0.65,
              }}>
                {showDeleted && (
                  <td style={{ padding: '12px 14px', width: 1, whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${u.name}`}
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelectOne(u.id)}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--gold)' }}
                    />
                  </td>
                )}
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
                      onClick={() => onToggleActive(u)}
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
                      <span
                        title={
                          lockExpiringSoon
                            ? `Unlocking in ${lockCountdown ?? '0:00'}${lockExpiry ? ` (around ${lockExpiry})` : ''}`
                            : lockCountdown
                              ? `Unlocking in ${lockCountdown}${lockExpiry ? ` (around ${lockExpiry})` : ''}`
                              : lockExpiry ? `Locked until ${lockExpiry}` : 'Locked'
                        }
                        style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: lockExpiringSoon ? '#facc1520' : '#f9731620',
                          color: lockExpiringSoon ? '#facc15' : '#f97316',
                          border: `1px solid ${lockExpiringSoon ? '#facc1545' : '#f9731635'}`,
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {lockExpiringSoon
                          ? `⏳ Unlocking in ${lockCountdown ?? '0:00'}`
                          : lockCountdown
                            ? `🔒 Locked · ${lockCountdown}`
                            : `🔒 Locked${lockExpiry ? ` until ${lockExpiry}` : ''}`}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12 }}>
                  {isUnlinked ? (
                    <button
                      type="button"
                      onClick={() => onEdit(u, true)}
                      title={`This ${ROLE_LABEL[u.role as Role] ?? u.role} login has no ${u.role === 'client' ? 'client' : 'driver'} record linked — they will see an empty ${u.role === 'client' ? 'My Orders' : 'My Trips'} screen. Click to link a record.`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        background: 'rgba(245,158,11,.13)', color: '#f59e0b', border: '1px solid rgba(245,158,11,.3)',
                        whiteSpace: 'nowrap', cursor: 'pointer',
                      }}
                    >
                      <AlertTriangle size={12} /> Link record
                    </button>
                  ) : linked}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {showDeleted ? (
                      <>
                        <button
                          onClick={() => onRestore(u)}
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
                          onClick={() => onViewHistory(u)}
                          title={`View activity history (${u.auditCount} ${u.auditCount === 1 ? 'entry' : 'entries'})`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: historyUserId === u.id ? 'rgba(23,138,110,.16)' : 'rgba(23,138,110,.08)',
                            border: `1px solid ${historyUserId === u.id ? 'rgba(23,138,110,.4)' : 'rgba(23,138,110,.18)'}`,
                            borderRadius: 7, color: 'var(--gold)', cursor: 'pointer', padding: '5px 8px', fontSize: 11, fontWeight: 700,
                          }}
                        >
                          <History size={13} />
                          {u.auditCount}
                        </button>
                        <button
                          onClick={() => onPurge(u)}
                          title="Permanently delete account (frees the email)"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
                            borderRadius: 7, color: 'var(--red)', cursor: 'pointer',
                            padding: '5px 10px', fontSize: 11, fontWeight: 700,
                          }}
                        >
                          <Trash2 size={12} /> Delete Forever
                        </button>
                      </>
                    ) : (
                    <>
                    {isLocked && (
                      <button
                        onClick={() => onUnlock(u)}
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
                      onClick={() => onViewHistory(u)}
                      title={`View activity history (${u.auditCount} ${u.auditCount === 1 ? 'entry' : 'entries'})`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: historyUserId === u.id ? 'rgba(23,138,110,.16)' : 'rgba(23,138,110,.08)',
                        border: `1px solid ${historyUserId === u.id ? 'rgba(23,138,110,.4)' : 'rgba(23,138,110,.18)'}`,
                        borderRadius: 7, color: 'var(--gold)', cursor: 'pointer', padding: '5px 8px', fontSize: 11, fontWeight: 700,
                      }}
                    >
                      <History size={13} />
                      {u.auditCount}
                    </button>
                    <button
                      onClick={() => onEdit(u)}
                      title="Edit user"
                      style={{
                        background: 'var(--chip-bg)', border: '1px solid var(--line)',
                        borderRadius: 7, color: 'var(--muted)', cursor: 'pointer', padding: '5px 8px',
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onResendNotification(u)}
                      title="Resend notification email"
                      style={{
                        background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)',
                        borderRadius: 7, color: 'var(--blue)', cursor: 'pointer', padding: '5px 8px',
                      }}
                    >
                      <Send size={13} />
                    </button>
                    <button
                      onClick={() => onResendWelcome(u)}
                      disabled={resendingId === u.id}
                      title="Resend welcome email"
                      style={{
                        background: 'rgba(23,138,110,.1)', border: '1px solid rgba(23,138,110,.25)',
                        borderRadius: 7, color: 'var(--gold)',
                        cursor: resendingId === u.id ? 'not-allowed' : 'pointer',
                        padding: '5px 8px', opacity: resendingId === u.id ? 0.6 : 1,
                      }}
                    >
                      <Mail size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(u)}
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
  );
}
