import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { MapContainer, TileLayer, Marker, Popup, FitBounds } from '@/components/map';
import L from 'leaflet';
import { MapPin, List, Map as MapIcon, Phone, Clock, Navigation, PackagePlus, Loader2, LocateFixed, RefreshCw, Headphones, Search, ShieldCheck, ShieldAlert, HandHeart, Check } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
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

// A real-world concrete plant discovered live from the public maps directory.
// These are NOT onboarded partner plants — surfaced as unverified leads only.
export interface DiscoveredPlant {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  contactNumber: string | null;
  openNow: boolean | null;
  distanceKm: number;
  source: 'discovered';
}

// Customers can widen the search when their site is farther from the metro
// cluster — the default 40 km only reaches the immediate plants.
const RADIUS_OPTIONS = [40, 80, 100, 150, 250] as const;
const DEFAULT_RADIUS_KM = 100;
// Single network-wide help line shown when a customer taps a plant.
const HELP_CONTACT = '+91 74982 86760';
const HELP_TEL = '+917498286760';

// Returning customers usually order from the same site repeatedly, so we
// remember their last confirmed location + chosen radius in localStorage and
// reuse it on the next visit — the list loads instantly without re-prompting
// for GPS or resetting the search width. First-time visitors (no saved value)
// still get the live GPS prompt / manual fallback.
const SAVED_LOCATION_KEY = 'rmc_nearby_location';

interface SavedLocation { coords: LatLng; radius: number }

function readSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(SAVED_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; radius?: unknown };
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const r = Number(parsed.radius);
    // Only honour a radius we still offer; otherwise fall back to the default
    // so a stale/legacy value can't leave the dropdown out of sync.
    const radius = (RADIUS_OPTIONS as readonly number[]).includes(r) ? r : DEFAULT_RADIUS_KM;
    return { coords: { lat, lng }, radius };
  } catch {
    return null;
  }
}

function saveLocation(coords: LatLng, radius: number) {
  try {
    localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify({ lat: coords.lat, lng: coords.lng, radius }));
  } catch {
    // Persistence is best-effort (private mode / quota) — never block the page.
  }
}

function dot(color: string, glyph: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid rgba(0,0,0,.35);box-shadow:0 3px 8px rgba(0,0,0,.4);display:grid;place-items:center;"><span style="transform:rotate(45deg);font-size:14px;line-height:1">${glyph}</span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26],
  });
}
// Professional white line-icons (no emoji) drawn inside the coloured pin.
const svgMarker = (inner: string) =>
  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const PERSON = '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';
const FACTORY = '<path d="M2 20h20V9l-6 4V9l-6 4V4H4a2 2 0 0 0-2 2Z"/><path d="M6 17h.01M10 17h.01M14 17h.01M18 17h.01"/>';
const meIcon = dot('#38bdf8', svgMarker(PERSON));
const plantIcon = dot('var(--gold, #178a6e)', svgMarker(FACTORY));
// Muted grey marker for unverified, not-yet-onboarded leads from the live map directory.
const leadIcon = dot('var(--muted)', svgMarker(FACTORY));

function FitAll({ points }: { points: [number, number][] }) {
  return <FitBounds points={points} singleZoom={13} maxZoom={15} />;
}

