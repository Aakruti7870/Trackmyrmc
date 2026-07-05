import { useState, useEffect, useMemo } from 'react';
import { MapPin, Navigation, Clock, Truck, Radio, Gauge } from 'lucide-react';
import { api, type LivePosition } from '@/lib/api';
import LiveDeliveryMap, { type DeliveryMarker } from '@/components/LiveDeliveryMap';

const DOTS = ['#178a6e', '#22c55e', '#38bdf8', '#a78bfa', '#f97316'];

function fmtDistance(m: number | null): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function LiveGPSTracker() {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Real live fixes from the dispatch feed, refreshed on an interval (this feed
  // is staff-scoped and polled, not pushed — the SSE 'vehicle.position' event is
  // scoped to a challan's own client/driver, so staff never receive it).
  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<LivePosition[]>('/positions')
        .then(d => {
          if (!alive) return;
          const list = Array.isArray(d)
            ? d.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number')
            : [];
          setPositions(list);
          setLastUpdate(new Date());
          setSelected(prev =>
            prev != null && list.some(p => p.challanId === prev)
              ? prev
              : list[0]?.challanId ?? null,
          );
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const markers = useMemo<DeliveryMarker[]>(
    () =>
      positions.map(p => ({
        challanId: p.challanId,
        challanNo: p.challanNo,
        vehicleNo: p.vehicleNo,
        truck: { lat: p.lat, lng: p.lng },
        // The dispatch feed carries the truck fix + site name but no site
        // coordinates, so only the moving mixer is pinned on the map (the site
        // name still shows in the list + detail row).
        site: null,
      })),
    [positions],
  );

  const selVehicle = positions.find(p => p.challanId === selected);

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Driver Live GPS</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,.12)', color: '#22c55e' }}>{positions.length} ON ROAD</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>

      <div className="ck-gps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 200px' }}>
        <div style={{ position: 'relative', minHeight: 220, background: 'radial-gradient(circle at 50% 50%, #0d1f38, #050d18)' }}>
          {markers.length > 0 ? (
            <LiveDeliveryMap markers={markers} height={220} bare />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Navigation size={28} color="#263449" />
              <span style={{ color: '#263449', fontSize: 13, fontWeight: 600 }}>No vehicles transmitting</span>
            </div>
          )}
        </div>

        <div className="ck-gps-list" style={{ borderLeft: '1px solid var(--line)', overflowY: 'auto', maxHeight: 220 }}>
          {positions.length === 0 && (
            <div style={{ padding: '20px 12px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>Dispatch a challan and start the trip to see live tracking</div>
          )}
          {positions.map((p, i) => {
            const isSel = selected === p.challanId;
            const col = DOTS[i % DOTS.length];
            const dist = fmtDistance(p.distanceM);
            return (
              <div key={p.challanId} onClick={() => setSelected(p.challanId)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isSel ? 'var(--menu-hover)' : 'transparent', transition: 'background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{p.vehicleNo || 'Mixer'}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.driverName || 'Unassigned'}</div>
                <div style={{ display: 'flex', gap: 6, paddingLeft: 14 }}>
                  <span style={{ fontSize: 10, color: col, fontWeight: 700 }}><Gauge size={9} style={{ display: 'inline', marginRight: 2 }} />{p.speed != null ? Math.round(p.speed) : 0} km/h</span>
                  {dist && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{dist} to site</span>}
                </div>
                {p.siteName && <div style={{ paddingLeft: 14, marginTop: 3, fontSize: 9, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {p.siteName}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {selVehicle && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '10px 16px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Truck size={14} color="#178a6e" /><span style={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{selVehicle.vehicleNo || 'Mixer'}</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}><span style={{ color: 'var(--text)', fontWeight: 600 }}>{selVehicle.driverName || 'Unassigned'}</span></div>
          {selVehicle.siteName && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}><MapPin size={12} color="#22c55e" /><span style={{ color: 'var(--muted)' }}>{selVehicle.siteName}</span></div>}
          {fmtDistance(selVehicle.distanceM) && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}><Clock size={12} color="#38bdf8" /><span style={{ color: 'var(--text)', fontWeight: 700 }}>{fmtDistance(selVehicle.distanceM)} to site</span></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
            <Radio size={11} color="#22c55e" />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>{selVehicle.speed != null ? Math.round(selVehicle.speed) : 0} km/h</span>
            {selVehicle.challanNo && <span>· Challan #{selVehicle.challanNo}</span>}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.3); } }`}</style>
    </div>
  );
}
