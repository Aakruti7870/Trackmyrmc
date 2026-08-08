import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, MapClickCapture } from '@/components/map';
import { useMapHandle } from '@/components/map/handle';
import L from 'leaflet';
import { ArrowLeft, Search, Crosshair, MapPin, Loader2, Check, ChevronLeft } from 'lucide-react';
import { getMapEngine } from '@/lib/mapEngine';

// A full-screen, Rapido/Uber/Swiggy-style delivery location picker. Two steps:
//   1. "search" — type an address, live suggestions, plus Use-Current-Location
//      and Select-on-Map shortcuts.
//   2. "map"    — a draggable pin the customer fine-tunes, then confirms.
// It resolves a { lat, lng, address, placeId } and hands it back to the caller;
// it never navigates, so opening it from inside the order form can't bounce the
// customer to the homepage the way a nested <form> submit did.

export interface PickedLocation { lat: number; lng: number; address: string; placeId: string | null }

// Self-contained inline SVG pin — no network fetch, works on BOTH the Google and
// Leaflet compat engines (the Google layer converts this divIcon HTML into the
// AdvancedMarkerElement content).
const PIN_SVG = `<svg width="34" height="46" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><path fill="#0f766e" stroke="#ffffff" stroke-width="1.5" d="M12 .75C6.2.75 1.5 5.45 1.5 11.25c0 7.5 10.5 19.5 10.5 19.5s10.5-12 10.5-19.5C22.5 5.45 17.8.75 12 .75z"/><circle cx="12" cy="11.25" r="3.75" fill="#ffffff"/></svg>`;
const markerIcon = L.divIcon({ html: PIN_SVG, className: 'dlp-pin', iconSize: [34, 46], iconAnchor: [17, 46] });

const DEFAULT_CENTER = { lat: 18.5204, lng: 73.8567 }; // Pune, India

interface GeoHit { lat: number; lng: number; address: string; placeId: string | null }
interface Prediction { label: string; placeId?: string; lat?: number; lng?: number }

// Geocode a free-text query. Prefers Google's geocoder (better hit rate for
// Indian addresses/landmarks and returns a place_id) and falls back to the free
// Nominatim service so search still works when no Google key is configured.
async function geocodeQuery(q: string, signal?: AbortSignal): Promise<GeoHit[]> {
  if (getMapEngine() === 'google' && window.google?.maps) {
    try {
      const geocoder = new google.maps.Geocoder();
      const resp = await geocoder.geocode({ address: q, region: 'in' });
      if (resp.results.length) {
        return resp.results.slice(0, 6).map(r => ({
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          address: r.formatted_address,
          placeId: r.place_id ?? null,
        }));
      }
    } catch { /* fall through to Nominatim */ }
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Search failed');
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return data.map(d => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), address: d.display_name, placeId: null }));
}

// Live "as you type" predictions. Uses Google Places Autocomplete when the
// Places library is loaded (real place_id per prediction); otherwise degrades to
// a debounced geocoder lookup so suggestions still appear on the free stack.
async function fetchPredictions(input: string, signal?: AbortSignal): Promise<Prediction[]> {
  if (getMapEngine() === 'google' && window.google?.maps?.places) {
    try {
      const svc = new google.maps.places.AutocompleteService();
      const resp = await svc.getPlacePredictions({ input, componentRestrictions: { country: 'in' } });
      if (resp?.predictions?.length) {
        return resp.predictions.map(p => ({ label: p.description, placeId: p.place_id }));
      }
    } catch { /* fall through to geocoder suggestions */ }
  }
  const hits = await geocodeQuery(input, signal);
  return hits.map(h => ({ label: h.address, lat: h.lat, lng: h.lng, placeId: h.placeId ?? undefined }));
}

// Resolve a Google Places prediction (place_id only) to coordinates + address.
async function resolvePlaceId(placeId: string): Promise<GeoHit | null> {
  if (window.google?.maps) {
    try {
      const geocoder = new google.maps.Geocoder();
      const resp = await geocoder.geocode({ placeId });
      const r = resp.results[0];
      if (r) return { lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), address: r.formatted_address, placeId: r.place_id ?? placeId };
    } catch { /* ignore */ }
  }
  return null;
}

