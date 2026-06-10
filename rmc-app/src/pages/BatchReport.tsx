import { useState, useEffect } from 'react';
import { Plus, X, Search, Trash2, Activity } from 'lucide-react';
import { api, type BatchRecord } from '@/lib/api';

const GRADES = ['M10','M15','M20','M25','M30','M35','M40','M45','M50','M55','M60'];

export default function BatchReport() {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<BatchRecord>>({});
  const [editing, setEditing] = useState<BatchRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ totalBatches: 0, totalQty: 0, totalCement: 0, totalWater: 0 });

  function load() {
    api.get<BatchRecord[]>('/batches').then(setBatches);
    api.get<typeof summary>('/batches/summary').then(setSummary);
  }
  useEffect(load, []);

  function openCreate() { setForm({}); setEditing(null); setModal(true); setError(''); }
  function openEdit(b: BatchRecord) { setForm({ ...b }); setEditing(b); setModal(true); setError(''); }

  async function save() {
    setSaving(true); setError('');
    try {
      if (!editing) await api.post('/batches', form);
      else await api.put(`/batches/${editing.id}`, form);
      load(); setModal(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function remove(b: BatchRecord) {
    if (!confirm(`Delete batch ${b.batchNo}?`)) return;
    await api.delete(`/batches/${b.id}`); load();
  }

  const filtered = batches.filter(b => {
    const matchSearch = b.batchNo.toLowerCase().includes(search.toLowerCase()) || (b.operator || '').toLowerCase().includes(search.toLowerCase());
    const matchGrade = !filterGrade || b.grade === filterGrade;
    return matchSearch && matchGrade;
  });

  const gradeBreakdown = batches.reduce((acc, b) => {
    acc[b.grade] = (acc[b.grade] || 0) + Number(b.quantity);
    return acc;
  }, {} as Record<string, number>);
  const totalQtyAll = Object.values(gradeBreakdown).reduce((a, b) => a + b, 0);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Production</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{batches.length} batch records total</p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> Log Batch</button>
      </div>

      {/* Today's summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {[
          { label: "Today's Batches", value: summary.totalBatches, unit: '', color: 'var(--blue)' },
          { label: "Today's Production", value: Number(summary.totalQty || 0).toFixed(1), unit: 'm³', color: 'var(--green)' },
          { label: 'Cement Used', value: summary.totalCement, unit: 'bags', color: 'var(--gold)' },
          { label: 'Water Used', value: summary.totalWater, unit: 'L', color: '#a78bfa' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="glass-card" style={{ padding: '16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Activity size={13} style={{ color: color }} />
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{value} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>{unit}</span></div>
          </div>
        ))}
      </div>

      {/* Grade breakdown bars */}
      {totalQtyAll > 0 && (
        <div className="glass-card" style={{ padding: '16px 18px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Grade Mix Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(gradeBreakdown).sort((a, b) => b[1] - a[1]).map(([grade, qty]) => (
              <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>{grade}</span>
                <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 999, overflow: 'hidden', height: 8 }}>
                  <div style={{ width: `${(qty / totalQtyAll) * 100}%`, height: '100%', background: 'linear-gradient(90deg,var(--blue),#0ea5e9)', borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 60 }}>{qty.toFixed(1)} m³</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ color: 'var(--muted)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batches…"
            style={{ ...inputStyle, paddingLeft: 36 }} />
        </div>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 120 }}>
          <option value="">All Grades</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {['Batch No', 'Grade', 'Qty (m³)', 'Cement (bags)', 'Water (L)', 'Sand (kg)', 'Aggregate (kg)', 'Operator', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(38,52,73,.4)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--gold)', fontWeight: 700, fontFamily: 'monospace' }}>{b.batchNo}</td>
                  <td style={{ padding: '10px 12px' }}><span style={{ padding: '2px 8px', background: 'rgba(56,189,248,.12)', color: 'var(--blue)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{b.grade}</span></td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{b.quantity}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{b.cementBags ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{b.waterLiters ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{b.sandKg ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)' }}>{b.aggregateKg ?? '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12 }}>{b.operator || '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 11 }}>{new Date(b.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => openEdit(b)} style={{ padding: '4px 8px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--blue)', fontSize: 11 }}>Edit</button>
                      <button onClick={() => remove(b)} style={{ padding: '4px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>No batch records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{editing ? 'Edit Batch' : 'Log New Batch'}</h3>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Grade *</label>
                <select value={form.grade || ''} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle}>
                  <option value="">Select…</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Quantity (m³) *</label>
                <input type="number" value={form.quantity || ''} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} />
              </div>
              {[
                ['cementBags', 'Cement Bags'],
                ['waterLiters', 'Water (Liters)'],
                ['sandKg', 'Sand (kg)'],
                ['aggregateKg', 'Aggregate (kg)'],
                ['operator', 'Plant Operator'],
              ].map(([k, l]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{l}</label>
                  <input type={k === 'operator' ? 'text' : 'number'}
                    value={(form as Record<string, string | number | undefined>)[k] || ''}
                    onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={inputStyle} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>Remarks</label>
                <textarea value={form.remarks || ''} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Saving…' : editing ? 'Update Batch' : 'Log Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
