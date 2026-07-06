import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, MapClickCapture } from '@/components/map';
import { useMapHandle } from '@/components/map/handle';
import L from 'leaflet';
import { Crosshair, Search, Loader2, MapPin } from 'lucide-react';
import { getMapEngine } from '@/lib/mapEngine';

// Leaflet's default marker PNGs are resolved relative to the CSS and break
// under bundlers, and a remote CDN copy silently vanishes when the network /
// CSP blocks it — leaving the pin invisible so a dropped location looks like
// nothing happened. Use a self-contained inline SVG pin instead: it needs no
// network, and the Google compat layer converts this divIcon HTML into the
// AdvancedMarkerElement content, so the same pin shows on BOTH map engines.
const PIN_SVG = `<svg width="32" height="42" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path fill="#0f766e" stroke="#ffffff" stroke-width="1.5" d="M12 .75C6.2.75 1.5 5.45 1.5 11.25c0 7.5 10.5 19.5 10.5 19.5s10.5-12 10.5-19.5C22.5 5.45 17.8.75 12 .75z"/><circle cx="12" cy="11.25" r="3.75" fill="#ffffff"/></svg>`;
const markerIcon = L.divIcon({
  html: PIN_SVG,
  className: 'lp-pin',
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -40],
});

export interface LatLng { lat: number; lng: number }

// Default view: Pune, India (the plant's region) when no pin is set yet.
const DEFAULT_CENTER: LatLng = { lat: 18.5204, lng: 73.8567 };

// Recenters the map imperatively when the value changes from outside
// (geolocation, search) without re-mounting the container.
function Recenter({ center }: { center: LatLng }) {
  const handle = useMapHandle();
  // Depend on the raw coordinates, NOT the object — `center` is a fresh literal
  // on every render, so keying on the object would re-center on every keystroke
  // in the search box and fight the user panning the map. Only an actual
  // coordinate change (search, geolocation, pin drop) should move the view.
  useEffect(() => {
    handle.setView([center.lat, center.lng], Math.max(handle.getZoom(), 15));
  }, [center.lat, center.lng, handle]);
  return null;
}

interface GeoResult { lat: string; lon: string; display_name: string }

// Shared geocoder used by BOTH the search box and the automatic address→pin
// follow. Prefers Google's geocoder when Google Maps is active (better hit rate
// for Indian addresses/landmarks) and falls back to the free Nominatim service.
async function geocodeQuery(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  let data: GeoResult[] = [];
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
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Search failed');
    data = (await res.json()) as GeoResult[];
  }
  return data;
}

export default function LocationPicker({
  value, onChange, address,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  // When provided, the map automatically geocodes this address and drops the pin
  // as the customer fills it in — until they adjust the pin themselves, after
  // which the map stops following the text so their manual choice is respected.
  address?: string;
}) {
  const center = value ?? DEFAULT_CENTER;
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [autoPinned, setAutoPinned] = useState(false);
  // Geocoder matches the customer can pick from. We show a short list rather
  // than silently snapping to the first hit, so an ambiguous address (several
  // towns with the same name) is resolvable instead of landing on the wrong pin.
  const [results, setResults] = useState<GeoResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const autoAbortRef = useRef<AbortController | null>(null);
  // True once the customer picks/drops/drags the pin themselves — freezes the
  // automatic address-follow so we never yank their chosen spot away.
  const manualRef = useRef(false);
  // Last address string we auto-geocoded; seeded with the initial address so an
  // order that already has a pin + address isn't re-geocoded on mount.
  const lastGeoRef = useRef<string>(address ?? '');
  // Hold the latest onChange without making it an effect dependency (the parent
  // passes a fresh inline handler each render).
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => () => { abortRef.current?.abort(); autoAbortRef.current?.abort(); }, []);

  // Automatic address → pin. Debounced so we geocode the settled address rather
  // than every keystroke, and skipped once the customer has placed the pin
  // manually so their adjustment is never overridden.
  useEffect(() => {
    const addr = (address ?? '').trim();
    if (manualRef.current || addr.length < 6 || addr === lastGeoRef.current) return;
    const t = setTimeout(() => {
      autoAbortRef.current?.abort();
      const ctrl = new AbortController();
      autoAbortRef.current = ctrl;
      geocodeQuery(addr, ctrl.signal)
        .then(data => {
          if (ctrl.signal.aborted || manualRef.current) return;
          lastGeoRef.current = addr;
          if (data.length) {
            onChangeRef.current({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
            setAutoPinned(true);
            setNote('');
          }
        })
        .catch(() => { /* silent — the customer can still search or drop a pin */ });
    }, 700);
    return () => clearTimeout(t);
  }, [address]);

  // Centralise MANUAL pin updates so every path (search pick, map click,
  // my-location, drag) clears the results list AND freezes the auto-follow.
  function pick(p: LatLng) {
    manualRef.current = true;
    setAutoPinned(false);
    setResults([]);
    onChange(p);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    manualRef.current = true;
    setAutoPinned(false);
    setSearching(true);
    setNote('');
    setResults([]);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await geocodeQuery(q, ctrl.signal);
      if (!data.length) { setNote('No match found — try a nearby landmark or drop a pin.'); return; }
      // Jump straight to the best match — searching a place should take you
      // there and drop the pin immediately, no extra tap. When several places
      // share the name we still list the alternatives below so an ambiguous
      // search can be corrected with one tap.
      onChange({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      setResults(data.length > 1 ? data : []);
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
          {value
            ? (autoPinned
                ? 'Pinned from your address · drag the pin to fine-tune'
                : `Pin: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`)
            : 'Type the delivery address above, or tap the map to drop a pin.'}
        </span>
        {note && <span style={{ fontSize: 11.5, color: 'var(--red)' }}>{note}</span>}
      </div>

      <style>{`@keyframes lp-spin{to{transform:rotate(360deg)}}.lp-spin{animation:lp-spin .8s linear infinite}.lp-pin{background:none;border:none;}`}</style>
    </div>
  );
}
