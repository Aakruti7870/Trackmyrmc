import { useState, useEffect } from 'react';
import { Plus, X, Search, Pencil, Trash2, Truck } from 'lucide-react';
import { vehicleStore } from '@/lib/store';
import type { Vehicle, VehicleStatus } from '@/lib/types';

const empty: Omit<Vehicle, 'id' | 'createdAt'> = { vehicleNo: '', driver: '', driverPhone: '', capacity: 7, status: 'active' };

const VS_COLOR: Record<VehicleStatus, string> = { active: '#22c55e', inactive: '#ef4444', maintenance: '#f7c948' };
const VS_BG: Record<VehicleStatus, string> = { active: 'rgba(34,197,94,.12)', inactive: 'rgba(239,68,68,.12)', maintenance: 'rgba(247,201,72,.12)' };
const statusColor = (s: VehicleStatus) => VS_COLOR[s];
const statusBg = (s: VehicleStatus) => VS_BG[s];

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = () => setVehicles(vehicleStore.getAll());
  useEffect(() => { reload(); }, []);

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    return !q || v.vehicleNo.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q);
  });

  function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
  function openEdit(v: Vehicle) { setForm({ vehicleNo: v.vehicleNo, driver: v.driver, driverPhone: v.driverPhone, capacity: v.capacity, status: v.status }); setEditId(v.id); setShowForm(true); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) vehicleStore.update(editId, form); else vehicleStore.add(form);
    setShowForm(false); reload();
  }

  function doDelete() { if (deleteId) { vehicleStore.remove(deleteId); reload(); setDeleteId(null); } }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(38,52,73,.4)', border: '1px solid #263449',
    borderRadius: 10, padding: '9px 12px', color: '#eef5ff', fontSize: 14, outline: 'none'
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#9fb0c7', marginBottom: 5, display: 'block' };

  const activeCount = vehicles.filter(v => v.status === 'active').length;
  const maintCount = vehicles.filter(v => v.status === 'maintenance').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Vehicles</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>Transit Mixer Fleet Management</p>
        </div>
        <button onClick={openAdd} data-testid="button-add-vehicle" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          borderRadius: 12, padding: '10px 18px',
          background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
          color: '#111827', fontWeight: 800, fontSize: 14
        }}>
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Fleet', value: vehicles.length, color: '#38bdf8' },
          { label: 'Active', value: activeCount, color: '#22c55e' },
          { label: 'Maintenance', value: maintCount, color: '#f7c948' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card" style={{ padding: '16px 18px' }}>
            <div style={{ color: '#9fb0c7', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div className="metric-text" style={{ fontSize: '1.6rem', background: `linear-gradient(180deg, ${color}, ${color}aa)`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb0c7' }} />
        <input placeholder="Search vehicle no, driver..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-vehicles"
          style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>

      {/* Vehicle cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {filtered.map(v => (
          <div key={v.id} className="glass-card" style={{ padding: 20 }} data-testid={`vehicle-card-${v.id}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg,#facc15,#f59e0b)',
                  display: 'grid', placeItems: 'center',
                  boxShadow: '0 8px 20px rgba(245,158,11,.2)'
                }}>
                  <Truck size={20} color="#111827" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'monospace', letterSpacing: '.5px' }}>{v.vehicleNo}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: statusColor(v.status), background: statusBg(v.status) }}>{v.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(v)} data-testid={`button-edit-vehicle-${v.id}`} style={{ background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#38bdf8', cursor: 'pointer' }}><Pencil size={13} /></button>
                <button onClick={() => setDeleteId(v.id)} data-testid={`button-delete-vehicle-${v.id}`} style={{ background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9fb0c7' }}>Driver</span>
                <span style={{ fontWeight: 600 }}>{v.driver}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9fb0c7' }}>Phone</span>
                <span>{v.driverPhone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9fb0c7' }}>Capacity</span>
                <span style={{ fontWeight: 700, color: '#f7c948' }}>{v.capacity} m³</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#9fb0c7' }}>No vehicles found</div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editId ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: '#9fb0c7', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Vehicle Number *</label>
                <input value={form.vehicleNo} onChange={e => setForm(f => ({ ...f, vehicleNo: e.target.value.toUpperCase() }))} required placeholder="MH 46 CU 0813" style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '.5px' }} data-testid="input-vehicle-no" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Driver Name *</label>
                  <input value={form.driver} onChange={e => setForm(f => ({ ...f, driver: e.target.value }))} required placeholder="Driver name" style={inputStyle} data-testid="input-driver" />
                </div>
                <div>
                  <label style={labelStyle}>Driver Phone</label>
                  <input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} placeholder="10-digit number" style={inputStyle} data-testid="input-driver-phone" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Capacity (m³)</label>
                  <input type="number" min={1} max={15} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} style={inputStyle} data-testid="input-capacity" />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as VehicleStatus }))} style={inputStyle} data-testid="select-vehicle-status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: '#1a2940', color: '#eef5ff', border: '1px solid #263449', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button type="submit" data-testid="button-save-vehicle" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)', color: '#111827', fontWeight: 800, fontSize: 14 }}>{editId ? 'Update' : 'Add Vehicle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Vehicle?</h3>
            <p style={{ color: '#9fb0c7', marginBottom: 20, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 16px', borderRadius: 10, background: '#1a2940', color: '#eef5ff', border: '1px solid #263449', fontSize: 14 }}>Cancel</button>
              <button onClick={doDelete} data-testid="button-confirm-delete-vehicle" style={{ padding: '9px 16px', borderRadius: 10, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
