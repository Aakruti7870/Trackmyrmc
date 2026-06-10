import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  History, Search, CheckCircle, XCircle, X, Filter, RotateCcw, Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';

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

type Facets = {
  actions: string[];
  actors: { id: number; name: string | null }[];
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

function actionLabel(action: string) {
  return ACTION_LABEL[action] ?? action;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.4px',
};

const deletedTagStyle: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
  background: 'rgba(239,68,68,.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)',
  textTransform: 'uppercase', letterSpacing: '.3px', whiteSpace: 'nowrap',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Render an audit-log account reference (actor or target). The FK may be null
 * because the account was deleted (ON DELETE SET NULL), but the human-readable
 * label is preserved at write time.
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

type Filters = {
  q: string;
  action: string;
  actorId: string;
  from: string;
  to: string;
};

const emptyFilters: Filters = { q: '', action: '', actorId: '', from: '', to: '' };

export default function ActivityLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [facets, setFacets] = useState<Facets>({ actions: [], actors: [] });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Facets>('/audit-logs/facets').then(setFacets).catch(() => {});
  }, []);

  const fetchLogs = useCallback((f: Filters) => {
    const params = new URLSearchParams();
    if (f.q.trim()) params.set('q', f.q.trim());
    if (f.action) params.set('action', f.action);
    if (f.actorId) params.set('actorId', f.actorId);
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    const qs = params.toString();
    setLoading(true);
    api.get<AuditEntry[]>(`/audit-logs${qs ? `?${qs}` : ''}`)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounce so typing in the free-text box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => fetchLogs(filters), 250);
    return () => clearTimeout(t);
  }, [filters, fetchLogs]);

  const hasActiveFilter = useMemo(
    () => Boolean(filters.q || filters.action || filters.actorId || filters.from || filters.to),
    [filters],
  );

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={22} style={{ color: 'var(--gold)' }} />
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Activity Log</h2>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Every account and email event across the system, newest first
            {logs.length ? ` · ${logs.length} ${logs.length === 1 ? 'entry' : 'entries'}` : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
        border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 16, marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Filter size={15} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Filters</span>
          {hasActiveFilter && (
            <button
              onClick={() => setFilters(emptyFilters)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto',
                padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.15)', color: 'var(--muted)',
              }}
            >
              <RotateCcw size={12} /> Clear filters
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* Free text */}
          <div>
            <span style={labelStyle}>Search</span>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                value={filters.q}
                onChange={e => update('q', e.target.value)}
                placeholder="Email, name, detail…"
                style={{ ...inputStyle, paddingLeft: 32, paddingRight: filters.q ? 30 : 12 }}
              />
              {filters.q && (
                <button
                  onClick={() => update('q', '')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 2 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Action */}
          <div>
            <span style={labelStyle}>Action Type</span>
            <select value={filters.action} onChange={e => update('action', e.target.value)} style={inputStyle}>
              <option value="">All Actions</option>
              {facets.actions.map(a => (
                <option key={a} value={a}>{actionLabel(a)}</option>
              ))}
            </select>
          </div>

          {/* Actor */}
          <div>
            <span style={labelStyle}>Performed By</span>
            <select value={filters.actorId} onChange={e => update('actorId', e.target.value)} style={inputStyle}>
              <option value="">All Admins</option>
              {facets.actors.map(a => (
                <option key={a.id} value={String(a.id)}>{a.name ?? `#${a.id}`}</option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div>
            <span style={labelStyle}>From</span>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={e => update('from', e.target.value)}
                style={{ ...inputStyle, paddingLeft: 32, colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* To date */}
          <div>
            <span style={labelStyle}>To</span>
            <div style={{ position: 'relative' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={e => update('to', e.target.value)}
                style={{ ...inputStyle, paddingLeft: 32, colorScheme: 'dark' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
        border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9fb0c7', fontSize: 13 }}>
            Loading activity…
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9fb0c7', fontSize: 13 }}>
            {hasActiveFilter
              ? 'No activity matches the current filters.'
              : 'No activity recorded yet. Account changes and emails will appear here.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.15)' }}>
                  {['Timestamp', 'Action', 'Details', 'Target Account', 'Performed By', 'Email'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(entry => {
                  const c = ACTION_COLOR[entry.action] ?? '#9fb0c7';
                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatDate(entry.createdAt)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                          background: `color-mix(in srgb, ${c} 13%, transparent)`,
                          color: c, border: `1px solid color-mix(in srgb, ${c} 25%, transparent)`,
                        }}>
                          {actionLabel(entry.action)}
                        </span>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
