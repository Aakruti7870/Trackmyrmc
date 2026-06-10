import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Search, AlertTriangle, UserCheck } from 'lucide-react';
import { api, type Driver } from '@/lib/api';

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<Driver>>({});
  const [editing, setEditing] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() { api.get<Driver[]>('/drivers').then(setDrivers); }
  useEffect(load, []);

  function openCreate() { setForm({ isActive: true }); setEditing(null); setModal('create'); setError(''); }
  function openEdit(d: Driver) { setForm({ ...d }); setEditing(d); setModal('edit'); setError(''); }

  async function save() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') await api.post('/drivers', form);
      else await api.put(`/drivers/${editing!.id}`, form);
      load(); setModal(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function remove(d: Driver) {
    if (!confirm(`Delete driver ${d.name}?`)) return;
    await api.delete(`/drivers/${d.id}`); load();
  }

  const filtered = drivers.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search) ||
    (d.licenseNo || '').toLowerCase().includes(search.toLowerCase())
  );

  function daysUntil(dateStr?: string | null) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: '#eef5ff', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Drivers</h2>
          <p style={{ margin: '4px 0 0', color: '#9fb0c7', fontSize: 13 }}>{drivers.filter(d => d.isActive).length} active · {drivers.length} total</p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
          color: '#111827', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> Add Driver</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 320 }}>
        <Search size={14} color="#9fb0c7" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search drivers…"
          style={{ ...inputStyle, paddingLeft: 36 }} />
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #263449' }}>
                {['Driver', 'Phone', 'License No', 'License Expiry', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', color: '#9fb0c7', fontWeight: 600, textAlign: 'left', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const licDays = daysUntil(d.licenseExpiry);
                const licWarning = licDays !== null && licDays < 60;
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(38,52,73,.4)' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 9,
                          background: d.isActive ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                          display: 'grid', placeItems: 'center',
                        }}>
                          <UserCheck size={14} color={d.isActive ? '#22c55e' : '#ef4444'} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12 }}>{d.phone}</td>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 12, color: '#9fb0c7' }}>{d.licenseNo || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12 }}>
                      {d.licenseExpiry ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: licWarning ? '#f7c948' : '#9fb0c7' }}>
                          {licWarning && <AlertTriangle size={12} />}
                          {d.licenseExpiry} {licDays !== null && `(${licDays}d)`}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        color: d.isActive ? '#22c55e' : '#ef4444',
                        background: d.isActive ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                      }}>{d.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => openEdit(d)} style={{ padding: '4px 8px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 7, cursor: 'pointer', color: '#38bdf8' }}><Edit2 size={12} /></button>
                        <button onClick={() => remove(d)} style={{ padding: '4px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#9fb0c7' }}>No drivers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#0d1930', border: '1px solid #263449', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{modal === 'create' ? 'Add Driver' : 'Edit Driver'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9fb0c7' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'name', label: 'Full Name *', type: 'text', full: true },
                { key: 'phone', label: 'Phone *', type: 'text' },
                { key: 'licenseNo', label: 'License Number', type: 'text' },
                { key: 'licenseExpiry', label: 'License Expiry', type: 'date' },
              ].map(({ key, label, type, full }) => (
                <div key={key} style={{ gridColumn: full ? '1/-1' : 'auto' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>{label}</label>
                  <input type={type} value={(form as Record<string, string | undefined>)[key] || ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1/-1' }}>
                <input type="checkbox" id="active" checked={!!form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                <label htmlFor="active" style={{ fontSize: 13, color: '#eef5ff', cursor: 'pointer' }}>Active Driver</label>
              </div>
            </div>
            {error && <div style={{ marginTop: 10, color: '#ef4444', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#9fb0c7', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)', color: '#111827', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Add Driver' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
