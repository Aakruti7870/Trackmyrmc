import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { MapContainer, TileLayer, Marker, Popup, FitBounds } from '@/components/map';
import L from 'leaflet';
import { MapPin, List, Map as MapIcon, Phone, Clock, Navigation, PackagePlus, Loader2, LocateFixed, RefreshCw, Headphones, Search, ShieldCheck, ShieldAlert, HandHeart, Check, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import LocationPicker, { type LatLng } from '@/components/LocationPicker';
import { GstPanBadge } from '@/components/EkycBadge';

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
  gstPanVerified?: boolean;
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

interface NearbyPlantsResponse {
  plants: NearbyPlant[];
  count: number;
}

function isValidCoords(value: LatLng): boolean {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
}

function readSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(SAVED_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; radius?: unknown };
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!isValidCoords({ lat, lng })) return null;
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

// Map markers are clean pulsing dots rather than crowded teardrop pins, so a
// dense cluster of plants reads as a calm field of blips (and the same style
// can front a live delivery-tracking map later). Colour comes through a CSS
// custom property so one keyframe animates every dot.
function blip(color: string) {
  return L.divIcon({
    className: '',
    html: `<span class="np-blip" style="--np-c:${color}"></span>`,
    iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -10],
  });
}
const meBlip = blip('#38bdf8');
const plantBlip = blip('var(--gold, #178a6e)');
// Muted grey blip for unverified, not-yet-onboarded leads from the live directory.
const leadBlip = blip('var(--muted, #94a3b8)');

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
  const [phase, setPhase] = useState<'locating' | 'loading' | 'ready' | 'geoerror'>('locating');
  const [fetchError, setFetchError] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [manual, setManual] = useState<LatLng | null>(null);
  // Seed the radius from the customer's last visit so the dropdown and the
  // initial query reflect their previous choice rather than the default.
  const [radiusKm, setRadiusKm] = useState<number>(() => readSavedLocation()?.radius ?? DEFAULT_RADIUS_KM);
  const [query, setQuery] = useState('');
  // Lightweight, market-style client-side refinements over the loaded results.
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [gradeSel, setGradeSel] = useState<string[]>([]);
  const focusRef = useRef<number | null>(null);
  // Per-lead invite state, keyed by Google placeId, so a customer can flag a
  // discovered plant for onboarding without re-requesting it.
  const [inviteState, setInviteState] = useState<Record<string, 'sending' | 'done' | 'error'>>({});
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({});
  // Mirror the radius in a ref so the geolocation loader can read the latest
  // value without being recreated (which would re-prompt for location).
  const radiusRef = useRef(radiusKm);

  // Live discovery is best-effort: a failure (key missing, upstream down, rate
  // limited) must never block the onboarded results, so on any error we simply
  // fall back to the onboarded partner plants without surfacing a banner.
  const loadDiscovered = useCallback((c: LatLng, radius: number) => {
    setDiscovering(true);
    return api
      .get<DiscoveredPlant[]>(`/plants/discover?lat=${c.lat}&lng=${c.lng}&radius=${radius}`)
      .then(data => { setDiscovered(data); })
      .catch(() => { setDiscovered([]); })
      .finally(() => setDiscovering(false));
  }, []);

  const loadPlants = useCallback(async (c: LatLng, radius: number) => {
    if (!isValidCoords(c)) {
      setFetchError('Your location coordinates are invalid. Please choose the site location again.');
      setPlants([]);
      setDiscovered([]);
      setPhase('geoerror');
      return;
    }

    // Remember only validated coordinates. This prevents undefined, null, NaN,
    // empty or out-of-range values from ever reaching the API query string.
    saveLocation(c, radius);
    setPhase('loading');
    setFetchError('');
    setDiscovered([]);
    const query = new URLSearchParams({
      lat: String(c.lat),
      lng: String(c.lng),
      radius: String(radius),
    });
    try {
      const data = await api.get<NearbyPlantsResponse | NearbyPlant[]>(`/plants/nearby?${query.toString()}`);
      // Accept the legacy array during rolling deployments, but prefer the
      // documented { plants, count } response from the hardened backend.
      const result = Array.isArray(data) ? data : data.plants;
      setPlants(Array.isArray(result) ? result : []);
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

  function toggleGrade(g: string) {
    setGradeSel(sel => sel.includes(g) ? sel.filter(x => x !== g) : [...sel, g]);
  }
  function clearFilters() {
    setQuery('');
    setOpenNowOnly(false);
    setGradeSel([]);
  }

  // Client-side name/area filter over the loaded results, so a customer can jump
  // to a known plant without re-querying the server.
  const q = query.trim().toLowerCase();
  const matchText = (...fields: (string | null | undefined)[]) =>
    !q || fields.some(v => (v ?? '').toLowerCase().includes(q));

  // Grade chips are derived from what the loaded partner plants actually offer,
  // so the customer only ever sees grades that can return a result.
  const gradeOptions = Array.from(new Set((plants ?? []).flatMap(p => p.grades))).sort();

  let shownPlants = (plants ?? []).filter(p => matchText(p.name, p.city, p.address));
  if (openNowOnly) shownPlants = shownPlants.filter(p => p.openNow);
  if (gradeSel.length) shownPlants = shownPlants.filter(p => p.grades.some(g => gradeSel.includes(g)));

  let shownDiscovered = discovered.filter(p => matchText(p.name, p.address));
  if (openNowOnly) shownDiscovered = shownDiscovered.filter(p => p.openNow === true);

  const filtersActive = !!q || openNowOnly || gradeSel.length > 0;
  const hasAnyData = (plants?.length ?? 0) > 0 || discovered.length > 0;
  const nothingShown = shownPlants.length === 0 && shownDiscovered.length === 0;

  // Radius ceiling helpers for the dead-end guidance: the widest range we offer
  // and the next step up from the current selection (undefined once at the max).
  const maxRadius = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
  const nextRadius = RADIUS_OPTIONS.find(r => r > radiusKm);

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
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
            <div style={segWrap}>
              <button onClick={() => setView('list')} style={segBtn(view === 'list')}><List size={15} /> List</button>
              <button onClick={() => setView('map')} style={segBtn(view === 'map')}><MapIcon size={15} /> Map</button>
            </div>
            <button onClick={retryLocation} title="Refresh location" style={iconBtn}><RefreshCw size={15} /></button>
          </div>
        )}
      </div>

      {/* Search + quick refinements over the loaded plants */}
      {phase === 'ready' && ((plants && plants.length > 0) || discovered.length > 0) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search plants by name, city or area…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '13px 14px 13px 42px',
                borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)',
                color: 'var(--text)', fontSize: 14.5, fontWeight: 600, outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,.04)',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} title="Clear search" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 4 }}>
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>
              <SlidersHorizontal size={14} />
            </span>
            <button onClick={() => setOpenNowOnly(v => !v)} style={chip(openNowOnly)}>
              <Clock size={13} /> Open now
            </button>
            {gradeOptions.map(g => (
              <button key={g} onClick={() => toggleGrade(g)} style={chip(gradeSel.includes(g))}>{g}</button>
            ))}
            {filtersActive && (
              <button onClick={clearFilters} style={{ ...chip(false), color: 'var(--red)', borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)' }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
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

          {/* Empty onboarded list but live leads exist: still surface the section header. */}
          {view === 'list' && (plants.length > 0 || discovered.length > 0 || discovering) && (
            <>
              {shownPlants.length > 0 && (
                <>
                  <SectionHeader
                    icon={<ShieldCheck size={16} style={{ color: 'var(--green)' }} />}
                    title="Verified partner plants"
                    sub="Approved on CONCRETE KING — order directly."
                    count={shownPlants.length}
                  />
                  <div style={grid}>
                    {shownPlants.map(p => <PlantCard key={p.id} p={p} onOrder={() => placeOrder(p)} onMap={() => viewOnMap(p)} />)}
                  </div>
                </>
              )}

              {hasAnyData && nothingShown && filtersActive && (
                <div style={{ ...softCard, marginTop: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <span>No plants match your search or filters.</span>
                  <button onClick={clearFilters} style={ghostBtn}><X size={15} /> Clear filters</button>
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
                    count={shownDiscovered.length}
                  />
                  <div style={grid}>
                    {shownDiscovered.map(p => (
                      <LeadCard
                        key={p.placeId}
                        p={p}
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
            <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '11px 15px', background: 'var(--chip-bg)', borderBottom: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--text)' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--gold)' }} /> Verified partner</span>
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--muted)' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--muted)' }} /> Unverified lead</span>
                <span style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--blue)' }}><span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--blue)' }} /> You</span>
              </div>
              <MapContainer center={[coords.lat, coords.lng]} zoom={12} style={{ height: 'min(70vh, 560px)', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitAll points={[[coords.lat, coords.lng], ...shownPlants.map(p => [p.latitude, p.longitude] as [number, number]), ...shownDiscovered.map(p => [p.latitude, p.longitude] as [number, number])]} />
                <Marker position={[coords.lat, coords.lng]} icon={meBlip}><Popup>Your location</Popup></Marker>
                {shownPlants.map(p => (
                  <Marker key={`v-${p.id}`} position={[p.latitude, p.longitude]} icon={plantBlip}>
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
                  <Marker key={`d-${p.placeId}`} position={[p.latitude, p.longitude]} icon={leadBlip}>
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

          {/* One subtle network-wide help line, instead of repeating it on every card. */}
          {(shownPlants.length > 0 || shownDiscovered.length > 0) && (
            <div style={helpBar}>
              <Headphones size={14} style={{ color: 'var(--gold)' }} />
              <span>Need help choosing a plant? Call&nbsp;</span>
              <a href={`tel:${HELP_TEL}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 800 }}>{HELP_CONTACT}</a>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes np-spin{to{transform:rotate(360deg)}}
        .np-spin{animation:np-spin .8s linear infinite}
        .np-blip{display:block;width:16px;height:16px;border-radius:50%;background:var(--np-c);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);position:relative}
        .np-blip::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:var(--np-c);opacity:.45;animation:np-ping 1.7s cubic-bezier(0,0,.2,1) infinite;z-index:-1}
        @keyframes np-ping{0%{transform:scale(.55);opacity:.5}80%,100%{transform:scale(2.1);opacity:0}}
      `}</style>
    </div>
  );
}

function PlantCard({ p, onOrder, onMap }: { p: NearbyPlant; onOrder: () => void; onMap: () => void }) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span style={verifiedTag}><ShieldCheck size={12} /> Verified partner</span>
            {p.gstPanVerified && <GstPanBadge />}
          </div>
          <div style={{ fontWeight: 800, fontSize: 16.5, color: 'var(--text)', lineHeight: 1.25 }}>{p.name}</div>
        </div>
        <span style={distanceBadge}>{p.distanceKm} km</span>
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

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <button onClick={onMap} style={{ ...ghostBtn, flex: 1 }}><MapIcon size={15} /> View on map</button>
        <button onClick={onOrder} style={{ ...primaryBtn, flex: 1.3 }}><PackagePlus size={15} /> Place Order</button>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, sub, count }: { icon: React.ReactNode; title: string; sub: string; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 26, paddingBottom: 2 }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{title}</span>
          {typeof count === 'number' && (
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--muted)', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 20, padding: '1px 8px' }}>{count}</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// Card for an unverified, not-yet-onboarded plant discovered live from the map
// directory. Deliberately dimmer than PlantCard, with no "Place Order" CTA —
// these plants can't be ordered from until they onboard. Two actions only:
// request onboarding, or open directions.
function LeadCard({ p, invite, inviteError, onInvite }: {
  p: DiscoveredPlant;
  invite?: 'sending' | 'done' | 'error';
  inviteError?: string;
  onInvite: () => void;
}) {
  return (
    <div style={{ ...card, background: 'var(--chip-bg)', border: '1px dashed var(--line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={unverifiedTag}><ShieldAlert size={12} /> Unverified · not yet onboarded</span>
          <div style={{ fontWeight: 800, fontSize: 16.5, color: 'var(--text)', lineHeight: 1.25 }}>{p.name}</div>
        </div>
        <span style={{ ...distanceBadge, color: 'var(--muted)', background: 'rgba(148,163,184,.14)', borderColor: 'rgba(148,163,184,.35)' }}>{p.distanceKm} km</span>
      </div>

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
        Not on CONCRETE KING yet. Request it and our team will reach out to onboard this plant.
      </div>

      {invite === 'done' ? (
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12.5, fontWeight: 700, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 32%, transparent)', borderRadius: 9, padding: '9px 11px' }}>
          <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Thanks! We've recorded your request to onboard this plant.</span>
        </div>
      ) : (
        invite === 'error' && inviteError && (
          <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{inviteError}</div>
        )
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        <a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" style={{ ...ghostBtn, flex: 1, textDecoration: 'none' }}>
          <Navigation size={15} /> Directions
        </a>
        {invite !== 'done' && (
          <button onClick={onInvite} disabled={invite === 'sending'} style={{ ...primaryBtn, flex: 1.3, opacity: invite === 'sending' ? 0.6 : 1, cursor: invite === 'sending' ? 'wait' : 'pointer' }}>
            {invite === 'sending'
              ? <><Loader2 size={15} className="np-spin" /> Sending…</>
              : <><HandHeart size={15} /> Request this plant</>}
          </button>
        )}
      </div>
    </div>
  );
}

function segBtn(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--muted)',
    border: 'none',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
  };
}
const segWrap: React.CSSProperties = {
  display: 'inline-flex', gap: 3, padding: 3, borderRadius: 11, background: 'var(--chip-bg)', border: '1px solid var(--line)',
};
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '9px 11px', borderRadius: 10, cursor: 'pointer',
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)',
};
function chip(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
    background: active ? 'color-mix(in srgb, var(--gold) 15%, transparent)' : 'var(--surface)',
    color: active ? 'var(--gold)' : 'var(--text)',
    border: `1px solid ${active ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'var(--line)'}`,
  };
}
const radiusSelect: React.CSSProperties = {
  appearance: 'none', padding: '8px 13px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
  background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)',
};
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13.5, fontWeight: 800,
  background: 'var(--gold)', color: '#1a1a1a', border: 'none',
};
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)',
};
const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 11,
  boxShadow: '0 1px 3px rgba(0,0,0,.05)',
};
const distanceBadge: React.CSSProperties = {
  flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
};
const verifiedTag: React.CSSProperties = {
  alignSelf: 'flex-start', display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, fontWeight: 800, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 32%, transparent)', borderRadius: 6, padding: '2px 7px',
};
const unverifiedTag: React.CSSProperties = {
  alignSelf: 'flex-start', display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 14%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)', borderRadius: 6, padding: '2px 7px',
};
const grid: React.CSSProperties = {
  display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', marginTop: 12,
};
const helpBar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 26, padding: '12px 16px', borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)',
};
const wrap: React.CSSProperties = { padding: '22px clamp(14px, 4vw, 34px)', maxWidth: 1100, margin: '0 auto' };
const centerCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
  padding: '54px 20px', marginTop: 16, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--chip-bg)',
};
const softCard: React.CSSProperties = {
  padding: 18, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--chip-bg)',
};
