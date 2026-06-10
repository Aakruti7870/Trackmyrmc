import { useState, useEffect } from 'react';
import { Plus, X, Search, Pencil, Trash2, Truck } from 'lucide-react';
import { orderStore, clientStore } from '@/lib/store';
import type { Order, Client, OrderStatus } from '@/lib/types';
import { Link } from 'wouter';

const GRADES = ['M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50'];

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: '#f7c948',
  'in-progress': '#38bdf8',
  completed: '#22c55e',
  cancelled: '#ef4444',
};
const STATUS_BG: Record<OrderStatus, string> = {
  pending: 'rgba(247,201,72,.12)',
  'in-progress': 'rgba(56,189,248,.12)',
  completed: 'rgba(34,197,94,.12)',
  cancelled: 'rgba(239,68,68,.12)',
};
const statusColor = (s: OrderStatus) => STATUS_COLOR[s];
const statusBg = (s: OrderStatus) => STATUS_BG[s];

const emptyForm = { clientId: '', site: '', grade: 'M-25', qty: 10, date: new Date().toISOString().slice(0, 10), status: 'pending' as OrderStatus, notes: '' };

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = () => {
    setOrders(orderStore.getAll());
    setClients(clientStore.getAll());
  };

  useEffect(() => { reload(); }, []);

  const filtered = orders.filter(o => {
    const matchSearch = o.clientName.toLowerCase().includes(search.toLowerCase()) ||
      o.site.toLowerCase().includes(search.toLowerCase()) ||
      o.grade.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function openAdd() {
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setEditId(null);
    setShowForm(true);
  }

  function openEdit(o: Order) {
    setForm({ clientId: o.clientId, site: o.site, grade: o.grade, qty: o.qty, date: o.date, status: o.status, notes: o.notes });
    setEditId(o.id);
    setShowForm(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientId) return;
    const client = clients.find(c => c.id === form.clientId);
    if (!client) return;
    if (editId) {
      orderStore.update(editId, { ...form, clientName: client.name });
    } else {
      orderStore.add({ ...form, clientName: client.name });
    }
    setShowForm(false);
    reload();
  }

  function confirmDelete(id: string) { setDeleteId(id); }
  function doDelete() {
    if (deleteId) { orderStore.remove(deleteId); reload(); setDeleteId(null); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(38,52,73,.4)', border: '1px solid #263449',
    borderRadius: 10, padding: '9px 12px', color: '#eef5ff', fontSize: 14, outline: 'none'
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#9fb0c7', marginBottom: 5, display: 'block' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Orders</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>Manage all RMC orders</p>
        </div>
        <button
          onClick={openAdd}
          data-testid="button-add-order"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            borderRadius: 12, padding: '10px 18px',
            background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
            color: '#111827', fontWeight: 800, fontSize: 14,
            boxShadow: '0 12px 30px rgba(255,183,3,.18)'
          }}
        >
          <Plus size={16} /> New Order
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb0c7' }} />
          <input
            placeholder="Search client, site, grade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-orders"
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          data-testid="select-filter-status"
          style={{ ...inputStyle, width: 'auto', minWidth: 130 }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: '#9fb0c7', fontSize: 12 }}>
              {['Date', 'Client', 'Site', 'Grade', 'Qty', 'Dispatched', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #263449' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }} data-testid={`order-row-${o.id}`}>
                <td style={{ padding: '12px 16px', color: '#9fb0c7', fontSize: 12 }}>{o.date}</td>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{o.clientName}</td>
                <td style={{ padding: '12px 16px', color: '#9fb0c7' }}>{o.site}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: 'rgba(56,189,248,.12)', color: '#38bdf8'
                  }}>{o.grade}</span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{o.qty} m³</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ height: 4, width: 60, background: '#263449', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, (o.dispatchedQty / o.qty) * 100)}%`,
                        background: 'linear-gradient(90deg,#22c55e,#86efac)', borderRadius: 999
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#9fb0c7' }}>{o.dispatchedQty}/{o.qty}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    color: statusColor(o.status), background: statusBg(o.status)
                  }}>{o.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link href="/dispatch">
                      <button title="Dispatch" data-testid={`button-dispatch-${o.id}`} style={{
                        background: 'rgba(34,197,94,.12)', border: 'none', borderRadius: 8, padding: '6px 8px',
                        color: '#22c55e', cursor: 'pointer'
                      }}><Truck size={13} /></button>
                    </Link>
                    <button onClick={() => openEdit(o)} title="Edit" data-testid={`button-edit-order-${o.id}`} style={{
                      background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '6px 8px',
                      color: '#38bdf8', cursor: 'pointer'
                    }}><Pencil size={13} /></button>
                    <button onClick={() => confirmDelete(o.id)} title="Delete" data-testid={`button-delete-order-${o.id}`} style={{
                      background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px',
                      color: '#ef4444', cursor: 'pointer'
                    }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#9fb0c7' }}>No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editId ? 'Edit Order' : 'New Order'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: '#9fb0c7', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Client *</label>
                <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} required style={inputStyle} data-testid="select-client">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Site / Location *</label>
                <input value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} required placeholder="e.g. Panvel Tower Site" style={inputStyle} data-testid="input-site" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Grade *</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} data-testid="select-grade">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Qty (m³) *</label>
                  <input type="number" min={1} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} required style={inputStyle} data-testid="input-qty" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} data-testid="input-date" />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as OrderStatus }))} style={inputStyle} data-testid="select-status">
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes..." style={{ ...inputStyle, resize: 'vertical' }} data-testid="textarea-notes" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '10px 18px', borderRadius: 10, background: '#1a2940',
                  color: '#eef5ff', border: '1px solid #263449', fontWeight: 600, fontSize: 14
                }}>Cancel</button>
                <button type="submit" data-testid="button-save-order" style={{
                  padding: '10px 22px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
                  color: '#111827', fontWeight: 800, fontSize: 14
                }}>{editId ? 'Update' : 'Save Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Order?</h3>
            <p style={{ color: '#9fb0c7', marginBottom: 20, fontSize: 14 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{
                padding: '9px 16px', borderRadius: 10, background: '#1a2940',
                color: '#eef5ff', border: '1px solid #263449', fontSize: 14
              }}>Cancel</button>
              <button onClick={doDelete} data-testid="button-confirm-delete" style={{
                padding: '9px 16px', borderRadius: 10, background: '#ef4444',
                color: '#fff', fontWeight: 700, fontSize: 14
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
