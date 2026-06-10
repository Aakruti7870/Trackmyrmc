import { useState, useEffect, useCallback, useRef } from 'react';
import { api, type Challan, type PositionUpdateResult } from '@/lib/api';
import { Truck, MapPin, CheckCircle, Clock, Package, AlertCircle, CalendarDays, Navigation, Satellite, AlertTriangle } from 'lucide-react';

const STATUS_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  pending:    { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 10%, transparent)',  icon: Clock },
  dispatched: { color: 'var(--blue)', bg: 'rgba(56,189,248,.1)', icon: Truck },
  delivered:  { color: 'var(--green)', bg: 'rgba(34,197,94,.1)',  icon: CheckCircle },
  cancelled:  { color: 'var(--red)', bg: 'rgba(239,68,68,.1)',  icon: AlertCircle },
};

const POST_INTERVAL_MS = 10000;
const GEOFENCE_RADIUS_M = 150;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function TripCard({ challan, onMarkDelivered, tracking, liveDistanceM }: {
  challan: Challan; onMarkDelivered: (id: number) => void; tracking: boolean; liveDistanceM?: number | null;
}) {
  const s = STATUS_STYLES[challan.status] || STATUS_STYLES.pending;
  const StatusIcon = s.icon;
  const isActionable = challan.status === 'dispatched';
  const [marking, setMarking] = useState(false);
  const hasPin = challan.siteLat != null && challan.siteLng != null;

  async function handleMark() {
    setMarking(true);
    try { await onMarkDelivered(challan.id); } finally { setMarking(false); }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: `1px solid color-mix(in srgb, ${s.color} 16%, transparent)`,
      borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,.28)',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 72, height: 72, borderRadius: '0 16px 0 72px',
        background: s.bg, display: 'grid', placeItems: 'center', paddingTop: 8, paddingLeft: 8,
      }}>
        <StatusIcon size={18} style={{ color: s.color }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{challan.challanNo}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: s.color, background: s.bg, border: `1px solid color-mix(in srgb, ${s.color} 20%, transparent)`, textTransform: 'capitalize' }}>
          {challan.status}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Grade</div>
          <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 800 }}>{challan.grade}</span>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Volume</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{parseFloat(challan.quantity).toFixed(1)} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>m³</span></div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Client</div>
          <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{challan.clientName || '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>Vehicle</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 700 }}>{challan.vehicleNo || '—'}</div>
        </div>
      </div>

      {challan.siteName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '7px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 8 }}>
          <MapPin size={12} style={{ color: 'var(--muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{challan.siteName}</span>
        </div>
      )}

      {isActionable && tracking && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, padding: '8px 11px', borderRadius: 9,
          background: liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'rgba(34,197,94,.12)' : 'rgba(56,189,248,.09)',
          border: `1px solid ${liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'rgba(56,189,248,.2)'}`,
        }}>
          <Navigation size={13} style={{ color: liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'var(--green)' : 'var(--blue)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: liveDistanceM != null && liveDistanceM <= GEOFENCE_RADIUS_M ? 'var(--green)' : 'var(--blue)' }}>
            {!hasPin ? 'Site has no GPS pin — mark manually'
              : liveDistanceM == null ? 'Locating…'
              : liveDistanceM <= GEOFENCE_RADIUS_M ? 'At site — auto-completing delivery…'
              : `${fmtDist(liveDistanceM)} to site`}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: isActionable ? 14 : 0 }}>
        {challan.dispatchTime && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Dispatched</div>
            <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
              {new Date(challan.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
        {challan.deliveryTime && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Delivered</div>
            <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
              {new Date(challan.deliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>

      {isActionable && (
        <button
          onClick={handleMark}
          disabled={marking}
          style={{
            width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: marking ? 'not-allowed' : 'pointer',
            background: marking ? 'rgba(34,197,94,.2)' : 'linear-gradient(135deg,#16a34a,var(--green))',
            color: '#fff', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: marking ? 'none' : '0 4px 16px rgba(34,197,94,.3)', transition: 'all .2s',
          }}
        >
          <CheckCircle size={15} />
          {marking ? 'Marking…' : 'Mark as Delivered'}
        </button>
      )}
    </div>
  );
}

function GPSPanel({
  tracking, geoState, geoMsg, lastFix, nearestM, activeCount, onToggle,
}: {
  tracking: boolean;
  geoState: 'off' | 'active' | 'denied' | 'unsupported' | 'error';
  geoMsg: string;
  lastFix: { accuracy: number | null; at: number } | null;
  nearestM: number | null;
  activeCount: number;
  onToggle: () => void;
}) {
  const on = tracking && geoState === 'active';
  return (
    <div style={{
      background: on ? 'linear-gradient(135deg,rgba(34,197,94,.1),rgba(8,17,31,.9))' : 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: `1px solid ${on ? 'color-mix(in srgb, var(--green) 28%, transparent)' : 'rgba(255,255,255,.08)'}`,
      borderRadius: 16, padding: 18, marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: on ? 'color-mix(in srgb, var(--green) 16%, transparent)' : 'rgba(56,189,248,.1)',
            border: `1px solid ${on ? 'color-mix(in srgb, var(--green) 30%, transparent)' : 'rgba(56,189,248,.2)'}`,
            position: 'relative',
          }}>
            <Satellite size={20} style={{ color: on ? 'var(--green)' : 'var(--blue)' }} />
            {on && <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 0 0 rgba(34,197,94,.5)', animation: 'rmc-pulse 1.8s infinite' }} />}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Live GPS Auto-Delivery</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {on ? 'Tracking your location — deliveries complete automatically on arrival'
                  : `Trips auto-complete when you arrive within ${GEOFENCE_RADIUS_M} m of the site`}
            </div>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={activeCount === 0 && !on}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11,
            cursor: activeCount === 0 && !on ? 'not-allowed' : 'pointer',
            background: on ? 'rgba(239,68,68,.14)' : (activeCount === 0 ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#16a34a,var(--green))'),
            color: on ? 'var(--red)' : (activeCount === 0 ? 'var(--muted)' : '#fff'),
            border: on ? '1px solid color-mix(in srgb, var(--red) 30%, transparent)' : '1px solid transparent',
            fontSize: 13, fontWeight: 800, transition: 'all .2s', whiteSpace: 'nowrap',
          }}
        >
          <Navigation size={15} />
          {on ? 'Stop tracking' : 'Start tracking'}
        </button>
      </div>

      {on && (
        <div style={{ display: 'flex', gap: 22, marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Nearest site</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{nearestM == null ? '—' : fmtDist(nearestM)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>GPS accuracy</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{lastFix?.accuracy != null ? `±${Math.round(lastFix.accuracy)} m` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Last fix</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
              {lastFix ? new Date(lastFix.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
            </div>
          </div>
        </div>
      )}

      {(geoState === 'denied' || geoState === 'unsupported' || geoState === 'error') && geoMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 12px', borderRadius: 10,
          background: 'rgba(239,68,68,.1)', border: '1px solid color-mix(in srgb, var(--red) 26%, transparent)',
          color: 'var(--red)', fontSize: 12, fontWeight: 600,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          {geoMsg}
        </div>
      )}
    </div>
  );
}

export default function MyTrips() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [filter, setFilter] = useState<'all' | 'dispatched' | 'delivered'>('all');
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const [tracking, setTracking] = useState(false);
  const [geoState, setGeoState] = useState<'off' | 'active' | 'denied' | 'unsupported' | 'error'>('off');
  const [geoMsg, setGeoMsg] = useState('');
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; accuracy: number | null; at: number } | null>(null);
  const [liveDist, setLiveDist] = useState<Record<number, number | null>>({});

  const lastFixRef = useRef<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postingRef = useRef(false);
  const challansRef = useRef<Challan[]>([]);
  useEffect(() => { challansRef.current = challans; }, [challans]);

  const load = useCallback((all: boolean) => {
    setLoading(true);
    const url = all ? '/me/trips?from=2020-01-01' : '/me/trips';
    api.get<Challan[]>(url)
      .then(rows => { setChallans(rows); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(viewAll); }, [load, viewAll]);

  async function handleMarkDelivered(id: number) {
    await api.put(`/challans/${id}`, { status: 'delivered' });
    let challanNo = '';
    setChallans(prev => prev.map(c => {
      if (c.id === id) { challanNo = c.challanNo; return { ...c, status: 'delivered', deliveryTime: new Date().toISOString() }; }
      return c;
    }));
    setConfirmation(`${challanNo} marked as delivered`);
    window.setTimeout(() => setConfirmation(''), 4000);
  }

  // Push the latest fix to the server for each active (dispatched) trip. The
  // server runs the authoritative geofence and may auto-complete a delivery.
  const doPost = useCallback(async () => {
    const fix = lastFixRef.current;
    if (!fix || postingRef.current) return;
    const active = challansRef.current.filter(c => c.status === 'dispatched');
    if (!active.length) return;
    postingRef.current = true;
    try {
      const results = await Promise.allSettled(active.map(c =>
        api.post<PositionUpdateResult>('/positions', {
          challanId: c.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy,
        }).then(r => ({ id: c.id, no: c.challanNo, r }))
      ));
      const dist: Record<number, number | null> = {};
      const deliveredNos: string[] = [];
      for (const res of results) {
        if (res.status === 'fulfilled') {
          dist[res.value.id] = res.value.r.distanceM;
          if (res.value.r.delivered) deliveredNos.push(res.value.no);
        }
      }
      setLiveDist(prev => ({ ...prev, ...dist }));
      if (deliveredNos.length) {
        const set = new Set(deliveredNos);
        setChallans(prev => prev.map(c => set.has(c.challanNo) ? { ...c, status: 'delivered', deliveryTime: new Date().toISOString() } : c));
        setConfirmation(`${deliveredNos.join(', ')} auto-delivered on arrival`);
        window.setTimeout(() => setConfirmation(''), 5000);
      }
    } finally {
      postingRef.current = false;
    }
  }, []);

  // Start/stop geolocation watch + heartbeat poll while tracking is enabled.
  useEffect(() => {
    if (!tracking) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoState('unsupported');
      setGeoMsg('This device or browser does not support GPS location.');
      setTracking(false);
      return;
    }
    setGeoState('active');
    setGeoMsg('');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const f = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        };
        lastFixRef.current = f;
        setLastFix({ ...f, at: Date.now() });
        void doPost();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState('denied');
          setGeoMsg('Location permission denied. Enable location access in your browser settings to use auto-delivery.');
          setTracking(false);
        } else {
          setGeoState('error');
          setGeoMsg(err.message || 'Unable to read your location. Make sure GPS is on and try again.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    // Heartbeat: re-post the last fix even while stationary so the geofence can
    // accumulate the consecutive in-radius fixes it needs to auto-complete.
    intervalRef.current = setInterval(() => { void doPost(); }, POST_INTERVAL_MS);

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [tracking, doPost]);

  // Auto-stop tracking once there are no active trips left to deliver.
  useEffect(() => {
    if (tracking && !challans.some(c => c.status === 'dispatched')) {
      setTracking(false);
      setGeoState('off');
      setLastFix(null);
      lastFixRef.current = null;
    }
  }, [challans, tracking]);

  const filtered = filter === 'all' ? challans : challans.filter(c => c.status === filter);
  const active = challans.filter(c => c.status === 'dispatched').length;
  const delivered = challans.filter(c => c.status === 'delivered').length;
  const totalVol = challans.filter(c => c.status === 'delivered').reduce((s, c) => s + parseFloat(c.quantity || '0'), 0);

  // Nearest active site distance for the GPS panel header (prefer server value,
  // fall back to a client-side estimate from the last fix).
  const nearestM = (() => {
    const dispatched = challans.filter(c => c.status === 'dispatched');
    let best: number | null = null;
    for (const c of dispatched) {
      let d = liveDist[c.id];
      if ((d == null || d === undefined) && lastFix && c.siteLat != null && c.siteLng != null) {
        d = Math.round(haversineM(lastFix.lat, lastFix.lng, Number(c.siteLat), Number(c.siteLng)));
      }
      if (d != null && (best == null || d < best)) best = d;
    }
    return best;
  })();

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <style>{`@keyframes rmc-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 8px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}`}</style>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px' }}>My Trips</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
            {viewAll ? 'All assigned delivery challans' : "Today's assigned delivery challans"}
          </p>
        </div>
        <button
          onClick={() => setViewAll(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: viewAll ? 'color-mix(in srgb, var(--gold) 15%, transparent)' : 'rgba(255,255,255,.06)',
            border: `1px solid ${viewAll ? '#f7c94844' : 'rgba(255,255,255,.1)'}`,
            borderRadius: 10, cursor: 'pointer', color: viewAll ? 'var(--gold)' : 'var(--muted)',
            fontSize: 12, fontWeight: 600, transition: 'all .2s',
          }}
        >
          <CalendarDays size={14} />
          {viewAll ? 'Today only' : 'View history'}
        </button>
      </div>

      {confirmation && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '12px 16px',
          background: 'rgba(34,197,94,.12)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
          borderRadius: 12, color: 'var(--green)', fontSize: 13, fontWeight: 700,
        }}>
          <CheckCircle size={16} />
          {confirmation}
        </div>
      )}

      <GPSPanel
        tracking={tracking}
        geoState={geoState}
        geoMsg={geoMsg}
        lastFix={lastFix}
        nearestM={nearestM}
        activeCount={active}
        onToggle={() => {
          if (tracking) { setTracking(false); setGeoState('off'); }
          else { setGeoState('active'); setGeoMsg(''); setTracking(true); }
        }}
      />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Active Trips', value: active, color: 'var(--blue)', icon: Truck },
          { label: 'Delivered', value: delivered, color: 'var(--green)', icon: CheckCircle },
          { label: 'Volume Delivered', value: `${totalVol.toFixed(1)} m³`, color: '#a78bfa', icon: Package },
        ].map(k => (
          <div key={k.label} style={{
            background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
            border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `color-mix(in srgb, ${k.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${k.color} 19%, transparent)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <k.icon size={17} style={{ color: k.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([['all', 'All'], ['dispatched', 'Active'], ['delivered', 'Delivered']] as const).map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter(val)} style={{
            padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            background: filter === val ? 'linear-gradient(135deg,var(--surface),var(--panel2))' : 'transparent',
            color: filter === val ? 'var(--text)' : 'var(--muted)',
            boxShadow: filter === val ? '0 2px 8px rgba(0,0,0,.25)' : 'none',
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, color: 'var(--muted)',
          background: 'rgba(15,28,54,.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,.06)',
        }}>
          <Truck size={36} style={{ opacity: .3, display: 'block', margin: '0 auto 12px' }} />
          {viewAll ? 'No trips found' : 'No trips assigned for today'}
          {!viewAll && (
            <button onClick={() => setViewAll(true)} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              View trip history →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {filtered.map(c => (
            <TripCard key={c.id} challan={c} onMarkDelivered={handleMarkDelivered} tracking={tracking && geoState === 'active'} liveDistanceM={liveDist[c.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
