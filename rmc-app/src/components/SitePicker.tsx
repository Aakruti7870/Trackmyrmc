import { useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import type { Site } from '@/lib/api';
import LocationPicker, { type LatLng } from '@/components/LocationPicker';

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, boxSizing: 'border-box',
  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 14,
};

// A delivery-site selector reused by the order and recurring-order modals. Lets
// the customer choose one of their saved sites or add a new one inline (which is
// saved to their account and immediately selected).
export default function SitePicker({
  sites, value, onChange, onCreate,
}: {
  sites: Site[];
  value: string;
  onChange: (siteId: string) => void;
  onCreate: (payload: { name: string; address?: string; city?: string; latitude?: string; longitude?: string }) => Promise<Site>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setName(''); setAddress(''); setCity(''); setPin(null);
  }

  async function save() {
    if (!name.trim()) { setError('Site name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const site = await onCreate({
        name: name.trim(),
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        latitude: pin ? String(pin.lat) : undefined,
        longitude: pin ? String(pin.lng) : undefined,
      });
      onChange(String(site.id));
      setAdding(false);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save site.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label style={labelStyle}>Delivery Site (optional)</label>
      {!adding ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">No saved site</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>)}
          </select>
          <button type="button" onClick={() => { setAdding(true); setError(''); }} title="Add new site" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
            background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
            border: '1px solid color-mix(in srgb, var(--gold) 35%, transparent)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            <Plus size={14} /> New
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'var(--chip-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
              <MapPin size={13} style={{ color: 'var(--gold)' }} /> New delivery site
            </span>
            <button type="button" onClick={() => { setAdding(false); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
              <X size={15} />
            </button>
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Site name (e.g. Tower B Foundation)" style={{ ...inputStyle, marginBottom: 8 }} />
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address (optional)" style={{ ...inputStyle, marginBottom: 8 }} />
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="City (optional)" style={{ ...inputStyle, marginBottom: 10 }} />
          <label style={{ ...labelStyle, marginBottom: 6 }}>Pin location on map (optional — enables live tracking)</label>
          <LocationPicker value={pin} onChange={setPin} />
          {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{error}</div>}
          <button type="button" onClick={save} disabled={saving} style={{
            marginTop: 10, width: '100%', padding: '9px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontSize: 13, fontWeight: 800,
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? 'Saving…' : 'Save site'}
          </button>
        </div>
      )}
    </div>
  );
}
