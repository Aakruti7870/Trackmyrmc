import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertTriangle } from 'lucide-react';
import { api, type Vehicle, type Driver } from '@/lib/api';

const STATUSES = ['active', 'maintenance', 'inactive'];

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<Vehicle & { driverId?: number }>>({});
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() { api.get<Vehicle[]>('/vehicles').then(setVehicles); }
  useEffect(() => { load(); api.get<Driver[]>('/drivers').then(d => setDrivers(d.filter(x => x.isActive))); }, []);

  function openCreate() { setForm({ status: 'active', type: 'Transit Mixer' }); setEditing(null); setModal('create'); setError(''); }
  function openEdit(v: Vehicle) { setForm({ ...v }); setEditing(v); setModal('edit'); setError(''); }

  async function save() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') await api.post('/vehicles', form);
      else await api.put(`/vehicles/${editing!.id}`, form);
      load(); setModal(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function remove(v: Vehicle) {
    if (!confirm(`Delete ${v.vehicleNo}?`)) return;
    await api.delete(`/vehicles/${v.id}`); load();
  }

  const filtered = vehicles.filter(v =>
    v.vehicleNo.toLowerCase().includes(search.toLowerCase()) ||
    (v.driverName || '').toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => ({ active: 'var(--green)', maintenance: 'var(--gold)', inactive: 'var(--red)' }[s] || 'var(--muted)');
  const statusBg = (s: string) => ({ active: 'rgba(34,197,94,.12)', maintenance: 'color-mix(in srgb, var(--gold) 12%, transparent)', inactive: 'rgba(239,68,68,.12)' }[s] || 'rgba(159,176,199,.12)');

  function daysUntil(dateStr?: string | null) {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    return diff;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Fleet</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{vehicles.filter(v => v.status === 'active').length}/{vehicles.length} vehicles active</p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> Add Vehicle</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} style={{ color: 'var(--muted)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vehicles…"
          style={{ ...inputStyle, paddingLeft: 36 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {filtered.map(v => {
          const insExpiry = daysUntil(v.insuranceExpiry);
          const insWarning = insExpiry !== null && insExpiry < 60;
          return (
            <div key={v.id} className="glass-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 15, fontFamily: 'monospace', letterSpacing: '.5px' }}>{v.vehicleNo}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{v.type} · {v.capacity} m³</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: statusColor(v.status), background: statusBg(v.status) }}>
                    {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => openEdit(v)} style={{ padding: 5, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--blue)' }}><Edit2 size={12} /></button>
                    <button onClick={() => remove(v)} style={{ padding: 5, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12 }}>
                <div style={{ color: 'var(--muted)' }}>Driver: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{v.driverName || 'Unassigned'}</span></div>
                {v.driverPhone && <div style={{ color: 'var(--muted)' }}>Phone: <span style={{ color: 'var(--text)' }}>{v.driverPhone}</span></div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: insWarning ? 'var(--gold)' : 'var(--muted)' }}>
                  {insWarning && <AlertTriangle size={12} style={{ color: 'var(--gold)' }} />}
                  Insurance: <span style={{ color: insWarning ? 'var(--gold)' : 'var(--text)', fontWeight: insWarning ? 700 : 400 }}>
                    {v.insuranceExpiry ? `${v.insuranceExpiry} (${insExpiry}d)` : '—'}
                  </span>
                </div>
                <div style={{ color: 'var(--muted)' }}>Last Service: <span style={{ color: 'var(--text)' }}>{v.lastService || '—'}</span></div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No vehicles found</div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{modal === 'create' ? 'Add Vehicle' : 'Edit Vehicle'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['vehicleNo', 'Vehicle Number *', '1/-1'], ['type', 'Type'], ['capacity', 'Capacity (m³)'], ['insuranceExpiry', 'Insurance Expiry'], ['lastService', 'Last Service Date']].map(([k, l, full]) => (
                <div key={k} style={{ gridColumn: full || 'auto' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{l}</label>
                  <input type={k.includes('Expiry') || k.includes('Service') ? 'date' : k === 'capacity' ? 'number' : 'text'}
                    value={(form as Record<string, string | undefined>)[k] || ''}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Assign Driver</label>
                <select value={form.driverId || ''} onChange={e => setForm(f => ({ ...f, driverId: e.target.value ? +e.target.value : undefined }))} style={inputStyle}>
                  <option value="">Unassigned</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Status</label>
                <select value={form.status || 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Add Vehicle' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
