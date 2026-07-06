import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPinned, Search, Crosshair, Loader2, MapPin, Plus, Save, Send,
  Copy, MessageCircle, Check, Building2,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, MapClickCapture } from '@/components/map';
import { useMapHandle } from '@/components/map/handle';
import L from 'leaflet';
import { api, ApiError, type AdminPlant, type SendInviteResult } from '@/lib/api';
import { getMapEngine, useMapEngine } from '@/lib/mapEngine';
import { SectionHeading, GlassPanel, PrimaryButton, GhostButton, Badge, } from '../ui';
import { mix } from '../tokens';

// Bundled Leaflet marker PNGs break under Vite — point at the CDN copies. A
// second (green) icon marks the plant currently being edited/added so it stands
// out from the saved-plant pins.
const savedIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const editIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet-color-markers@1.0.0/img/marker-icon-2x-green.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet-color-markers@1.0.0/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface LatLng { lat: number; lng: number }
const DEFAULT_CENTER: LatLng = { lat: 18.5204, lng: 73.8567 }; // Pune

const STATUSES = ['pending', 'invited', 'verified', 'active'] as const;
type NetworkStatus = (typeof STATUSES)[number];
const STATUS_COLOR: Record<NetworkStatus, string> = {
  pending: 'var(--muted)',
  invited: 'var(--blue)',
  verified: 'var(--orange)',
  active: 'var(--green)',
};

interface GeoResult { lat: string; lon: string; display_name: string }

// Recenter the map imperatively when the pin moves from outside (search / my
// location / selecting a saved plant) without re-mounting the container.
function Recenter({ center }: { center: LatLng | null }) {
  const handle = useMapHandle();
  useEffect(() => {
    if (center) handle.setView([center.lat, center.lng], Math.max(handle.getZoom(), 14));
  }, [center, handle]);
  return null;
}

interface FormState {
  name: string;
  ownerName: string;
  contactNumber: string;
  whatsappNumber: string;
  email: string;
  address: string;
  city: string;
  latitude: string;
  longitude: string;
  networkStatus: NetworkStatus;
  showOnNetwork: boolean;
}

const EMPTY_FORM: FormState = {
  name: '', ownerName: '', contactNumber: '', whatsappNumber: '', email: '',
  address: '', city: '', latitude: '', longitude: '',
  networkStatus: 'pending', showOnNetwork: true,
};

function fromPlant(p: AdminPlant): FormState {
  return {
    name: p.name ?? '',
    ownerName: p.ownerName ?? '',
    contactNumber: p.contactNumber ?? '',
    whatsappNumber: p.whatsappNumber ?? '',
    email: p.email ?? '',
    address: p.address ?? '',
    city: p.city ?? '',
    latitude: p.latitude ?? '',
    longitude: p.longitude ?? '',
    networkStatus: (STATUSES as readonly string[]).includes(p.networkStatus) ? p.networkStatus : 'pending',
    showOnNetwork: p.showOnNetwork !== false,
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 9, fontSize: 13,
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
      {children}
    </label>
  );
}

