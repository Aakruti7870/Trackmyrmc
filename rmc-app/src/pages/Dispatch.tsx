import { useState, useEffect } from 'react';
import { Plus, Search, X, Printer, Check, Truck } from 'lucide-react';
import { Link } from 'wouter';
import { api, type Challan, type Order, type Vehicle, type Driver, type Client, type Site } from '@/lib/api';

const GRADES = ['M10','M15','M20','M25','M30','M35','M40','M45','M50','M55','M60'];

export default function Dispatch() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<{
    orderId: string; clientId: string; siteId: string; vehicleId: string;
    driverId: string; grade: string; quantity: string; pumpRequired: boolean; notes: string;
  }>({ orderId: '', clientId: '', siteId: '', vehicleId: '', driverId: '', grade: '', quantity: '', pumpRequired: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() { api.get<Challan[]>('/challans').then(setChallans); }

  useEffect(() => {
    load();
    api.get<Order[]>('/orders').then(o => setOrders(o.filter(x => x.status === 'pending' || x.status === 'in_progress')));
    api.get<Vehicle[]>('/vehicles').then(v => setVehicles(v.filter(x => x.status === 'active')));
    api.get<Driver[]>('/drivers').then(d => setDrivers(d.filter(x => x.isActive)));
    api.get<Client[]>('/clients').then(setClients);
  }, []);

  async function loadSites(clientId: string) {
    if (!clientId) return setSites([]);
    setSites(await api.get<Site[]>(`/clients/${clientId}/sites`));
  }

  function openModal(order?: Order) {
    if (order) {
      setForm({ orderId: String(order.id), clientId: String(order.clientId), siteId: order.siteId ? String(order.siteId) : '', vehicleId: '', driverId: '', grade: order.grade, quantity: order.quantity, pumpRequired: order.pumpRequired, notes: '' });
      loadSites(String(order.clientId));
    } else {
      setForm({ orderId: '', clientId: '', siteId: '', vehicleId: '', driverId: '', grade: '', quantity: '', pumpRequired: false, notes: '' });
      setSites([]);
    }
    setModal(true); setError('');
  }

  async function save() {
    setSaving(true); setError('');
    try {
      await api.post('/challans', {
        orderId: form.orderId ? +form.orderId : null,
        clientId: +form.clientId,
        siteId: form.siteId ? +form.siteId : null,
        vehicleId: form.vehicleId ? +form.vehicleId : null,
        driverId: form.driverId ? +form.driverId : null,
        grade: form.grade, quantity: +form.quantity,
        pumpRequired: form.pumpRequired, notes: form.notes,
      });
      load();
      api.get<Order[]>('/orders').then(o => setOrders(o.filter(x => x.status === 'pending' || x.status === 'in_progress')));
      setModal(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function markDelivered(ch: Challan) {
    await api.put(`/challans/${ch.id}`, { status: 'delivered' }); load();
  }

  const filtered = challans.filter(ch => {
    const matchSearch = ch.challanNo.toLowerCase().includes(search.toLowerCase()) ||
      (ch.clientName || '').toLowerCase().includes(search.toLowerCase()) ||
      (ch.vehicleNo || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || ch.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => ({ pending: '#f7c948', dispatched: '#38bdf8', delivered: '#22c55e', cancelled: '#ef4444' }[s] || '#9fb0c7');
  const statusBg = (s: string) => ({ pending: 'rgba(247,201,72,.12)', dispatched: 'rgba(56,189,248,.12)', delivered: 'rgba(34,197,94,.12)', cancelled: 'rgba(239,68,68,.12)' }[s] || 'rgba(159,176,199,.12)');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: '#eef5ff', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Dispatch</h2>
          <p style={{ margin: '4px 0 0', color: '#9fb0c7', fontSize: 13 }}>{challans.filter(c => c.status === 'dispatched').length} on road · {challans.length} total challans</p>
        </div>
        <button onClick={() => openModal()} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)',
          color: '#052e16', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> Create Challan</button>
      </div>

      {/* Active orders ready to dispatch */}
      {orders.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9fb0c7', marginBottom: 8 }}>Pending Orders — Ready to Dispatch</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {orders.slice(0, 5).map(o => (
              <div key={o.id} style={{
                padding: '10px 14px', background: 'rgba(247,201,72,.06)', border: '1px solid rgba(247,201,72,.2)',
                borderRadius: 10, cursor: 'pointer', minWidth: 180,
              }} onClick={() => openModal(o)}>
                <div style={{ fontWeight: 700, color: '#f7c948', fontFamily: 'monospace', fontSize: 12 }}>{o.orderNo}</div>
                <div style={{ fontSize: 12, fontWeight: 600, margin: '3px 0' }}>{o.clientName}</div>
                <div style={{ fontSize: 11, color: '#9fb0c7' }}>{o.grade} · {o.quantity} m³ {o.pumpRequired ? '· Pump' : ''}</div>
                <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4, fontWeight: 700 }}>→ Create Challan</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} color="#9fb0c7" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search challans…"
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #263449' }}>
                {['Challan', 'Client', 'Vehicle', 'Driver', 'Grade', 'Qty', 'Dispatch Time', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', color: '#9fb0c7', fontWeight: 600, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ch => (
                <tr key={ch.id} style={{ borderBottom: '1px solid rgba(38,52,73,.4)' }}>
                  <td style={{ padding: '11px 14px', color: '#f7c948', fontWeight: 700, fontFamily: 'monospace' }}>#{ch.challanNo}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600 }}>{ch.clientName}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontSize: 11, color: '#9fb0c7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Truck size={11} color="#38bdf8" />
                      {ch.vehicleNo || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: '#9fb0c7' }}>{ch.driverName || '—'}</td>
                  <td style={{ padding: '11px 14px' }}><span style={{ padding: '2px 8px', background: 'rgba(56,189,248,.12)', color: '#38bdf8', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{ch.grade}</span></td>
                  <td style={{ padding: '11px 14px', fontWeight: 700 }}>{ch.quantity} m³</td>
                  <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12 }}>
                    {ch.dispatchTime ? new Date(ch.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: statusColor(ch.status), background: statusBg(ch.status) }}>
                      {ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {ch.status === 'dispatched' && (
                        <button onClick={() => markDelivered(ch)} style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                          background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)',
                          borderRadius: 7, cursor: 'pointer', color: '#22c55e', fontSize: 11, fontWeight: 700,
                        }}><Check size={11} /> Delivered</button>
                      )}
                      <Link href={`/challans/${ch.id}/print`}>
                        <button style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                          background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)',
                          borderRadius: 7, cursor: 'pointer', color: '#38bdf8', fontSize: 11, fontWeight: 700,
                        }}><Printer size={11} /> Print</button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#9fb0c7' }}>No challans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Challan Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#0d1930', border: '1px solid #263449', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Create Challan</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9fb0c7' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {form.orderId && (
                <div style={{ gridColumn: '1/-1', padding: '8px 12px', background: 'rgba(247,201,72,.06)', border: '1px solid rgba(247,201,72,.15)', borderRadius: 8, fontSize: 12, color: '#f7c948' }}>
                  Creating challan for Order #{orders.find(o => String(o.id) === form.orderId)?.orderNo}
                </div>
              )}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Client *</label>
                <select value={form.clientId} onChange={e => { setForm(f => ({ ...f, clientId: e.target.value, siteId: '' })); loadSites(e.target.value); }} style={inputStyle}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {sites.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Delivery Site</label>
                  <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
                    <option value="">No specific site</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Grade *</label>
                <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Quantity (m³) *</label>
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Vehicle</label>
                <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} style={inputStyle}>
                  <option value="">Select vehicle…</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo} ({v.capacity} m³)</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Driver</label>
                <select value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} style={inputStyle}>
                  <option value="">Select driver…</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="pump" checked={form.pumpRequired} onChange={e => setForm(f => ({ ...f, pumpRequired: e.target.checked }))} />
                <label htmlFor="pump" style={{ fontSize: 13, color: '#eef5ff', cursor: 'pointer' }}>Pump Required</label>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9fb0c7', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            {error && <div style={{ marginTop: 10, color: '#ef4444', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#9fb0c7', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)', color: '#052e16', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Creating…' : 'Dispatch Challan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
