import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, FitBounds } from '@/components/map';
import { useMapHandle } from '@/components/map/handle';
import L from 'leaflet';
import { Hand, Lock, Radio, Phone, Clock, MapPin, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useSSE } from '@/lib/useSSE';

// A single on-duty staff member as returned by GET /attendance/live. This is the
// same payload LiveDrivers renders, extended (in #469) with plant + presence so
// the duty map can label every role, not just drivers.
export interface DutyStaff {
  userId: number;
  name: string | null;
  phone: string | null;
  role: string | null;
  plantId: number | null;
  plantName: string | null;
  driverId: number | null;
  vehicleNo: string | null;
  checkInAt: string;
  status: string;
  presence: 'online' | 'gps_inactive';
  lastUpdatedAt: string | null;
  tripChallanId: number | null;
  location: { lat: number; lng: number; speed: number | null; heading: number | null; updatedAt: string } | null;
}

// SSE driver.location payload — a generic per-user fix reused for all roles.
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

// Per-role colour + short label so each marker/list row reads at a glance.
const ROLE_META: Record<string, { label: string; color: string }> = {
  authority:        { label: 'Super Admin', color: '#a78bfa' },
  admin:            { label: 'Admin', color: '#38bdf8' },
  plant_owner:      { label: 'Plant Owner', color: '#38bdf8' },
  supervisor:       { label: 'Supervisor', color: '#0ea5e9' },
  dispatcher:       { label: 'Dispatcher', color: '#f59e0b' },
  plant_operator:   { label: 'Plant Operator', color: '#14b8a6' },
  fleet_manager:    { label: 'Fleet Manager', color: '#ec4899' },
  quality_engineer: { label: 'Quality Engineer', color: '#8b5cf6' },
  driver:           { label: 'Driver', color: 'var(--gold, #178a6e)' },
};

function roleMeta(role: string | null) {
  return (role && ROLE_META[role]) || { label: role ? role.replace(/_/g, ' ') : 'Staff', color: 'var(--muted)' };
}

// Coloured teardrop pin with a white glyph, built from a divIcon so we don't rely
// on image assets. Colour comes from the staff member's role.
function pin(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:2px solid rgba(0,0,0,.35);
      box-shadow:0 3px 8px rgba(0,0,0,.4);display:grid;place-items:center;">
      <svg style="transform:rotate(45deg)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
    popupAnchor: [0, -24],
  });
}

// Cache one icon per colour so we don't rebuild divIcons on every render.
const iconCache = new Map<string, L.DivIcon>();
function iconFor(color: string) {
  let ic = iconCache.get(color);
  if (!ic) { ic = pin(color); iconCache.set(color, ic); }
  return ic;
}