export default function MappingPlant({ accent }: { accent: string }) {
  const engine = useMapEngine();
  const [plants, setPlants] = useState<AdminPlant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const [center, setCenter] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [invite, setInvite] = useState<SendInviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  function loadPlants() {
    api.get<AdminPlant[]>('/plants')
      .then(d => { setPlants(Array.isArray(d) ? d : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }
  useEffect(() => { loadPlants(); }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const pin = useMemo<LatLng | null>(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [form.latitude, form.longitude]);

  // Saved plants that carry usable coordinates — rendered as pins on the map.
  const savedPins = useMemo(
    () => plants
      .map(p => ({ p, lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) }))
      .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng)),
    [plants],
  );

  const mapCenter: LatLng = pin ?? center ?? savedPins[0] ?? DEFAULT_CENTER;

  function setPin(p: LatLng) {
    setResults([]);
    setForm(f => ({ ...f, latitude: p.lat.toFixed(6), longitude: p.lng.toFixed(6) }));
    setCenter(p);
  }

  function startNew() {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setInvite(null);
    setMsg(null);
    setResults([]);
  }

  function selectPlant(p: AdminPlant) {
    setSelectedId(p.id);
    setForm(fromPlant(p));
    setInvite(null);
    setMsg(null);
    setResults([]);
    const lat = parseFloat(p.latitude);
    const lng = parseFloat(p.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) setCenter({ lat, lng });
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
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
        } catch { data = []; }
      }
      if (!data.length) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('Search failed');
        data = (await res.json()) as GeoResult[];
      }
      if (!data.length) { setMsg({ kind: 'err', text: 'No match found — try a nearby landmark or drop a pin.' }); return; }
      if (data.length === 1) setPin({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      else setResults(data);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setMsg({ kind: 'err', text: 'Could not search right now — drop a pin instead.' });
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setMsg({ kind: 'err', text: 'Location is not available on this device.' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false); },
      () => { setMsg({ kind: 'err', text: 'Could not get your location — drop a pin instead.' }); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save() {
    setMsg(null);
    if (!form.name.trim()) { setMsg({ kind: 'err', text: 'Plant name is required.' }); return; }
    if (!pin) { setMsg({ kind: 'err', text: 'Drop a pin on the map to set the plant location.' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      ownerName: form.ownerName.trim() || null,
      contactNumber: form.contactNumber.trim() || null,
      whatsappNumber: form.whatsappNumber.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      latitude: pin.lat.toFixed(6),
      longitude: pin.lng.toFixed(6),
      locationVerified: true,
      networkStatus: form.networkStatus,
      showOnNetwork: form.showOnNetwork,
    };
    try {
      const saved = selectedId
        ? await api.put<AdminPlant>(`/plants/${selectedId}`, payload)
        : await api.post<AdminPlant>('/plants', payload);
      setSelectedId(saved.id);
      setForm(fromPlant(saved));
      setMsg({ kind: 'ok', text: `Plant "${saved.name}" saved.` });
      loadPlants();
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Could not save the plant.';
      setMsg({ kind: 'err', text });
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite() {
    setMsg(null);
    setInvite(null);
    if (!selectedId) { setMsg({ kind: 'err', text: 'Save the plant first, then send the invite.' }); return; }
    if (!form.ownerName.trim()) { setMsg({ kind: 'err', text: 'Owner name is required to send an invite.' }); return; }
    if (!form.email.trim()) { setMsg({ kind: 'err', text: 'Owner email is required to send an invite.' }); return; }
    setInviting(true);
    try {
      const res = await api.post<SendInviteResult>(`/plants/${selectedId}/send-invite`, {
        name: form.ownerName.trim(),
        email: form.email.trim(),
      });
      setInvite(res);
      setMsg({
        kind: 'ok',
        text: res.emailSent
          ? 'Invitation emailed to the plant owner. You can also copy or WhatsApp the link below.'
          : 'Invite link generated. Copy it or send it over WhatsApp.',
      });
      loadPlants();
    } catch (err) {
      const text = err instanceof ApiError ? err.message : 'Could not send the invitation.';
      setMsg({ kind: 'err', text });
    } finally {
      setInviting(false);
    }
  }

  function copyLink() {
    if (!invite) return;
    navigator.clipboard?.writeText(invite.inviteUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1800); },
      () => setMsg({ kind: 'err', text: 'Could not copy — select and copy the link manually.' }),
    );
  }

  function whatsappHref(): string {
    if (!invite) return '#';
    const text = `Hi${form.ownerName ? ' ' + form.ownerName : ''}, you're invited to join the Concrete King RMC network. Set up your plant login here: ${invite.inviteUrl}`;
    const num = form.whatsappNumber.replace(/[^\d]/g, '');
    return num
      ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<MapPinned size={20} />} accent={accent}
        title="MAPPING PLANT"
        subtitle="Search, pin, invite and onboard RMC plants into the Concrete King network."
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        {/* --- Map + search --- */}
        <GlassPanel accent={accent} style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <form onSubmit={search} style={{ display: 'flex', gap: 6, flex: 1, minWidth: 200 }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search plant by name or location…"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="submit" disabled={searching} title="Search Plant" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 13px', borderRadius: 9,
                cursor: searching ? 'wait' : 'pointer', background: mix(accent, 16), color: accent,
                border: `1px solid ${mix(accent, 40)}`, fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap',
              }}>
                {searching ? <Loader2 size={14} className="mp-spin" /> : <Search size={14} />} Search Plant
              </button>
            </form>
            <button type="button" onClick={useMyLocation} disabled={locating} title="Use my location" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: 9,
              cursor: locating ? 'wait' : 'pointer', background: 'var(--chip-bg)', color: 'var(--text)',
              border: '1px solid var(--line)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              {locating ? <Loader2 size={14} className="mp-spin" /> : <Crosshair size={14} />} My location
            </button>
          </div>

          {results.length > 0 && (
            <div style={{ marginBottom: 10, border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', background: 'var(--chip-bg)' }}>
              {results.map((r, i) => (
                <button
                  key={`${r.lat},${r.lon},${i}`}
                  type="button"
                  onClick={() => setPin({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) })}
                  style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left',
                    padding: '9px 11px', background: 'transparent', cursor: 'pointer', color: 'var(--text)',
                    border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 12.5, fontWeight: 600,
                  }}
                >
                  <MapPin size={14} style={{ flexShrink: 0, marginTop: 1, color: accent }} />
                  <span>{r.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={pin ? 14 : 11} style={{ height: 380, width: '100%' }} scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickCapture onPick={setPin} />
              <Recenter center={center} />
              {/* Saved plant pins — click to select & edit */}
              {savedPins.filter(x => x.p.id !== selectedId).map(({ p, lat, lng }) => (
                <Marker key={p.id} position={[lat, lng]} icon={savedIcon} eventHandlers={{ click: () => selectPlant(p) }}>
                  <Popup>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                      <strong>{p.name}</strong><br />
                      {p.city || '—'}<br />
                      Status: {p.networkStatus}{p.showOnNetwork ? ' • on network' : ' • hidden'}<br />
                      <button
                        type="button" onClick={() => selectPlant(p)}
                        style={{ marginTop: 4, cursor: 'pointer', border: 'none', background: 'transparent', color: '#178a6e', fontWeight: 800, padding: 0 }}
                      >Edit this plant →</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {/* The plant currently being added / edited (draggable) */}
              {pin && (
                <Marker
                  position={[pin.lat, pin.lng]}
                  icon={editIcon}
                  draggable
                  eventHandlers={{
                    dragend(e) {
                      const m = e.target as L.Marker;
                      const ll = m.getLatLng();
                      setPin({ lat: ll.lat, lng: ll.lng });
                    },
                  }}
                />
              )}
            </MapContainer>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {pin ? `Pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : 'Tap the map or search to pin the plant.'}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {engine === 'google' ? 'Google Maps' : 'OpenStreetMap'} • green pin = editing
            </span>
          </div>
        </GlassPanel>

        {/* --- Details form --- */}
        <GlassPanel accent={accent} style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
              {selectedId ? 'Edit plant details' : 'New plant details'}
            </div>
            {selectedId && <GhostButton accent={accent} onClick={startNew}><Plus size={14} /> Add new</GhostButton>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Plant Name *">
                <input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} placeholder="e.g. Concrete King — Baner Plant" />
              </Field>
            </div>
            <Field label="Owner Name">
              <input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Mobile Number">
              <input value={form.contactNumber} onChange={e => set('contactNumber', e.target.value)} style={inputStyle} inputMode="tel" />
            </Field>
            <Field label="WhatsApp Number">
              <input value={form.whatsappNumber} onChange={e => set('whatsappNumber', e.target.value)} style={inputStyle} inputMode="tel" />
            </Field>
            <Field label="Email Address">
              <input value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} inputMode="email" />
            </Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Address">
                <input value={form.address} onChange={e => set('address', e.target.value)} style={inputStyle} />
              </Field>
            </div>
            <Field label="Locality / City">
              <input value={form.city} onChange={e => set('city', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Plant Status">
              <select value={form.networkStatus} onChange={e => set('networkStatus', e.target.value as NetworkStatus)} style={inputStyle}>
                {STATUSES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Latitude">
              <input value={form.latitude} readOnly style={{ ...inputStyle, opacity: 0.75 }} placeholder="auto from map" />
            </Field>
            <Field label="Longitude">
              <input value={form.longitude} readOnly style={{ ...inputStyle, opacity: 0.75 }} placeholder="auto from map" />
            </Field>
          </div>

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={() => set('showOnNetwork', !form.showOnNetwork)}
            style={{
              marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              background: form.showOnNetwork ? mix('var(--green)', 12) : 'var(--surface)',
              border: `1px solid ${form.showOnNetwork ? mix('var(--green)', 40) : 'var(--line)'}`,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Show on Network</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Only Active + Show-on-Network plants appear on the customer dashboard.</span>
            </span>
            <span style={{
              width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative', transition: 'all .15s',
              background: form.showOnNetwork ? 'var(--green)' : 'var(--line)',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: form.showOnNetwork ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'all .15s',
              }} />
            </span>
          </button>

          {msg && (
            <div style={{
              marginTop: 12, padding: '9px 11px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
              background: msg.kind === 'ok' ? mix('var(--green)', 12) : mix('var(--red)', 12),
              color: msg.kind === 'ok' ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${msg.kind === 'ok' ? mix('var(--green)', 34) : mix('var(--red)', 34)}`,
            }}>
              {msg.text}
            </div>
          )}

          {invite && (
            <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Invite link</div>
              <div style={{
                fontSize: 12, color: 'var(--text)', wordBreak: 'break-all',
                background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px',
              }}>{invite.inviteUrl}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <GhostButton accent={accent} onClick={copyLink}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
                </GhostButton>
                <a href={whatsappHref()} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <GhostButton accent="var(--green)"><MessageCircle size={14} /> WhatsApp</GhostButton>
                </a>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <PrimaryButton accent={accent} onClick={save} disabled={saving}>
              {saving ? <Loader2 size={15} className="mp-spin" /> : <Save size={15} />} Save Plant
            </PrimaryButton>
            <GhostButton accent={accent} onClick={sendInvite} style={inviting ? { opacity: 0.6 } : undefined}>
              {inviting ? <Loader2 size={14} className="mp-spin" /> : <Send size={14} />} Send Invitation
            </GhostButton>
          </div>
        </GlassPanel>
      </div>

      {/* --- Saved plants list --- */}
      <GlassPanel accent={accent} style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Building2 size={16} color={accent} /> Mapped plants{loaded ? ` (${plants.length})` : ''}
        </div>
        <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
          {plants.map(p => {
            const st = ((STATUSES as readonly string[]).includes(p.networkStatus) ? p.networkStatus : 'pending') as NetworkStatus;
            const on = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPlant(p)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: 13, borderRadius: 13,
                  background: on ? mix(accent, 12) : 'var(--surface)',
                  border: `1px solid ${on ? mix(accent, 45) : 'var(--line)'}`,
                  display: 'flex', flexDirection: 'column', gap: 7,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <Badge color={STATUS_COLOR[st]} dot>{st}</Badge>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {p.city || '—'}{p.ownerName ? ` • ${p.ownerName}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge color={p.showOnNetwork ? 'var(--green)' : 'var(--muted)'}>{p.showOnNetwork ? 'On network' : 'Hidden'}</Badge>
                  {p.inviteStatus === 'invited' && <Badge color="var(--blue)">Invited</Badge>}
                </div>
              </button>
            );
          })}
          {loaded && plants.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, gridColumn: '1 / -1' }}>
              No plants mapped yet — search a location, drop a pin and save your first plant.
            </div>
          )}
        </div>
      </GlassPanel>

      <style>{`@keyframes mp-spin{to{transform:rotate(360deg)}}.mp-spin{animation:mp-spin .8s linear infinite}`}</style>
    </div>
  );
}
