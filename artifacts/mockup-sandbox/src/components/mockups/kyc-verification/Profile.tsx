import './_group.css';
import { useState } from 'react';
import {
  ShieldCheck, Upload, Trash2, Eye, Send, AlertCircle, FileText,
  BadgeCheck, Clock, XCircle, FileEdit,
} from 'lucide-react';

type KycStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

const DOC_TYPES = [
  { value: 'gst', label: 'GST Certificate' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'aadhaar', label: 'Aadhaar (masked)' },
  { value: 'driving_license', label: 'Driving Licence' },
  { value: 'rc', label: 'Vehicle RC' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'puc', label: 'PUC Certificate' },
  { value: 'fitness', label: 'Fitness Certificate' },
  { value: 'photo', label: 'Photograph' },
  { value: 'other', label: 'Other Document' },
];
const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]));

const BADGE_STYLES: Record<KycStatus, { color: string; bg: string; icon: typeof BadgeCheck; label: string }> = {
  draft:     { color: 'var(--muted)', bg: 'var(--chip-bg)', icon: FileEdit, label: 'Draft' },
  submitted: { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 12%, transparent)', icon: Clock, label: 'Under Review' },
  approved:  { color: 'var(--green)', bg: 'rgba(34,197,94,.12)', icon: BadgeCheck, label: 'Verified' },
  rejected:  { color: 'var(--red)', bg: 'rgba(239,68,68,.12)', icon: XCircle, label: 'Rejected' },
};

function VerifiedBadge({ status, size = 12 }: { status?: string | null; size?: number }) {
  const s = BADGE_STYLES[status as KycStatus];
  if (!s) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: size - 1, fontWeight: 600, color: 'var(--muted)', background: 'var(--chip-bg)' }}>
        No KYC
      </span>
    );
  }
  const Icon = s.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, fontSize: size - 1, fontWeight: 700, color: s.color, background: s.bg }}>
      <Icon size={size} /> {s.label}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 };

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface MockDoc { id: number; docType: string; fileName: string | null; expiryDate: string | null; createdAt: string }

