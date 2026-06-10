import { useState, useEffect } from 'react';
import { Plus, X, Search, Trash2 } from 'lucide-react';
import { batchStore, orderStore } from '@/lib/store';
import type { BatchRecord, Order } from '@/lib/types';

const GRADES = ['M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50'];

export default function BatchReport() {
  const [records, setRecords] = useState<BatchRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    batchNo: '', grade: 'M-25', qty: 6,
    orderId: '', clientName: '', operatorName: '', notes: ''
  });

  const reload = () => { setRecords(batchStore.getAll()); setOrders(orderStore.getAll()); };
  useEffect(() => { reload(); }, []);

  const filtered = [...records]
    .filter(r => {
      const q = search.toLowerCase();
      const matchQ = !q || r.batchNo.toLowerCase().includes(q) || r.grade.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q);
      const matchDate = !dateFilter || r.date === dateFilter;
      return matchQ && matchDate;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.batchNo.localeCompare(a.batchNo));

  const todayQty = records.filter(r => r.date === new Date().toISOString().slice(0, 10)).reduce((s, r) => s + r.qty, 0);
  const totalQty = records.reduce((s, r) => s + r.qty, 0);
  const todayBatches = records.filter(r => r.date === new Date().toISOString().slice(0, 10)).length;

  function onOrderChange(orderId: string) {
    const o = orders.find(o => o.id === orderId);
    setForm(f => ({ ...f, orderId, clientName: o?.clientName || '', grade: o?.grade || f.grade }));
  }

  function autoNextBatch() {
    const nums = records.map(r => parseInt(r.batchNo.replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `B-${String(next).padStart(3, '0')}`;
  }

  function openAdd() {
    setForm(f => ({ ...f, batchNo: autoNextBatch(), date: new Date().toISOString().slice(0, 10) }));
    setShowForm(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    batchStore.add({ ...form });
    setShowForm(false); reload();
  }

  function doDelete() { if (deleteId) { batchStore.remove(deleteId); reload(); setDeleteId(null); } }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(38,52,73,.4)', border: '1px solid #263449',
    borderRadius: 10, padding: '9px 12px', color: '#eef5ff', fontSize: 14, outline: 'none'
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#9fb0c7', marginBottom: 5, display: 'block' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Batch Report</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>Plant batching records and production log</p>
        </div>
        <button onClick={openAdd} data-testid="button-add-batch" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          borderRadius: 12, padding: '10px 18px',
          background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
          color: '#111827', fontWeight: 800, fontSize: 14
        }}>
          <Plus size={16} /> Add Batch
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: "Today's Batches", value: todayBatches },
          { label: "Today Production", value: `${todayQty} m³` },
          { label: "Total Production", value: `${totalQty.toLocaleString()} m³` },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card" style={{ padding: '16px 18px' }}>
            <div style={{ color: '#9fb0c7', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div className="metric-text" style={{ fontSize: '1.6rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb0c7' }} />
          <input placeholder="Search batch, grade, client..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-batch"
            style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} data-testid="input-date-filter"
          style={{ ...inputStyle, width: 'auto' }} />
        {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '9px 14px', borderRadius: 10, background: '#1a2940', color: '#9fb0c7', border: '1px solid #263449', fontSize: 13 }}>Clear</button>}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ color: '#9fb0c7', fontSize: 12 }}>
              {['Date', 'Batch No', 'Grade', 'Qty', 'Client', 'Operator', 'Notes', 'Action'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #263449' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(38,52,73,.5)' }} data-testid={`batch-row-${r.id}`}>
                <td style={{ padding: '12px 16px', color: '#9fb0c7', fontSize: 12 }}>{r.date}</td>
                <td style={{ padding: '12px 16px', color: '#f7c948', fontWeight: 700 }}>{r.batchNo}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'rgba(56,189,248,.12)', color: '#38bdf8' }}>{r.grade}</span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.qty} m³</td>
                <td style={{ padding: '12px 16px' }}>{r.clientName}</td>
                <td style={{ padding: '12px 16px', color: '#9fb0c7', fontSize: 13 }}>{r.operatorName}</td>
                <td style={{ padding: '12px 16px', color: '#9fb0c7', fontSize: 12 }}>{r.notes || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => setDeleteId(r.id)} data-testid={`button-delete-batch-${r.id}`} style={{ background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9fb0c7' }}>No batch records found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Batch Record</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: '#9fb0c7', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} data-testid="input-batch-date" />
                </div>
                <div>
                  <label style={labelStyle}>Batch No</label>
                  <input value={form.batchNo} onChange={e => setForm(f => ({ ...f, batchNo: e.target.value }))} required style={inputStyle} data-testid="input-batch-no" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Link to Order (optional)</label>
                <select value={form.orderId} onChange={e => onOrderChange(e.target.value)} style={inputStyle} data-testid="select-batch-order">
                  <option value="">No linked order</option>
                  {orders.filter(o => o.status !== 'cancelled').map(o => (
                    <option key={o.id} value={o.id}>{o.clientName} | {o.site} | {o.grade}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Grade *</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} data-testid="select-batch-grade">
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Qty (m³) *</label>
                  <input type="number" min={1} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} required style={inputStyle} data-testid="input-batch-qty" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Client</label>
                  <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Client name" style={inputStyle} data-testid="input-batch-client" />
                </div>
                <div>
                  <label style={labelStyle}>Operator</label>
                  <input value={form.operatorName} onChange={e => setForm(f => ({ ...f, operatorName: e.target.value }))} placeholder="Operator name" style={inputStyle} data-testid="input-batch-operator" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes (slump, temp, etc.)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Slump 120mm, Temp 28°C" style={inputStyle} data-testid="input-batch-notes" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: '#1a2940', color: '#eef5ff', border: '1px solid #263449', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button type="submit" data-testid="button-save-batch" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)', color: '#111827', fontWeight: 800, fontSize: 14 }}>Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Batch Record?</h3>
            <p style={{ color: '#9fb0c7', marginBottom: 20, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 16px', borderRadius: 10, background: '#1a2940', color: '#eef5ff', border: '1px solid #263449', fontSize: 14 }}>Cancel</button>
              <button onClick={doDelete} style={{ padding: '9px 16px', borderRadius: 10, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
