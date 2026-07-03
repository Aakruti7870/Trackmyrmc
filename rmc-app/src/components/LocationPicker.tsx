import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, MapClickCapture } from '@/components/map';
import { useMapHandle } from '@/components/map/handle';
import L from 'leaflet';
import { Crosshair, Search, Loader2, MapPin } from 'lucide-react';
import { getMapEngine } from '@/lib/mapEngine';

// Leaflet's default marker images are resolved relative to the CSS and break
// under bundlers. Point them at the CDN copies once, globally.
const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

export interface LatLng { lat: number; lng: number }

// Default view: Pune, India (the plant's region) when no pin is set yet.
const DEFAULT_CENTER: LatLng = { lat: 18.5204, lng: 73.8567 };

// Recenters the map imperatively when the value changes from outside
// (geolocation, search) without re-mounting the container.
function Recenter({ center }: { center: LatLng }) {
  const handle = useMapHandle();
  useEffect(() => {
    handle.setView([center.lat, center.lng], Math.max(handle.getZoom(), 15));
  }, [center, handle]);
  return null;
}

interface GeoResult { lat: string; lon: string; display_name: string }

export default function LocationPicker({
  value, onChange,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
}) {
  const center = value ?? DEFAULT_CENTER;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  // Geocoder matches the customer can pick from. We show a short list rather
  // than silently snapping to the first hit, so an ambiguous address (several
  // towns with the same name) is resolvable instead of landing on the wrong pin.
  const [results, setResults] = useState<GeoResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Centralise pin updates so every path (search pick, map click, my-location,
  // drag) also clears the open results list.
  function pick(p: LatLng) {
    setResults([]);
    onChange(p);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setNote('');
    setResults([]);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      let data: GeoResult[] = [];
      // Prefer Google's geocoder when Google Maps is active — better hit rate
      // for Indian addresses/landmarks. Any failure falls back to Nominatim.
      if (getMapEngine() === 'google' && window.google?.maps) {
        try {
          const geocoder = new google.maps.Geocoder();
          const resp = await geocoder.geocode({ address: q, region: 'in' });
          data = resp.results.slice(0, 5).map(r => ({
            lat: String(r.geometry.location.lat()),
            lon: String(r.geometry.location.lng()),
            display_name: r.formatted_address,
          }));
        } catch {
          data = [];
        }
      }
      if (!data.length) {
        // Free Nominatim geocoder — no API key. Bias results to India.
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Search failed');
        data = (await res.json()) as GeoResult[];
      }
      if (!data.length) { setNote('No match found — try a nearby landmark or drop a pin.'); return; }
      // A single confident hit applies straight away; multiple matches are
      // listed so the customer disambiguates.
      if (data.length === 1) { pick({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }); }
      else { setResults(data); }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setNote('Could not search right now — drop a pin instead.');
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setNote('Location is not available on this device.'); return; }
    setLocating(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      pos => { pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { setNote('Could not get your location — drop a pin instead.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <form onSubmit={search} style={{ display: 'flex', gap: 6, flex: 1, minWidth: 200 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search address or landmark…"
            style={{
              flex: 1, padding: '8px 11px', borderRadius: 9, boxSizing: 'border-box',
              background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13,
            }}
          />
          <button type="submit" disabled={searching} title="Search" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 11px', borderRadius: 9, cursor: searching ? 'wait' : 'pointer',
            background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700,
          }}>
            {searching ? <Loader2 size={14} className="lp-spin" /> : <Search size={14} />}
          </button>
        </form>
        <button type="button" onClick={useMyLocation} disabled={locating} title="Use my location" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: 9, cursor: locating ? 'wait' : 'pointer',
          background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
          border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {locating ? <Loader2 size={14} className="lp-spin" /> : <Crosshair size={14} />} My location
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginBottom: 8, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--chip-bg)' }}>
          {results.map((r, i) => (
            <button
              key={`${r.lat},${r.lon},${i}`}
              type="button"
              onClick={() => pick({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) })}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                padding: '9px 11px', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
                border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 12.5, fontWeight: 600,
              }}
            >
              <MapPin size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--gold)' }} />
              <span>{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={value ? 15 : 12}
          style={{ height: 260, width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickCapture onPick={pick} />
          <Recenter center={center} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend(e) {
                  const m = e.target as L.Marker;
                  const ll = m.getLatLng();
                  pick({ lat: ll.lat, lng: ll.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {value ? `Pin: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : 'Tap the map to drop a pin.'}
        </span>
        {note && <span style={{ fontSize: 11.5, color: 'var(--red)' }}>{note}</span>}
      </div>

      <style>{`@keyframes lp-spin{to{transform:rotate(360deg)}}.lp-spin{animation:lp-spin .8s linear infinite}`}</style>
    </div>
  );
}
