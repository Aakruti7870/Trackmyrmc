import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useSSE } from '@/lib/useSSE';
import {
  Siren, AlertTriangle, Car, Wrench, HeartPulse, ShieldAlert, HandCoins, HelpCircle,
  CheckCircle, Clock, MapPin, User,
} from 'lucide-react';

type EType = 'accident' | 'breakdown' | 'medical' | 'safety' | 'theft' | 'other';

const TYPE_META: Record<EType, { label: string; icon: React.ElementType }> = {
  accident:  { label: 'Accident',  icon: Car },
  breakdown: { label: 'Breakdown', icon: Wrench },
  medical:   { label: 'Medical',   icon: HeartPulse },
  safety:    { label: 'Safety',    icon: ShieldAlert },
  theft:     { label: 'Theft',     icon: HandCoins },
  other:     { label: 'Other',     icon: HelpCircle },
};

type Status = 'open' | 'acknowledged' | 'resolved';

interface Emergency {
  id: number;
  driverName: string | null;
  type: string;
  message: string | null;
  lat: string | null;
  lng: string | null;
  status: Status;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<Status, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  open:         { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',  icon: AlertTriangle, label: 'Open' },
  acknowledged: { color: 'var(--blue)',  bg: 'rgba(56,189,248,.12)', icon: Clock,         label: 'Acknowledged' },
  resolved:     { color: 'var(--green)', bg: 'rgba(34,197,94,.12)',  icon: CheckCircle,   label: 'Resolved' },
};

const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

function fmtTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Emergencies() {
  const { showToast } = useToast();
  const { subscribe } = useSSE();
  const [rows, setRows] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('open');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback((f: Status | 'all') => {
    const path = f === 'all' ? '/emergencies' : `/emergencies?status=${f}`;
    return api.get<Emergency[]>(path)
      .then(setRows)
      .catch(() => showToast('Could not load emergencies', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(filter); }, [filter, load]);

  // Live-refresh when a new SOS lands while this screen is open.
  useEffect(() => {
    const unsub = subscribe('emergency.raised', () => load(filter));
    return () => { unsub(); };
  }, [subscribe, load, filter]);

  async function update(id: number, status: 'acknowledged' | 'resolved') {
    setBusyId(id);
    try {
      await api.patch(`/emergencies/${id}`, { status });
      showToast(status === 'acknowledged' ? 'Acknowledged' : 'Marked resolved', 'success');
      load(filter);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(239,68,68,.14)', color: 'var(--red)' }}>
          <Siren size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Emergencies</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Driver SOS alerts</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            background: filter === f.key ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--chip-bg)',
            border: filter === f.key ? '1px solid color-mix(in srgb, var(--gold) 55%, transparent)' : '1px solid var(--line)',
            color: filter === f.key ? 'var(--gold)' : 'var(--muted)',
          }}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>No emergencies in this view.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => {
            const st = STATUS_STYLES[r.status];
            const StIcon = st.icon;
            const M = TYPE_META[r.type as EType] || TYPE_META.other;
            const TIcon = M.icon;
            const hasCoords = r.lat != null && r.lng != null;
            return (
              <div key={r.id} style={{ ...card, borderColor: r.status === 'open' ? 'rgba(239,68,68,.35)' : 'var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: st.bg, color: st.color }}>
                      <TIcon size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{M.label}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}>
                        <User size={13} /> {r.driverName || 'Driver'} · {fmtTime(r.createdAt)}
                      </div>
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg }}>
                    <StIcon size={13} /> {st.label}
                  </span>
                </div>

                {r.message && <div style={{ fontSize: 13.5, marginTop: 10 }}>{r.message}</div>}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  {hasCoords && (
                    <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer"
                      style={{ ...btnGhost, textDecoration: 'none' }}>
                      <MapPin size={14} /> View location
                    </a>
                  )}
                  <div style={{ flex: 1 }} />
                  {r.status === 'open' && (
                    <button onClick={() => update(r.id, 'acknowledged')} disabled={busyId === r.id}
                      style={{ ...btnGhost, color: 'var(--blue)', borderColor: 'color-mix(in srgb, var(--blue) 40%, transparent)' }}>
                      <Clock size={14} /> Acknowledge
                    </button>
                  )}
                  {r.status !== 'resolved' && (
                    <button onClick={() => update(r.id, 'resolved')} disabled={busyId === r.id}
                      style={{ ...btnGhost, background: 'var(--green)', color: '#04231c', border: 'none' }}>
                      <CheckCircle size={14} /> Resolve
                    </button>
                  )}
                </div>

                {r.acknowledgedByName && r.status !== 'open' && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Acknowledged by {r.acknowledgedByName}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 16,
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10,
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
