import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { compressImage, uploadImageToStorage } from '@/lib/imageUpload';
import { useToast } from '@/lib/toast';
import VerifiedBadge from '@/components/VerifiedBadge';
import { DOC_TYPES, DOC_LABEL } from '@/lib/kycDocTypes';
import {
  ShieldCheck, Upload, Trash2, Eye, Send, AlertCircle, FileText, Loader2,
} from 'lucide-react';

interface KycProfileData {
  id: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  legalName: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  dlNumber: string | null;
  dlExpiry: string | null;
  aadhaarMasked: string | null;
  notes: string | null;
  rejectionReason: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
}

interface KycDoc {
  id: number;
  docType: string;
  fileName: string | null;
  expiryDate: string | null;
  createdAt: string;
}


const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 14,
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 };

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function KycProfile() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<KycProfileData | null>(null);
  const [documents, setDocuments] = useState<KycDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [legalName, setLegalName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dlExpiry, setDlExpiry] = useState('');
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [notes, setNotes] = useState('');

  const [docType, setDocType] = useState('pan');
  const [docExpiry, setDocExpiry] = useState('');

  const applyProfile = useCallback((p: KycProfileData | null, docs: KycDoc[]) => {
    setProfile(p);
    setDocuments(docs);
    if (p) {
      setLegalName(p.legalName ?? '');
      setGstNumber(p.gstNumber ?? '');
      setPanNumber(p.panNumber ?? '');
      setDlNumber(p.dlNumber ?? '');
      setDlExpiry(p.dlExpiry ?? '');
      setAadhaarLast4(p.aadhaarMasked ? p.aadhaarMasked.slice(-4) : '');
      setNotes(p.notes ?? '');
    }
  }, []);

  const load = useCallback(() => {
    return api.get<{ profile: KycProfileData | null; documents: KycDoc[] }>('/kyc-verification/me')
      .then(({ profile: p, documents: docs }) => applyProfile(p, docs))
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [applyProfile, showToast]);

  useEffect(() => { load(); }, [load]);

  const locked = profile?.status === 'approved';

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/kyc-verification/me', {
        legalName, gstNumber, panNumber, dlNumber, dlExpiry, aadhaarMasked: aadhaarLast4, notes,
      });
      showToast('KYC details saved', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/kyc-verification/me/submit', {});
      showToast('KYC submitted for verification', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not submit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await compressImage(file, 1600, 0.8);
      const objectPath = await uploadImageToStorage(dataUrl, '/kyc-verification/upload-url');
      await api.post('/kyc-verification/me/documents', {
        docType, objectPath, expiryDate: docExpiry || null, fileName: file.name,
      });
      showToast('Document uploaded', 'success');
      setDocExpiry('');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (id: number) => {
    if (!window.confirm('Remove this document?')) return;
    try {
      await api.delete(`/kyc-verification/me/documents/${id}`);
      showToast('Document removed', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not remove', 'error');
    }
  };

  const viewDoc = async (id: number) => {
    try {
      const { url } = await api.get<{ url: string | null }>(`/kyc-verification/me/documents/${id}/url`);
      if (url) window.open(url, '_blank', 'noopener');
      else showToast('Document is unavailable', 'error');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not open document', 'error');
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}><Loader2 className="spin" size={22} /> Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={22} style={{ color: 'var(--gold)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>KYC &amp; Verification</h1>
        <VerifiedBadge status={profile?.status} showEmpty size={13} />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 18 }}>
        Complete your identity verification to unlock a verified badge on your account.
      </p>

      {profile?.status === 'rejected' && profile.rejectionReason && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 12,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--red)',
          fontSize: 13, marginBottom: 16,
        }}>
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <strong>Verification was rejected{profile.reviewedByName ? ` by ${profile.reviewedByName}` : ''}.</strong>
            <div>{profile.rejectionReason}</div>
            <div style={{ marginTop: 2, color: 'var(--muted)' }}>Fix the issues below and submit again.</div>
          </div>
        </div>
      )}
      {profile?.status === 'submitted' && (
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
          Your identity is verified{profile?.reviewedAt ? ` (approved ${fmtDate(profile.reviewedAt)})` : ''}. Contact an administrator to change these details.
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
            onClick={saveProfile}
            disabled={saving}
            style={{
              marginTop: 14, padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: 13, opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save details'}
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
            <button onClick={() => viewDoc(d.id)} title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 6 }}>
              <Eye size={16} />
            </button>
            {!locked && (
              <button onClick={() => removeDoc(d.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 6 }}>
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
              border: '1px dashed var(--gold)', color: 'var(--gold)', fontWeight: 700, fontSize: 13,
              cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1,
            }}>
              <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload photo/scan'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                disabled={uploading}
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

      {!locked && profile && profile.status !== 'submitted' && (
        <button
          onClick={submit}
          disabled={saving}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 12,
            border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#fff', fontWeight: 800,
            fontSize: 14, opacity: saving ? 0.6 : 1,
          }}
        >
          <Send size={16} /> Submit for verification
        </button>
      )}
    </div>
  );
}
