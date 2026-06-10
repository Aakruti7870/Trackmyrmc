import { useState, useEffect } from 'react';
import { Plus, X, Search, Printer, Check } from 'lucide-react';
import { challanStore, orderStore, vehicleStore } from '@/lib/store';
import type { Challan, Order, Vehicle } from '@/lib/types';

const GRADES = ['M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50'];

export default function Dispatch() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    clientName: '', site: '', grade: 'M-25', qty: 6,
    vehicleId: '', vehicleNo: '', driver: ''
  });

  const reload = () => {
    setChallans(challanStore.getAll());
    setOrders(orderStore.getAll());
    setVehicles(vehicleStore.getActive());
  };

  useEffect(() => { reload(); }, []);

  const filtered = [...challans]
    .filter(c => {
      const q = search.toLowerCase();
      return !q || c.clientName.toLowerCase().includes(q) || c.challanNo.includes(q) || c.grade.toLowerCase().includes(q);
    })
    .sort((a, b) => b.challanNo.localeCompare(a.challanNo));

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'in-progress');

  function onOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setForm(f => ({
        ...f, clientName: order.clientName, site: order.site,
        grade: order.grade, qty: Math.min(7, order.qty - order.dispatchedQty)
      }));
    }
  }

  function onVehicleChange(vehicleId: string) {
    const v = vehicles.find(v => v.id === vehicleId);
    setForm(f => ({ ...f, vehicleId, vehicleNo: v?.vehicleNo || '', driver: v?.driver || '' }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !form.vehicleId) return;
    challanStore.add({
      orderId: selectedOrderId,
      date: form.date,
      clientName: form.clientName,
      site: form.site,
      grade: form.grade,
      qty: form.qty,
      vehicleId: form.vehicleId,
      vehicleNo: form.vehicleNo,
      driver: form.driver,
      status: 'dispatched',
    });
    setShowForm(false);
    reload();
  }

  function markDelivered(id: string) {
    challanStore.update(id, { status: 'delivered' });
    reload();
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(38,52,73,.4)', border: '1px solid #263449',
    borderRadius: 10, padding: '9px 12px', color: '#eef5ff', fontSize: 14, outline: 'none'
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#9fb0c7', marginBottom: 5, display: 'block' };

  const todayCount = challans.filter(c => c.date === new Date().toISOString().slice(0, 10)).reduce((s, c) => s + c.qty, 0);
  const dispatchedToday = challans.filter(c => c.date === new Date().toISOString().slice(0, 10)).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Dispatch / Online Challan</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>
            Order select → auto fetch client, site, grade, qty and TM driver
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          data-testid="button-generate-challan"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            borderRadius: 12, padding: '10px 18px',
            background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)',
            color: '#052e16', fontWeight: 800, fontSize: 14
          }}
        >
          <Plus size={16} /> Generate Challan
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: "Today's Challans", value: dispatchedToday },
          { label: "Today Dispatch", value: `${todayCount} m³` },
          { label: "Total Challans", value: challans.length },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card" style={{ padding: '16px 18px' }}>
            <div style={{ color: '#9fb0c7', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div className="metric-text" style={{ fontSize: '1.6rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb0c7' }} />
        <input placeholder="Search challans..." value={search} onChange={e => setSearch(e.target.value)}
          data-testid="input-search-challans"
          style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>

      {/* Challans table */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: '#9fb0c7', fontSize: 12 }}>
              {['Date', 'Challan', 'Client', 'Site', 'Grade', 'Qty', 'TM Vehicle', 'Driver', 'Status', 'Action'].map(h => (
                <th key={h} style={{ padding: '14px 14px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #263449', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(ch => (
              <tr key={ch.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }} data-testid={`challan-row-${ch.id}`}>
                <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12, whiteSpace: 'nowrap' }}>{ch.date}</td>
                <td style={{ padding: '11px 14px', color: '#f7c948', fontWeight: 700 }}>#{ch.challanNo}</td>
                <td style={{ padding: '11px 14px', fontWeight: 600 }}>{ch.clientName}</td>
                <td style={{ padding: '11px 14px', color: '#9fb0c7', fontSize: 12 }}>{ch.site}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(56,189,248,.12)', color: '#38bdf8' }}>{ch.grade}</span>
                </td>
                <td style={{ padding: '11px 14px', fontWeight: 700 }}>{ch.qty} m³</td>
                <td style={{ padding: '11px 14px', fontSize: 12 }}>{ch.vehicleNo}</td>
                <td style={{ padding: '11px 14px', fontSize: 12, color: '#9fb0c7' }}>{ch.driver}</td>
                <td style={{ padding: '11px 14px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    color: ch.status === 'delivered' ? '#22c55e' : '#38bdf8',
                    background: ch.status === 'delivered' ? 'rgba(34,197,94,.12)' : 'rgba(56,189,248,.12)'
                  }}>{ch.status}</span>
                </td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ch.status === 'dispatched' && (
                      <button
                        onClick={() => markDelivered(ch.id)}
                        title="Mark Delivered"
                        data-testid={`button-delivered-${ch.id}`}
                        style={{ background: 'rgba(34,197,94,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#22c55e', cursor: 'pointer' }}
                      ><Check size={13} /></button>
                    )}
                    <button
                      onClick={() => window.print()}
                      title="Print"
                      data-testid={`button-print-${ch.id}`}
                      style={{ background: 'rgba(159,176,199,.1)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#9fb0c7', cursor: 'pointer' }}
                    ><Printer size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#9fb0c7' }}>No challans found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Generate Challan Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Generate Challan</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: '#9fb0c7', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Fetch From Order *</label>
                <select value={selectedOrderId} onChange={e => onOrderChange(e.target.value)} required style={inputStyle} data-testid="select-order">
                  <option value="">Select order...</option>
                  {activeOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.clientName} | {o.site} | {o.grade} | {o.qty - o.dispatchedQty} m³ remaining
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} data-testid="input-challan-date" />
                </div>
                <div>
                  <label style={labelStyle}>Grade</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} data-testid="select-challan-grade">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Client Name</label>
                  <input value={form.clientName} readOnly style={{ ...inputStyle, opacity: .7 }} />
                </div>
                <div>
                  <label style={labelStyle}>Site</label>
                  <input value={form.site} readOnly style={{ ...inputStyle, opacity: .7 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Qty m³ *</label>
                  <input type="number" min={1} max={7} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} required style={inputStyle} data-testid="input-challan-qty" />
                </div>
                <div>
                  <label style={labelStyle}>TM Vehicle *</label>
                  <select value={form.vehicleId} onChange={e => onVehicleChange(e.target.value)} required style={inputStyle} data-testid="select-vehicle">
                    <option value="">Select vehicle...</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Driver</label>
                <input value={form.driver} readOnly style={{ ...inputStyle, opacity: .7 }} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '10px 18px', borderRadius: 10, background: '#1a2940',
                  color: '#eef5ff', border: '1px solid #263449', fontWeight: 600, fontSize: 14
                }}>Cancel</button>
                <button type="submit" data-testid="button-save-challan" style={{
                  padding: '10px 22px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#86efac,#22c55e 48%,#15803d)',
                  color: '#052e16', fontWeight: 800, fontSize: 14
                }}>Generate Challan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
