import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, List, Map as MapIcon, Phone, Clock, Navigation, PackagePlus, Loader2, LocateFixed, RefreshCw, Headphones } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import LocationPicker, { type LatLng } from '@/components/LocationPicker';

export interface NearbyPlant {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  contactNumber: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusKm: number;
  grades: string[];
  openTime: string | null;
  closeTime: string | null;
  openNow: boolean;
  distanceKm: number;
}

const RADIUS_KM = 40;
// Single network-wide help line shown when a customer taps a plant.
const HELP_CONTACT = '+91 74982 86760';
const HELP_TEL = '+917498286760';

function dot(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid rgba(0,0,0,.35);box-shadow:0 3px 8px rgba(0,0,0,.4);display:grid;place-items:center;"><span style="transform:rotate(45deg);font-size:14px;line-height:1">${glyph}</span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26],
  });
}
const meIcon = dot('#38bdf8', '🧍');
const plantIcon = dot('var(--gold, #f7c948)', '🏭');

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView(points[0], Math.max(map.getZoom(), 13)); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function NearbyPlants() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [plants, setPlants] = useState<NearbyPlant[] | null>(null);
  const [phase, setPhase] = useState<'locating' | 'loading' | 'ready' | 'geoerror'>('locating');
  const [fetchError, setFetchError] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [manual, setManual] = useState<LatLng | null>(null);
  const focusRef = useRef<number | null>(null);

  const loadPlants = useCallback(async (c: LatLng) => {
    setPhase('loading');
    setFetchError('');
    try {
      const data = await api.get<NearbyPlant[]>(`/plants/nearby?lat=${c.lat}&lng=${c.lng}&radius=${RADIUS_KM}`);
      setPlants(data);
      setPhase('ready');
    } catch (e) {
      setFetchError((e as Error).message || 'Could not load nearby plants.');
      setPhase('ready');
      setPlants([]);
    }
  }, []);

  // Promise-chain loader: all setState happens inside .then/.catch (deferred),
  // so this is safe to call directly from an effect without sync setState.
  const requestLocation = useCallback(() => {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('no-geolocation')); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 12000 },
      );
    })
      .then(c => { setCoords(c); return loadPlants(c); })
      .catch(() => setPhase('geoerror'));
  }, [loadPlants]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  function retryLocation() {
    setPhase('locating');
    requestLocation();
  }

  function useManualLocation() {
    if (!manual) return;
    setCoords(manual);
    loadPlants(manual);
  }

  function placeOrder(p: NearbyPlant) {
    sessionStorage.setItem('rmc_selected_plant', JSON.stringify({ id: p.id, name: p.name }));
    // Logged-in customers go straight to ordering; logged-out landing visitors
    // are funneled to register first (the booking flow lives behind login).
    navigate(user ? '/my-orders' : '/register');
  }

  function viewOnMap(p: NearbyPlant) {
    focusRef.current = p.id;
    setView('map');
  }

  const wrap: React.CSSProperties = { padding: '22px clamp(14px, 4vw, 34px)', maxWidth: 1100, margin: '0 auto' };

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900, letterSpacing: '-0.6px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={26} style={{ color: 'var(--gold)' }} /> Nearby RMC Plants
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Approved plants delivering within {RADIUS_KM} km of your site, nearest first.
          </p>
        </div>
        {phase === 'ready' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setView('list')} style={toggleBtn(view === 'list')}><List size={15} /> List</button>
            <button onClick={() => setView('map')} style={toggleBtn(view === 'map')}><MapIcon size={15} /> Map</button>
            <button onClick={retryLocation} title="Refresh location" style={toggleBtn(false)}><RefreshCw size={15} /></button>
          </div>
        )}
      </div>

      {/* Loading (locating or fetching) */}
      {(phase === 'locating' || phase === 'loading') && (
        <div style={centerCard}>
          <Loader2 size={30} className="np-spin" style={{ color: 'var(--gold)' }} />
          <div style={{ marginTop: 12, fontWeight: 700, color: 'var(--text)' }}>Finding nearby RMC plants...</div>
        </div>
      )}

      {/* Geolocation denied / failed -> manual fallback */}
      {phase === 'geoerror' && (
        <div style={{ ...softCard, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <Navigation size={20} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
              Unable to get your location. Please allow location or enter site address manually.
            </div>
          </div>
          <button onClick={retryLocation} style={{ ...primaryBtn, marginBottom: 16 }}>
            <LocateFixed size={16} /> Try location again
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Or set your site location:</div>
          <LocationPicker value={manual} onChange={setManual} />
          <button onClick={useManualLocation} disabled={!manual} style={{ ...primaryBtn, marginTop: 12, opacity: manual ? 1 : 0.5, cursor: manual ? 'pointer' : 'not-allowed' }}>
            <MapPin size={16} /> Find plants near this location
          </button>
        </div>
      )}

      {/* Results */}
      {phase === 'ready' && plants && (
        <>
          {fetchError && (
            <div style={{ ...softCard, borderColor: 'color-mix(in srgb, var(--red) 45%, transparent)', color: 'var(--red)', marginTop: 14, fontSize: 13.5 }}>
              {fetchError}
            </div>
          )}

          {plants.length === 0 && !fetchError && (
            <div style={centerCard}>
              <MapPin size={30} style={{ color: 'var(--muted)' }} />
              <div style={{ marginTop: 12, fontWeight: 700, color: 'var(--text)' }}>No approved RMC plants found within {RADIUS_KM} km.</div>
              <button onClick={() => setPhase('geoerror')} style={{ ...ghostBtn, marginTop: 14 }}>
                <Navigation size={15} /> Change location
              </button>
            </div>
          )}

          {plants.length > 0 && view === 'list' && (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', marginTop: 16 }}>
              {plants.map(p => <PlantCard key={p.id} p={p} onOrder={() => placeOrder(p)} onMap={() => viewOnMap(p)} />)}
            </div>
          )}

          {plants.length > 0 && view === 'map' && coords && (
            <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <MapContainer center={[coords.lat, coords.lng]} zoom={12} style={{ height: 'min(70vh, 560px)', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitAll points={[[coords.lat, coords.lng], ...plants.map(p => [p.latitude, p.longitude] as [number, number])]} />
                <Marker position={[coords.lat, coords.lng]} icon={meIcon}><Popup>Your location</Popup></Marker>
                {plants.map(p => (
                  <Marker key={p.id} position={[p.latitude, p.longitude]} icon={plantIcon}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{p.distanceKm} km · {p.openNow ? 'Open now' : 'Closed'}</div>
                        <button onClick={() => placeOrder(p)} style={{ background: '#f7c948', color: '#1a1a1a', border: 'none', borderRadius: 8, padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Place Order</button>
                        <div style={{ fontSize: 12, color: '#333', marginTop: 8, paddingTop: 6, borderTop: '1px solid #eee' }}>
                          Need help? <a href={`tel:${HELP_TEL}`} style={{ color: '#0a66c2', fontWeight: 700, textDecoration: 'none' }}>{HELP_CONTACT}</a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes np-spin{to{transform:rotate(360deg)}}.np-spin{animation:np-spin .8s linear infinite}`}</style>
    </div>
  );
}

function PlantCard({ p, onOrder, onMap }: { p: NearbyPlant; onOrder: () => void; onMap: () => void }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02))',
      border: '1px solid var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', lineHeight: 1.25 }}>{p.name}</div>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          {p.distanceKm} km
        </span>
      </div>

      {(p.address || p.city) && (
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{[p.address, p.city].filter(Boolean).join(', ')}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
        {p.contactNumber && (
          <a href={`tel:${p.contactNumber}`} style={{ display: 'flex', gap: 5, alignItems: 'center', color: 'var(--text)', textDecoration: 'none' }}>
            <Phone size={13} /> {p.contactNumber}
          </a>
        )}
        <span style={{ display: 'flex', gap: 5, alignItems: 'center', color: p.openNow ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
          <Clock size={13} /> {p.openNow ? 'Open now' : 'Closed'}
          {p.openTime && p.closeTime && <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {p.openTime}–{p.closeTime}</span>}
        </span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <Navigation size={13} /> Delivers {p.deliveryRadiusKm} km
        </span>
      </div>

      {p.grades.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {p.grades.map(g => (
            <span key={g} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--blue)', background: 'color-mix(in srgb, var(--blue) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--blue) 30%, transparent)', borderRadius: 7, padding: '2px 8px' }}>{g}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>
        <Headphones size={13} /> Help:&nbsp;
        <a href={`tel:${HELP_TEL}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{HELP_CONTACT}</a>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <button onClick={onMap} style={{ ...ghostBtn, flex: 1 }}><MapIcon size={15} /> View on map</button>
        <button onClick={onOrder} style={{ ...primaryBtn, flex: 1 }}><PackagePlus size={15} /> Place Order</button>
      </div>
    </div>
  );
}

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: active ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'rgba(255,255,255,.04)',
    color: active ? 'var(--gold)' : 'var(--text)',
    border: `1px solid ${active ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'var(--line)'}`,
  };
}
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 800,
  background: 'var(--gold)', color: '#1a1a1a', border: 'none',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
  background: 'rgba(255,255,255,.05)', color: 'var(--text)', border: '1px solid var(--line)',
};
const centerCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  padding: '54px 20px', marginTop: 16, borderRadius: 14, border: '1px solid var(--line)', background: 'rgba(255,255,255,.02)',
};
const softCard: React.CSSProperties = {
  padding: 18, borderRadius: 14, border: '1px solid var(--line)', background: 'rgba(255,255,255,.02)',
};
