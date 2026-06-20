import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Hand, Lock } from 'lucide-react';

export interface DeliveryMarker {
  challanId: number;
  challanNo: string | null;
  vehicleNo?: string | null;
  truck: { lat: number; lng: number } | null;
  site: { lat: number; lng: number; name?: string | null } | null;
}

// Small colored pin built from a divIcon so we don't depend on image assets and
// can visually separate the moving truck (gold) from the fixed site (green).
function dot(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:2px solid rgba(0,0,0,.35);
      box-shadow:0 3px 8px rgba(0,0,0,.4);display:grid;place-items:center;">
      <span style="transform:rotate(45deg);font-size:14px;line-height:1">${glyph}</span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26],
  });
}

const truckIcon = dot('var(--gold, #f7c948)', '🚚');
const siteIcon = dot('#22c55e', '📍');

// Refits the map to every visible marker whenever the set of coordinates
// changes, so trucks and sites stay in frame as positions update.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 14));
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
  }, [points, map]);
  return null;
}

// Toggles Leaflet's touch/scroll handlers so that on mobile the map only
// captures touch once the user opts in. While locked, the container is left
// scrollable (touch-action: pan-y) so the page keeps scrolling normally.
function GestureGate({ interactive }: { interactive: boolean }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (interactive) {
      map.dragging.enable();
      map.touchZoom.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      container.style.touchAction = '';
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      container.style.touchAction = 'pan-y';
    }
  }, [interactive, map]);
  return null;
}

export default function LiveDeliveryMap({ markers }: { markers: DeliveryMarker[] }) {
  const [isMobile, setIsMobile] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const points = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    for (const m of markers) {
      if (m.truck) pts.push([m.truck.lat, m.truck.lng]);
      if (m.site) pts.push([m.site.lat, m.site.lng]);
    }
    return pts;
  }, [markers]);

  if (points.length === 0) return null;

  const center = points[0];
  // Desktop always interactive; on mobile only after the user enables it.
  const interactive = !isMobile || enabled;
  const showHint = isMobile && !enabled;

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 14 }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: 300, width: '100%' }}
        scrollWheelZoom={!isMobile}
        dragging={!isMobile}
        touchZoom={!isMobile}
        doubleClickZoom={!isMobile}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        <GestureGate interactive={interactive} />
        {markers.map(m => (
          <div key={m.challanId}>
            {m.truck && m.site && (
              <Polyline
                positions={[[m.truck.lat, m.truck.lng], [m.site.lat, m.site.lng]]}
                pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6 6', opacity: 0.7 }}
              />
            )}
            {m.site && (
              <Marker position={[m.site.lat, m.site.lng]} icon={siteIcon}>
                <Popup>{m.site.name || 'Delivery site'}</Popup>
              </Marker>
            )}
            {m.truck && (
              <Marker position={[m.truck.lat, m.truck.lng]} icon={truckIcon}>
                <Popup>
                  {m.challanNo || 'Mixer'}{m.vehicleNo ? ` · ${m.vehicleNo}` : ''}
                </Popup>
              </Marker>
            )}
          </div>
        ))}
      </MapContainer>

      {showHint && (
        // Full-cover tap target. touch-action: pan-y lets the page keep
        // scrolling over the map; a stationary tap enables map gestures.
        <button
          type="button"
          onClick={() => setEnabled(true)}
          aria-label="Enable map interaction"
          style={{
            position: 'absolute', inset: 0, zIndex: 500,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: 'none', cursor: 'pointer', touchAction: 'pan-y',
            background: 'color-mix(in srgb, #050d18 35%, transparent)',
            color: '#fff', font: 'inherit',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 999,
            background: 'rgba(5,13,24,.78)', border: '1px solid rgba(255,255,255,.18)',
            fontSize: 13, fontWeight: 700,
          }}>
            <Hand size={15} /> Use two fingers to move the map
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Tap to enable zoom &amp; pan</span>
        </button>
      )}

      {isMobile && enabled && (
        <button
          type="button"
          onClick={() => setEnabled(false)}
          aria-label="Lock map and resume page scroll"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 500,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(5,13,24,.82)', border: '1px solid rgba(255,255,255,.18)',
            color: '#fff', fontSize: 11, fontWeight: 700,
          }}
        >
          <Lock size={13} /> Lock map
        </button>
      )}
    </div>
  );
}
