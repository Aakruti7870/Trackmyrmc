import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { MapContainer, TileLayer, Marker, Popup, FitBounds } from '@/components/map';
import L from 'leaflet';
import {
  Check, CircleHelp, Clock, HandHeart, Headphones, Info, List, Loader2, LocateFixed,
  Map as MapIcon, MapPin, Navigation, PackagePlus, Phone, RefreshCw, Search,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Truck, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import LocationPicker, { type LatLng } from '@/components/LocationPicker';
import { GstPanBadge } from '@/components/EkycBadge';

export interface PlantCapabilities {
  numberOfTransitMixers?: number | null;
  productionCapacityM3PerHour?: number | string | null;
  laboratoryAvailable?: boolean | null;
  inhouseConcretePumpAvailable?: boolean | null;
  supportingPlantAvailable?: boolean | null;
  dieselGeneratorAvailable?: boolean | null;
}

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
  capabilities?: PlantCapabilities | null;
  showGlowingEffect?: boolean;
}

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

const RADIUS_OPTIONS = [40, 80, 100, 150, 250] as const;
const DEFAULT_RADIUS_KM = 100;
const HELP_CONTACT = '+91 74982 86760';
const HELP_TEL = '+917498286760';
const SAVED_LOCATION_KEY = 'rmc_nearby_location';

type SavedLocation = { coords: LatLng; radius: number };
type NearbyPlantsResponse = { plants: NearbyPlant[]; count: number };

function isValidCoords(value: LatLng): boolean {
  return Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180;
}

function readSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(SAVED_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; radius?: unknown };
    const lat = Number(parsed.lat);
    const lng = Number(parsed.lng);
    if (!isValidCoords({ lat, lng })) return null;
    const savedRadius = Number(parsed.radius);
    const radius = (RADIUS_OPTIONS as readonly number[]).includes(savedRadius) ? savedRadius : DEFAULT_RADIUS_KM;
    return { coords: { lat, lng }, radius };
  } catch {
    return null;
  }
}

function saveLocation(coords: LatLng, radius: number): void {
  try {
    localStorage.setItem(SAVED_LOCATION_KEY, JSON.stringify({ lat: coords.lat, lng: coords.lng, radius }));
  } catch {
    // Persistence is best effort and must never block plant discovery.
  }
}