export function Profile() {
  const [status, setStatus] = useState<KycStatus>('draft');
  const [toast, setToast] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MockDoc[]>([
    { id: 1, docType: 'pan', fileName: 'pan-card.jpg', expiryDate: null, createdAt: '2026-06-28T10:00:00Z' },
    { id: 2, docType: 'gst', fileName: 'gst-certificate.jpg', expiryDate: null, createdAt: '2026-07-01T09:30:00Z' },
    { id: 3, docType: 'driving_license', fileName: 'dl-front.jpg', expiryDate: '2027-03-14', createdAt: '2026-07-02T14:12:00Z' },
  ]);

  const [legalName, setLegalName] = useState('Sharma Constructions Pvt Ltd');
  const [gstNumber, setGstNumber] = useState('27AABCS1234F1Z6');
  const [panNumber, setPanNumber] = useState('AABCS1234F');
  const [dlNumber, setDlNumber] = useState('');
  const [dlExpiry, setDlExpiry] = useState('');
  const [aadhaarLast4, setAadhaarLast4] = useState('4821');
  const [notes, setNotes] = useState('');

  const [docType, setDocType] = useState('pan');
  const [docExpiry, setDocExpiry] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const locked = status === 'approved';

  const uploadDoc = (file: File) => {
    setDocuments(docs => [...docs, {
      id: Math.max(0, ...docs.map(d => d.id)) + 1,
      docType, fileName: file.name, expiryDate: docExpiry || null, createdAt: new Date().toISOString(),
    }]);
    setDocExpiry('');
    showToast('Document uploaded');
  };

  return (
    <div className="kyc-mock-root">
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 99, padding: '10px 16px', borderRadius: 12, background: 'var(--text)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={22} style={{ color: 'var(--gold)' }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>KYC &amp; Verification</h1>
          <VerifiedBadge status={status} size={13} />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Complete your identity verification to unlock a verified badge on your account.
        </p>

        {status === 'rejected' && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12,
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--red)',
            fontSize: 13, marginBottom: 16,
          }}>
            <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <strong>Verification was rejected by Anita Rao.</strong>
              <div>GST certificate is unreadable — please upload a clearer scan.</div>
              <div style={{ marginTop: 2, color: 'var(--muted)' }}>Fix the issues below and submit again.</div>
            </div>
          </div>
        )}
        {status === 'submitted' && (
          <div style={{
            padding: '10px 14px', borderRadius: 12, background: 'color-mix(in srgb, var(--gold) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)', color: 'var(--gold)', fontSize: 13, marginBottom: 16,
          }}>
            Your KYC is under review. Editing any detail will withdraw the submission.
          </div>
        )}
        {locked && (
          <div style={{
            padding: '10px 14px', borderRadius: 12, background: 'rgba(34,197,94,.1)',
            border: '1px solid rgba(34,197,94,.3)', color: 'var(--green)', fontSize: 13, marginBottom: 16,
          }}>
            Your identity is verified (approved 05 Jul 2026). Contact an administrator to change these details.
          </div>
        )}

        <div style={{ background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>Identity details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>Legal / registered name</label>
              <input style={inputStyle} value={legalName} onChange={e => setLegalName(e.target.value)} disabled={locked} placeholder="As per PAN / GST" />
            </div>
            <div>
              <label style={labelStyle}>GST number (GSTIN)</label>
              <input style={inputStyle} value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} disabled={locked} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
            <div>
              <label style={labelStyle}>PAN</label>
              <input style={inputStyle} value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} disabled={locked} placeholder="AAAPL1234C" maxLength={10} />
            </div>
            <div>
              <label style={labelStyle}>Aadhaar — last 4 digits only</label>
              <input style={inputStyle} value={aadhaarLast4} onChange={e => setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} disabled={locked} placeholder="1234" maxLength={4} inputMode="numeric" />
            </div>
            <div>
              <label style={labelStyle}>Driving licence number</label>
              <input style={inputStyle} value={dlNumber} onChange={e => setDlNumber(e.target.value)} disabled={locked} placeholder="For drivers" />
            </div>
            <div>
              <label style={labelStyle}>Driving licence expiry</label>
              <input type="date" style={inputStyle} value={dlExpiry} onChange={e => setDlExpiry(e.target.value)} disabled={locked} />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Notes for the reviewer (optional)</label>
            <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} disabled={locked} placeholder="Anything the reviewer should know" />
          </div>
          {!locked && (
            <button
              onClick={() => showToast('KYC details saved')}
              style={{
                marginTop: 14, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: 13,
              }}
            >
              Save details
            </button>
          )}
        </div>

        <div style={{ background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>Documents</h2>
          {documents.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>No documents uploaded yet.</div>
          )}
          {documents.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
              border: '1px solid var(--line)', marginBottom: 8, background: 'var(--chip-bg)',
            }}>
              <FileText size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{DOC_LABEL[d.docType] ?? d.docType}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {d.fileName ?? 'document'} · uploaded {fmtDate(d.createdAt)}
                  {d.expiryDate ? ` · expires ${fmtDate(d.expiryDate)}` : ''}
                </div>
              </div>
              <button onClick={() => showToast('Opens the stored scan in a new tab')} title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6 }}>
                <Eye size={16} />
              </button>
              {!locked && (
                <button onClick={() => { setDocuments(docs => docs.filter(x => x.id !== d.id)); showToast('Document removed'); }} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 6 }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          {!locked && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
              <div style={{ minWidth: 180 }}>
                <label style={labelStyle}>Document type</label>
                <select style={inputStyle} value={docType} onChange={e => setDocType(e.target.value)}>
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Expiry (if any)</label>
                <input type="date" style={inputStyle} value={docExpiry} onChange={e => setDocExpiry(e.target.value)} />
              </div>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
                border: '1px dashed var(--gold)', color: 'var(--gold)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
                <Upload size={15} /> Upload photo/scan
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) uploadDoc(f);
                  }}
                />
              </label>
            </div>
          )}
        </div>

        {!locked && status !== 'submitted' && (
          <button
            onClick={() => { setStatus('submitted'); showToast('KYC submitted for verification'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12,
              border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#fff', fontWeight: 800, fontSize: 14,
            }}
          >
            <Send size={16} /> Submit for verification
          </button>
        )}

        <div style={{ marginTop: 26, padding: '10px 14px', borderRadius: 12, border: '1px dashed var(--line)', color: 'var(--muted)', fontSize: 12 }}>
          Demo preview — try the states:{' '}
          {(['draft', 'submitted', 'approved', 'rejected'] as KycStatus[]).map(s => (
            <button key={s} onClick={() => setStatus(s)} style={{
              margin: '0 4px', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (status === s ? 'var(--gold)' : 'var(--line)'),
              background: status === s ? 'var(--gold-soft)' : 'transparent',
              color: status === s ? 'var(--gold)' : 'var(--muted)',
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
