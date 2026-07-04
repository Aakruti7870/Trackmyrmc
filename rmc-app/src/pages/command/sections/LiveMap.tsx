import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, FitBounds } from '@/components/map';
import L from 'leaflet';
import { MapPin, Navigation, Gauge } from 'lucide-react';
import { api, type LivePosition } from '@/lib/api';
import { useMapEngine } from '@/lib/mapEngine';
import { SectionHeading, GlassPanel, StatCard, LiveDot, } from '../ui';
import { mix } from '../tokens';

// Custom marker icon — bundled Leaflet PNGs break under Vite, so we point at the
// CDN copies (see project convention for maps).
const truckIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

export default function LiveMap({ accent, showStats = true }: { accent: string; showStats?: boolean }) {
  const engine = useMapEngine();
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => api.get<LivePosition[]>('/positions')
      .then(d => { if (alive) { setPositions(Array.isArray(d) ? d : []); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const points = useMemo<[number, number][]>(
    () => positions.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number').map(p => [p.lat, p.lng]),
    [positions],
  );
  const center: [number, number] = points[0] ?? [19.033, 73.0297]; // Navi Mumbai fallback
  const moving = positions.filter(p => (p.speed ?? 0) > 1).length;

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<MapPin size={20} />} accent={accent}
        title="Live GPS Tracking"
        subtitle="Every in-transit mixer across the network, updated every 15s"
        right={<LiveDot color={accent} />}
      />

      {showStats && (
        <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14 }}>
          <StatCard icon={<Navigation size={17} />} label="Vehicles tracked" accent={accent} value={positions.length} />
          <StatCard icon={<Gauge size={17} />} label="On the move" accent="var(--green)" value={moving} />
          <StatCard icon={<MapPin size={17} />} label="Idle / stopped" accent="var(--orange)" value={Math.max(0, positions.length - moving)} />
        </div>
      )}

      <GlassPanel accent={accent} style={{ padding: 6, overflow: 'hidden' }}>
        <div style={{ borderRadius: 14, overflow: 'hidden', height: 440 }}>
          <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} singleZoom={12} />
            {positions.map(p => (
              <Marker key={p.challanId} position={[p.lat, p.lng]} icon={truckIcon}>
                <Popup>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                    <strong>{p.vehicleNo ?? 'Vehicle'}</strong><br />
                    Driver: {p.driverName ?? '—'}<br />
                    Challan: {p.challanNo ?? '—'}<br />
                    Site: {p.siteName ?? '—'}<br />
                    Status: {p.status}{p.speed != null ? ` • ${Math.round(p.speed)} km/h` : ''}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        {loaded && positions.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '14px 8px', fontSize: 13, color: 'var(--muted)',
          }}>
            No mixers are transmitting live positions right now.
          </div>
        )}
      </GlassPanel>

      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: mix(accent, 90), display: 'inline-block' }} />
        {engine === 'google'
          ? 'Live map powered by Google Maps.'
          : 'Maps & geocoding via OpenStreetMap — no third-party map key required.'}
      </p>
    </div>
  );
}
