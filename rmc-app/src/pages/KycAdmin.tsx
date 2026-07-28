import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { compressImage, uploadImageToStorage } from '@/lib/imageUpload';
import VerifiedBadge from '@/components/VerifiedBadge';
import { DOC_LABEL } from '@/lib/kycDocTypes';
import {
  BadgeCheck, X, FileText, Eye, Loader2, CheckCircle2, XCircle, Clock, Truck, Upload, Send, History,
} from 'lucide-react';

interface ProfileRow {
  id: number;
  entityType: 'customer' | 'driver' | 'staff' | 'plant_owner' | 'vehicle';
  status: 'pending' | 'submitted' | 'under_review' | 'verified' | 'rejected' | 'suspended' | 'expired' | 'revoked';
  legalName: string | null;
  subjectName: string | null;
  subjectEmail: string | null;
  subjectRole: string | null;
  vehicleNo: string | null;
  docCount: number;
  submittedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

interface ProfileDetail {
  profile: ProfileRow & {
    gstNumber: string | null;
    panNumber: string | null;
    dlNumber: string | null;
    dlExpiry: string | null;
    aadhaarMasked: string | null;
    notes: string | null;
    rejectionReason: string | null;
  };
  documents: { id: number; docType: string; fileName: string | null; expiryDate: string | null; createdAt: string; url: string | null }[];
  history: { id: number; actorName: string | null; action: string; detail: string | null; createdAt: string }[];
}

interface ExpiringRow {
  id: number;
  docType: string;
  fileName: string | null;
  expiryDate: string;
  profileId: number;
  entityType: string;
  subjectName: string | null;
  vehicleNo: string | null;
}

interface VehicleRow { id: number; vehicleNo: string; type: string | null }

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
  background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 13,
};
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 };

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function subjectLabel(r: { entityType: string; subjectName?: string | null; vehicleNo?: string | null; legalName?: string | null }): string {
  if (r.entityType === 'vehicle') return r.vehicleNo ? `Vehicle ${r.vehicleNo}` : 'Vehicle';
  return r.subjectName ?? r.legalName ?? 'Unknown';
}