function blip(color: string) {
  return L.divIcon({
    className: '',
    html: `<span class="np-blip" style="--np-c:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
}

const meBlip = blip('#38bdf8');
const plantBlip = blip('var(--gold, #178a6e)');
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
  const [radiusKm, setRadiusKm] = useState<number>(() => readSavedLocation()?.radius ?? DEFAULT_RADIUS_KM);
  const [query, setQuery] = useState('');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [gradeSel, setGradeSel] = useState<string[]>([]);
  const [inviteState, setInviteState] = useState<Record<string, 'sending' | 'done' | 'error'>>({});
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({});

  const loadDiscovered = useCallback((location: LatLng, radius: number) => {
    setDiscovering(true);
    return api.get<DiscoveredPlant[]>(`/plants/discover?lat=${location.lat}&lng=${location.lng}&radius=${radius}`)
      .then(rows => setDiscovered(rows))
      .catch(() => setDiscovered([]))
      .finally(() => setDiscovering(false));
  }, []);

  const loadPlants = useCallback(async (location: LatLng, radius: number) => {
    if (!isValidCoords(location)) {
      setFetchError('Your location coordinates are invalid. Please choose the site location again.');
      setPlants([]);
      setDiscovered([]);
      setPhase('geoerror');
      return;
    }
    saveLocation(location, radius);
    setPhase('loading');
    setFetchError('');
    setDiscovered([]);
    const params = new URLSearchParams({ lat: String(location.lat), lng: String(location.lng), radius: String(radius) });
    try {
      const data = await api.get<NearbyPlantsResponse | NearbyPlant[]>(`/plants/nearby?${params.toString()}`);
      const result = Array.isArray(data) ? data : data.plants;
      setPlants(Array.isArray(result) ? result : []);
      setPhase('ready');
    } catch (error) {
      setFetchError((error as Error).message || 'Could not load nearby plants.');
      setPlants([]);
      setPhase('ready');
    }
    void loadDiscovered(location, radius);
  }, [loadDiscovered]);

  const requestLocation = useCallback((radius = radiusKm) => {
    return new Promise<LatLng>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('no-geolocation'));
      navigator.geolocation.getCurrentPosition(
        position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 12000 },
      );
    }).then(location => {
      setCoords(location);
      return loadPlants(location, radius);
    }).catch(() => setPhase('geoerror'));
  }, [loadPlants, radiusKm]);

  const bootstrap = useCallback(() => {
    const saved = readSavedLocation();
    if (!saved) return requestLocation(DEFAULT_RADIUS_KM);
    return Promise.resolve().then(() => {
      setRadiusKm(saved.radius);
      setCoords(saved.coords);
      return loadPlants(saved.coords, saved.radius);
    });
  }, [loadPlants, requestLocation]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  function retryLocation() {
    setPhase('locating');
    void requestLocation(radiusKm);
  }

  function handleManualChange(location: LatLng) {
    setManual(location);
    setCoords(location);
    void loadPlants(location, radiusKm);
  }

  function changeRadius(radius: number) {
    setRadiusKm(radius);
    if (coords) void loadPlants(coords, radius);
  }

  function placeOrder(plant: NearbyPlant) {
    sessionStorage.setItem('rmc_selected_plant', JSON.stringify({ id: plant.id, name: plant.name }));
    navigate(user ? '/my-orders' : '/register');
  }

  function openAbout(plant: NearbyPlant) {
    navigate(`/plants/${plant.id}/about`);
  }

  function inviteLead(plant: DiscoveredPlant) {
    if (!user) { navigate('/register'); return; }
    if (inviteState[plant.placeId] === 'sending' || inviteState[plant.placeId] === 'done') return;
    setInviteState(current => ({ ...current, [plant.placeId]: 'sending' }));
    setInviteMsg(current => ({ ...current, [plant.placeId]: '' }));
    api.post('/plants/invite', {
      placeId: plant.placeId,
      name: plant.name,
      address: plant.address,
      latitude: plant.latitude,
      longitude: plant.longitude,
      contactNumber: plant.contactNumber,
    }).then(() => setInviteState(current => ({ ...current, [plant.placeId]: 'done' })))
      .catch((error: Error) => {
        setInviteState(current => ({ ...current, [plant.placeId]: 'error' }));
        setInviteMsg(current => ({ ...current, [plant.placeId]: error.message || 'Could not send your request.' }));
      });
  }

  const normalizedQuery = query.trim().toLowerCase();
  const matchesText = (...fields: Array<string | null | undefined>) => !normalizedQuery || fields.some(value => (value ?? '').toLowerCase().includes(normalizedQuery));
  const gradeOptions = Array.from(new Set((plants ?? []).flatMap(plant => plant.grades))).sort();
  let shownPlants = (plants ?? []).filter(plant => matchesText(plant.name, plant.city, plant.address));
  if (openNowOnly) shownPlants = shownPlants.filter(plant => plant.openNow);
  if (gradeSel.length) shownPlants = shownPlants.filter(plant => plant.grades.some(grade => gradeSel.includes(grade)));
  let shownDiscovered = discovered.filter(plant => matchesText(plant.name, plant.address));
  if (openNowOnly) shownDiscovered = shownDiscovered.filter(plant => plant.openNow === true);

  const filtersActive = Boolean(normalizedQuery) || openNowOnly || gradeSel.length > 0;
  const hasAnyData = (plants?.length ?? 0) > 0 || discovered.length > 0;
  const nothingShown = shownPlants.length === 0 && shownDiscovered.length === 0;
  const maxRadius = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];
  const nextRadius = RADIUS_OPTIONS.find(radius => radius > radiusKm);

  function clearFilters() {
    setQuery('');
    setOpenNowOnly(false);
    setGradeSel([]);
  }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={26} style={{ color: 'var(--gold)' }} /> Nearby RMC Plants
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 14 }}>Approved plants within {radiusKm} km of your site, nearest first.</p>
        </div>
        {phase === 'ready' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
              <Navigation size={14} style={{ color: 'var(--gold)' }} />
              <select aria-label="Nearby plant radius" value={radiusKm} onChange={event => changeRadius(Number(event.target.value))} style={radiusSelect}>
                {RADIUS_OPTIONS.map(radius => <option key={radius} value={radius}>Within {radius} km</option>)}
              </select>
            </label>
            <div style={segWrap}>
              <button onClick={() => setView('list')} style={segBtn(view === 'list')}><List size={15} /> List</button>
              <button onClick={() => setView('map')} style={segBtn(view === 'map')}><MapIcon size={15} /> Map</button>
            </div>
            <button onClick={retryLocation} title="Refresh location" aria-label="Refresh location" style={iconBtn}><RefreshCw size={15} /></button>
          </div>
        )}
      </div>

      {phase === 'ready' && ((plants && plants.length > 0) || discovered.length > 0) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search plants by name, city or area…" style={searchInput} />
            {query && <button onClick={() => setQuery('')} title="Clear search" style={clearSearch}><X size={16} /></button>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
            <SlidersHorizontal size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <button onClick={() => setOpenNowOnly(value => !value)} style={chip(openNowOnly)}><Clock size={13} /> Open now</button>
            {gradeOptions.map(grade => <button key={grade} onClick={() => setGradeSel(current => current.includes(grade) ? current.filter(value => value !== grade) : [...current, grade])} style={chip(gradeSel.includes(grade))}>{grade}</button>)}
            {filtersActive && <button onClick={clearFilters} style={{ ...chip(false), color: 'var(--red)' }}><X size={13} /> Clear</button>}
          </div>
        </div>
      )}

      {(phase === 'locating' || phase === 'loading') && <div style={centerCard}><Loader2 size={30} className="np-spin" style={{ color: 'var(--gold)' }} /><div style={{ marginTop: 12, fontWeight: 700 }}>Finding nearby RMC plants...</div></div>}

      {phase === 'geoerror' && (
        <div style={{ ...softCard, marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
            <Navigation size={20} style={{ color: 'var(--red)', flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Unable to get your location. Please allow location or enter site address manually.</div>
          </div>
          <button onClick={retryLocation} style={{ ...primaryBtn, marginBottom: 16 }}><LocateFixed size={16} /> Try location again</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Or set your site location:</div>
          <LocationPicker value={manual} onChange={handleManualChange} />
        </div>
      )}

      {phase === 'ready' && plants && (
        <>
          {fetchError && <div style={{ ...softCard, color: 'var(--red)', marginTop: 14 }}>{fetchError}</div>}
          {plants.length === 0 && !fetchError && (
            <div style={centerCard}>
              <MapPin size={30} style={{ color: 'var(--muted)' }} />
              <div style={{ marginTop: 12, fontWeight: 700 }}>No approved partner plants within {radiusKm} km.</div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)', maxWidth: 420 }}>
                {nextRadius ? `We search up to ${maxRadius} km — widen the search to look for plants farther from your site.` : `That’s the widest area we can search (${maxRadius} km). Try a different location${discovered.length > 0 ? ', or see the other concrete plants listed below' : ''}.`}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                {nextRadius && <button onClick={() => changeRadius(nextRadius)} style={primaryBtn}><Navigation size={15} /> Widen to {nextRadius} km</button>}
                <button onClick={() => setPhase('geoerror')} style={ghostBtn}><Navigation size={15} /> Change location</button>
              </div>
            </div>
          )}

          {view === 'list' && (plants.length > 0 || discovered.length > 0 || discovering) && (
            <>
              {shownPlants.length > 0 && (
                <>
                  <SectionHeader icon={<ShieldCheck size={16} style={{ color: 'var(--green)' }} />} title="Verified partner plants" sub="Approved on CONCRETE KING — order directly." count={shownPlants.length} />
                  <div style={grid}>{shownPlants.map(plant => <PlantCard key={plant.id} plant={plant} onOrder={() => placeOrder(plant)} onMap={() => setView('map')} onAbout={() => openAbout(plant)} />)}</div>
                </>
              )}
              {hasAnyData && nothingShown && filtersActive && <div style={{ ...softCard, marginTop: 16, textAlign: 'center' }}><span>No plants match your search or filters.</span><br /><button onClick={clearFilters} style={{ ...ghostBtn, marginTop: 10 }}><X size={15} /> Clear filters</button></div>}
              {discovering && discovered.length === 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 22, color: 'var(--muted)' }}><Loader2 size={16} className="np-spin" /> Searching the live map directory for more nearby plants…</div>}
              {shownDiscovered.length > 0 && (
                <>
                  <SectionHeader icon={<Search size={16} style={{ color: 'var(--muted)' }} />} title="Other concrete plants nearby" sub="Found live on the map — unverified, not yet onboarded." count={shownDiscovered.length} />
                  <div style={grid}>{shownDiscovered.map(plant => <LeadCard key={plant.placeId} plant={plant} invite={inviteState[plant.placeId]} inviteError={inviteMsg[plant.placeId]} onInvite={() => inviteLead(plant)} />)}</div>
                </>
              )}
            </>
          )}

          {view === 'map' && coords && (
            <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <MapContainer center={[coords.lat, coords.lng]} zoom={12} style={{ height: 'min(70vh, 560px)', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitAll points={[[coords.lat, coords.lng], ...shownPlants.map(plant => [plant.latitude, plant.longitude] as [number, number]), ...shownDiscovered.map(plant => [plant.latitude, plant.longitude] as [number, number])]} />
                <Marker position={[coords.lat, coords.lng]} icon={meBlip}><Popup>Your location</Popup></Marker>
                {shownPlants.map(plant => <Marker key={`plant-${plant.id}`} position={[plant.latitude, plant.longitude]} icon={plantBlip}><Popup><strong>{plant.name}</strong><div>{plant.distanceKm} km · {plant.openNow ? 'Open now' : 'Closed'}</div><button onClick={() => openAbout(plant)}>About Plant</button></Popup></Marker>)}
                {shownDiscovered.map(plant => <Marker key={`lead-${plant.placeId}`} position={[plant.latitude, plant.longitude]} icon={leadBlip}><Popup><strong>{plant.name}</strong><div>Unverified · not onboarded</div></Popup></Marker>)}
              </MapContainer>
            </div>
          )}

          {(shownPlants.length > 0 || shownDiscovered.length > 0) && <div style={helpBar}><Headphones size={14} style={{ color: 'var(--gold)' }} /><span>Need help choosing a plant? Call&nbsp;</span><a href={`tel:${HELP_TEL}`} style={{ color: 'var(--gold)', fontWeight: 800 }}>{HELP_CONTACT}</a></div>}
        </>
      )}

      <style>{`
        @keyframes np-spin{to{transform:rotate(360deg)}}
        .np-spin{animation:np-spin .8s linear infinite}
        .np-blip{display:block;width:16px;height:16px;border-radius:50%;background:var(--np-c);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);position:relative}
        .np-blip::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:var(--np-c);opacity:.45;animation:np-ping 1.7s cubic-bezier(0,0,.2,1) infinite;z-index:-1}
        @keyframes np-ping{0%{transform:scale(.55);opacity:.5}80%,100%{transform:scale(2.1);opacity:0}}
        @keyframes np-paid-pulse{0%,100%{box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 55%,transparent),0 2px 8px rgba(0,0,0,.08)}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--gold) 12%,transparent),0 4px 18px color-mix(in srgb,var(--gold) 30%,transparent)}}
        .np-paid-glow{animation:np-paid-pulse 2.4s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.np-spin,.np-blip::after,.np-paid-glow{animation:none!important}}
      `}</style>
    </div>
  );
}

function CapabilityBadges({ capabilities }: { capabilities?: PlantCapabilities | null }) {
  if (!capabilities) return null;
  const badges: string[] = [];
  if (capabilities.numberOfTransitMixers != null) badges.push(`TM ${capabilities.numberOfTransitMixers}`);
  if (capabilities.productionCapacityM3PerHour != null && capabilities.productionCapacityM3PerHour !== '') badges.push(`${capabilities.productionCapacityM3PerHour} m³/hr`);
  if (capabilities.laboratoryAvailable === true) badges.push('Lab');
  if (capabilities.inhouseConcretePumpAvailable === true) badges.push('Pump');
  if (capabilities.supportingPlantAvailable === true) badges.push('Backup Plant');
  if (capabilities.dieselGeneratorAvailable === true) badges.push('DG');
  if (!badges.length) return null;
  return <div aria-label="Plant capabilities" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>{badges.map(badge => <span key={badge} style={capabilityBadge}>{badge}</span>)}</div>;
}

function PlantCard({ plant, onOrder, onMap, onAbout }: { plant: NearbyPlant; onOrder: () => void; onMap: () => void; onAbout: () => void }) {
  return (
    <article className={plant.showGlowingEffect ? 'np-paid-glow' : undefined} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 190px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><span style={verifiedTag}><ShieldCheck size={12} /> Verified partner</span>{plant.gstPanVerified && <GstPanBadge />}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16.5, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{plant.name}</div>
            <button onClick={onAbout} aria-label={`About ${plant.name}`} title="About Plant" style={infoBtn}><Info size={16} /></button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {plant.capabilities?.numberOfTransitMixers != null && <span style={tmBadge}><Truck size={13} /> TM {plant.capabilities.numberOfTransitMixers}</span>}
          <span style={distanceBadge}>{plant.distanceKm} km</span>
        </div>
      </div>

      <CapabilityBadges capabilities={{ ...plant.capabilities, numberOfTransitMixers: null }} />
      {(plant.address || plant.city) && <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 6 }}><MapPin size={14} style={{ flexShrink: 0 }} /><span>{[plant.address, plant.city].filter(Boolean).join(', ')}</span></div>}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
        {plant.contactNumber && <a href={`tel:${plant.contactNumber}`} style={{ display: 'flex', gap: 5, alignItems: 'center', color: 'var(--text)', textDecoration: 'none' }}><Phone size={13} /> {plant.contactNumber}</a>}
        <span style={{ display: 'flex', gap: 5, alignItems: 'center', color: plant.openNow ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}><Clock size={13} /> {plant.openNow ? 'Open now' : 'Closed'}</span>
        <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Navigation size={13} /> Delivers {plant.deliveryRadiusKm} km</span>
      </div>
      {plant.grades.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{plant.grades.map(grade => <span key={grade} style={gradeBadge}>{grade}</span>)}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
        <button onClick={onAbout} style={{ ...ghostBtn, flex: '1 1 130px' }}><CircleHelp size={15} /> About Plant</button>
        <button onClick={onMap} style={{ ...ghostBtn, flex: '1 1 130px' }}><MapIcon size={15} /> View on map</button>
        <button onClick={onOrder} style={{ ...primaryBtn, flex: '1 1 140px' }}><PackagePlus size={15} /> Place Order</button>
      </div>
    </article>
  );
}

function LeadCard({ plant, invite, inviteError, onInvite }: { plant: DiscoveredPlant; invite?: 'sending' | 'done' | 'error'; inviteError?: string; onInvite: () => void }) {
  return (
    <article style={{ ...card, background: 'var(--chip-bg)', border: '1px dashed var(--line)' }}>
      <span style={unverifiedTag}><ShieldAlert size={12} /> Unverified · not yet onboarded</span>
      <strong style={{ fontSize: 16.5 }}>{plant.name}</strong>
      {plant.address && <div style={{ color: 'var(--muted)', fontSize: 13 }}><MapPin size={14} /> {plant.address}</div>}
      {invite === 'done' ? <div style={{ color: 'var(--green)', fontWeight: 700 }}><Check size={15} /> Thanks! We've recorded your request to onboard this plant.</div> : <>{invite === 'error' && inviteError && <div style={{ color: 'var(--red)' }}>{inviteError}</div>}<button onClick={onInvite} disabled={invite === 'sending'} style={primaryBtn}>{invite === 'sending' ? <><Loader2 size={15} className="np-spin" /> Sending…</> : <><HandHeart size={15} /> Request this plant</>}</button></>}
    </article>
  );
}

function SectionHeader({ icon, title, sub, count }: { icon: React.ReactNode; title: string; sub: string; count?: number }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 26 }}>
    {icon}<div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong>{title}</strong>{typeof count === 'number' && <span style={countBadge}>{count}</span>}</div><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{sub}</div></div>
  </div>;
}

function segBtn(active: boolean): React.CSSProperties { return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--gold)' : 'var(--muted)', border: 'none' }; }
function chip(active: boolean): React.CSSProperties { return { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 20, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: active ? 'color-mix(in srgb,var(--gold) 15%,transparent)' : 'var(--surface)', color: active ? 'var(--gold)' : 'var(--text)', border: '1px solid var(--line)' }; }

const wrap: React.CSSProperties = { padding: '22px clamp(14px, 4vw, 34px)', maxWidth: 1100, margin: '0 auto', overflowX: 'hidden' };
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0, boxShadow: '0 1px 3px rgba(0,0,0,.05)' };
const grid: React.CSSProperties = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px,100%),1fr))', marginTop: 12 };
const centerCard: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '54px 20px', marginTop: 16, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--chip-bg)' };
const softCard: React.CSSProperties = { padding: 18, borderRadius: 16, border: '1px solid var(--line)', background: 'var(--chip-bg)' };
const segWrap: React.CSSProperties = { display: 'inline-flex', gap: 3, padding: 3, borderRadius: 11, background: 'var(--chip-bg)', border: '1px solid var(--line)' };
const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44, borderRadius: 10, cursor: 'pointer', background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)' };
const infoBtn: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', minWidth: 44, minHeight: 44, padding: 0, border: 'none', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', flexShrink: 0 };
const radiusSelect: React.CSSProperties = { padding: '8px 13px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: 'var(--chip-bg)', color: 'var(--text)', border: '1px solid var(--line)' };
const searchInput: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '13px 42px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 14.5, fontWeight: 600 };
const clearSearch: React.CSSProperties = { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', minWidth: 44, minHeight: 44 };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, padding: '10px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13.5, fontWeight: 800, background: 'var(--gold)', color: '#1a1a1a', border: 'none' };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, padding: '10px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)' };
const distanceBadge: React.CSSProperties = { flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--gold)', background: 'color-mix(in srgb,var(--gold) 14%,transparent)', border: '1px solid color-mix(in srgb,var(--gold) 35%,transparent)', borderRadius: 20, padding: '4px 9px', whiteSpace: 'nowrap' };
const tmBadge: React.CSSProperties = { ...distanceBadge, display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text)' };
const capabilityBadge: React.CSSProperties = { fontSize: 11.5, fontWeight: 750, padding: '3px 8px', borderRadius: 999, color: 'var(--text)', background: 'var(--chip-bg)', border: '1px solid var(--line)', overflowWrap: 'anywhere' };
const gradeBadge: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--blue)', background: 'color-mix(in srgb,var(--blue) 14%,transparent)', border: '1px solid color-mix(in srgb,var(--blue) 30%,transparent)', borderRadius: 7, padding: '2px 8px' };
const verifiedTag: React.CSSProperties = { alignSelf: 'flex-start', display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, fontWeight: 800, color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 13%,transparent)', border: '1px solid color-mix(in srgb,var(--green) 32%,transparent)', borderRadius: 6, padding: '2px 7px' };
const unverifiedTag: React.CSSProperties = { ...verifiedTag, color: '#f59e0b', background: 'color-mix(in srgb,#f59e0b 14%,transparent)', borderColor: 'color-mix(in srgb,#f59e0b 35%,transparent)' };
const countBadge: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 20, padding: '1px 8px' };
const helpBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 26, padding: '12px 16px', borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' };
