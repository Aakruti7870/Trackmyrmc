import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Plus, X, Settings, Printer, Trash2, FileSpreadsheet, Link2, AlertTriangle } from 'lucide-react';
import {
  batchReportApi, mixDesignApi,
  type BatchReportListItem, type MixDesignRow, type BatchSettings, type BatchReportCreateBody,
} from '@/lib/batchSheets';
import { api, type Challan } from '@/lib/api';

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

export default function BatchSheets() {
  const [reports, setReports] = useState<BatchReportListItem[]>([]);
  const [mixes, setMixes] = useState<MixDesignRow[]>([]);
  const [settings, setSettings] = useState<BatchSettings>({ plantType: '', mixerCapacityCum: 1, batchSizeCum: 1 });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);

  const [showGenerate, setShowGenerate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([batchReportApi.list(), mixDesignApi.list(), batchReportApi.settings()])
      .then(([rows, mds, st]) => {
        if (cancelled) return;
        setReports(rows); setMixes(mds); setSettings(st); setBanner(null);
      })
      .catch((e: Error) => { if (!cancelled) setBanner(e.message || 'Failed to load batch sheets'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const reload = () =>
    batchReportApi.list().then(setReports).catch((e: Error) => setBanner(e.message || 'Failed to reload'));

  function doDelete() {
    if (deleteId == null) return;
    batchReportApi.remove(deleteId)
      .then(() => reload())
      .catch((e: Error) => setBanner(e.message || 'Failed to delete'))
      .finally(() => setDeleteId(null));
  }

  const btnPrimary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 7, borderRadius: 12, padding: '10px 18px',
    background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
    color: '#111827', fontWeight: 800, fontSize: 14,
  };

  return (
    <div>
      <div className="page-hd" style={{ alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Batch Sheets</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 14 }}>
            Batching plant report generator — grade recipe × quantity, printable in landscape
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowSettings(true)} data-testid="button-batch-settings" style={{
            display: 'flex', alignItems: 'center', gap: 7, borderRadius: 12, padding: '10px 16px',
            background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)', fontWeight: 700, fontSize: 14,
          }}>
            <Settings size={15} /> Plant Settings
          </button>
          <button onClick={() => setShowGenerate(true)} data-testid="button-generate-sheet" style={btnPrimary}>
            <Plus size={16} /> Generate Sheet
          </button>
        </div>
      </div>

      {banner && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: 16, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={15} /> {banner}</span>
          <button onClick={() => setBanner(null)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {mixes.length === 0 && !loading && (
        <div className="glass-card" style={{ padding: '14px 18px', marginBottom: 16, fontSize: 13.5, color: 'var(--muted)' }}>
          No mix designs yet. <Link href="/mix-design" style={{ color: 'var(--blue)', fontWeight: 700 }}>Create a grade recipe in Mix Design</Link> first — the batch sheet generator uses it for target weights.
        </div>
      )}

      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                {['Report No', 'Date', 'Grade', 'Qty (m³)', 'Batches', 'Customer', 'Truck', 'Challan', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }} data-testid={`row-batch-sheet-${r.id}`}>
                  <td style={{ padding: '11px 14px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    <Link href={`/batch-sheets/${r.id}/print`} style={{ color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <FileSpreadsheet size={14} /> {r.reportNo}
                    </Link>
                  </td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>{r.batchDate ? fmtDate(r.batchDate) : fmtDate(r.createdAt)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 800 }}>{r.grade}</td>
                  <td style={{ padding: '11px 14px' }}>{Number(r.productionQty)} <span style={{ color: 'var(--muted)', fontSize: 11 }}>@ {Number(r.batchSize)}</span></td>
                  <td style={{ padding: '11px 14px' }}>{r.batchCount}</td>
                  <td style={{ padding: '11px 14px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customer || '—'}</td>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.truckNo || '—'}</td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    {r.challanNo ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--blue)', fontWeight: 700 }}><Link2 size={12} /> {r.challanNo}</span> : '—'}
                  </td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <Link href={`/batch-sheets/${r.id}/print`}>
                      <button data-testid={`button-print-sheet-${r.id}`} style={{ background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: 'var(--blue)', cursor: 'pointer', marginRight: 6 }}><Printer size={13} /></button>
                    </Link>
                    <button onClick={() => setDeleteId(r.id)} data-testid={`button-delete-sheet-${r.id}`} style={{ background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: 'var(--red)', cursor: 'pointer' }}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {!loading && reports.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>No batch sheets yet — generate the first one.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showGenerate && (
        <GenerateModal
          mixes={mixes}
          settings={settings}
          onClose={() => setShowGenerate(false)}
          onDone={() => { setShowGenerate(false); reload(); }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={(s) => { setSettings(s); setShowSettings(false); }}
        />
      )}

      {deleteId != null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Batch Sheet?</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontSize: 14 }}>Cancel</button>
              <button onClick={doDelete} data-testid="button-confirm-delete-sheet" style={{ padding: '9px 16px', borderRadius: 10, background: 'var(--red)', color: '#fff', fontWeight: 700, fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ——— Generate modal ———

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--chip-bg)', border: '1px solid var(--line)',
  borderRadius: 10, padding: '9px 12px', color: 'var(--text)', fontSize: 14, outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, display: 'block' };

function GenerateModal({ mixes, settings, onClose, onDone }: {
  mixes: MixDesignRow[];
  settings: BatchSettings;
  onClose: () => void;
  onDone: () => void;
}) {
  const [challanList, setChallanList] = useState<Challan[]>([]);
  const [form, setForm] = useState({
    mixDesignId: mixes[0] ? String(mixes[0].id) : '',
    challanId: '',
    productionQty: '',
    batchSize: settings.batchSizeCum ? String(settings.batchSizeCum) : '1',
    customer: '',
    site: '',
    truckNo: '',
    truckDriver: '',
    orderedQty: '',
    withThisLoad: '',
    batchDate: '',
    startTime: '',
    endTime: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<Challan[]>('/challans')
      .then(list => { if (!cancelled) setChallanList(list.slice(0, 100)); })
      .catch(() => { /* challan attach stays optional */ });
    return () => { cancelled = true; };
  }, []);

  const attached = form.challanId !== '';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.mixDesignId) { setError('Pick a grade / mix design.'); return; }
    const qty = Number(form.productionQty);
    if (!Number.isFinite(qty) || qty <= 0) { setError('Enter the production quantity in m³.'); return; }
    const size = Number(form.batchSize);
    if (!Number.isFinite(size) || size <= 0) { setError('Enter a valid batch size.'); return; }
    if (settings.mixerCapacityCum && size > settings.mixerCapacityCum + 1e-9) {
      setError(`Batch size exceeds the mixer capacity (${settings.mixerCapacityCum} m³). Update Plant Settings if the mixer changed.`);
      return;
    }
    const body: BatchReportCreateBody & Record<string, unknown> = {
      mixDesignId: Number(form.mixDesignId),
      productionQty: qty,
      batchSize: size,
      mixerCapacity: settings.mixerCapacityCum || undefined,
      plantType: settings.plantType || undefined,
    };
    if (attached) body.challanId = Number(form.challanId);
    for (const f of ['customer', 'site', 'truckNo', 'truckDriver', 'batchDate', 'startTime', 'endTime'] as const) {
      if (form[f].trim()) body[f] = form[f].trim();
    }
    for (const f of ['orderedQty', 'withThisLoad'] as const) {
      if (form[f].trim()) body[f] = Number(form[f]);
    }
    setSaving(true);
    batchReportApi.create(body)
      .then(() => onDone())
      .catch((err: Error) => setError(err.message || 'Failed to generate'))
      .finally(() => setSaving(false));
  }

  const selectedChallan = challanList.find(c => String(c.id) === form.challanId);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: 16 }}>
      <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Generate Batch Sheet</h3>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div className="modal-grid">
            <div>
              <label style={labelStyle}>Grade / Recipe *</label>
              <select value={form.mixDesignId} onChange={e => setForm(f => ({ ...f, mixDesignId: e.target.value }))} style={inputStyle} data-testid="select-sheet-mix">
                {mixes.length === 0 && <option value="">No mix designs</option>}
                {mixes.map(m => <option key={m.id} value={m.id}>{m.grade} — {m.recipeName}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Attach Challan (optional)</label>
              <select value={form.challanId} onChange={e => setForm(f => ({ ...f, challanId: e.target.value }))} style={inputStyle} data-testid="select-sheet-challan">
                <option value="">— None —</option>
                {challanList.map(c => (
                  <option key={c.id} value={c.id}>#{c.challanNo} · {c.clientName || '—'} · {c.grade} · {c.quantity} m³</option>
                ))}
              </select>
            </div>
          </div>

          {attached && (
            <div style={{ padding: '9px 12px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.25)', borderRadius: 10, color: 'var(--blue)', fontSize: 12.5 }}>
              Truck, driver, customer, site, quantities and exact dispatch time will prefill from challan
              {selectedChallan ? ` #${selectedChallan.challanNo}` : ''}. Any field you fill below overrides it.
            </div>
          )}

          <div className="modal-grid">
            <div>
              <label style={labelStyle}>Production Qty (m³) *</label>
              <input type="number" step="0.5" min={0.5} value={form.productionQty} onChange={e => setForm(f => ({ ...f, productionQty: e.target.value }))} required placeholder="e.g. 6" style={inputStyle} data-testid="input-sheet-qty" />
            </div>
            <div>
              <label style={labelStyle}>Batch Size (m³ / batch) *</label>
              <input type="number" step="0.25" min={0.25} value={form.batchSize} onChange={e => setForm(f => ({ ...f, batchSize: e.target.value }))} required style={inputStyle} data-testid="input-sheet-batch-size" />
            </div>
          </div>

          <div className="modal-grid">
            <div>
              <label style={labelStyle}>Customer</label>
              <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder={attached ? 'From challan' : ''} style={inputStyle} data-testid="input-sheet-customer" />
            </div>
            <div>
              <label style={labelStyle}>Site</label>
              <input value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))} placeholder={attached ? 'From challan' : ''} style={inputStyle} data-testid="input-sheet-site" />
            </div>
          </div>

          <div className="modal-grid">
            <div>
              <label style={labelStyle}>Truck No</label>
              <input value={form.truckNo} onChange={e => setForm(f => ({ ...f, truckNo: e.target.value }))} placeholder={attached ? 'From challan' : ''} style={inputStyle} data-testid="input-sheet-truck" />
            </div>
            <div>
              <label style={labelStyle}>Truck Driver</label>
              <input value={form.truckDriver} onChange={e => setForm(f => ({ ...f, truckDriver: e.target.value }))} placeholder={attached ? 'From challan' : ''} style={inputStyle} data-testid="input-sheet-driver" />
            </div>
          </div>

          <div className="modal-grid">
            <div>
              <label style={labelStyle}>Ordered Qty (m³)</label>
              <input type="number" step="0.5" min={0} value={form.orderedQty} onChange={e => setForm(f => ({ ...f, orderedQty: e.target.value }))} placeholder={attached ? 'From order' : ''} style={inputStyle} data-testid="input-sheet-ordered" />
            </div>
            <div>
              <label style={labelStyle}>With This Load (m³)</label>
              <input type="number" step="0.5" min={0} value={form.withThisLoad} onChange={e => setForm(f => ({ ...f, withThisLoad: e.target.value }))} placeholder={attached ? 'Auto cumulative' : ''} style={inputStyle} data-testid="input-sheet-withload" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Batch Date</label>
              <input type="date" value={form.batchDate} onChange={e => setForm(f => ({ ...f, batchDate: e.target.value }))} style={inputStyle} data-testid="input-sheet-date" />
            </div>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input type="time" step={1} value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} style={inputStyle} data-testid="input-sheet-start" />
            </div>
            <div>
              <label style={labelStyle}>End Time</label>
              <input type="time" step={1} value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} style={inputStyle} data-testid="input-sheet-end" />
            </div>
          </div>

          {error && (
            <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }} data-testid="text-sheet-form-error">
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 14 }}>Cancel</button>
            <button type="submit" disabled={saving || mixes.length === 0} data-testid="button-save-sheet" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, fontSize: 14, opacity: saving || mixes.length === 0 ? 0.6 : 1 }}>
              {saving ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ——— Plant settings modal ———

function SettingsModal({ settings, onClose, onSaved }: {
  settings: BatchSettings;
  onClose: () => void;
  onSaved: (s: BatchSettings) => void;
}) {
  const [form, setForm] = useState({
    plantType: settings.plantType,
    mixerCapacityCum: String(settings.mixerCapacityCum),
    batchSizeCum: String(settings.batchSizeCum),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    batchReportApi.saveSettings({
      plantType: form.plantType,
      mixerCapacityCum: Number(form.mixerCapacityCum),
      batchSizeCum: Number(form.batchSizeCum),
    })
      .then(onSaved)
      .catch((err: Error) => setError(err.message || 'Failed to save'))
      .finally(() => setSaving(false));
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: 16 }}>
      <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Batching Plant Settings</h3>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)', padding: 4 }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={labelStyle}>Plant Type / Model</label>
            <input value={form.plantType} onChange={e => setForm(f => ({ ...f, plantType: e.target.value }))} placeholder="e.g. SCHWING Stetter M1 T Belt" style={inputStyle} data-testid="input-settings-plant-type" />
          </div>
          <div className="modal-grid">
            <div>
              <label style={labelStyle}>Mixer Capacity (m³) *</label>
              <input type="number" step="0.25" min={0.25} max={50} value={form.mixerCapacityCum} onChange={e => setForm(f => ({ ...f, mixerCapacityCum: e.target.value }))} required style={inputStyle} data-testid="input-settings-capacity" />
            </div>
            <div>
              <label style={labelStyle}>Default Batch Size (m³) *</label>
              <input type="number" step="0.25" min={0.25} max={50} value={form.batchSizeCum} onChange={e => setForm(f => ({ ...f, batchSizeCum: e.target.value }))} required style={inputStyle} data-testid="input-settings-batch-size" />
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
            The default batch size prefills the generator, and sheets refuse a batch size above the mixer capacity.
          </p>
          {error && (
            <div style={{ padding: '9px 12px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 14 }}>Cancel</button>
            <button type="submit" disabled={saving} data-testid="button-save-settings" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