// Turn a dropped/dragged pin back into a human address (+ place_id when Google).
async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<{ address: string; placeId: string | null }> {
  if (getMapEngine() === 'google' && window.google?.maps) {
    try {
      const geocoder = new google.maps.Geocoder();
      const resp = await geocoder.geocode({ location: { lat, lng } });
      const r = resp.results[0];
      if (r) return { address: r.formatted_address, placeId: r.place_id ?? null };
    } catch { /* fall through */ }
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (res.ok) {
      const d = (await res.json()) as { display_name?: string };
      if (d?.display_name) return { address: d.display_name, placeId: null };
    }
  } catch { /* ignore */ }
  return { address: '', placeId: null };
}

// Recenters the map imperatively when the draft coordinate changes, without
// re-mounting the map container.
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const handle = useMapHandle();
  useEffect(() => {
    handle.setView([lat, lng], Math.max(handle.getZoom(), 16));
  }, [lat, lng, handle]);
  return null;
}

export default function DeliveryLocationPicker({
  initial, onConfirm, onClose,
}: {
  initial: PickedLocation | null;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}) {
  // Start on the map when an existing pin is being adjusted; otherwise on search.
  const [step, setStep] = useState<'search' | 'map'>(initial ? 'map' : 'search');
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<PickedLocation | null>(initial);
  const [reverseBusy, setReverseBusy] = useState(false);

  const predAbort = useRef<AbortController | null>(null);
  const revAbort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lock the scroll container (#app-main) while the picker overlay is open.
  // Body is already overflow:hidden in the app shell; locking #app-main prevents
  // the underlying page from scrolling behind the full-screen picker.
  useEffect(() => {
    const el = document.getElementById('app-main');
    if (!el) return;
    const prev = el.style.overflowY;
    el.style.overflowY = 'hidden';
    return () => { el.style.overflowY = prev; };
  }, []);

  useEffect(() => () => { predAbort.current?.abort(); revAbort.current?.abort(); }, []);

  // Focus the search box when that step is shown.
  useEffect(() => { if (step === 'search') inputRef.current?.focus(); }, [step]);

  // Debounced live predictions as the customer types. All state updates happen
  // inside the timer (never synchronously in the effect body) so we don't trigger
  // cascading renders on every keystroke.
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 3) { setPredictions([]); setSearching(false); return; }
      setSearching(true);
      predAbort.current?.abort();
      const ctrl = new AbortController();
      predAbort.current = ctrl;
      fetchPredictions(q, ctrl.signal)
        .then(list => { if (!ctrl.signal.aborted) { setPredictions(list); setNote(list.length ? '' : 'No match — try a nearby landmark or drop a pin.'); } })
        .catch(err => { if ((err as Error).name !== 'AbortError') setNote('Could not search right now — drop a pin instead.'); })
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, 320);
    return () => clearTimeout(t);
  }, [query]);

  // Move to the map step centred on a chosen hit, and start reverse-geocoding if
  // we only have coordinates without a tidy address.
  function goToMap(hit: GeoHit) {
    setDraft({ lat: hit.lat, lng: hit.lng, address: hit.address, placeId: hit.placeId });
    setStep('map');
    setNote('');
  }

  async function pickPrediction(p: Prediction) {
    if (typeof p.lat === 'number' && typeof p.lng === 'number') {
      goToMap({ lat: p.lat, lng: p.lng, address: p.label, placeId: p.placeId ?? null });
      return;
    }
    if (p.placeId) {
      setResolving(true);
      setNote('');
      const hit = await resolvePlaceId(p.placeId);
      setResolving(false);
      if (hit) { goToMap({ ...hit, address: hit.address || p.label }); return; }
      setNote('Could not open that place — try another or drop a pin.');
    }
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) { setNote('Location is not available on this device.'); return; }
    const { requestLocationDisclosure } = await import('@/lib/locationDisclosure');
    const ok = await requestLocationDisclosure();
    if (!ok) return;
    setLocating(true);
    setNote('');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const rev = await reverseGeocode(lat, lng);
        setLocating(false);
        goToMap({ lat, lng, address: rev.address, placeId: rev.placeId });
      },
      () => { setNote('Could not get your location — search or drop a pin instead.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // A manual pin (tap or drag) on the map: update coords immediately, then
  // reverse-geocode to refresh the address label + place_id in the background.
  function movePin(lat: number, lng: number) {
    setDraft(d => ({ lat, lng, address: d?.address ?? '', placeId: null }));
    revAbort.current?.abort();
    const ctrl = new AbortController();
    revAbort.current = ctrl;
    setReverseBusy(true);
    reverseGeocode(lat, lng, ctrl.signal)
      .then(rev => { if (!ctrl.signal.aborted) setDraft(d => (d ? { ...d, address: rev.address || d.address, placeId: rev.placeId } : d)); })
      .catch(() => { /* keep coords, address stays as-is */ })
      .finally(() => { if (!ctrl.signal.aborted) setReverseBusy(false); });
  }

  const center = draft ?? DEFAULT_CENTER;

  const shell: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 5000, background: 'var(--bg)',
    display: 'flex', flexDirection: 'column',
  };
  const topBar: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    borderBottom: '1px solid var(--line)', background: 'var(--surface, var(--bg))', flexShrink: 0,
  };
  const iconBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38,
    borderRadius: 10, background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0,
  };

  return (
    <div style={shell} role="dialog" aria-modal="true" aria-label="Choose delivery location">
      {step === 'search' ? (
        <>
          <div style={topBar}>
            <button type="button" onClick={onClose} title="Back to order form" style={iconBtn}><ArrowLeft size={18} /></button>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search delivery location"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '11px 12px 11px 34px', borderRadius: 10,
                  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 14,
                }}
              />
              {searching && <Loader2 size={16} className="dlp-spin" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', flexShrink: 0 }}>
            <button type="button" onClick={useCurrentLocation} disabled={locating} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
              border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', fontSize: 13, fontWeight: 700, cursor: locating ? 'wait' : 'pointer',
            }}>
              {locating ? <Loader2 size={15} className="dlp-spin" /> : <Crosshair size={15} />} Use Current Location
            </button>
            <button type="button" onClick={() => { setStep('map'); setNote(''); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10,
              background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              <MapPin size={15} /> Select on Map
            </button>
          </div>

          {note && <div style={{ padding: '0 16px 8px', fontSize: 12.5, color: 'var(--red)' }}>{note}</div>}
          {resolving && <div style={{ padding: '0 16px 8px', fontSize: 12.5, color: 'var(--muted)' }}>Opening place…</div>}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {predictions.map((p, i) => (
              <button
                key={`${p.placeId ?? p.label}-${i}`}
                type="button"
                onClick={() => pickPrediction(p)}
                style={{
                  display: 'flex', gap: 11, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                  padding: '13px 16px', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
                  border: 'none', borderBottom: '1px solid var(--line)', fontSize: 13.5,
                }}
              >
                <MapPin size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--gold)' }} />
                <span>{p.label}</span>
              </button>
            ))}
            {query.trim().length < 3 && (
              <div style={{ padding: '18px 16px', fontSize: 13, color: 'var(--muted)' }}>
                Start typing an address or landmark, use your current location, or pick a spot on the map.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={topBar}>
            <button type="button" onClick={() => { setStep('search'); setNote(''); }} title="Back to search" style={iconBtn}><ChevronLeft size={18} /></button>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>Adjust the delivery pin</div>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <MapContainer center={[center.lat, center.lng]} zoom={draft ? 16 : 12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickCapture onPick={p => movePin(p.lat, p.lng)} />
              {draft && <Recenter lat={draft.lat} lng={draft.lng} />}
              {draft && (
                <Marker
                  position={[draft.lat, draft.lng]}
                  icon={markerIcon}
                  draggable
                  eventHandlers={{ dragend(e) { const ll = (e.target as L.Marker).getLatLng(); movePin(ll.lat, ll.lng); } }}
                />
              )}
            </MapContainer>
          </div>

          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--line)', background: 'var(--surface, var(--bg))', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 12 }}>
              <MapPin size={17} style={{ flexShrink: 0, marginTop: 1, color: 'var(--gold)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                  {draft ? (draft.address || (reverseBusy ? 'Finding address…' : 'Pinned location')) : 'Tap the map to drop a pin'}
                </div>
                {draft && (
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                    {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)} · drag the pin to fine-tune
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={!draft}
              onClick={() => { if (draft) onConfirm(draft); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px',
                borderRadius: 12, border: 'none', fontSize: 14.5, fontWeight: 800,
                background: draft ? 'var(--gold)' : 'var(--chip-bg)', color: draft ? '#fff' : 'var(--muted)',
                cursor: draft ? 'pointer' : 'not-allowed',
              }}
            >
              <Check size={17} /> Confirm Delivery Location
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes dlp-spin{to{transform:rotate(360deg)}}.dlp-spin{animation:dlp-spin .8s linear infinite}.dlp-pin{background:none;border:none}`}</style>
    </div>
  );
}