function fmtTime(iso: string | null): string {
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

// Toggles map gesture handling so that on mobile the map only captures touch once
// the user opts in (matches LiveDeliveryMap).
function GestureGate({ interactive }: { interactive: boolean }) {
  const handle = useMapHandle();
  useEffect(() => { handle.setInteractive(interactive); }, [interactive, handle]);
  return null;
}

export default function LiveDutyMap({ title = 'Live Duty Map', maxHeight = 340 }: { title?: string; maxHeight?: number }) {
  const [staff, setStaff] = useState<DutyStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [, force] = useState(0);
  const { subscribe } = useSSE();
  const loadingRef = useRef(false);

  const load = () => {
    if (loadingRef.current) return Promise.resolve();
    loadingRef.current = true;
    return api.get<{ drivers: DutyStaff[] }>('/attendance/live')
      .then((res) => { setStaff(res.drivers); setError(''); })
      .catch(() => setError('Could not load on-duty staff.'))
      .finally(() => { setLoading(false); loadingRef.current = false; });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Live updates: merge each incoming fix, drop a member on check-out, and reload
  // when someone new comes on shift or the stream reconnects.
  useEffect(() => {
    const unsubLoc = subscribe('driver.location', (raw: unknown) => {
      const e = raw as LocationEvent;
      setStaff((prev) => {
        const idx = prev.findIndex((d) => d.userId === e.userId);
        const location = { lat: e.lat, lng: e.lng, speed: e.speed, heading: e.heading, updatedAt: e.updatedAt };
        if (idx === -1) { load(); return prev; }
        const next = [...prev];
        next[idx] = {
          ...next[idx], location,
          presence: 'online', lastUpdatedAt: e.updatedAt,
          vehicleNo: e.vehicleNo ?? next[idx].vehicleNo,
        };
        return next;
      });
    });
    const unsubOff = subscribe('driver.offline', (raw: unknown) => {
      const { userId } = raw as { userId: number };
      setStaff((prev) => prev.filter((d) => d.userId !== userId));
    });
    const unsubReconnect = subscribe('reconnect', () => { load(); });
    return () => { unsubLoc(); unsubOff(); unsubReconnect(); };
  }, [subscribe]);

  // Keep relative "last fix" times fresh.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const located = useMemo(() => staff.filter((s) => s.location), [staff]);
  const points = useMemo<[number, number][]>(
    () => located.map((s) => [s.location!.lat, s.location!.lng]),
    [located],
  );

  const onlineCount = staff.filter((s) => s.presence === 'online').length;
  const interactive = !isMobile || enabled;
  const showHint = isMobile && !enabled;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
      <style>{`@keyframes dmBlink{0%,100%{opacity:1}50%{opacity:.25}}.dm-dot{width:8px;height:8px;border-radius:50%;display:inline-block;animation:dmBlink 1.2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.dm-dot{animation:none}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Radio size={18} color="var(--gold)" />
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h2>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
          {staff.length} on duty · {onlineCount} online
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13,
          background: 'color-mix(in srgb, #ef4444 12%, var(--surface))',
          border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Loading…</div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          <MapPin size={30} style={{ opacity: .3, display: 'block', margin: '0 auto 10px' }} />
          No staff are checked in right now.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(0,1fr)', gap: 14, alignItems: 'stretch' }} className="dm-grid">
          <style>{`@media(max-width:719px){.dm-grid{grid-template-columns:1fr!important}}`}</style>

          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', minHeight: 240 }}>
            {points.length === 0 ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', minHeight: 240, color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                No live GPS fixes yet.<br />Staff appear here once their device shares a location.
              </div>
            ) : (
              <MapContainer
                center={points[0]}
                zoom={12}
                style={{ height: maxHeight, width: '100%' }}
                scrollWheelZoom={!isMobile}
                dragging={!isMobile}
                touchZoom={!isMobile}
                doubleClickZoom={!isMobile}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds points={points} maxZoom={15} singleZoom={13} />
                <GestureGate interactive={interactive} />
                {located.map((s) => {
                  const meta = roleMeta(s.role);
                  return (
                    <Marker key={s.userId} position={[s.location!.lat, s.location!.lng]} icon={iconFor(meta.color)}>
                      <Popup>
                        <strong>{s.name || `User #${s.userId}`}</strong><br />
                        {meta.label}{s.vehicleNo ? ` · ${s.vehicleNo}` : ''}<br />
                        {s.plantName ? `${s.plantName} · ` : ''}{ago(s.location!.updatedAt)}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}

            {points.length > 0 && showHint && (
              <button
                type="button"
                onClick={() => setEnabled(true)}
                aria-label="Enable map interaction"
                style={{
                  position: 'absolute', inset: 0, zIndex: 500,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: 'none', cursor: 'pointer', touchAction: 'pan-y',
                  background: 'color-mix(in srgb, #050d18 35%, transparent)', color: '#fff', font: 'inherit',
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
                  background: 'rgba(5,13,24,.78)', border: '1px solid rgba(255,255,255,.18)', fontSize: 13, fontWeight: 700,
                }}>
                  <Hand size={15} /> Use two fingers to move the map
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Tap to enable zoom &amp; pan</span>
              </button>
            )}

            {points.length > 0 && isMobile && enabled && (
              <button
                type="button"
                onClick={() => setEnabled(false)}
                aria-label="Lock map and resume page scroll"
                style={{
                  position: 'absolute', top: 10, right: 10, zIndex: 500,
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
                  background: 'rgba(5,13,24,.82)', border: '1px solid rgba(255,255,255,.18)', color: '#fff', fontSize: 11, fontWeight: 700,
                }}
              >
                <Lock size={13} /> Lock map
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gap: 8, alignContent: 'start', maxHeight, overflowY: 'auto' }}>
            {staff.map((s) => {
              const meta = roleMeta(s.role);
              const online = s.presence === 'online';
              return (
                <div key={s.userId} style={{
                  border: '1px solid var(--line)', borderRadius: 12, padding: 11,
                  background: 'var(--chip-bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name || `User #${s.userId}`}
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3,
                        fontSize: 10.5, fontWeight: 800, color: meta.color,
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: 2, background: meta.color, display: 'inline-block' }} />
                        {meta.label}{s.vehicleNo ? ` · ${s.vehicleNo}` : ''}
                      </span>
                    </div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999,
                      fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0,
                      color: online ? '#16a34a' : '#f59e0b',
                      background: online ? 'color-mix(in srgb, #16a34a 14%, transparent)' : 'color-mix(in srgb, #f59e0b 14%, transparent)',
                      border: `1px solid color-mix(in srgb, ${online ? '#16a34a' : '#f59e0b'} 30%, transparent)`,
                    }}>
                      {online && <span className="dm-dot" style={{ background: '#16a34a' }} />}
                      {online ? 'Online' : 'GPS inactive'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
                    {s.plantName && <Line icon={Building2} text={s.plantName} />}
                    <Line icon={Clock} text={`On shift since ${fmtTime(s.checkInAt)}`} />
                    <Line icon={MapPin} text={s.location ? ago(s.location.updatedAt) : 'no fix yet'} color={s.location ? '#16a34a' : 'var(--muted)'} />
                    {s.phone && (
                      <a href={`tel:${s.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>
                        <Phone size={12} style={{ flexShrink: 0 }} /> {s.phone}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Line({ icon: Icon, text, color }: { icon: React.ElementType; text: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: color ?? 'var(--muted)', fontWeight: 600 }}>
      <Icon size={12} style={{ flexShrink: 0, color: 'var(--muted)' }} />
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </div>
  );
}