export default function KycAdmin() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabId>('queue');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [expiring, setExpiring] = useState<ExpiringRow[]>([]);
  const [expiryDays, setExpiryDays] = useState(30);
  const [vehiclesList, setVehiclesList] = useState<VehicleRow[]>([]);
  const [vehicleBadges, setVehicleBadges] = useState<Record<number, string>>({});

  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [acting, setActing] = useState(false);

  const [vehicleEdit, setVehicleEdit] = useState<VehicleRow | null>(null);

  const load = useCallback(() => {
    if (tab === 'expiring') {
      return api.get<ExpiringRow[]>(`/kyc-verification/expiring?days=${expiryDays}`)
        .then(setExpiring)
        .catch((e: Error) => showToast(e.message, 'error'))
        .finally(() => setLoading(false));
    }
    if (tab === 'vehicles') {
      return api.get<VehicleRow[]>('/vehicles')
        .then((vs) => {
          setVehiclesList(vs);
          if (vs.length === 0) return;
          return api.get<Record<number, string>>(`/kyc-verification/badges?entity=vehicle&ids=${vs.map(v => v.id).join(',')}`)
            .then(setVehicleBadges);
        })
        .catch((e: Error) => showToast(e.message, 'error'))
        .finally(() => setLoading(false));
    }
    // Show both "submitted" (awaiting first review) AND "under_review" (assigned but
    // not yet decided) so no application falls off the reviewer's radar.
    const qs = tab === 'queue' ? '?status=submitted,under_review' : '';
    return api.get<ProfileRow[]>(`/kyc-verification/profiles${qs}`)
      .then(setRows)
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [tab, expiryDays, showToast]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (id: number) => {
    setDetailLoading(true);
    setRejectReason('');
    api.get<ProfileDetail>(`/kyc-verification/profiles/${id}`)
      .then(setDetail)
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setDetailLoading(false));
  };

  const decide = async (decision: 'approve' | 'reject') => {
    if (!detail) return;
    if (decision === 'reject' && !rejectReason.trim()) {
      showToast('Enter a rejection reason first', 'error');
      return;
    }
    setActing(true);
    try {
      await api.post(`/kyc-verification/profiles/${detail.profile.id}/${decision}`, decision === 'reject' ? { reason: rejectReason.trim() } : {});
      showToast(decision === 'approve' ? 'KYC verified' : 'KYC rejected', 'success');
      setDetail(null);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Action failed', 'error');
    } finally {
      setActing(false);
    }
  };

  const transition = async (status: 'suspended' | 'verified' | 'revoked') => {
    if (!detail) return;
    if (!rejectReason.trim()) { showToast('Enter an administrative reason first', 'error'); return; }
    setActing(true);
    try {
      await api.post(`/kyc-verification/profiles/${detail.profile.id}/transition`, { status, reason: rejectReason.trim() });
      showToast(`KYC status changed to ${status.replace('_', ' ')}`, 'success');
      setDetail(null); await load();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Action failed', 'error'); }
    finally { setActing(false); }
  };

  return (
    <div>
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
            onClick={() => { setLoading(true); setTab(t.id); }}
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

      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}><Loader2 className="spin" size={20} /> Loading…</div>}

      {!loading && (tab === 'queue' || tab === 'all') && (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>
              {tab === 'queue' ? 'No submissions waiting for review.' : 'No KYC profiles yet.'}
            </div>
          )}
          {rows.map(r => (
            <button
              key={r.id}
              onClick={() => openDetail(r.id)}
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

      {!loading && tab === 'expiring' && (
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Documents expiring within</span>
            {[30, 60, 90].map(d => (
              <button
                key={d}
                onClick={() => { setLoading(true); setExpiryDays(d); }}
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
              const overdue = new Date(d.expiryDate) < new Date();
              return (
                <button key={d.id} onClick={() => openDetail(d.profileId)} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
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

      {!loading && tab === 'vehicles' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {vehiclesList.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: 30 }}>No vehicles in the fleet yet.</div>
          )}
          {vehiclesList.map(v => (
            <button key={v.id} onClick={() => setVehicleEdit(v)} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <Truck size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.vehicleNo}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{v.type ?? 'Transit Mixer'}</div>
              </div>
              <VerifiedBadge status={vehicleBadges[v.id]} showEmpty size={13} />
            </button>
          ))}
        </div>
      )}

      {(detail || detailLoading) && (
        <DetailDrawer
          detail={detail}
          loading={detailLoading}
          acting={acting}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          onDecide={decide}
          onTransition={transition}
          onClose={() => setDetail(null)}
        />
      )}

      {vehicleEdit && (
        <VehicleKycDrawer
          vehicle={vehicleEdit}
          onClose={() => { setVehicleEdit(null); load(); }}
        />
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
          borderLeft: '1px solid var(--glass-border)', padding: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DetailDrawer({ detail, loading, acting, rejectReason, setRejectReason, onDecide, onTransition, onClose }: {
  detail: ProfileDetail | null;
  loading: boolean;
  acting: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  onDecide: (d: 'approve' | 'reject') => void;
  onTransition: (s: 'suspended' | 'verified' | 'revoked') => void;
  onClose: () => void;
}) {
  return (
    <DrawerShell onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>KYC Profile</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
      </div>
      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}><Loader2 className="spin" size={20} /></div>}
      {detail && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{subjectLabel(detail.profile)}</span>
            <VerifiedBadge status={detail.profile.status} size={13} />
          </div>
          {detail.profile.subjectEmail && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              {detail.profile.subjectEmail}{detail.profile.subjectRole ? ` · ${detail.profile.subjectRole}` : ''}
            </div>
          )}

          <div style={{ ...cardStyle, marginBottom: 14 }}>
            {[
              ['Legal name', detail.profile.legalName],
              ['GSTIN', detail.profile.gstNumber],
              ['PAN', detail.profile.panNumber],
              ['Aadhaar', detail.profile.aadhaarMasked],
              ['DL number', detail.profile.dlNumber],
              ['DL expiry', detail.profile.dlExpiry ? fmtDate(detail.profile.dlExpiry) : null],
              ['Notes', detail.profile.notes],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
            {detail.profile.rejectionReason && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                Last rejection: {detail.profile.rejectionReason}
              </div>
            )}
          </div>

          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Documents ({detail.documents.length})</h3>
          {detail.documents.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>No documents uploaded.</div>}
          {detail.documents.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 6 }}>
              <FileText size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{DOC_LABEL[d.docType] ?? d.docType}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {fmtDate(d.createdAt)}{d.expiryDate ? ` · expires ${fmtDate(d.expiryDate)}` : ''}
                </div>
              </div>
              {d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)' }} title="View">
                  <Eye size={15} />
                </a>
              )}
            </div>
          ))}

          {detail.profile.status === 'submitted' && (
            <div style={{ ...cardStyle, marginTop: 14 }}>
              <label style={labelStyle}>Rejection reason (required to reject)</label>
              <input style={inputStyle} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. GST certificate is unreadable" />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => onDecide('approve')}
                  disabled={acting}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--green)', color: '#fff', fontWeight: 800, fontSize: 13, opacity: acting ? 0.6 : 1 }}
                >
                  <CheckCircle2 size={15} /> Approve
                </button>
                <button
                  onClick={() => onDecide('reject')}
                  disabled={acting}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--red)', color: '#fff', fontWeight: 800, fontSize: 13, opacity: acting ? 0.6 : 1 }}
                >
                  <XCircle size={15} /> Reject
                </button>
              </div>
            </div>
          )}
          {(detail.profile.status === 'verified' || detail.profile.status === 'suspended') && (
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>Administrative reason (required)</label>
              <input style={inputStyle} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Record the reason for this decision" />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {detail.profile.status === 'verified' ? (
                  <button disabled={acting} onClick={() => onTransition('suspended')} style={{ ...inputStyle, cursor: 'pointer', color: 'var(--danger)' }}>Suspend</button>
                ) : (
                  <>
                    <button disabled={acting} onClick={() => onTransition('verified')} style={{ ...inputStyle, cursor: 'pointer', color: 'var(--success)' }}>Reactivate</button>
                    <button disabled={acting} onClick={() => onTransition('revoked')} style={{ ...inputStyle, cursor: 'pointer', color: 'var(--danger)' }}>Revoke</button>
                  </>
                )}
              </div>
            </div>
          )}

          {detail.history.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '16px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <History size={14} /> History
              </h3>
              {detail.history.map(h => (
                <div key={h.id} style={{ fontSize: 12, color: 'var(--muted)', padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--text)', fontWeight: 600 }}>{h.actorName ?? 'System'}</span>
                  {' — '}{(h.detail ?? h.action).replace(/^\[kyc#\d+\]\s*/, '')}
                  <span style={{ float: 'right' }}>{fmtDate(h.createdAt)}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </DrawerShell>
  );
}

function VehicleKycDrawer({ vehicle, onClose }: { vehicle: VehicleRow; onClose: () => void }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [docs, setDocs] = useState<{ id: number; docType: string; fileName: string | null; expiryDate: string | null; createdAt: string }[]>([]);
  const [legalName, setLegalName] = useState('');
  const [notes, setNotes] = useState('');
  const [docType, setDocType] = useState('rc');
  const [docExpiry, setDocExpiry] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return api.get<{ profile: { status: string; legalName: string | null; notes: string | null } | null; documents: typeof docs }>(`/kyc-verification/vehicles/${vehicle.id}`)
      .then(({ profile, documents }) => {
        setStatus(profile?.status ?? null);
        setDocs(documents);
        setLegalName(profile?.legalName ?? '');
        setNotes(profile?.notes ?? '');
      })
      .catch((e: Error) => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [vehicle.id, showToast]);

  useEffect(() => { load(); }, [load]);

  const locked = status === 'verified';

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/kyc-verification/vehicles/${vehicle.id}`, { legalName, notes });
      showToast('Vehicle KYC saved', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/kyc-verification/vehicles/${vehicle.id}/submit`, {});
      showToast('Vehicle KYC submitted for review', 'success');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not submit', 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (file: File) => {
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, 1600, 0.8);
      const objectPath = await uploadImageToStorage(dataUrl, '/kyc-verification/upload-url');
      await api.post(`/kyc-verification/vehicles/${vehicle.id}/documents`, {
        docType, objectPath, expiryDate: docExpiry || null, fileName: file.name,
      });
      showToast('Document uploaded', 'success');
      setDocExpiry('');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const VEHICLE_DOCS = ['rc', 'insurance', 'puc', 'fitness', 'other'];

  return (
    <DrawerShell onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>Vehicle KYC — {vehicle.vehicleNo}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
      </div>
      {loading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}><Loader2 className="spin" size={20} /></div>}
      {!loading && (
        <>
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
              <button onClick={save} disabled={busy} style={{ marginTop: 10, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#fff', fontWeight: 700, fontSize: 13, opacity: busy ? 0.6 : 1 }}>
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
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px dashed var(--gold)', color: 'var(--gold)', fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                <Upload size={14} /> Upload
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  disabled={busy}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) uploadDoc(f);
                  }}
                />
              </label>
            </div>
          )}

          {!locked && status && status !== 'submitted' && (
            <button onClick={submit} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--gold)', color: '#fff', fontWeight: 800, fontSize: 13, opacity: busy ? 0.6 : 1 }}>
              <Send size={14} /> Submit for verification
            </button>
          )}
        </>
      )}
    </DrawerShell>
  );
}
