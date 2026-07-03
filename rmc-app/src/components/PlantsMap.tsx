import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, FitBounds } from '@/components/map';
import L from 'leaflet';
import { Factory, MapPin, Phone, Navigation } from 'lucide-react';
import { api } from '@/lib/api';
import { useMapEngine } from '@/lib/mapEngine';

export interface MapPlant {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  contactNumber: string | null;
  latitude: number;
  longitude: number;
  grades: string[] | null;
  openTime: string | null;
  closeTime: string | null;
  openNow: boolean;
}

// HTML pin rendered identically by Leaflet (divIcon) and the Google engine
// (translated to AdvancedMarkerElement content by the compat layer).
function plantPin(openNow: boolean): L.DivIcon {
  const ring = openNow ? '#22c55e' : '#94a3b8';
  return L.divIcon({
    className: 'plant-pin',
    html: `<div style="position:relative;width:34px;height:42px;">
      <div style="width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:linear-gradient(135deg,#178a6e,#0f5c4a);border:2.5px solid ${ring};box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(45deg)"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
      </div>
    </div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38],
  });
}

// Normalize an Indian phone number for wa.me links: digits only, and a bare
// 10-digit local number gets the country code prefixed.
function waPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  return digits;
}

const btnStyle = (bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  flex: '1 1 0', minWidth: 0, minHeight: 36, padding: '7px 8px', borderRadius: 9,
  background: bg, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
  whiteSpace: 'nowrap',
});

function PlantPopupCard({ p }: { p: MapPlant }) {
  const phone = p.contactNumber?.trim() || '';
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.55, minWidth: 210, maxWidth: 250, color: '#0f2e29' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 13.5, overflowWrap: 'anywhere' }}>{p.name}</strong>
        <span style={{
          flexShrink: 0, padding: '2px 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 800,
          background: p.openNow ? 'rgba(34,197,94,.15)' : 'rgba(148,163,184,.2)',
          color: p.openNow ? '#15803d' : '#64748b',
        }}>
          {p.openNow ? '● OPEN' : '● CLOSED'}
        </span>
      </div>
      {(p.address || p.city) && (
        <div style={{ color: '#4b6560', marginTop: 3, overflowWrap: 'anywhere' }}>
          {[p.address, p.city].filter(Boolean).join(', ')}
        </div>
      )}
      {(p.openTime || p.closeTime) && (
        <div style={{ color: '#4b6560', marginTop: 2 }}>
          Hours: {p.openTime ?? '—'} – {p.closeTime ?? '—'}
        </div>
      )}
      {p.grades && p.grades.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {p.grades.slice(0, 6).map(g => (
            <span key={g} style={{ padding: '1px 7px', borderRadius: 6, background: 'rgba(23,138,110,.12)', color: '#0f5c4a', fontSize: 10.5, fontWeight: 700 }}>{g}</span>
          ))}
          {p.grades.length > 6 && <span style={{ fontSize: 10.5, color: '#64748b' }}>+{p.grades.length - 6}</span>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {phone && (
          <a href={`tel:${phone}`} style={btnStyle('#178a6e')} aria-label={`Call ${p.name}`}>
            <Phone size={13} /> Call
          </a>
        )}
        {phone && (
          <a href={`https://wa.me/${waPhone(phone)}`} target="_blank" rel="noopener noreferrer" style={btnStyle('#25d366')} aria-label={`WhatsApp ${p.name}`}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
            WhatsApp
          </a>
        )}
        <a href={directions} target="_blank" rel="noopener noreferrer" style={btnStyle('#38bdf8')} aria-label={`Directions to ${p.name}`}>
          <Navigation size={13} /> Directions
        </a>
      </div>
    </div>
  );
}

export default function PlantsMap() {
  const engine = useMapEngine();
  const [plantsData, setPlantsData] = useState<MapPlant[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<MapPlant[]>('/plants/map')
      .then(d => { if (alive) { setPlantsData(Array.isArray(d) ? d : []); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const points = useMemo<[number, number][]>(
    () => plantsData.map(p => [p.latitude, p.longitude]),
    [plantsData],
  );
  const center: [number, number] = points[0] ?? [19.033, 73.0297]; // Navi Mumbai fallback
  const openCount = plantsData.filter(p => p.openNow).length;

  return (
    <div className="glass-card" style={{ padding: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(23,138,110,.2), rgba(23,138,110,.08))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)',
          }}>
            <Factory size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Plant Network Map</h3>
            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>All RMC plants — tap a marker for details &amp; actions</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'rgba(23,138,110,.12)', color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={12} /> {plantsData.length} plant{plantsData.length === 1 ? '' : 's'}
          </span>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, background: 'rgba(34,197,94,.12)', color: '#22c55e', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> {openCount} open now
          </span>
        </div>
      </div>

      <div className="plants-map-shell" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} singleZoom={13} />
          {plantsData.map(p => (
            <Marker key={p.id} position={[p.latitude, p.longitude]} icon={plantPin(p.openNow)}>
              <Popup>
                <PlantPopupCard p={p} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {loaded && plantsData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px 8px', fontSize: 13, color: 'var(--muted)' }}>
          No verified plants with a confirmed location yet.
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', flexShrink: 0 }} />
        {engine === 'google'
          ? 'Map powered by Google Maps.'
          : 'Map via OpenStreetMap — Google Maps activates automatically once a valid key is configured.'}
      </p>
    </div>
  );
}