export default function NearbyPlants() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [plants, setPlants] = useState<NearbyPlant[] | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredPlant[]>([]);
  const [discovering, setDiscovering] = useState(false);
  // Live discovery is best-effort, but a failure must NOT be silently swallowed
  // into an empty list — surface a friendly message so the customer understands
  // why the wider map search came back empty (vs. genuinely no plants nearby).
  const [discoverError, setDiscoverError] = useState('');
  const [phase, setPhase] = useState<'locating' | 'loading' | 'ready' | 'geoerror'>('locating');
  const [fetchError, setFetchError] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [manual, setManual] = useState<LatLng | null>(null);
  // Seed the radius from the customer's last visit so the dropdown and the
  // initial query reflect their previous choice rather than the default.
  const [radiusKm, setRadiusKm] = useState<number>(() => readSavedLocation()?.radius ?? DEFAULT_RADIUS_KM);
  const [query, setQuery] = useState('');
  const focusRef = useRef<number | null>(null);
  // Per-lead invite state, keyed by Google placeId, so a customer can flag a
  // discovered plant for onboarding without re-requesting it.
  const [inviteState, setInviteState] = useState<Record<string, 'sending' | 'done' | 'error'>>({});
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({});
  // Mirror the radius in a ref so the geolocation loader can read the latest
  // value without being recreated (which would re-prompt for location).
  const radiusRef = useRef(radiusKm);

  // Live discovery is best-effort: a failure (key missing, upstream down, rate
  // limited) must never block the onboarded results, so it owns its own state and
  // records the failure in discoverError instead of silently emptying the list.
  const loadDiscovered = useCallback((c: LatLng, radius: number) => {
    setDiscovering(true);
    setDiscoverError('');
    return api
      .get<DiscoveredPlant[]>(`/plants/discover?lat=${c.lat}&lng=${c.lng}&radius=${radius}`)
      .then(data => { setDiscovered(data); setDiscoverError(''); })
      .catch((e: unknown) => {
        setDiscovered([]);
        // A 503 means the live directory is intentionally not configured; any
        // other failure is a transient upstream/network error the customer can
        // retry. Either way we say so plainly rather than showing an empty list.
        const status = e instanceof ApiError ? e.status : 0;
        setDiscoverError(
          status === 503
            ? 'Live map search isn’t available right now, so this list shows only our onboarded partner plants.'
            : 'We couldn’t search the wider map directory just now — showing our onboarded partner plants. Refresh to try again.',
        );
      })
      .finally(() => setDiscovering(false));
  }, []);

  const loadPlants = useCallback(async (c: LatLng, radius: number) => {
    // Remember this confirmed location + radius so the next visit loads it
    // instantly. The coords are user-confirmed (GPS fix or manual pick) so we
    // persist even if the fetch below fails — that's a transient network issue,
    // not a bad location.
    saveLocation(c, radius);
    setPhase('loading');
    setFetchError('');
    setDiscovered([]);
    try {
      const data = await api.get<NearbyPlant[]>(`/plants/nearby?lat=${c.lat}&lng=${c.lng}&radius=${radius}`);
      setPlants(data);
      setPhase('ready');
    } catch (e) {
      setFetchError((e as Error).message || 'Could not load nearby plants.');
      setPhase('ready');
      setPlants([]);
    }
    loadDiscovered(c, radius);
  }, [loadDiscovered]);

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
      .then(c => { setCoords(c); return loadPlants(c, radiusRef.current); })
      .catch(() => setPhase('geoerror'));
  }, [loadPlants]);

  // On mount, prefer the customer's last confirmed location so returning
  // visitors get results instantly without re-granting GPS. The setState is
  // deferred through a resolved promise (matching requestLocation) so the
  // effect itself never sets state synchronously. First-timers fall back to the
  // live GPS prompt exactly as before.
  const bootstrap = useCallback(() => {
    const saved = readSavedLocation();
    if (!saved) return requestLocation();
    return Promise.resolve().then(() => {
      setCoords(saved.coords);
      return loadPlants(saved.coords, saved.radius);
    });
  }, [loadPlants, requestLocation]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  function retryLocation() {
    setPhase('locating');
    requestLocation();
  }

  // Picking a location in the manual fallback (drop a pin, search a place, or
  // "my location") fetches nearby plants immediately — no second button press.
  function handleManualChange(p: LatLng) {
    setManual(p);
    setCoords(p);
    loadPlants(p, radiusRef.current);
  }

  function changeRadius(r: number) {
    setRadiusKm(r);
    radiusRef.current = r;
    if (coords) loadPlants(coords, r);
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

  // Flag a discovered (not-yet-onboarded) plant so our team can reach out and
  // onboard it. Logged-out visitors are funneled to register first (the action
  // is recorded server-side against the requesting user).
  function inviteLead(p: DiscoveredPlant) {
    if (!user) { navigate('/register'); return; }
    if (inviteState[p.placeId] === 'sending' || inviteState[p.placeId] === 'done') return;
    setInviteState(s => ({ ...s, [p.placeId]: 'sending' }));
    setInviteMsg(m => ({ ...m, [p.placeId]: '' }));
    api.post('/plants/invite', {
      placeId: p.placeId,
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      contactNumber: p.contactNumber,
    })
      .then(() => setInviteState(s => ({ ...s, [p.placeId]: 'done' })))
      .catch((e: Error) => {
        setInviteState(s => ({ ...s, [p.placeId]: 'error' }));
        setInviteMsg(m => ({ ...m, [p.placeId]: e.message || 'Could not send your request.' }));
      });
  }

  // Client-side name/area filter over the loaded results, so a customer can jump
  // to a known plant without re-querying the server.
  const q = query.trim().toLowerCase();
  const matchText = (...fields: (string | null | undefined)[]) =>
    !q || fields.some(v => (v ?? '').toLowerCase().includes(q));
  const shownPlants = (plants ?? []).filter(p => matchText(p.name, p.city, p.address));
  const shownDiscovered = discovered.filter(p => matchText(p.name, p.address));

  // Radius ceiling helpers for the dead-end guidance: the widest range we offer
  // and the next step up from the current selection (undefined once at the max).
  const maxRadius = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
  const nextRadius = RADIUS_OPTIONS.find(r => r > radiusKm);

  const wrap: React.CSSProperties = { padding: '22px clamp(14px, 4vw, 34px)', maxWidth: 1100, margin: '0 auto' };

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900, letterSpacing: '-0.6px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={26} style={{ color: 'var(--gold)' }} /> Nearby RMC Plants
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Approved plants within {radiusKm} km of your site, nearest first.
          </p>
        </div>
        {phase === 'ready' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              <Navigation size={14} style={{ color: 'var(--gold)' }} />
              <select value={radiusKm} onChange={e => changeRadius(Number(e.target.value))} style={radiusSelect}>
                {RADIUS_OPTIONS.map(r => <option key={r} value={r}>Within {r} km</option>)}
              </select>
            </label>
            <button onClick={() => setView('list')} style={toggleBtn(view === 'list')}><List size={15} /> List</button>
            <button onClick={() => setView('map')} style={toggleBtn(view === 'map')}><MapIcon size={15} /> Map</button>
            <button onClick={retryLocation} title="Refresh location" style={toggleBtn(false)}><RefreshCw size={15} /></button>
          </div>
        )}
      </div>

      {/* Search by name / city / area over the loaded plants */}
      {phase === 'ready' && ((plants && plants.length > 0) || discovered.length > 0) && (
        <div style={{ position: 'relative', marginTop: 14 }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search plants by name, city or area…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '11px 14px 11px 40px',
              borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--line)',
              color: 'var(--text)', fontSize: 14, fontWeight: 600, outline: 'none',
            }}
          />
        </div>
      )}

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
          <LocationPicker value={manual} onChange={handleManualChange} />
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
            <MapPin size={14} style={{ flexShrink: 0 }} /> Search an address, tap the map, or use your location — we’ll find nearby plants automatically.
          </div>
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
              <div style={{ marginTop: 12, fontWeight: 700, color: 'var(--text)' }}>No approved partner plants within {radiusKm} km.</div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', maxWidth: 420 }}>
                {nextRadius
                  ? `We search up to ${maxRadius} km — widen the search to look for plants farther from your site.`
                  : `That’s the widest area we can search (${maxRadius} km). Try a different location${discovered.length > 0 ? ', or see the other concrete plants listed below' : ''}.`}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                {nextRadius && (
                  <button onClick={() => changeRadius(nextRadius)} style={primaryBtn}>
                    <Navigation size={15} /> Widen to {nextRadius} km
                  </button>
                )}
                <button onClick={() => setPhase('geoerror')} style={ghostBtn}>
                  <Navigation size={15} /> Change location
                </button>
              </div>
            </div>
          )}

          {/* Live discovery failed/unconfigured: say so instead of leaving the
              customer to assume there simply are no other plants nearby. */}
          {discoverError && !discovering && (
            <div style={{ ...softCard, marginTop: 14, display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: 'color-mix(in srgb, #f59e0b 40%, transparent)', background: 'color-mix(in srgb, #f59e0b 8%, transparent)', fontSize: 13.5 }}>
              <ShieldAlert size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: 'var(--text)' }}>{discoverError}</span>
            </div>
          )}

          {/* Empty onboarded list but live leads exist: still surface the section header. */}
          {view === 'list' && (plants.length > 0 || discovered.length > 0 || discovering) && (
            <>
              {shownPlants.length > 0 && (
                <>
                  <SectionHeader
                    icon={<ShieldCheck size={16} style={{ color: 'var(--green)' }} />}
                    title="Verified partner plants"
                    sub="Approved on CONCRETE KING — order directly."
                  />
                  <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', marginTop: 12 }}>
                    {shownPlants.map(p => <PlantCard key={p.id} p={p} onOrder={() => placeOrder(p)} onMap={() => viewOnMap(p)} />)}
                  </div>
                </>
              )}

              {q && shownPlants.length === 0 && shownDiscovered.length === 0 && (plants.length > 0 || discovered.length > 0) && (
                <div style={{ ...softCard, marginTop: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
                  No plants match “{query}”. Try a different name or clear the search.
                </div>
              )}

              {discovering && discovered.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 22, color: 'var(--muted)', fontSize: 13.5, fontWeight: 600 }}>
                  <Loader2 size={16} className="np-spin" style={{ color: 'var(--muted)' }} />
                  Searching the live map directory for more nearby plants…
                </div>
              )}

              {shownDiscovered.length > 0 && (
                <>
                  <SectionHeader
                    icon={<Search size={16} style={{ color: 'var(--muted)' }} />}
                    title="Other concrete plants nearby"
                    sub="Found live on the map — unverified, not yet onboarded."
                  />
                  <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', marginTop: 12 }}>
                    {shownDiscovered.map(p => (
                      <LeadCard
                        key={p.placeId}
                        p={p}
                        onMap={() => setView('map')}
                        invite={inviteState[p.placeId]}
                        inviteError={inviteMsg[p.placeId]}
                        onInvite={() => inviteLead(p)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {view === 'map' && coords && (
            <div style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--chip-bg)', borderBottom: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--text)' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--gold)' }} /> Verified partner</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--muted)' }} /> Unverified lead</span>
              </div>
              <MapContainer center={[coords.lat, coords.lng]} zoom={12} style={{ height: 'min(70vh, 560px)', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitAll points={[[coords.lat, coords.lng], ...shownPlants.map(p => [p.latitude, p.longitude] as [number, number]), ...shownDiscovered.map(p => [p.latitude, p.longitude] as [number, number])]} />
                <Marker position={[coords.lat, coords.lng]} icon={meIcon}><Popup>Your location</Popup></Marker>
                {shownPlants.map(p => (
                  <Marker key={`v-${p.id}`} position={[p.latitude, p.longitude]} icon={plantIcon}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{p.distanceKm} km · {p.openNow ? 'Open now' : 'Closed'}</div>
                        <button onClick={() => placeOrder(p)} style={{ background: 'var(--gold)', color: '#1a1a1a', border: 'none', borderRadius: 8, padding: '6px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>Place Order</button>
                        <div style={{ fontSize: 12, color: '#333', marginTop: 8, paddingTop: 6, borderTop: '1px solid #eee' }}>
                          Need help? <a href={`tel:${HELP_TEL}`} style={{ color: '#0a66c2', fontWeight: 700, textDecoration: 'none' }}>{HELP_CONTACT}</a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {shownDiscovered.map(p => (
                  <Marker key={`d-${p.placeId}`} position={[p.latitude, p.longitude]} icon={leadIcon}>
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', display: 'inline-block', padding: '1px 7px', borderRadius: 20, fontWeight: 800, marginBottom: 6 }}>Unverified · not onboarded</div>
                        <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{p.distanceKm} km away{p.openNow != null ? ` · ${p.openNow ? 'Open now' : 'Closed'}` : ''}</div>
                        {p.address && <div style={{ fontSize: 11.5, color: '#666', marginBottom: 6 }}>{p.address}</div>}
                        <a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0a66c2', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>Open in Google Maps →</a>
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
      background: 'var(--surface)',
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

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 26, paddingBottom: 2 }}>
      {icon}
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// Card for an unverified, not-yet-onboarded plant discovered live from the map
// directory. Deliberately dimmer than PlantCard, with no "Place Order" CTA —
// these plants can't be ordered from until they onboard.
function LeadCard({ p, onMap, invite, inviteError, onInvite }: {
  p: DiscoveredPlant;
  onMap: () => void;
  invite?: 'sending' | 'done' | 'error';
  inviteError?: string;
  onInvite: () => void;
}) {
  return (
    <div style={{
      background: 'var(--chip-bg)',
      border: '1px dashed var(--line)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', lineHeight: 1.25 }}>{p.name}</div>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--muted)', background: 'rgba(148,163,184,.14)', border: '1px solid rgba(148,163,184,.35)', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
          {p.distanceKm} km
        </span>
      </div>

      <span style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 11.5, fontWeight: 800, color: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 14%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)', borderRadius: 7, padding: '2px 8px' }}>
        <ShieldAlert size={12} /> Unverified · not yet onboarded
      </span>

      {p.address && (
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <MapPin size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{p.address}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
        {p.contactNumber && (
          <a href={`tel:${p.contactNumber}`} style={{ display: 'flex', gap: 5, alignItems: 'center', color: 'var(--text)', textDecoration: 'none' }}>
            <Phone size={13} /> {p.contactNumber}
          </a>
        )}
        {p.openNow != null && (
          <span style={{ display: 'flex', gap: 5, alignItems: 'center', color: p.openNow ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
            <Clock size={13} /> {p.openNow ? 'Open now' : 'Closed'}
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
        Not on CONCRETE KING yet. Request it below and our team will reach out to onboard this plant.
      </div>

      {invite === 'done' ? (
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 32%, transparent)', borderRadius: 9, padding: '9px 11px' }}>
          <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Thanks! We've recorded your request to onboard this plant.</span>
        </div>
      ) : (
        <>
          {invite === 'error' && inviteError && (
            <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{inviteError}</div>
          )}
          <button onClick={onInvite} disabled={invite === 'sending'} style={{ ...primaryBtn, opacity: invite === 'sending' ? 0.6 : 1, cursor: invite === 'sending' ? 'wait' : 'pointer' }}>
            {invite === 'sending'
              ? <><Loader2 size={15} className="np-spin" /> Sending request…</>
              : <><HandHeart size={15} /> Request this plant</>}
          </button>
        </>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}>
        <Headphones size={13} /> Help:&nbsp;
        <a href={`tel:${HELP_TEL}`} style={{ color: 'var(--gold)', textDecoration: 'none' }}>{HELP_CONTACT}</a>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <button onClick={onMap} style={{ ...ghostBtn, flex: 1 }}><MapIcon size={15} /> View on map</button>
        <a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, flex: 1, textDecoration: 'none' }}>
          <Navigation size={15} /> Directions
        </a>
      </div>
    </div>
  );
}

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: active ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--chip-bg)',
    color: active ? 'var(--gold)' : 'var(--text)',
    border: `1px solid ${active ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'var(--line)'}`,
  };
}
const radiusSelect: React.CSSProperties = {
  appearance: 'none', padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 800,
  background: 'var(--gold)', color: '#1a1a1a', border: 'none',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)',
};
const centerCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  padding: '54px 20px', marginTop: 16, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--chip-bg)',
};
const softCard: React.CSSProperties = {
  padding: 18, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--chip-bg)',
};
