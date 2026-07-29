import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { BadgeCheck, CheckCircle2, FileCheck2, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';

type Plant = { id: number; name: string; city?: string | null };
type PendingProfile = { plantId: number; profileStatus: string; completionPercentage: number; submittedAt?: string | null; rejectionReason?: string | null };
type Certificate = { id: number; certificateName: string; certificateStatus: string; verificationStatus: string; documentUrl?: string | null; expiryDate?: string | null };
type ReviewDetail = { profile: Record<string, unknown>; certificates: Certificate[] };

const REVIEW_FIELDS: Array<[string, string]> = [
  ['productionCapacityM3PerHour', 'Production Capacity'],
  ['maximumDailySupplyCapacityM3', 'Maximum Daily Supply'],
  ['numberOfTransitMixers', 'Transit Mixers'],
  ['numberOfPumps', 'Pumps'],
  ['laboratoryAvailable', 'Laboratory'],
  ['dieselGeneratorAvailable', 'DG'],
  ['supportingPlantAvailable', 'Supporting Plant'],
  ['batchReportLinkedWithTm', 'TM-linked Batch Report'],
  ['challanLinkedWithTm', 'TM-linked Challan'],
  ['creditPaymentAvailable', 'Credit Facility'],
  ['creditDaysMin', 'Minimum Credit Days'],
  ['creditDaysMax', 'Maximum Credit Days'],
  ['workingHoursStart', 'Working Hours Start'],
  ['workingHoursEnd', 'Working Hours End'],
  ['additionalInformation', 'Additional Information'],
];

function display(value: unknown): string {
  if (value === true) return 'Available';
  if (value === false) return 'Not Available';
  if (value === null || value === undefined || value === '') return 'Not Provided';
  return String(value);
}

export default function PlantProfileReview() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => Promise.all([
    api.get<Plant[]>('/plants'),
    api.get<PendingProfile[]>('/admin/plant-profiles/pending'),
  ]).then(([plantRows, profileRows]) => {
    setError('');
    setPlants(plantRows);
    setPending(profileRows);
    if (selectedPlantId && !profileRows.some(row => row.plantId === selectedPlantId)) {
      setSelectedPlantId(null);
      setDetail(null);
    }
  }).catch(caught => {
    setError((caught as Error).message);
  }).finally(() => {
    setLoading(false);
  }), [selectedPlantId]);

  useEffect(() => { void load(); }, [load]);

  const plantById = useMemo(() => new Map(plants.map(plant => [plant.id, plant])), [plants]);

  async function openReview(plantId: number) {
    setSelectedPlantId(plantId);
    setDetail(null);
    setReason('');
    setError('');
    try {
      setDetail(await api.get<ReviewDetail>(`/admin/plant-profiles/${plantId}`));
    } catch (caught) {
      setError((caught as Error).message);
    }
  }

  async function verifyProfile() {
    if (!selectedPlantId) return;
    setActing(true);
    setError('');
    try {
      await api.post(`/admin/plant-profiles/${selectedPlantId}/verify`, {});
      setNotice('Plant profile verified.');
      setSelectedPlantId(null);
      setDetail(null);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function requestChanges() {
    if (!selectedPlantId) return;
    if (reason.trim().length < 3) {
      setError('Enter a reason with at least 3 characters.');
      return;
    }
    setActing(true);
    setError('');
    try {
      await api.post(`/admin/plant-profiles/${selectedPlantId}/reject`, { reason: reason.trim() });
      setNotice('Changes requested from the plant.');
      setSelectedPlantId(null);
      setDetail(null);
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function certificateAction(certificateId: number, action: 'verify' | 'reject') {
    if (!selectedPlantId) return;
    setActing(true);
    setError('');
    try {
      await api.post(`/admin/plant-certificates/${certificateId}/${action}`, action === 'verify' ? { verificationMethod: 'manual_confirmation' } : {});
      await openReview(selectedPlantId);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setActing(false);
    }
  }

  return <div style={{ display: 'grid', gap: 16, paddingBottom: 28 }}>
    <header className="card" style={{ padding: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div><h1 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}><BadgeCheck />Plant Profile Reviews</h1><p style={{ marginBottom: 0 }}>Super Admin verification for About Plant capability claims and customer-visible certificates.</p></div>
      <button className="btn" onClick={() => void load()} disabled={loading}><RefreshCw size={16} />Refresh</button>
    </header>

    {error && <div className="card" style={{ padding: 14, color: 'var(--red)' }}>{error}</div>}
    {notice && <div className="card" style={{ padding: 14, color: 'var(--green)' }}><CheckCircle2 size={17} /> {notice}</div>}

    <section className="card" style={{ padding: 18 }}>
      <h2 style={{ marginTop: 0 }}>Awaiting Review</h2>
      {loading ? <p>Loading submitted profiles…</p> : pending.length === 0 ? <p>No plant profiles are awaiting review.</p> : <div style={{ display: 'grid', gap: 10 }}>
        {pending.map(row => {
          const plant = plantById.get(row.plantId);
          return <article key={row.plantId} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div><strong>{plant?.name ?? `Plant #${row.plantId}`}</strong><div style={{ color: 'var(--muted)', fontSize: 13 }}>{plant?.city ?? 'Location not provided'} · {row.completionPercentage}% complete · {row.profileStatus}</div></div>
            <button className="btn primary" onClick={() => void openReview(row.plantId)}>Review Profile</button>
          </article>;
        })}
      </div>}
    </section>

    {selectedPlantId && <section className="card" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{plantById.get(selectedPlantId)?.name ?? `Plant #${selectedPlantId}`}</h2>
        <button className="btn" onClick={() => { setSelectedPlantId(null); setDetail(null); }}><XCircle size={16} />Close</button>
      </div>
      {!detail ? <p>Loading profile details…</p> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
          {REVIEW_FIELDS.map(([key, label]) => <div key={key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, minWidth: 0 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>{label}</div><strong style={{ overflowWrap: 'anywhere' }}>{display(detail.profile[key])}</strong></div>)}
        </div>

        <div><h3 style={{ display: 'flex', gap: 7, alignItems: 'center' }}><FileCheck2 size={18} />Certificates</h3>
          {detail.certificates.length === 0 ? <p>No certificates submitted.</p> : <div style={{ display: 'grid', gap: 10 }}>{detail.certificates.map(certificate => <article key={certificate.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
            <div><strong>{certificate.certificateName}</strong><div style={{ color: 'var(--muted)', fontSize: 13 }}>{certificate.certificateStatus} · {certificate.verificationStatus}{certificate.expiryDate ? ` · Valid until ${certificate.expiryDate}` : ''}</div></div>
            {certificate.documentUrl && <a className="btn" href={certificate.documentUrl} target="_blank" rel="noreferrer">View Document</a>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn primary" disabled={acting} onClick={() => void certificateAction(certificate.id, 'verify')}><CheckCircle2 size={16} />Verify</button>
              <button className="btn" disabled={acting} onClick={() => void certificateAction(certificate.id, 'reject')}><ShieldAlert size={16} />Reject</button>
            </div>
          </article>)}</div>}
        </div>

        <label style={{ display: 'grid', gap: 6 }}>Reason when requesting changes<textarea className="input" rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain what the plant must correct" /></label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={acting} onClick={() => void verifyProfile()}><CheckCircle2 size={17} />Verify Plant Profile</button>
          <button className="btn" disabled={acting} onClick={() => void requestChanges()}><ShieldAlert size={17} />Request Changes</button>
        </div>
      </>}
    </section>}
  </div>;
}
