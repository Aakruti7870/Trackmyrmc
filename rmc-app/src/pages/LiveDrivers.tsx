import { useEffect, useState } from 'react';
import { Radio, Phone, Truck, MapPin, Clock, Navigation } from 'lucide-react';
import { api } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';

interface DriverLive {
  userId: number;
  name: string | null;
  phone: string | null;
  role: string | null;
  driverId: number | null;
  vehicleNo: string | null;
  checkInAt: string;
  status: string;
  tripChallanId: number | null;
  location: { lat: number; lng: number; speed: number | null; heading: number | null; updatedAt: string } | null;
}

// SSE driver.location payload — a superset of the row's location fields.
interface LocationEvent {
  userId: number;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  driverId?: number | null;
  vehicleNo?: string | null;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  updatedAt: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  on_duty:      { label: 'On duty', color: '#38bdf8' },
  dispatched:   { label: 'Dispatched', color: 'var(--gold)' },
  in_transit:   { label: 'In transit', color: 'var(--gold)' },
  reached_site: { label: 'At site', color: '#a78bfa' },
  unloading:    { label: 'Unloading', color: '#22c55e' },
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ago(iso: string | null): string {
  if (!iso) return 'no fix yet';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 'no fix yet';
  const s = Math.round(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export default function LiveDrivers() {
  const [drivers, setDrivers] = useState<DriverLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, force] = useState(0);
  const { subscribe } = useSSE();

  const load = () => {
    return api.get<{ drivers: DriverLive[] }>('/attendance/live')
      .then((res) => { setDrivers(res.drivers); setError(''); })
      .catch(() => setError('Could not load live drivers.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Live updates: merge each incoming fix into the matching driver row, drop a
  // driver when they check out, and refresh trip status when it advances.
  useEffect(() => {
    const unsubLoc = subscribe('driver.location', (raw: unknown) => {
      const e = raw as LocationEvent;
      setDrivers((prev) => {
        const idx = prev.findIndex((d) => d.userId === e.userId);
        const location = { lat: e.lat, lng: e.lng, speed: e.speed, heading: e.heading, updatedAt: e.updatedAt };
        if (idx === -1) {
          // A driver who checked in after this page loaded — pull the full row.
          load();
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], location, vehicleNo: e.vehicleNo ?? next[idx].vehicleNo };
        return next;
      });
    });
    const unsubOff = subscribe('driver.offline', (raw: unknown) => {
      const { userId } = raw as { userId: number };
      setDrivers((prev) => prev.filter((d) => d.userId !== userId));
    });
    const unsubTrip = subscribe('trip.updated', () => { load(); });
    const unsubReconnect = subscribe('reconnect', () => { load(); });
    return () => { unsubLoc(); unsubOff(); unsubTrip(); unsubReconnect(); };
  }, [subscribe]);

  // Re-render every 15s so the "last fix" relative times stay current.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes ldBlink{0%,100%{opacity:1}50%{opacity:.25}}.ld-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block;animation:ldBlink 1.2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.ld-dot{animation:none}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={22} color="var(--gold)" />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Live Drivers</h1>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Everyone currently on shift, with their truck, status and last location.</div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13,
          background: 'color-mix(in srgb, #ef4444 12%, var(--surface))',
          border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
      ) : drivers.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--muted)',
          background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--line)',
        }}>
          <Truck size={36} style={{ opacity: .3, display: 'block', margin: '0 auto 12px' }} />
          No one is checked in right now.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(320px, 100%), 1fr))', gap: 14 }}>
          {drivers.map((d) => {
            const meta = STATUS_META[d.status] ?? { label: d.status, color: 'var(--muted)' };
            const loc = d.location;
            return (
              <div key={d.userId} style={{
                background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{d.name || `User #${d.userId}`}</div>
                    {d.role && <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{d.role.replace('_', ' ')}</div>}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
                    color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
                  }}>
                    <span className="ld-dot" style={{ background: meta.color }} /> {meta.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <Row icon={Truck} label="Truck" value={d.vehicleNo || '—'} mono />
                  <Row icon={Phone} label="Phone" value={d.phone || '—'} href={d.phone ? `tel:${d.phone}` : undefined} />
                  <Row icon={Clock} label="On shift since" value={fmt(d.checkInAt)} />
                  <Row
                    icon={MapPin}
                    label="Last location"
                    value={loc ? `${ago(loc.updatedAt)}${loc.speed != null && loc.speed > 1 ? ` · ${Math.round(loc.speed)} km/h` : ''}` : 'no fix yet'}
                    color={loc ? '#16a34a' : 'var(--muted)'}
                  />
                </div>

                {loc && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12,
                      padding: '9px 0', borderRadius: 10, textDecoration: 'none',
                      background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.3)',
                      color: 'var(--blue)', fontSize: 13, fontWeight: 700,
                    }}
                  >
                    <Navigation size={14} /> View on map
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono, href, color }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean; href?: string; color?: string;
}) {
  const valStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: color ?? 'var(--text)',
    fontFamily: mono ? 'monospace' : undefined, textDecoration: 'none',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: 'var(--muted)', width: 96, flexShrink: 0 }}>{label}</span>
      {href ? <a href={href} style={{ ...valStyle, color: 'var(--gold)' }}>{value}</a> : <span style={valStyle}>{value}</span>}
    </div>
  );
}
