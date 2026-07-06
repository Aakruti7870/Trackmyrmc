import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import {
  Siren, AlertTriangle, Car, Wrench, HeartPulse, ShieldAlert, HandCoins, HelpCircle,
  CheckCircle, Clock, MapPin,
} from 'lucide-react';

const TYPES = ['accident', 'breakdown', 'medical', 'safety', 'theft', 'other'] as const;
type EType = typeof TYPES[number];

const TYPE_META: Record<EType, { label: string; icon: React.ElementType }> = {
  accident:  { label: 'Accident',  icon: Car },
  breakdown: { label: 'Breakdown', icon: Wrench },
  medical:   { label: 'Medical',   icon: HeartPulse },
  safety:    { label: 'Safety',    icon: ShieldAlert },
  theft:     { label: 'Theft',     icon: HandCoins },
  other:     { label: 'Other',     icon: HelpCircle },
};

interface Emergency {
  id: number;
  type: string;
  message: string | null;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  open:         { color: 'var(--red)',   bg: 'rgba(239,68,68,.12)',  icon: AlertTriangle, label: 'Open — help coming' },
  acknowledged: { color: 'var(--blue)',  bg: 'rgba(56,189,248,.12)', icon: Clock,         label: 'Acknowledged' },
  resolved:     { color: 'var(--green)', bg: 'rgba(34,197,94,.12)',  icon: CheckCircle,   label: 'Resolved' },
};

function fmtTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function DriverSOS() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<EType>('breakdown');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    return api.get<Emergency[]>('/emergencies/mine')
      .then(setRows)
      .catch(() => showToast('Could not load your alerts', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function raise() {
    setSending(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      await new Promise<void>((resolve) => {
        if (!navigator.geolocation) { resolve(); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve(); },
          () => resolve(),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
        );
      });
      await api.post('/emergencies', { type, message: message.trim() || undefined, lat, lng });
      showToast('Emergency alert sent to your supervisors', 'success');
      setMessage('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send alert', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(239,68,68,.14)', color: 'var(--red)' }}>
          <Siren size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Emergency / SOS</h1>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Instantly alert your supervisors</div>
        </div>
      </div>

      <div style={{ ...card, border: '1px solid rgba(239,68,68,.3)' }}>
        <label style={label}>What's happening?</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(96px, 100%), 1fr))', gap: 8, marginBottom: 16 }}>
          {TYPES.map(t => {
            const M = TYPE_META[t];
            const Icon = M.icon;
            const active = type === t;
            return (
              <button key={t} onClick={() => setType(t)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 6px', borderRadius: 12, cursor: 'pointer',
                background: active ? 'rgba(239,68,68,.14)' : 'var(--chip-bg)',
                border: active ? '1px solid var(--red)' : '1px solid var(--line)',
                color: active ? 'var(--red)' : 'var(--muted)', fontWeight: 700, fontSize: 12,
              }}>
                <Icon size={20} /> {M.label}
              </button>
            );
          })}
        </div>

        <label style={label}>Add details (optional)</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
          placeholder="Describe the situation so help arrives prepared…"
          style={{ ...input, marginBottom: 16, resize: 'vertical' }} />

        <button onClick={raise} disabled={sending} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 16,
          boxShadow: '0 10px 30px rgba(239,68,68,.35)', opacity: sending ? 0.6 : 1,
        }}>
          <Siren size={20} /> {sending ? 'Sending alert…' : 'SEND SOS'}
        </button>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <MapPin size={12} /> Your location is shared with supervisors when available.
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '22px 0 10px' }}>My alerts</h2>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>No emergencies raised. Stay safe.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map(r => {
            const st = STATUS_STYLES[r.status] || STATUS_STYLES.open;
            const StIcon = st.icon;
            const M = TYPE_META[r.type as EType] || TYPE_META.other;
            const TIcon = M.icon;
            return (
              <div key={r.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: st.bg, color: st.color }}>
                      <TIcon size={17} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{M.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtTime(r.createdAt)}</div>
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: st.color, background: st.bg }}>
                    <StIcon size={13} /> {st.label}
                  </span>
                </div>
                {r.message && <div style={{ fontSize: 13, marginTop: 10 }}>{r.message}</div>}
                {r.acknowledgedByName && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    Acknowledged by {r.acknowledgedByName}
                  </div>
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
  background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 16, marginBottom: 12,
};
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
};
