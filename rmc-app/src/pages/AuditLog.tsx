import { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, CheckCircle, XCircle, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

type AuditEntry = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  targetUserId: number | null;
  targetUserEmail: string | null;
  status: string | null;
  detail: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

type AuditResponse = {
  rows: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
  actions: string[];
};

const ACTION_LABEL: Record<string, string> = {
  smtp_test: 'SMTP Test',
  password_reset: 'Password Reset',
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
};

const ACTION_COLOR: Record<string, string> = {
  smtp_test: '#22c55e',
  password_reset: '#38bdf8',
  welcome_email: '#38bdf8',
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

function actionLabel(action: string): string {
  return ACTION_LABEL[action] || action.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function actionColor(action: string): string {
  return ACTION_COLOR[action] || 'var(--muted)';
}

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg,rgba(17,30,55,.85),rgba(10,20,40,.9))',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 18,
  boxShadow: '0 8px 32px rgba(0,0,0,.35)',
};

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const load = useCallback(() => {
    // setState lives inside the promise callbacks (never synchronously in the
    // function body) so calling load() from the effect doesn't trigger a
    // cascading render. Loading is set true by the user-triggered actions
    // (refresh, filter, pagination) and the initial useState(true).
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(offset));
    if (actionFilter) params.set('action', actionFilter);
    api.get<AuditResponse>(`/admin/audit-logs?${params.toString()}`)
      .then(res => {
        setRows(res.rows);
        setTotal(res.total);
        // Keep the full action list stable (it is computed unfiltered server-side).
        if (res.actions.length) setActions(res.actions);
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [actionFilter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  function changeFilter(value: string) {
    setLoading(true);
    setActionFilter(value);
    setOffset(0);
  }

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: 'color-mix(in srgb, var(--gold) 13%, transparent)',
          border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
          display: 'grid', placeItems: 'center',
        }}>
          <ScrollText size={20} style={{ color: 'var(--gold)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Audit Log
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            Every system event — email tests, password resets, lockouts and account changes — in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); load(); }}
          disabled={loading}
          title="Refresh"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
            color: 'var(--text)', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        marginBottom: 16,
      }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
          Action
        </label>
        <select
          value={actionFilter}
          onChange={e => changeFilter(e.target.value)}
          style={{
            padding: '9px 12px', borderRadius: 10, minWidth: 200,
            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
            color: 'var(--text)', fontSize: 13, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">All actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          {total > 0 ? `${from}–${to} of ${total}` : '0 entries'}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            No audit log entries{actionFilter ? ' for this action' : ''} yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--muted)' }}>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Detail</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Target</th>
                  <th style={thStyle}>When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(log => {
                  const color = actionColor(log.action);
                  const ok = log.status === 'success';
                  const failed = log.status === 'failure';
                  return (
                    <tr key={log.id} style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                          color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                          whiteSpace: 'nowrap',
                        }}>
                          {actionLabel(log.action)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {log.status ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 12, fontWeight: 600,
                            color: ok ? 'var(--green)' : failed ? 'var(--red)' : 'var(--muted)',
                          }}>
                            {ok ? <CheckCircle size={13} /> : failed ? <XCircle size={13} /> : null}
                            {log.status}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                        {log.emailSent && (
                          <Mail size={12} style={{ color: 'var(--blue)', marginLeft: 6, verticalAlign: 'middle' }} />
                        )}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 260, color: 'var(--muted)' }}>
                        <span style={{ wordBreak: 'break-word' }}>{log.detail || '—'}</span>
                      </td>
                      <td style={tdStyle}>
                        {log.actorName || <span style={{ color: 'var(--muted)' }}>System</span>}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--muted)' }}>
                        {log.targetUserEmail || '—'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {(canPrev || canNext) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => { setLoading(true); setOffset(o => Math.max(0, o - PAGE_SIZE)); }}
            disabled={!canPrev}
            style={pagerStyle(canPrev)}
          >
            <ChevronLeft size={15} />
            Previous
          </button>
          <button
            type="button"
            onClick={() => { setLoading(true); setOffset(o => o + PAGE_SIZE); }}
            disabled={!canNext}
            style={pagerStyle(canNext)}
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px', fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.4px',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', color: 'var(--text)', verticalAlign: 'top',
};

function pagerStyle(enabled: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '9px 16px', borderRadius: 10,
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    color: enabled ? 'var(--text)' : 'var(--muted)', fontSize: 13, fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.5,
  };
}
