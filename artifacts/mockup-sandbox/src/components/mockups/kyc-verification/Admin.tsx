import './_group.css';
import { useState } from 'react';
import {
  BadgeCheck, X, FileText, Eye, CheckCircle2, XCircle, Clock, Truck, Upload, Send, History,
  FileEdit,
} from 'lucide-react';

type KycStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

const DOC_LABEL: Record<string, string> = {
  gst: 'GST Certificate', pan: 'PAN Card', aadhaar: 'Aadhaar (masked)', driving_license: 'Driving Licence',
  rc: 'Vehicle RC', insurance: 'Insurance', puc: 'PUC Certificate', fitness: 'Fitness Certificate',
  photo: 'Photograph', other: 'Other Document',
};

const BADGE_STYLES: Record<KycStatus, { color: string; bg: string; icon: typeof BadgeCheck; label: string }> = {
  draft:     { color: 'var(--muted)', bg: 'var(--chip-bg)', icon: FileEdit, label: 'Draft' },
  submitted: { color: 'var(--gold)', bg: 'color-mix(in srgb, var(--gold) 12%, transparent)', icon: Clock, label: 'Under Review' },
  approved:  { color: 'var(--green)', bg: 'rgba(34,197,94,.12)', icon: BadgeCheck, label: 'Verified' },
  rejected:  { color: 'var(--red)', bg: 'rgba(239,68,68,.12)', icon: XCircle, label: 'Rejected' },
};

