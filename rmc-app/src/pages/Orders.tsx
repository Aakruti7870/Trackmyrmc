import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Truck, Check } from 'lucide-react';
import { Link } from 'wouter';
import { api, type Order, type Client, type Site } from '@/lib/api';
import EkycBadge from '@/components/EkycBadge';

const GRADES = ['M10','M15','M20','M25','M30','M35','M40','M45','M50','M55','M60'];
const STATUSES = ['pending_approval','approved','rejected','pending','in_progress','completed','cancelled'];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<Order & { clientId: number; siteId?: number }>>({});
  const [editing, setEditing] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() { api.get<Order[]>('/orders').then(setOrders); }
  useEffect(() => {
    load();
    api.get<Client[]>('/clients').then(setClients);
  }, []);

  async function loadSites(clientId: number) {
    const s = await api.get<Site[]>(`/clients/${clientId}/sites`);
    setSites(s);
  }

  function openCreate() {
    setForm({ pumpRequired: false, status: 'pending' });
    setSites([]);
    setEditing(null); setModal('create'); setError('');
  }
  function openEdit(o: Order) {
    setForm({ ...o });
    if (o.clientId) loadSites(o.clientId);
    setEditing(o); setModal('edit'); setError('');
  }

  async function save() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') await api.post('/orders', form);
      else await api.put(`/orders/${editing!.id}`, form);
      load(); setModal(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function remove(o: Order) {
    if (!confirm(`Delete ${o.orderNo}?`)) return;
    await api.delete(`/orders/${o.id}`); load();
  }

  async function updateStatus(o: Order, status: string) {
    await api.put(`/orders/${o.id}`, { ...o, status }); load();
  }

  async function approveOrder(o: Order) {
    await api.post(`/orders/${o.id}/approve`, {}); load();
  }

  async function rejectOrder(o: Order) {
    const reason = window.prompt(`Reject order ${o.orderNo}? Optionally add a reason for the customer:`);
    if (reason === null) return;
    await api.post(`/orders/${o.id}/reject`, { reason: reason.trim() || undefined }); load();
  }

  const filtered = orders.filter(o => {
    const matchSearch = o.orderNo.toLowerCase().includes(search.toLowerCase()) ||
      (o.clientName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string) => ({ pending_approval: 'var(--gold)', approved: 'var(--green)', rejected: 'var(--red)', pending: 'var(--gold)', in_progress: 'var(--blue)', completed: 'var(--green)', cancelled: 'var(--red)' }[s] || 'var(--muted)');
  const statusBg = (s: string) => ({ pending_approval: 'color-mix(in srgb, var(--gold) 12%, transparent)', approved: 'rgba(34,197,94,.12)', rejected: 'rgba(239,68,68,.12)', pending: 'color-mix(in srgb, var(--gold) 12%, transparent)', in_progress: 'rgba(56,189,248,.12)', completed: 'rgba(34,197,94,.12)', cancelled: 'rgba(239,68,68,.12)' }[s] || 'rgba(159,176,199,.12)');
  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'var(--chip-bg)', border: '1px solid var(--line)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div className="page-hd">
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Orders</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{orders.length} total orders</p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> New Order</button>
      </div>

      <div className="filter-row">
        <div className="filter-search" style={{ maxWidth: 320 }}>
          <Search size={14} style={{ color: 'var(--muted)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…"
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 140 }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {['Order No', 'Client', 'Site', 'Grade', 'Qty (m³)', 'Pump', 'Delivery', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '11px 14px', color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>{o.orderNo}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {o.clientName}
                      {o.customerKycVerified && <EkycBadge size={16} />}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{o.siteName || '—'}</td>
                  <td style={{ padding: '11px 14px' }}><span style={{ padding: '2px 8px', background: 'rgba(56,189,248,.12)', color: 'var(--blue)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{o.grade}</span></td>
                  <td style={{ padding: '11px 14px', fontWeight: 700 }}>{o.quantity}</td>
                  <td style={{ padding: '11px 14px', color: o.pumpRequired ? 'var(--green)' : 'var(--muted)', fontSize: 12 }}>{o.pumpRequired ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 12 }}>{o.deliveryDate || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: statusColor(o.status), background: statusBg(o.status) }}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {o.status === 'pending_approval' && (
                        <>
                          <button onClick={() => approveOrder(o)} style={{ padding: '4px 10px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--green)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Check size={11} /> Approve
                          </button>
                          <button onClick={() => rejectOrder(o)} style={{ padding: '4px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--red)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <X size={11} /> Reject
                          </button>
                        </>
                      )}
                      {(o.status === 'approved' || o.status === 'pending') && (
                        <Link href="/dispatch">
                          <button style={{ padding: '4px 10px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--green)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Truck size={11} /> Dispatch
                          </button>
                        </Link>
                      )}
                      <button onClick={() => openEdit(o)} style={{ padding: '4px 8px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--blue)' }}><Edit2 size={12} /></button>
                      <button onClick={() => remove(o)} style={{ padding: '4px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{modal === 'create' ? 'New Order' : 'Edit Order'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div className="modal-grid">
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Client *</label>
                <select value={form.clientId || ''} onChange={e => { setForm(f => ({ ...f, clientId: +e.target.value, siteId: undefined })); if (e.target.value) loadSites(+e.target.value); }}
                  style={inputStyle}>
                  <option value="">Select client…</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {sites.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Delivery Site</label>
                  <select value={form.siteId || ''} onChange={e => setForm(f => ({ ...f, siteId: e.target.value ? +e.target.value : undefined }))} style={inputStyle}>
                    <option value="">No specific site</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Grade *</label>
                <select value={form.grade || ''} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle}>
                  <option value="">Select grade…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Quantity (m³) *</label>
                <input type="number" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Delivery Date</label>
                <input type="date" value={form.deliveryDate || ''} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Delivery Time</label>
                <input type="time" value={form.deliveryTime || ''} onChange={e => setForm(f => ({ ...f, deliveryTime: e.target.value }))} style={inputStyle} />
              </div>
              {modal === 'edit' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Status</label>
                  <select value={form.status || ''} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="pump" checked={!!form.pumpRequired} onChange={e => setForm(f => ({ ...f, pumpRequired: e.target.checked }))} />
                <label htmlFor="pump" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>Pump Required</label>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 10, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Create Order' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      <span style={{ display: 'none' }}>{typeof updateStatus}</span>
    </div>
  );
}
