import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, X, Fuel, Image as ImageIcon, Upload } from 'lucide-react';
import { api, type FuelLog as FuelLogEntry, type Vehicle } from '@/lib/api';

// Uploads a single fuel-bill/odometer photo straight to object storage via a
// presigned URL and returns the resulting /objects/... entity path.
async function uploadBillPhoto(file: File): Promise<string> {
  const { uploadURL, objectPath } = await api.post<{ uploadURL: string; objectPath: string }>(
    '/fuel/bill-upload-url',
    { contentType: file.type },
  );
  const res = await fetch(uploadURL, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) throw new Error('Could not upload the bill photo. Please try again.');
  return objectPath;
}

function toLocalInput(value?: string | null): string {
  const d = value ? new Date(value) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

type FormState = {
  vehicleId?: number;
  litres: string;
  amount: string;
  odometer: string;
  filledAt: string;
  notes: string;
  billPhoto?: string | null;
};

const emptyForm: FormState = { litres: '', amount: '', odometer: '', filledAt: toLocalInput(), notes: '', billPhoto: null };

export default function FuelLog() {
  const [logs, setLogs] = useState<FuelLogEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleFilter, setVehicleFilter] = useState<string>('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<FuelLogEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = vehicleFilter ? `?vehicleId=${vehicleFilter}` : '';
    api.get<FuelLogEntry[]>(`/fuel${qs}`).then(setLogs);
  }, [vehicleFilter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get<Vehicle[]>('/vehicles').then(setVehicles); }, []);

  function openCreate() {
    setForm({ ...emptyForm, filledAt: toLocalInput(), vehicleId: vehicles[0]?.id });
    setEditing(null); setModal('create'); setError('');
  }
  function openEdit(l: FuelLogEntry) {
    setForm({
      vehicleId: l.vehicleId,
      litres: l.litres ?? '',
      amount: l.amount ?? '',
      odometer: l.odometer != null ? String(l.odometer) : '',
      filledAt: toLocalInput(l.filledAt),
      notes: l.notes ?? '',
      billPhoto: l.hasBillPhoto ? 'keep' : null,
    });
    setEditing(l); setModal('edit'); setError('');
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true); setError('');
    try {
      const path = await uploadBillPhoto(file);
      setForm(f => ({ ...f, billPhoto: path }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    if (!form.vehicleId) { setError('Please choose a vehicle'); return; }
    if (!form.litres.trim()) { setError('Litres is required'); return; }
    setSaving(true); setError('');
    const payload: Record<string, unknown> = {
      vehicleId: form.vehicleId,
      litres: form.litres.trim(),
      amount: form.amount.trim() === '' ? null : form.amount.trim(),
      odometer: form.odometer.trim() === '' ? null : form.odometer.trim(),
      filledAt: new Date(form.filledAt).toISOString(),
      notes: form.notes.trim() === '' ? null : form.notes.trim(),
    };
    // Only send billPhoto when it actually changes: a fresh path uploads it; null
    // clears it; the "keep" sentinel on edit leaves the existing photo untouched.
    if (form.billPhoto !== 'keep') payload.billPhoto = form.billPhoto ?? null;
    try {
      if (modal === 'create') await api.post('/fuel', payload);
      else await api.put(`/fuel/${editing!.id}`, payload);
      load(); setModal(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save the fuel log');
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: FuelLogEntry) {
    if (!confirm(`Delete this fuel entry for ${l.vehicleNo || 'vehicle'}?`)) return;
    await api.delete(`/fuel/${l.id}`); load();
  }

  async function showPhoto(l: FuelLogEntry) {
    try {
      const detail = await api.get<FuelLogEntry>(`/fuel/${l.id}`);
      if (detail.billPhotoUrl) setViewPhoto(detail.billPhotoUrl);
    } catch { /* ignore */ }
  }

  const totalLitres = logs.reduce((s, l) => s + (parseFloat(l.litres) || 0), 0);
  const totalAmount = logs.reduce((s, l) => s + (l.amount ? parseFloat(l.amount) || 0 : 0), 0);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase',
    letterSpacing: '.4px', marginBottom: 4,
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            <Fuel size={22} color="var(--gold)" /> Fuel Log
          </h1>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Diesel fills per vehicle — used for cost control & reconciliation
          </div>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9,
            background: 'linear-gradient(135deg,var(--gold),var(--gold-dark))', border: 'none',
            color: '#1a1407', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Add Fuel Entry
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 180 }}>
          <option value="">All vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, fontSize: 12, color: 'var(--muted)' }}>
          <span>Total: <strong style={{ color: 'var(--text)' }}>{totalLitres.toFixed(1)} L</strong></span>
          {totalAmount > 0 && <span>Spend: <strong style={{ color: 'var(--gold)' }}>₹{totalAmount.toLocaleString('en-IN')}</strong></span>}
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,.03)', textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px' }}>
              <th style={{ padding: '11px 14px' }}>Date</th>
              <th style={{ padding: '11px 14px' }}>Vehicle</th>
              <th style={{ padding: '11px 14px', textAlign: 'right' }}>Litres</th>
              <th style={{ padding: '11px 14px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '11px 14px', textAlign: 'right' }}>Odometer</th>
              <th style={{ padding: '11px 14px' }}>By</th>
              <th style={{ padding: '11px 14px', textAlign: 'center' }}>Bill</th>
              <th style={{ padding: '11px 14px', textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--muted)' }}>No fuel entries yet.</td></tr>
            )}
            {logs.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{new Date(l.filledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                <td style={{ padding: '11px 14px', color: 'var(--text)', fontWeight: 600 }}>{l.vehicleNo || `#${l.vehicleId}`}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>{parseFloat(l.litres).toFixed(1)}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>{l.amount ? `₹${parseFloat(l.amount).toLocaleString('en-IN')}` : '—'}</td>
                <td style={{ padding: '11px 14px', textAlign: 'right' }}>{l.odometer != null ? l.odometer.toLocaleString('en-IN') : '—'}</td>
                <td style={{ padding: '11px 14px', color: 'var(--muted)' }}>{l.recordedByName || '—'}</td>
                <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                  {l.hasBillPhoto
                    ? <button onClick={() => showPhoto(l)} title="View bill" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--blue)' }}><ImageIcon size={16} /></button>
                    : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(l)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', marginRight: 8 }}><Edit2 size={15} /></button>
                  <button onClick={() => remove(l)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div onClick={() => !saving && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--card, #0d1726)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: 22, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{modal === 'create' ? 'Add Fuel Entry' : 'Edit Fuel Entry'}</h2>
              <button onClick={() => !saving && setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Vehicle</label>
              <select value={form.vehicleId ?? ''} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value ? +e.target.value : undefined }))} style={inputStyle}>
                <option value="">Select vehicle…</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNo}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Litres</label>
                <input type="number" min="0" step="0.1" value={form.litres} onChange={e => setForm(f => ({ ...f, litres: e.target.value }))} placeholder="e.g. 80" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Amount (₹, optional)</label>
                <input type="number" min="0" step="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 7200" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Odometer (km, optional)</label>
                <input type="number" min="0" step="1" value={form.odometer} onChange={e => setForm(f => ({ ...f, odometer: e.target.value }))} placeholder="reading at fill" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Filled at</label>
                <input type="datetime-local" value={form.filledAt} onChange={e => setForm(f => ({ ...f, filledAt: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="e.g. station name, full tank" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Bill / odometer photo (optional)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', cursor: photoBusy ? 'wait' : 'pointer', fontSize: 12, color: 'var(--text)', background: 'rgba(255,255,255,.04)' }}>
                  <Upload size={14} /> {photoBusy ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/*" onChange={onPickPhoto} disabled={photoBusy} style={{ display: 'none' }} />
                </label>
                {form.billPhoto === 'keep' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Existing photo kept</span>}
                {form.billPhoto && form.billPhoto !== 'keep' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)' }}>
                    Photo attached
                    <button onClick={() => setForm(f => ({ ...f, billPhoto: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}><X size={13} /></button>
                  </span>
                )}
                {form.billPhoto === 'keep' && (
                  <button onClick={() => setForm(f => ({ ...f, billPhoto: null }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12 }}>Remove</button>
                )}
              </div>
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => !saving && setModal(null)} style={{ padding: '9px 16px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--text)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={save} disabled={saving || photoBusy} style={{ padding: '9px 18px', borderRadius: 8, background: saving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))', border: 'none', color: '#1a1407', fontWeight: 700, cursor: saving || photoBusy ? 'not-allowed' : 'pointer', fontSize: 13 }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}>
          <img src={viewPhoto} alt="Fuel bill" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}
