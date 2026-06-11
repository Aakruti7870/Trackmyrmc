import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function LiveDeliveryMap({ markers }: { markers: DeliveryMarker[] }) {
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

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 14 }}>
      <MapContainer center={center} zoom={13} style={{ height: 300, width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
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
    </div>
  );
}
