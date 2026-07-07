import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Printer, Share2, ArrowLeft, QrCode, AlertTriangle } from 'lucide-react';
import { Link } from 'wouter';
import { api, type Challan, type IdleConfig } from '@/lib/api';
import { computeTripTiming, formatDuration } from '@/lib/tripTiming';
import { plantIdentity, type PlantIdentity, PLATFORM_NAME } from '@/lib/brand';

// ————— formatting helpers —————
function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}
function fmtClock(v?: string | null): string {
  if (!v) return '';
  return new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
// Receiver approval stamp: "hh:mm:ss / DD/MM/YY"
function fmtApprovalStamp(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} / ${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

// The plant profile is "complete enough" for a professional challan when it has
// at least a name, an address and a contact. Anything less prints half-empty
// letterheads, so we warn the owner (screen-only) to finish their profile.
function profileMissing(p: PlantIdentity): string[] {
  const missing: string[] = [];
  if (!p.legalName || p.legalName === 'Ready-Mix Concrete Plant') missing.push('company / plant name');
  if (!p.address && !p.city) missing.push('plant address');
  if (!p.contact) missing.push('contact number');
  if (!p.gstNo) missing.push('GST number');
  return missing;
}

const TERMS: string[] = [
  'Concrete should be used within 3 hours of batching time.',
  'Any shortage / less quantity claim must be noted on this challan at the time of delivery.',
  'DETENTION: Unloading time is 45 min for 6 cum. Overtime is chargeable as per plant policy.',
  'TM UNLOADING START & UNLOADING END time: please mention time on challan to avoid wrongly charged overtime.',
  'The customer has read and agreed to the above terms by signing this challan.',
];

// Corporate teal used for the printed lettering (headings, labels, rules) so
// the challan prints in the brand colour instead of plain black.
const TEAL = '#0f6b56';

// ————— one printed copy (ORIGINAL / DUPLICATE) —————
function ChallanCopy({ challan, plant, copyLabel, qrDataUrl }: {
  challan: Challan; plant: PlantIdentity; copyLabel: 'ORIGINAL' | 'DUPLICATE'; qrDataUrl: string | null;
}) {
  const line1 = [plant.address, plant.city].filter(Boolean).join(', ');
  const metaBits = [
    plant.gstNo ? `GSTIN : ${plant.gstNo}` : null,
    plant.contact ? `Contact : ${plant.contact}` : null,
    plant.email ? `Mail : ${plant.email}` : null,
  ].filter(Boolean);
  const deliveryAddress = [challan.siteName, challan.siteAddress].filter(Boolean).join(', ') || '—';
  const approvedBy = challan.deliveryTime ? (challan.contactPerson || challan.clientName || '') : '';
  const approvedAt = fmtApprovalStamp(challan.deliveryTime);
  const statusBits = [
    challan.dispatchTime ? `Dispatched ${fmtClock(challan.dispatchTime)}` : null,
    challan.siteArrivalTime ? `Site Arrival ${fmtClock(challan.siteArrivalTime)}` : null,
    challan.deliveryTime ? `Delivered ${fmtClock(challan.deliveryTime)}` : null,
    `Status: ${challan.status.toUpperCase()}${challan.hasProofPhoto || (challan.proofPhotos?.length ?? 0) > 0 ? ' · POD photo on record' : ''}`,
  ].filter(Boolean);

  const cell = (label: string, value: string, opts?: { mono?: boolean; bold?: boolean }) => (
    <>
      <td style={{ border: `1px solid ${TEAL}`, padding: '3px 8px', fontSize: 9, fontWeight: 800, color: TEAL, textTransform: 'uppercase', letterSpacing: '.3px', width: '17%', background: '#eef6f3' }}>{label}</td>
      <td style={{ border: `1px solid ${TEAL}`, padding: '3px 8px', fontSize: 10.5, fontWeight: opts?.bold ? 800 : 600, fontFamily: opts?.mono ? 'monospace' : undefined, width: '33%', color: '#111' }}>{value || '—'}</td>
    </>
  );

  return (
    <div className="challan-copy" style={{ border: `1.5px solid ${TEAL}`, padding: '10px 14px 6px', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Letterhead — issuing plant identity, never hardcoded */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: `2px solid ${TEAL}`, paddingBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '.4px', textTransform: 'uppercase', color: TEAL }}>
            M/S. {plant.legalName}
          </div>
          <div style={{ fontSize: 9, color: '#333', marginTop: 2, lineHeight: 1.45 }}>
            {line1 && <div><b style={{ color: TEAL }}>Plant Add :</b> {line1}</div>}
            {metaBits.length > 0 && <div>{metaBits.join('  |  ')}</div>}
            {plant.code && <div><b style={{ color: TEAL }}>Plant Code :</b> {plant.code}</div>}
          </div>
        </div>
        <div style={{ width: 70, textAlign: 'center', flexShrink: 0 }}>
          {qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="Live tracking QR" style={{ width: 58, height: 58, display: 'block', margin: '0 auto' }} />
              <div style={{ fontSize: 7, color: TEAL, fontWeight: 700, marginTop: 2 }}>SCAN FOR LIVE TRACKING</div>
            </>
          ) : (
            <div style={{ width: 58, height: 58, margin: '0 auto', border: `1.5px solid ${TEAL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: TEAL }}>
              {(plant.code || plant.legalName).slice(0, 3).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 900, letterSpacing: '1px', padding: '5px 0', color: TEAL }}>
        — DELIVERY CHALLAN <span style={{ color: '#b91c1c' }}>({copyLabel})</span> —
      </div>

      {/* Field grid */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>{cell('Challan No.', `${challan.challanNo}`, { mono: true, bold: true })}{cell('Loading Qty', `${challan.quantity} m³`, { bold: true })}</tr>
          <tr>{cell('Date', fmtDate(challan.dispatchTime || challan.createdAt))}{cell('Grade', challan.grade, { bold: true })}</tr>
          <tr>{cell('Company Name', challan.clientName || '—')}{cell('Slump', '')}</tr>
          <tr>{cell('Delivery Address', deliveryAddress)}{cell('Batch Number', '')}</tr>
          <tr>{cell('Contact Person', challan.contactPerson || '—')}{cell('Contact Number', challan.contactNumber || '—', { mono: true })}</tr>
        </tbody>
      </table>

      {/* Terms */}
      <ul style={{ margin: '4px 0 3px', paddingLeft: 14, fontSize: 8, color: '#222', lineHeight: 1.45 }}>
        {TERMS.map(t => <li key={t}>{t}</li>)}
      </ul>

      {/* Unloading + transport row */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            {cell('Unloading Start', fmtClock(challan.siteArrivalTime))}
            {cell('Unloading End', fmtClock(challan.siteReleaseTime))}
          </tr>
          <tr>
            {cell('TM Number', challan.vehicleNo || '—', { mono: true, bold: true })}
            {cell('Driver Contact', [challan.driverName, challan.driverPhone].filter(Boolean).join(' · ') || '—')}
          </tr>
        </tbody>
      </table>

      {/* Status timestamps strip */}
      <div style={{ fontSize: 8, color: '#333', padding: '3px 2px', borderBottom: `1px solid ${TEAL}` }}>
        {statusBits.join('   ·   ')}
      </div>

      {/* Signature blocks */}
      <div style={{ display: 'flex', gap: 0, minHeight: 58, flex: 1 }}>
        <div style={{ flex: 1, borderRight: `1px solid ${TEAL}`, padding: '4px 8px 3px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: TEAL }}>Received By (Customer / Site)</div>
          <div style={{ fontSize: 9.5, marginTop: 4, lineHeight: 1.8 }}>
            <div>Approved By - <b>{approvedBy || '______________________'}</b></div>
            <div>Time & Date - <b style={{ fontFamily: 'monospace' }}>{approvedAt || '____:____:____ / ____/____/____'}</b></div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 7.5, color: '#666' }}>Signature & stamp</div>
        </div>
        <div style={{ flex: 1, padding: '4px 8px 3px', display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: TEAL }}>For, {plant.legalName}</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 8.5, fontWeight: 700, borderTop: '1px solid #999', paddingTop: 3, marginLeft: 'auto', width: 150 }}>Authorised Signatory</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${TEAL}`, marginTop: 2, paddingTop: 3, textAlign: 'center', fontSize: 7.5, color: TEAL, fontWeight: 600 }}>
        {[plant.email, plant.contact ? `Ph: ${plant.contact}` : null].filter(Boolean).join('  |  ')}
        {(plant.email || plant.contact) ? '  —  ' : ''}Download the {PLATFORM_NAME} app to place and track your orders live.
      </div>
    </div>
  );
}

export default function ChallanPrint() {
  const [, params] = useRoute('/challans/:id/print');
  const [challan, setChallan] = useState<Challan | null>(null);
  const [idleConfig, setIdleConfig] = useState<IdleConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (params?.id) {
      api.get<Challan>(`/challans/${params.id}`)
        .then(c => { setChallan(c); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [params?.id]);

  // Idle config drives the billable-idle / idle-charge figures. Best-effort and
  // admin-only; falls back to the default free window with no rate otherwise.
  useEffect(() => {
    let cancelled = false;
    api.get<IdleConfig>('/admin/idle-settings')
      .then(cfg => { if (!cancelled) setIdleConfig({ freeMin: cfg.freeMin, ratePerHour: cfg.ratePerHour }); })
      .catch(() => { /* non-admin or unavailable — use defaults */ });
    return () => { cancelled = true; };
  }, []);

  // Mint a public 24h tracking link (staff-only, plant-scoped server-side) and
  // render it as a QR on both copies. Lazy-import keeps qrcode out of the main bundle.
  function generateTrackingQr() {
    if (!challan || qrBusy) return;
    setQrBusy(true);
    setQrError(null);
    api.post<{ token: string; url: string }>(`/challans/${challan.id}/share`, {})
      .then(async ({ url }) => {
        const abs = url.startsWith('http') ? url : `${window.location.origin}${url}`;
        const QRCode = (await import('qrcode')).default;
        const dataUrl = await QRCode.toDataURL(abs, { width: 256, margin: 0 });
        setQrDataUrl(dataUrl);
      })
      .catch(() => setQrError('Could not generate tracking link (staff permission required).'))
      .finally(() => setQrBusy(false));
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08111f', color: '#9fb0c7' }}>
      Loading challan…
    </div>
  );

  if (!challan) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08111f', color: '#ef4444', flexDirection: 'column', gap: 12 }}>
      <div>Challan not found</div>
      <Link href="/dispatch"><span style={{ color: '#38bdf8', fontSize: 13 }}>← Back to Dispatch</span></Link>
    </div>
  );

  const plant = plantIdentity(challan);
  const missing = profileMissing(plant);
  const timing = computeTripTiming(challan, idleConfig);
  const timingCells: [string, string][] = [];
  if (timing.travelMin != null) timingCells.push(['Travel Time', formatDuration(timing.travelMin)]);
  if (timing.siteMin != null) timingCells.push(['Time at Site', formatDuration(timing.siteMin)]);
  if (timing.billableIdleMin != null) timingCells.push(['Billable Idle', formatDuration(timing.billableIdleMin)]);
  if (timing.idleCharge != null) timingCells.push(['Idle Charge', `₹${timing.idleCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
  const hasAnnexure = (challan.proofPhotos?.length ?? 0) > 0 || timingCells.length > 0 || !!challan.notes;

  function shareWhatsApp() {
    if (!challan) return;
    const p = plantIdentity(challan);
    const msg = encodeURIComponent(
      `🏗️ *${p.name}*\n` +
      `Challan No: #${challan.challanNo}\n` +
      `Client: ${challan.clientName}\n` +
      `Site: ${challan.siteName || '—'}\n` +
      `Grade: ${challan.grade} | Qty: ${challan.quantity} m³\n` +
      `Vehicle: ${challan.vehicleNo || '—'}\n` +
      `Driver: ${challan.driverName || '—'}\n` +
      `Dispatch: ${challan.dispatchTime ? new Date(challan.dispatchTime).toLocaleString('en-IN') : '—'}\n` +
      `Status: ${challan.status.toUpperCase()}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  return (
    <>
      {/* Print controls — hidden on print */}
      <div className="no-print" style={{
        background: '#0d1930', borderBottom: '1px solid #263449', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <Link href="/dispatch">
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#9fb0c7', cursor: 'pointer', fontSize: 13 }}>
            <ArrowLeft size={14} /> Back
          </button>
        </Link>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#eaf6f1' }}>Challan #{challan.challanNo}</div>
        <button onClick={generateTrackingQr} disabled={qrBusy || !!qrDataUrl} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: qrDataUrl ? 'rgba(255,255,255,.05)' : 'rgba(56,189,248,.1)',
          border: '1px solid rgba(56,189,248,.25)',
          borderRadius: 8, color: qrDataUrl ? '#9fb0c7' : '#38bdf8', cursor: qrDataUrl ? 'default' : 'pointer', fontSize: 13, fontWeight: 700,
        }}><QrCode size={14} /> {qrDataUrl ? 'Tracking QR added' : qrBusy ? 'Generating…' : 'Tracking QR'}</button>
        <button onClick={shareWhatsApp} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)',
          borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 13, fontWeight: 700,
        }}><Share2 size={14} /> WhatsApp</button>
        <button onClick={() => window.print()} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'linear-gradient(135deg,#7ee5c7,#1f9e80)',
          borderRadius: 8, color: '#111827', cursor: 'pointer', fontSize: 13, fontWeight: 800, border: 'none',
        }}><Printer size={14} /> Print</button>
      </div>

      {qrError && (
        <div className="no-print" style={{ maxWidth: 794, margin: '10px auto 0', padding: '8px 14px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#fca5a5', fontSize: 12.5 }}>
          {qrError}
        </div>
      )}

      {missing.length > 0 && (
        <div className="no-print" style={{ maxWidth: 794, margin: '10px auto 0', padding: '10px 14px', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 8, color: '#fcd34d', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <b>Please complete plant profile before generating challan.</b>{' '}
            Missing: {missing.join(', ')}. These details print on the challan letterhead and are fetched from the issuing plant's profile.
          </div>
        </div>
      )}

      {/* A4 sheet: ORIGINAL + DUPLICATE separated by a cut line — matches the sample challan */}
      <div className="challan-page" style={{
        background: '#fff', color: '#1a1a1a', fontFamily: 'Arial, sans-serif',
        maxWidth: 794, margin: '24px auto', padding: '26px 30px', boxShadow: '0 4px 24px rgba(0,0,0,.15)',
      }}>
        <ChallanCopy challan={challan} plant={plant} copyLabel="ORIGINAL" qrDataUrl={qrDataUrl} />

        <div className="challan-cutline" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0', color: TEAL }}>
          <div style={{ flex: 1, borderTop: `1.5px dashed ${TEAL}` }} />
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '2px' }}>✂ CUT HERE</div>
          <div style={{ flex: 1, borderTop: `1.5px dashed ${TEAL}` }} />
        </div>

        <ChallanCopy challan={challan} plant={plant} copyLabel="DUPLICATE" qrDataUrl={qrDataUrl} />

        {/* Annexure — proof of delivery, timing & notes (second page on print) */}
        {hasAnnexure && (
          <div className="challan-annexure" style={{ marginTop: 24, borderTop: '2px solid #333', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.5px', marginBottom: 10 }}>
              ANNEXURE — CHALLAN #{challan.challanNo} · DELIVERY RECORD
            </div>

            {/* Full timestamps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
              {([['Dispatch', challan.dispatchTime], ['Site Arrival', challan.siteArrivalTime], ['Site Release', challan.siteReleaseTime], ['Delivered', challan.deliveryTime]] as const).map(([k, v]) => (
                <div key={k} style={{ padding: 8, background: '#fafafa', border: '1px solid #ddd', borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontSize: 8.5, color: '#888', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div>
                  <div style={{ fontSize: 11, fontWeight: 800 }}>{v ? `${fmtClock(v)} · ${fmtDate(v)}` : '—'}</div>
                </div>
              ))}
            </div>

            {timingCells.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${timingCells.length},1fr)`, gap: 8, marginBottom: 12 }}>
                {timingCells.map(([k, v]) => (
                  <div key={k} style={{ padding: 8, background: '#fffbf0', border: '1px solid #f0e0a0', borderRadius: 4, textAlign: 'center' }}>
                    <div style={{ fontSize: 8.5, color: '#a8801f', textTransform: 'uppercase', fontWeight: 700 }}>{k}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#7a5c00' }}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {challan.notes && (
              <div style={{ padding: 10, background: '#fffbf0', border: '1px solid #f0e0a0', borderRadius: 4, marginBottom: 12, fontSize: 11 }}>
                <span style={{ fontWeight: 700 }}>Notes: </span>{challan.notes}
              </div>
            )}

            {challan.proofPhotos && challan.proofPhotos.length > 0 && (
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                  Proof of Delivery{challan.proofPhotos.length > 1 ? ` (${challan.proofPhotos.length} photos)` : ''}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {challan.proofPhotos.map((src, i) => (
                    <img key={i} src={src} alt={`Proof of delivery ${i + 1}`}
                      style={{ maxWidth: challan.proofPhotos!.length > 1 ? '48%' : '100%', maxHeight: 300, borderRadius: 4, border: '1px solid #ddd', display: 'block' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
          /* Isolate the challan sheet: hide all app chrome (header, sidebar, bottom nav) */
          body * { visibility: hidden; }
          .challan-page, .challan-page * { visibility: visible; }
          .challan-page {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; margin: 0 !important; max-width: 100% !important; padding: 0 !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          /* ONE page, two equal halves: printable area is 281mm tall (297 − 2×8mm
             margins). Each copy gets a fixed half (~136mm) and clips any overflow,
             with the cut line between them — never a second sheet for the copies. */
          .challan-copy {
            height: 136mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-inside: avoid;
          }
          .challan-cutline { margin: 2mm 0 !important; }
          .challan-annexure { page-break-before: always; border-top: none !important; padding-top: 0 !important; }
        }
      `}</style>
    </>
  );
}
