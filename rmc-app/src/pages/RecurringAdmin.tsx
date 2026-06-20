import { useState, useEffect } from 'react';
import { api, type RecurringOrder } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Repeat, Pause, Play, Trash2, CalendarClock, MapPin, X, Search } from 'lucide-react';

interface AdminRecurring extends RecurringOrder {
  clientName?: string | null;
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describeSchedule(r: { frequency: string; anchor: number }): string {
  if (r.frequency === 'weekly') return `Every ${DOW[r.anchor] ?? '—'}`;
  const a = r.anchor;
  const suffix = a % 10 === 1 && a !== 11 ? 'st' : a % 10 === 2 && a !== 12 ? 'nd' : a % 10 === 3 && a !== 13 ? 'rd' : 'th';
  return `Monthly on the ${a}${suffix}`;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: '1px solid var(--line)', borderRadius: 16, padding: 20,
      boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.3)', ...style,
    }}>{children}</div>
  );
}

function btnStyle(color: string, busy: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, cursor: busy ? 'wait' : 'pointer',
    background: `color-mix(in srgb, ${color} 12%, transparent)`, color,
    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
    padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, opacity: busy ? 0.6 : 1,
  };
}

export default function RecurringAdmin() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'authority';
  const [rows, setRows] = useState<AdminRecurring[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  useEffect(() => {
    api.get<AdminRecurring[]>('/recurring')
      .then(setRows)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load recurring orders.'))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(r: AdminRecurring) {
    setBusyId(r.id);
    setActionError('');
    try {
      const updated = await api.patch<AdminRecurring>(`/recurring/${r.id}`, { active: !r.active });
      setRows(prev => prev.map(x => (x.id === updated.id ? { ...x, ...updated } : x)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the schedule.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: AdminRecurring) {
    if (!window.confirm(`Delete ${r.clientName ?? 'this client'}'s recurring ${r.grade} schedule? Future orders will stop.`)) return;
    setBusyId(r.id);
    setActionError('');
    try {
      await api.delete(`/recurring/${r.id}`);
      setRows(prev => prev.filter(x => x.id !== r.id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete the schedule.');
    } finally {
      setBusyId(null);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (statusFilter === 'active' && !r.active) return false;
    if (statusFilter === 'paused' && r.active) return false;
    if (!q) return true;
    return (
      (r.clientName ?? '').toLowerCase().includes(q) ||
      (r.siteName ?? '').toLowerCase().includes(q) ||
      r.grade.toLowerCase().includes(q)
    );
  });

  const activeCount = rows.filter(r => r.active).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Repeat size={24} style={{ color: 'var(--gold)' }} /> Recurring Orders
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
          Every customer's standing order schedule — {activeCount} active of {rows.length} total.
          {!canManage && ' (read-only)'}
        </p>
      </div>

      <Card style={{ marginBottom: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220 }}>
          <Search size={15} style={{ color: 'var(--muted)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search client, site or grade…"
            style={{
              flex: 1, padding: '8px 11px', borderRadius: 9, boxSizing: 'border-box',
              background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--chip-bg)', borderRadius: 10, padding: 3 }}>
          {(['all', 'active', 'paused'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 700, textTransform: 'capitalize',
              background: statusFilter === s ? 'linear-gradient(135deg,var(--surface),var(--panel2))' : 'transparent',
              color: statusFilter === s ? 'var(--text)' : 'var(--muted)',
            }}>{s}</button>
          ))}
        </div>
      </Card>

      {actionError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', color: 'var(--red)',
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
        }}>
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'inline-flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            <CalendarClock size={32} style={{ opacity: .4, display: 'block', margin: '0 auto 12px' }} />
            {rows.length === 0 ? 'No recurring orders yet' : 'No schedules match your filters'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Client', 'Grade', 'Qty (m³)', 'Schedule', 'Site', 'Next Order', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const busy = busyId === r.id;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)', opacity: r.active ? 1 : 0.65 }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{r.clientName ?? '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{r.grade}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text)', fontWeight: 700 }}>{parseFloat(r.quantity).toFixed(1)}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CalendarClock size={12} /> {describeSchedule(r)}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 12.5 }}>
                        {r.siteName ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {r.siteName}</span> : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        {new Date(r.nextRunDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                          color: r.active ? 'var(--green)' : 'var(--muted)',
                          background: r.active ? 'rgba(34,197,94,.13)' : 'rgba(159,176,199,.13)',
                        }}>{r.active ? 'Active' : 'Paused'}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {canManage ? (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => toggle(r)} disabled={busy} title={r.active ? 'Pause' : 'Resume'} style={btnStyle(r.active ? 'var(--gold)' : 'var(--green)', busy)}>
                              {r.active ? <Pause size={13} /> : <Play size={13} />} {r.active ? 'Pause' : 'Resume'}
                            </button>
                            <button onClick={() => remove(r)} disabled={busy} title="Delete" style={btnStyle('var(--red)', busy)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ display: 'block', textAlign: 'right', fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
