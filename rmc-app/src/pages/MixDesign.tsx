import { useState, useEffect } from 'react';
import { Plus, X, Pencil, Trash2, FlaskConical, AlertTriangle } from 'lucide-react';
import {
  mixDesignApi, MIX_GRADES, DEFAULT_MATERIALS,
  type MixDesignRow, type RecipeMaterial,
} from '@/lib/batchSheets';
import { ApiError } from '@/lib/api';

interface MaterialDraft { label: string; perCumKg: string; tolerancePct: string; key?: string }

const emptyForm = () => ({
  grade: 'M25',
  recipeName: '',
  recipeCode: '',
  notes: '',
  materials: DEFAULT_MATERIALS.map(m => ({
    key: m.key, label: m.label, perCumKg: String(m.perCumKg), tolerancePct: String(m.tolerancePct),
  })) as MaterialDraft[],
});

const MATERIAL_COLORS = ['var(--muted)', 'var(--green)', 'var(--green)', 'var(--gold)', 'var(--gold)', 'var(--blue)', 'var(--red)'];

export default function MixDesign() {
  const [mixes, setMixes] = useState<MixDesignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function reload() {
    return mixDesignApi.list()
      .then(rows => { setMixes(rows); setLoadError(null); })
      .catch((e: Error) => setLoadError(e.message || 'Failed to load mix designs'));
  }

  useEffect(() => {
    let cancelled = false;
    mixDesignApi.list()
      .then(rows => { if (!cancelled) { setMixes(rows); setLoadError(null); } })
      .catch((e: Error) => { if (!cancelled) setLoadError(e.message || 'Failed to load mix designs'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openAdd() {
    setForm(emptyForm());
    setEditId(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(m: MixDesignRow) {
    setForm({
      grade: m.grade,
      recipeName: m.recipeName,
      recipeCode: m.recipeCode || '',
      notes: m.notes || '',
      materials: m.materials.map(mat => ({
        key: mat.key, label: mat.label, perCumKg: String(mat.perCumKg), tolerancePct: String(mat.tolerancePct),
      })),
    });
    setEditId(m.id);
    setFormError(null);
    setShowForm(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const materials = form.materials
      .filter(m => m.label.trim())
      .map(m => ({ key: m.key, label: m.label.trim(), perCumKg: Number(m.perCumKg), tolerancePct: Number(m.tolerancePct) }));
    if (materials.length === 0) { setFormError('Add at least one material.'); return; }
    if (materials.some(m => !Number.isFinite(m.perCumKg) || m.perCumKg <= 0)) { setFormError('Every material needs a positive kg/m³ weight.'); return; }
    if (materials.some(m => !Number.isFinite(m.tolerancePct) || m.tolerancePct < 0 || m.tolerancePct > 20)) { setFormError('Tolerance must be between 0 and 20%.'); return; }
    const body = {
      grade: form.grade,
      recipeName: form.recipeName.trim() || `${form.grade} Design Mix`,
      recipeCode: form.recipeCode.trim() || null,
      notes: form.notes.trim() || null,
      materials,
    };
    setSaving(true);
    (editId ? mixDesignApi.update(editId, body) : mixDesignApi.create(body))
      .then(() => reload())
      .then(() => setShowForm(false))
      .catch((err: Error) => {
        setFormError(err instanceof ApiError && err.status === 409
          ? `A mix design for ${form.grade} already exists. Edit that one instead.`
          : err.message || 'Failed to save');
      })
      .finally(() => setSaving(false));
  }

  function doDelete() {
    if (deleteId == null) return;
    mixDesignApi.remove(deleteId)
      .then(() => reload())
      .catch((e: Error) => setLoadError(e.message || 'Failed to delete'))
      .finally(() => setDeleteId(null));
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--chip-bg)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, display: 'block' };

  const wcRatio = (mats: RecipeMaterial[]): string | null => {
    const water = mats.find(m => /water/i.test(m.label))?.perCumKg;
    const cement = mats.find(m => /cement/i.test(m.label))?.perCumKg;
    const flyash = mats.find(m => /fly\s*ash|flyash/i.test(m.label))?.perCumKg ?? 0;
    if (!water || !cement) return null;
    return (water / (cement + flyash)).toFixed(2);
  };
  const totalPerM3 = (mats: RecipeMaterial[]) => mats.reduce((s, m) => s + m.perCumKg, 0);

  return (
    <div>
      <div className="page-hd" style={{ alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Mix Design</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Grade-wise recipes with per-m³ material weights — used by the Batch Sheet generator
          </p>
        </div>
        <button onClick={openAdd} data-testid="button-add-mix" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          borderRadius: 12, padding: '10px 18px',
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', fontWeight: 800, fontSize: 14,
        }}>
          <Plus size={16} /> Add Mix Design
        </button>
      </div>

      {loadError && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', marginBottom: 16, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>
          <AlertTriangle size={15} /> {loadError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(340px, 100%), 1fr))', gap: 16 }}>
        {mixes.map(m => {
          const wc = wcRatio(m.materials);
          const maxKg = Math.max(...m.materials.map(x => x.perCumKg), 1);
          return (
            <div key={m.id} className="glass-card" style={{ padding: 22 }} data-testid={`mix-card-${m.id}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'linear-gradient(135deg,rgba(56,189,248,.2),rgba(56,189,248,.08))',
                    border: '1px solid rgba(56,189,248,.25)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <FlaskConical size={20} style={{ color: 'var(--blue)' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-1px' }}>{m.grade}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {m.recipeName}{m.recipeCode ? ` · ${m.recipeCode}` : ''}{wc ? ` · W/C ${wc}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(m)} data-testid={`button-edit-mix-${m.id}`} style={{ background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: 'var(--blue)', cursor: 'pointer' }}><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(m.id)} data-testid={`button-delete-mix-${m.id}`} style={{ background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
                {m.materials.map((mat, i) => (
                  <div key={mat.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{mat.label}</span>
                      <span style={{ fontWeight: 700, color: MATERIAL_COLORS[i % MATERIAL_COLORS.length] }}>
                        {mat.perCumKg} kg <span style={{ color: 'var(--muted)', fontWeight: 500 }}>±{mat.tolerancePct}%</span>
                      </span>
                    </div>
                    <div style={{ height: 5, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, (mat.perCumKg / maxKg) * 100)}%`,
                        background: MATERIAL_COLORS[i % MATERIAL_COLORS.length], borderRadius: 999,
                        transition: 'width .4s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                <span>{m.materials.length} materials</span>
                <span>Per m³: <strong style={{ color: 'var(--text)' }}>{totalPerM3(m.materials).toFixed(0)} kg</strong></span>
              </div>
              {m.notes && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{m.notes}</div>}
            </div>
          );
        })}
        {!loading && mixes.length === 0 && !loadError && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
            No mix designs yet — add one per grade to power the Batch Sheet generator.
          </div>
        )}
        {loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: 16 }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editId ? 'Edit Mix Design' : 'Add Mix Design'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div className="modal-grid">
                <div>
                  <label style={labelStyle}>Grade *</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))} style={inputStyle} data-testid="select-mix-grade" disabled={!!editId}>
                    {MIX_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Recipe Code</label>
                  <input value={form.recipeCode} onChange={e => setForm(f => ({ ...f, recipeCode: e.target.value }))} placeholder="e.g. 45" style={inputStyle} data-testid="input-recipe-code" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Recipe Name</label>
                <input value={form.recipeName} onChange={e => setForm(f => ({ ...f, recipeName: e.target.value }))} placeholder={`${form.grade} Design Mix`} style={inputStyle} data-testid="input-recipe-name" />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Materials (kg per m³) *</label>
                  <button type="button" data-testid="button-add-material" onClick={() => setForm(f => ({ ...f, materials: [...f.materials, { label: '', perCumKg: '', tolerancePct: '2' }] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '5px 10px', color: 'var(--blue)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    <Plus size={12} /> Material
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 30px', gap: 8, fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', padding: '0 2px' }}>
                    <span>Material</span><span>kg / m³</span><span>Tol ±%</span><span />
                  </div>
                  {form.materials.map((mat, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 30px', gap: 8, alignItems: 'center' }}>
                      <input value={mat.label} onChange={e => setForm(f => { const ms = [...f.materials]; ms[i] = { ...ms[i], label: e.target.value }; return { ...f, materials: ms }; })}
                        placeholder="Material name" style={inputStyle} data-testid={`input-material-label-${i}`} />
                      <input type="number" step="any" min={0} value={mat.perCumKg} onChange={e => setForm(f => { const ms = [...f.materials]; ms[i] = { ...ms[i], perCumKg: e.target.value }; return { ...f, materials: ms }; })}
                        placeholder="0" style={inputStyle} data-testid={`input-material-kg-${i}`} />
                      <input type="number" step="0.1" min={0} max={20} value={mat.tolerancePct} onChange={e => setForm(f => { const ms = [...f.materials]; ms[i] = { ...ms[i], tolerancePct: e.target.value }; return { ...f, materials: ms }; })}
                        style={inputStyle} data-testid={`input-material-tol-${i}`} />
                      <button type="button" onClick={() => setForm(f => ({ ...f, materials: f.materials.filter((_, j) => j !== i) }))}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 4 }} aria-label={`Remove ${mat.label || 'material'}`}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: 'var(--chip-bg)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>Total per m³: </span>
                <strong style={{ color: 'var(--gold)' }}>
                  {form.materials.reduce((s, m) => s + (Number(m.perCumKg) || 0), 0).toFixed(0)} kg
                </strong>
                {(() => {
                  const wc = wcRatio(form.materials.map(m => ({ key: m.key || '', label: m.label, perCumKg: Number(m.perCumKg) || 0, tolerancePct: 0 })));
                  return wc ? <span style={{ color: 'var(--muted)' }}> · W/C ratio: <strong style={{ color: 'var(--text)' }}>{wc}</strong></span> : null;
                })()}
              </div>

              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Mix design notes..." style={{ ...inputStyle, resize: 'vertical' }} data-testid="textarea-mix-notes" />
              </div>

              {formError && (
                <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }} data-testid="text-mix-form-error">
                  {formError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button type="submit" disabled={saving} data-testid="button-save-mix" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : editId ? 'Update' : 'Save Design'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId != null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Mix Design?</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>Existing batch sheets keep their own snapshot; only the master recipe is removed.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 14 }}>Cancel</button>
              <button onClick={doDelete} data-testid="button-confirm-delete-mix" style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
