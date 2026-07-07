import { useState, useEffect, Fragment } from 'react';
import { useRoute, Link } from 'wouter';
import { Printer, ArrowLeft, Pencil, RefreshCw, Check, X } from 'lucide-react';
import { batchReportApi, targetFor, type BatchReportDetail, type BatchRow } from '@/lib/batchSheets';
import { PLATFORM_NAME } from '@/lib/brand';
import { useAuth } from '@/lib/auth';

const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
const fmtStamp = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const TEAL = '#0f6b56';

export default function BatchSheetPrint() {
  const [, params] = useRoute('/batch-sheets/:id/print');
  const { user } = useAuth();
  const [report, setReport] = useState<BatchReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    batchReportApi.get(params.id)
      .then(r => { if (!cancelled) setReport(r); })
      .catch(() => { /* handled by the not-found branch */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params?.id]);

  function startEdit() {
    if (!report) return;
    setDraft(report.batches.map(b => ({ size: b.size, actuals: { ...b.actuals } })));
    setEditing(true);
    setError(null);
  }

  function saveEdit() {
    if (!report) return;
    setBusy(true);
    batchReportApi.update(report.id, { batches: draft })
      .then(r => { setReport(r); setEditing(false); setError(null); })
      .catch((e: Error) => setError(e.message || 'Failed to save'))
      .finally(() => setBusy(false));
  }

  function regenerate() {
    if (!report) return;
    setBusy(true);
    batchReportApi.update(report.id, { regenerate: true })
      .then(r => { setReport(r); setEditing(false); setError(null); })
      .catch((e: Error) => setError(e.message || 'Failed to regenerate'))
      .finally(() => setBusy(false));
  }

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
      Loading batch sheet…
    </div>
  );

  if (!report) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', flexDirection: 'column', gap: 12 }}>
      <div>Batch sheet not found</div>
      <Link href="/batch-sheets"><span style={{ color: 'var(--blue)', fontSize: 13 }}>← Back to Batch Sheets</span></Link>
    </div>
  );

  const mats = report.materials;
  const rows = editing ? draft : report.batches;
  const totals = report.totals;
  const round1 = (v: number) => Math.round(v * 10) / 10;

  const hd = (label: string, value: string, wide = false) => (
    <div style={{ display: 'flex', gap: 4, minWidth: 0, gridColumn: wide ? 'span 2' : undefined }}>
      <span style={{ fontWeight: 700, color: TEAL, whiteSpace: 'nowrap', fontSize: 9.5, textTransform: 'uppercase' }}>{label}:</span>
      <span style={{ fontWeight: 700, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );

  const th: React.CSSProperties = { border: '1px solid #555', padding: '3px 5px', fontSize: 9, fontWeight: 800, background: '#e8f3ef', color: TEAL, textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { border: '1px solid #777', padding: '2px 5px', fontSize: 9.5, textAlign: 'right', fontFamily: 'monospace' };

  return (
    <>
      {/* Controls — hidden on print */}
      <div className="no-print" style={{
        background: '#0d1930', borderBottom: '1px solid #263449', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Link href="/batch-sheets">
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#9fb0c7', cursor: 'pointer', fontSize: 13 }}>
            <ArrowLeft size={14} /> Back
          </button>
        </Link>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#eaf6f1' }}>Batch Sheet {report.reportNo}{report.challanNo ? ` · Challan #${report.challanNo}` : ''}</div>
        {!editing ? (
          <>
            <button onClick={startEdit} disabled={busy} data-testid="button-edit-actuals" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.25)', borderRadius: 8, color: '#38bdf8', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <Pencil size={14} /> Edit Actuals
            </button>
            <button onClick={regenerate} disabled={busy} data-testid="button-regenerate" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 8, color: '#f59e0b', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              <RefreshCw size={14} /> {busy ? 'Working…' : 'Regenerate'}
            </button>
            <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'linear-gradient(135deg,#7ee5c7,#1f9e80)', borderRadius: 8, color: '#111827', cursor: 'pointer', fontSize: 13, fontWeight: 800, border: 'none' }}>
              <Printer size={14} /> Print (Landscape)
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(false)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#9fb0c7', cursor: 'pointer', fontSize: 13 }}>
              <X size={14} /> Cancel
            </button>
            <button onClick={saveEdit} disabled={busy} data-testid="button-save-actuals" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'linear-gradient(135deg,#7ee5c7,#1f9e80)', borderRadius: 8, color: '#111827', cursor: 'pointer', fontSize: 13, fontWeight: 800, border: 'none' }}>
              <Check size={14} /> {busy ? 'Saving…' : 'Save Actuals'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="no-print" style={{ maxWidth: 1123, margin: '10px auto 0', padding: '8px 14px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {/* Landscape A4 sheet (~1123×794 px at 96dpi) */}
      <div className="batch-sheet-page" style={{
        background: '#fff', color: '#111', fontFamily: 'Arial, sans-serif',
        maxWidth: 1123, margin: '20px auto', padding: '18px 22px', boxShadow: '0 4px 24px rgba(0,0,0,.15)',
      }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2.5px solid ${TEAL}`, paddingBottom: 6, marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: TEAL, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              Autographic Batch Report
            </div>
            <div style={{ fontSize: 9.5, color: '#333', fontWeight: 700 }}>
              {report.plantType || 'Batching Plant'} · Recipe {report.recipeCode || '—'} · {report.recipeName}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9.5, fontWeight: 700 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#b91c1c', fontFamily: 'monospace' }}>{report.reportNo}</div>
            <div>Printed: <span style={{ fontFamily: 'monospace' }}>{fmtStamp(new Date().toISOString())}</span></div>
            <div>Generated: <span style={{ fontFamily: 'monospace' }}>{fmtStamp(report.createdAt)}</span></div>
          </div>
        </div>

        {/* Header grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px 16px', border: `1px solid ${TEAL}`, borderRadius: 4, padding: '6px 10px', marginBottom: 6 }}>
          {hd('Batch Date', fmtDate(report.batchDate))}
          {hd('Batch Start', report.startTime || '—')}
          {hd('Batch End', report.endTime || '—')}
          {hd('Grade', report.grade)}
          {hd('Customer', report.customer || '—', true)}
          {hd('Site', report.site || '—', true)}
          {hd('Truck No', report.truckNo || '—')}
          {hd('Truck Driver', report.truckDriver || '—')}
          {hd('Challan No', report.challanNo ? `#${report.challanNo}` : '—')}
          {hd('Mixer Capacity', report.mixerCapacity ? `${Number(report.mixerCapacity)} m³` : '—')}
          {hd('Production Qty', `${Number(report.productionQty)} m³`)}
          {hd('Batch Size', `${Number(report.batchSize)} m³`)}
          {hd('Ordered Qty', report.orderedQty ? `${Number(report.orderedQty)} m³` : '—')}
          {hd('With This Load', report.withThisLoad ? `${Number(report.withThisLoad)} m³` : '—')}
        </div>

        {/* Batch table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'center' }} rowSpan={2}>Batch</th>
              <th style={{ ...th, textAlign: 'center' }} rowSpan={2}>Size<br />(m³)</th>
              {mats.map(m => (
                <th key={m.key} style={{ ...th, textAlign: 'center' }} colSpan={2}>{m.label}<br /><span style={{ fontWeight: 600, color: '#555' }}>{m.perCumKg} kg/m³ ±{m.tolerancePct}%</span></th>
              ))}
            </tr>
            <tr>
              {mats.map(m => (
                <Fragment key={m.key}>
                  <th style={{ ...th, fontSize: 8, textAlign: 'center' }}>SET</th>
                  <th style={{ ...th, fontSize: 8, textAlign: 'center', background: '#fdf6e3', color: '#92400e' }}>ACTUAL</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => (
              <tr key={i} data-testid={`row-batch-${i + 1}`}>
                <td style={{ ...td, textAlign: 'center', fontWeight: 800 }}>{i + 1}</td>
                <td style={{ ...td, textAlign: 'center' }}>{b.size}</td>
                {mats.map(m => {
                  const set = targetFor(m, b.size);
                  const act = b.actuals[m.key] ?? 0;
                  const off = set > 0 ? Math.abs(act - set) / set * 100 > m.tolerancePct + 0.05 : false;
                  return (
                    <Fragment key={m.key}>
                      <td style={td}>{set}</td>
                      <td style={{ ...td, background: '#fffdf5', fontWeight: 700, color: off ? '#b91c1c' : '#111' }}>
                        {editing ? (
                          <input
                            type="number" step="0.01" min={0} value={draft[i]?.actuals[m.key] ?? 0}
                            onChange={e => setDraft(d => {
                              const next = d.map(r => ({ size: r.size, actuals: { ...r.actuals } }));
                              next[i].actuals[m.key] = Number(e.target.value);
                              return next;
                            })}
                            style={{ width: 58, fontSize: 9.5, fontFamily: 'monospace', textAlign: 'right', border: '1px solid #bbb', borderRadius: 3, padding: '1px 3px' }}
                            data-testid={`input-actual-${i}-${m.key}`}
                          />
                        ) : act}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...td, fontWeight: 900, textAlign: 'center', background: '#e8f3ef', color: TEAL }} colSpan={2}>SET TOTAL</td>
              {totals.perMaterial.map(m => (
                <td key={m.key} style={{ ...td, fontWeight: 800, background: '#e8f3ef' }} colSpan={2}>{round1(m.totalSet)}</td>
              ))}
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 900, textAlign: 'center', background: '#fdf6e3', color: '#92400e' }} colSpan={2}>ACTUAL TOTAL</td>
              {totals.perMaterial.map(m => (
                <td key={m.key} style={{ ...td, fontWeight: 800, background: '#fdf6e3' }} colSpan={2}>{round1(m.totalActual)}</td>
              ))}
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 900, textAlign: 'center' }} colSpan={2}>DIFF %</td>
              {totals.perMaterial.map(m => (
                <td key={m.key} style={{ ...td, fontWeight: 800, color: Math.abs(m.diffPct) > 2 ? '#b91c1c' : TEAL }} colSpan={2}>
                  {m.diffPct > 0 ? '+' : ''}{m.diffPct}%
                </td>
              ))}
            </tr>
          </tfoot>
        </table>

        {/* Mass summary + signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8, gap: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700 }}>
            <span style={{ color: TEAL }}>TOTAL SET MASS:</span> <span style={{ fontFamily: 'monospace' }}>{round1(totals.totalSetMass)} kg</span>
            <span style={{ margin: '0 8px', color: '#999' }}>|</span>
            <span style={{ color: '#92400e' }}>TOTAL ACTUAL MASS:</span> <span style={{ fontFamily: 'monospace' }}>{round1(totals.totalActualMass)} kg</span>
            <span style={{ margin: '0 8px', color: '#999' }}>|</span>
            <span style={{ color: TEAL }}>TOTAL DIFF:</span>{' '}
            <span style={{ fontFamily: 'monospace', color: Math.abs(totals.totalMassDiffPct) > 2 ? '#b91c1c' : '#111' }} data-testid="text-total-diff">
              {totals.totalMassDiffPct > 0 ? '+' : ''}{totals.totalMassDiffPct}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 40, fontSize: 9.5, fontWeight: 700, textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #555', paddingTop: 3, minWidth: 130 }}>Plant Operator{user?.name ? ` — ${user.name}` : ''}</div>
            <div style={{ borderTop: '1px solid #555', paddingTop: 3, minWidth: 130 }}>Quality Engineer</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #bbb', marginTop: 6, paddingTop: 3, textAlign: 'center', fontSize: 8, color: '#555' }}>
          Computer-generated autographic batch record · {PLATFORM_NAME}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 7mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
          body * { visibility: hidden; }
          .batch-sheet-page, .batch-sheet-page * { visibility: visible; }
          .batch-sheet-page {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 0 !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  );
}
