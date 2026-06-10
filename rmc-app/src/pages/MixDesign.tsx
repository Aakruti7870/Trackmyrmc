import { useState } from 'react';
import { Plus, X, Pencil, Trash2, FlaskConical } from 'lucide-react';
import { mixDesignStore } from '@/lib/store';
import type { MixDesign } from '@/lib/types';

const GRADES = ['M-15', 'M-20', 'M-25', 'M-30', 'M-35', 'M-40', 'M-45', 'M-50', 'M-55', 'M-60'];
const empty: Omit<MixDesign, 'id' | 'createdAt'> = { grade: 'M-25', cement: 360, water: 158, sand: 760, aggregate: 1060, admixture: 1.5, wCRatio: 0.44, notes: '' };

export default function MixDesign() {
  const [mixes, setMixes] = useState<MixDesign[]>(() => mixDesignStore.getAll());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = () => setMixes(mixDesignStore.getAll());

  function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
  function openEdit(m: MixDesign) { setForm({ grade: m.grade, cement: m.cement, water: m.water, sand: m.sand, aggregate: m.aggregate, admixture: m.admixture, wCRatio: m.wCRatio, notes: m.notes }); setEditId(m.id); setShowForm(true); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const wc = Number((form.water / form.cement).toFixed(2));
    if (editId) mixDesignStore.update(editId, { ...form, wCRatio: wc });
    else mixDesignStore.add({ ...form, wCRatio: wc });
    setShowForm(false); reload();
  }

  function doDelete() { if (deleteId) { mixDesignStore.remove(deleteId); reload(); setDeleteId(null); } }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(38,52,73,.4)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none'
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, display: 'block' };

  const totalBinder = (m: MixDesign) => m.cement;
  const totalPerM3 = (m: MixDesign) => m.cement + m.water + m.sand + m.aggregate + m.admixture;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Mix Design</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 14 }}>Concrete mix proportions per grade</p>
        </div>
        <button onClick={openAdd} data-testid="button-add-mix" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          borderRadius: 12, padding: '10px 18px',
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', fontWeight: 800, fontSize: 14
        }}>
          <Plus size={16} /> Add Mix Design
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
        {mixes.map(m => (
          <div key={m.id} className="glass-card" style={{ padding: 22 }} data-testid={`mix-card-${m.id}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: 'linear-gradient(135deg,rgba(56,189,248,.2),rgba(56,189,248,.08))',
                  border: '1px solid rgba(56,189,248,.25)',
                  display: 'grid', placeItems: 'center'
                }}>
                  <FlaskConical size={20} style={{ color: 'var(--blue)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-1px' }}>{m.grade}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>W/C: {m.wCRatio}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(m)} data-testid={`button-edit-mix-${m.id}`} style={{ background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: 'var(--blue)', cursor: 'pointer' }}><Pencil size={13} /></button>
                <button onClick={() => setDeleteId(m.id)} data-testid={`button-delete-mix-${m.id}`} style={{ background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={13} /></button>
              </div>
            </div>

            {/* Visual bar chart */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Cement', value: m.cement, color: 'var(--gold)', max: 600 },
                { label: 'Water', value: m.water, color: 'var(--blue)', max: 250 },
                { label: 'Sand', value: m.sand, color: 'var(--muted)', max: 1000 },
                { label: 'Aggregate', value: m.aggregate, color: 'var(--green)', max: 1300 },
                { label: 'Admixture', value: m.admixture, color: 'var(--red)', max: 5 },
              ].map(({ label, value, color, max }) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontWeight: 700, color }}>{value} {label === 'Admixture' ? '%' : 'kg'}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, (value / max) * 100)}%`,
                      background: color, borderRadius: 999,
                      transition: 'width .4s ease'
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <span>Total binder: <strong style={{ color: 'var(--text)' }}>{totalBinder(m)} kg</strong></span>
              <span>Per m³: <strong style={{ color: 'var(--text)' }}>{totalPerM3(m).toFixed(0)} kg</strong></span>
            </div>
            {m.notes && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{m.notes}</div>}
          </div>
        ))}
        {mixes.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--muted)' }}>No mix designs yet</div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editId ? 'Edit Mix Design' : 'Add Mix Design'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Grade *</label>
                <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} data-testid="select-mix-grade">
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Cement (kg/m³) *</label>
                  <input type="number" min={200} max={700} value={form.cement} onChange={e => setForm(f => ({ ...f, cement: Number(e.target.value) }))} required style={inputStyle} data-testid="input-cement" />
                </div>
                <div>
                  <label style={labelStyle}>Water (kg/m³) *</label>
                  <input type="number" min={100} max={250} value={form.water} onChange={e => setForm(f => ({ ...f, water: Number(e.target.value) }))} required style={inputStyle} data-testid="input-water" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Sand (kg/m³) *</label>
                  <input type="number" min={400} max={1000} value={form.sand} onChange={e => setForm(f => ({ ...f, sand: Number(e.target.value) }))} required style={inputStyle} data-testid="input-sand" />
                </div>
                <div>
                  <label style={labelStyle}>Aggregate (kg/m³) *</label>
                  <input type="number" min={600} max={1400} value={form.aggregate} onChange={e => setForm(f => ({ ...f, aggregate: Number(e.target.value) }))} required style={inputStyle} data-testid="input-aggregate" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Admixture (% of cement)</label>
                <input type="number" step={0.1} min={0} max={5} value={form.admixture} onChange={e => setForm(f => ({ ...f, admixture: Number(e.target.value) }))} style={inputStyle} data-testid="input-admixture" />
              </div>
              <div style={{ background: 'rgba(38,52,73,.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Calculated W/C Ratio: </span>
                <strong style={{ color: 'var(--gold)' }}>{(form.water / form.cement).toFixed(2)}</strong>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Mix design notes..." style={{ ...inputStyle, resize: 'vertical' }} data-testid="textarea-mix-notes" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button type="submit" data-testid="button-save-mix" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, fontSize: 14 }}>{editId ? 'Update' : 'Save Design'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Mix Design?</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 14 }}>Cancel</button>
              <button onClick={doDelete} style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