function VerifiedBadge({ status, showEmpty = false, size = 12 }: { status?: string | null; showEmpty?: boolean; size?: number }) {
  const s = BADGE_STYLES[status as KycStatus];
  if (!s) {
    if (!showEmpty) return null;
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

interface ProfileRow {
  id: number;
  entityType: 'customer' | 'driver' | 'staff' | 'plant_owner' | 'vehicle';
  status: KycStatus;
  legalName: string | null;
  subjectName: string | null;
  subjectEmail: string | null;
  subjectRole: string | null;
  vehicleNo: string | null;
  docCount: number;
  submittedAt: string | null;
  reviewedByName: string | null;
  aadhaarMasked?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  dlNumber?: string | null;
  dlExpiry?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
}

const ENTITY_LABEL: Record<string, string> = {
  customer: 'Customer', driver: 'Driver', staff: 'Staff', plant_owner: 'Plant Owner', vehicle: 'Vehicle',
};

const TABS = [
  { id: 'queue', label: 'Review Queue' },
  { id: 'all', label: 'All Profiles' },
  { id: 'expiring', label: 'Expiring Docs' },
  { id: 'vehicles', label: 'Vehicle KYC' },
] as const;
type TabId = typeof TABS[number]['id'];

const cardStyle: React.CSSProperties = {
  background: 'var(--glass-1)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 16,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 };

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function subjectLabel(r: { entityType: string; subjectName?: string | null; vehicleNo?: string | null; legalName?: string | null }): string {
  if (r.entityType === 'vehicle') return r.vehicleNo ? `Vehicle ${r.vehicleNo}` : 'Vehicle';
  return r.subjectName ?? r.legalName ?? 'Unknown';
}

const MOCK_ROWS: ProfileRow[] = [
  { id: 1, entityType: 'customer', status: 'submitted', legalName: 'Sharma Constructions Pvt Ltd', subjectName: 'Rajesh Sharma', subjectEmail: 'rajesh@sharmaconstructions.in', subjectRole: 'client', vehicleNo: null, docCount: 3, submittedAt: '2026-07-06T09:10:00Z', reviewedByName: null, gstNumber: '27AABCS1234F1Z6', panNumber: 'AABCS1234F', aadhaarMasked: 'XXXX-XXXX-4821', notes: 'GST certificate reissued in June.' },
  { id: 2, entityType: 'driver', status: 'submitted', legalName: 'Sunil Yadav', subjectName: 'Sunil Yadav', subjectEmail: 'sunil.yadav@otp.local', subjectRole: 'driver', vehicleNo: null, docCount: 2, submittedAt: '2026-07-07T15:42:00Z', reviewedByName: null, dlNumber: 'MH12 20210012345', dlExpiry: '2027-03-14', aadhaarMasked: 'XXXX-XXXX-9034' },
  { id: 3, entityType: 'plant_owner', status: 'approved', legalName: 'Patil RMC Industries', subjectName: 'Vikram Patil', subjectEmail: 'vikram@patilrmc.com', subjectRole: 'plant_owner', vehicleNo: null, docCount: 4, submittedAt: '2026-07-01T11:00:00Z', reviewedByName: 'Anita Rao', gstNumber: '27AAFCP8765K1Z3', panNumber: 'AAFCP8765K' },
  { id: 4, entityType: 'vehicle', status: 'approved', legalName: 'Patil RMC Industries', subjectName: null, subjectEmail: null, subjectRole: null, vehicleNo: 'MH04 AB 1234', docCount: 4, submittedAt: '2026-06-25T08:20:00Z', reviewedByName: 'Anita Rao' },
  { id: 5, entityType: 'staff', status: 'rejected', legalName: 'Prakash Kumbhar', subjectName: 'Prakash Kumbhar', subjectEmail: 'prakash@trackmyrmc.com', subjectRole: 'supervisor', vehicleNo: null, docCount: 1, submittedAt: '2026-07-03T10:05:00Z', reviewedByName: 'Anita Rao', rejectionReason: 'PAN photo is cropped — corners not visible.' },
];

const MOCK_DOCS: Record<number, { id: number; docType: string; fileName: string | null; expiryDate: string | null; createdAt: string }[]> = {
  1: [
    { id: 11, docType: 'gst', fileName: 'gst-certificate.jpg', expiryDate: null, createdAt: '2026-07-01T09:30:00Z' },
    { id: 12, docType: 'pan', fileName: 'pan-card.jpg', expiryDate: null, createdAt: '2026-06-28T10:00:00Z' },
    { id: 13, docType: 'photo', fileName: 'passport-photo.jpg', expiryDate: null, createdAt: '2026-06-28T10:02:00Z' },
  ],
  2: [
    { id: 21, docType: 'driving_license', fileName: 'dl-front.jpg', expiryDate: '2027-03-14', createdAt: '2026-07-07T15:20:00Z' },
    { id: 22, docType: 'aadhaar', fileName: 'aadhaar-masked.jpg', expiryDate: null, createdAt: '2026-07-07T15:25:00Z' },
  ],
  3: [
    { id: 31, docType: 'gst', fileName: 'gst.pdf.jpg', expiryDate: null, createdAt: '2026-06-30T12:00:00Z' },
    { id: 32, docType: 'pan', fileName: 'company-pan.jpg', expiryDate: null, createdAt: '2026-06-30T12:03:00Z' },
    { id: 33, docType: 'photo', fileName: 'owner-photo.jpg', expiryDate: null, createdAt: '2026-06-30T12:05:00Z' },
    { id: 34, docType: 'other', fileName: 'factory-licence.jpg', expiryDate: '2026-12-31', createdAt: '2026-06-30T12:08:00Z' },
  ],
  4: [
    { id: 41, docType: 'rc', fileName: 'rc-book.jpg', expiryDate: null, createdAt: '2026-06-24T09:00:00Z' },
    { id: 42, docType: 'insurance', fileName: 'insurance-policy.jpg', expiryDate: '2026-08-02', createdAt: '2026-06-24T09:04:00Z' },
    { id: 43, docType: 'puc', fileName: 'puc.jpg', expiryDate: '2026-07-21', createdAt: '2026-06-24T09:06:00Z' },
    { id: 44, docType: 'fitness', fileName: 'fitness-cert.jpg', expiryDate: '2027-01-15', createdAt: '2026-06-24T09:08:00Z' },
  ],
  5: [
    { id: 51, docType: 'pan', fileName: 'pan.jpg', expiryDate: null, createdAt: '2026-07-03T09:50:00Z' },
  ],
};

const MOCK_HISTORY: Record<number, { id: number; actorName: string | null; action: string; detail: string; createdAt: string }[]> = {
  1: [
    { id: 1, actorName: 'Rajesh Sharma', action: 'kyc.submit', detail: 'Submitted KYC profile for review (3 documents)', createdAt: '2026-07-06T09:10:00Z' },
    { id: 2, actorName: 'Rajesh Sharma', action: 'kyc.document.add', detail: 'Uploaded GST Certificate', createdAt: '2026-07-01T09:30:00Z' },
    { id: 3, actorName: 'Rajesh Sharma', action: 'kyc.update', detail: 'Updated identity details', createdAt: '2026-06-28T10:05:00Z' },
  ],
  2: [
    { id: 4, actorName: 'Sunil Yadav', action: 'kyc.submit', detail: 'Submitted KYC profile for review (2 documents)', createdAt: '2026-07-07T15:42:00Z' },
  ],
  3: [
    { id: 5, actorName: 'Anita Rao', action: 'kyc.approve', detail: 'Approved KYC profile', createdAt: '2026-07-05T10:00:00Z' },
    { id: 6, actorName: 'Vikram Patil', action: 'kyc.submit', detail: 'Submitted KYC profile for review (4 documents)', createdAt: '2026-07-01T11:00:00Z' },
  ],
  4: [
    { id: 7, actorName: 'Anita Rao', action: 'kyc.approve', detail: 'Approved vehicle KYC', createdAt: '2026-06-26T09:00:00Z' },
  ],
  5: [
    { id: 8, actorName: 'Anita Rao', action: 'kyc.reject', detail: 'Rejected: PAN photo is cropped — corners not visible.', createdAt: '2026-07-04T09:12:00Z' },
    { id: 9, actorName: 'Prakash Kumbhar', action: 'kyc.submit', detail: 'Submitted KYC profile for review (1 document)', createdAt: '2026-07-03T10:05:00Z' },
  ],
};

const MOCK_EXPIRING = [
  { id: 43, docType: 'puc', fileName: 'puc.jpg', expiryDate: '2026-07-21', profileId: 4, entityType: 'vehicle', subjectName: null, vehicleNo: 'MH04 AB 1234' },
  { id: 42, docType: 'insurance', fileName: 'insurance-policy.jpg', expiryDate: '2026-08-02', profileId: 4, entityType: 'vehicle', subjectName: null, vehicleNo: 'MH04 AB 1234' },
  { id: 99, docType: 'fitness', fileName: 'fitness-old.jpg', expiryDate: '2026-07-02', profileId: 4, entityType: 'vehicle', subjectName: null, vehicleNo: 'MH09 XY 7788' },
];

const MOCK_VEHICLES = [
  { id: 1, vehicleNo: 'MH04 AB 1234', type: 'Transit Mixer', badge: 'approved' as string | undefined },
  { id: 2, vehicleNo: 'MH09 XY 7788', type: 'Transit Mixer', badge: 'submitted' as string | undefined },
  { id: 3, vehicleNo: 'MH12 QT 5521', type: 'Concrete Pump', badge: undefined },
];

export function Admin() {
  const [tab, setTab] = useState<TabId>('queue');
  const [rows, setRows] = useState<ProfileRow[]>(MOCK_ROWS);
  const [expiryDays, setExpiryDays] = useState(30);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [vehicleEdit, setVehicleEdit] = useState<typeof MOCK_VEHICLES[number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  };

  const visible = tab === 'queue' ? rows.filter(r => r.status === 'submitted') : rows;
  const detail = detailId != null ? rows.find(r => r.id === detailId) ?? null : null;
  const expiring = MOCK_EXPIRING.filter(d => {
    const days = (new Date(d.expiryDate).getTime() - new Date('2026-07-08').getTime()) / 86400000;
    return days <= expiryDays;
  });

  const decide = (decision: 'approve' | 'reject') => {
    if (!detail) return;
    if (decision === 'reject' && !rejectReason.trim()) {
      showToast('Enter a rejection reason first');
      return;
    }
    setRows(rs => rs.map(r => r.id === detail.id
      ? { ...r, status: decision === 'approve' ? 'approved' : 'rejected', reviewedByName: 'You', rejectionReason: decision === 'reject' ? rejectReason.trim() : r.rejectionReason }
      : r));
    showToast(decision === 'approve' ? 'KYC approved' : 'KYC rejected');
    setDetailId(null);
    setRejectReason('');
  };

  return (
    <div className="kyc-mock-root">
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 99, padding: '10px 16px', borderRadius: 12, background: 'var(--text)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <BadgeCheck size={22} style={{ color: 'var(--gold)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>KYC &amp; Verification</h1>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Review identity submissions, manage vehicle compliance documents and track expiries.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 15px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (tab === t.id ? 'var(--gold)' : 'var(--line)'),
              background: tab === t.id ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'transparent',
              color: tab === t.id ? 'var(--gold)' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'queue' || tab === 'all') && (
        <div style={{ display: 'grid', gap: 8 }}>
          {visible.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>
              {tab === 'queue' ? 'No submissions waiting for review.' : 'No KYC profiles yet.'}
            </div>
          )}
          {visible.map(r => (
            <button
              key={r.id}
              onClick={() => { setDetailId(r.id); setRejectReason(''); }}
              style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {subjectLabel(r)}
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 999, padding: '1px 8px' }}>
                    {ENTITY_LABEL[r.entityType] ?? r.entityType}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {r.docCount} document{r.docCount === 1 ? '' : 's'}
                  {r.submittedAt ? ` · submitted ${fmtDate(r.submittedAt)}` : ''}
                  {r.reviewedByName ? ` · reviewed by ${r.reviewedByName}` : ''}
                </div>
              </div>
              <VerifiedBadge status={r.status} size={13} />
            </button>
          ))}
        </div>
      )}

      {tab === 'expiring' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Documents expiring within</span>
            {[30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => setExpiryDays(d)}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid ' + (expiryDays === d ? 'var(--gold)' : 'var(--line)'),
                  background: expiryDays === d ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'transparent',
                  color: expiryDays === d ? 'var(--gold)' : 'var(--muted)',
                }}
              >
                {d} days
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {expiring.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>
                Nothing expires within {expiryDays} days.
              </div>
            )}
            {expiring.map(d => {
              const overdue = new Date(d.expiryDate) < new Date('2026-07-08');
              return (
                <button key={d.id} onClick={() => setDetailId(d.profileId)} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                  <Clock size={18} style={{ color: overdue ? 'var(--red)' : 'var(--gold)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {DOC_LABEL[d.docType] ?? d.docType} — {subjectLabel(d)}
                    </div>
                    <div style={{ fontSize: 12, color: overdue ? 'var(--red)' : 'var(--muted)' }}>
                      {overdue ? 'EXPIRED' : 'Expires'} {fmtDate(d.expiryDate)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'vehicles' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {MOCK_VEHICLES.map(v => (
            <button key={v.id} onClick={() => setVehicleEdit(v)} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <Truck size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.vehicleNo}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.type}</div>
              </div>
              <VerifiedBadge status={v.badge} showEmpty size={13} />
            </button>
          ))}
        </div>
      )}

      {detail && (
        <DrawerShell onClose={() => setDetailId(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>KYC Profile</h2>
            <button onClick={() => setDetailId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{subjectLabel(detail)}</span>
            <VerifiedBadge status={detail.status} size={13} />
          </div>
          {detail.subjectEmail && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              {detail.subjectEmail}{detail.subjectRole ? ` · ${detail.subjectRole}` : ''}
            </div>
          )}

          <div style={{ ...cardStyle, marginBottom: 14 }}>
            {([
              ['Legal name', detail.legalName],
              ['GSTIN', detail.gstNumber],
              ['PAN', detail.panNumber],
              ['Aadhaar', detail.aadhaarMasked],
              ['DL number', detail.dlNumber],
              ['DL expiry', detail.dlExpiry ? fmtDate(detail.dlExpiry) : null],
              ['Notes', detail.notes],
            ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            {detail.rejectionReason && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                Last rejection: {detail.rejectionReason}
              </div>
            )}
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Documents ({(MOCK_DOCS[detail.id] ?? []).length})</h3>
          {(MOCK_DOCS[detail.id] ?? []).map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 6 }}>
              <FileText size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{DOC_LABEL[d.docType] ?? d.docType}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {fmtDate(d.createdAt)}{d.expiryDate ? ` · expires ${fmtDate(d.expiryDate)}` : ''}
                </div>
              </div>
              <span style={{ color: 'var(--muted)' }} title="View"><Eye size={15} /></span>
            </div>
          ))}

          {detail.status === 'submitted' && (
            <div style={{ ...cardStyle, marginTop: 14 }}>
              <label style={labelStyle}>Rejection reason (required to reject)</label>
              <input style={inputStyle} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. GST certificate is unreadable" />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => decide('approve')}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--green)', color: '#fff', fontWeight: 800, fontSize: 13 }}
                >
                  <CheckCircle2 size={15} /> Approve
                </button>
                <button
                  onClick={() => decide('reject')}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 13 }}
                >
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </div>
          )}

          {(MOCK_HISTORY[detail.id] ?? []).length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={14} /> History
              </h3>
              {(MOCK_HISTORY[detail.id] ?? []).map(h => (
                <div key={h.id} style={{ fontSize: 12, color: 'var(--muted)', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{h.actorName ?? 'System'}</span>
                  {' — '}{h.detail}
                  <span style={{ float: 'right' }}>{fmtDate(h.createdAt)}</span>
                </div>
              ))}
            </>
          )}
        </DrawerShell>
      )}

      {vehicleEdit && (
        <VehicleKycDrawer vehicle={vehicleEdit} onClose={() => setVehicleEdit(null)} onToast={showToast} />
      )}
    </div>
  );
}

function DrawerShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(480px, 100vw)', height: '100%', overflowY: 'auto', background: 'var(--bg)',
          borderLeft: '1px solid var(--glass-border)', padding: 20, boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function VehicleKycDrawer({ vehicle, onClose, onToast }: { vehicle: { id: number; vehicleNo: string; type: string; badge?: string }; onClose: () => void; onToast: (m: string) => void }) {
  const [status, setStatus] = useState<string | null>(vehicle.badge ?? null);
  const [legalName, setLegalName] = useState(vehicle.badge ? 'Patil RMC Industries' : '');
  const [notes, setNotes] = useState('');
  const [docType, setDocType] = useState('rc');
  const [docExpiry, setDocExpiry] = useState('');
  const [docs, setDocs] = useState(vehicle.badge === 'approved' ? (MOCK_VEHICLE_DOCS) : []);

  const locked = status === 'approved';
  const VEHICLE_DOCS = ['rc', 'insurance', 'puc', 'fitness', 'other'];

  return (
    <DrawerShell onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Vehicle KYC — {vehicle.vehicleNo}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
      </div>
      <div style={{ marginBottom: 12 }}><VerifiedBadge status={status} showEmpty size={13} /></div>
      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Registered owner name</label>
          <input style={inputStyle} value={legalName} onChange={e => setLegalName(e.target.value)} disabled={locked} placeholder="As per RC" />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} disabled={locked} />
        </div>
        {!locked && (
          <button onClick={() => onToast('Vehicle KYC saved')} style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: 13 }}>
            Save
          </button>
        )}
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Documents</h3>
      {docs.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>No documents yet.</div>}
      {docs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 6 }}>
          <FileText size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{DOC_LABEL[d.docType] ?? d.docType}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {fmtDate(d.createdAt)}{d.expiryDate ? ` · expires ${fmtDate(d.expiryDate)}` : ''}
            </div>
          </div>
        </div>
      ))}

      {!locked && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginTop: 10 }}>
          <div style={{ minWidth: 150 }}>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={docType} onChange={e => setDocType(e.target.value)}>
              {VEHICLE_DOCS.map(v => <option key={v} value={v}>{DOC_LABEL[v] ?? v}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Expiry</label>
            <input type="date" style={inputStyle} value={docExpiry} onChange={e => setDocExpiry(e.target.value)} />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px dashed var(--gold)', color: 'var(--gold)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            <Upload size={14} /> Upload
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  setDocs(ds => [...ds, { id: Math.max(0, ...ds.map(x => x.id)) + 1, docType, fileName: f.name, expiryDate: docExpiry || null, createdAt: new Date().toISOString() }]);
                  setDocExpiry('');
                  onToast('Document uploaded');
                }
              }}
            />
          </label>
        </div>
      )}

      {!locked && status && status !== 'submitted' && (
        <button onClick={() => { setStatus('submitted'); onToast('Vehicle KYC submitted for review'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#fff', fontWeight: 800, fontSize: 13 }}>
          <Send size={14} /> Submit for verification
        </button>
      )}
    </DrawerShell>
  );
}

const MOCK_VEHICLE_DOCS = [
  { id: 41, docType: 'rc', fileName: 'rc-book.jpg', expiryDate: null as string | null, createdAt: '2026-06-24T09:00:00Z' },
  { id: 42, docType: 'insurance', fileName: 'insurance-policy.jpg', expiryDate: '2026-08-02' as string | null, createdAt: '2026-06-24T09:04:00Z' },
  { id: 43, docType: 'puc', fileName: 'puc.jpg', expiryDate: '2026-07-21' as string | null, createdAt: '2026-06-24T09:06:00Z' },
  { id: 44, docType: 'fitness', fileName: 'fitness-cert.jpg', expiryDate: '2027-01-15' as string | null, createdAt: '2026-06-24T09:08:00Z' },
];
