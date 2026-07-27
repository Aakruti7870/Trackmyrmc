import { useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { api } from '@/lib/api';
import { BadgeCheck, Building2, CheckCircle2, FileCheck2, FlaskConical, Gauge, MapPin, ShieldCheck, Truck, WalletCards, Wrench } from 'lucide-react';

type Certificate = { id: number; certificateName: string; certificateStatus: string; certificateNumber?: string | null; issuingAuthority?: string | null; issueDate?: string | null; expiryDate?: string | null; verificationStatus: string; documentUrl?: string | null };
type Profile = Record<string, any>;
type Response = { plant: { id: number; name: string; address?: string | null; city?: string | null; profileVerified?: boolean }; profile: Profile | null; certificates: Certificate[]; message?: string; pendingChanges?: boolean };

const label = (v: unknown) => v === true ? 'Available' : v === false ? 'Not Available' : 'Not Provided';
const show = (v: unknown, suffix = '') => v === null || v === undefined || v === '' ? 'Not Provided' : `${v}${suffix}`;

function Section({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: Array<[string, React.ReactNode]> }) {
  return <section className="card" style={{ padding: 18, display: 'grid', gap: 12 }}>
    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>{icon}{title}</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      {rows.map(([k, v]) => <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, minWidth: 0 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>{k}</div><div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{v}</div></div>)}
    </div>
  </section>;
}

export default function PlantAbout() {
  const [, params] = useRoute('/plants/:plantId/about');
  const plantId = Number(params?.plantId);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState('');
  const load = () => { setError(''); api.get<Response>(`/plants/${plantId}/profile`).then(setData).catch(e => setError((e as Error).message)); };
  useEffect(load, [plantId]);
  const p = data?.profile;
  const certs = useMemo(() => [...(data?.certificates ?? [])].sort((a,b) => (a.verificationStatus === 'verified' ? -1 : 1) - (b.verificationStatus === 'verified' ? -1 : 1)), [data]);
  if (error) return <div className="card" style={{ padding: 20 }}><p>{error}</p><button className="btn primary" onClick={load}>Retry</button></div>;
  if (!data) return <div className="card" style={{ padding: 20 }}>Loading plant information…</div>;
  if (!p) return <div className="card" style={{ padding: 20 }}><h1>{data.plant.name}</h1><p>{data.message ?? 'Detailed plant information has not been added yet.'}</p></div>;

  return <div style={{ display: 'grid', gap: 16, paddingBottom: 24 }}>
    <header className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0 }}>{data.plant.name}</h1><p style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)' }}><MapPin size={16}/>{data.plant.address || data.plant.city || 'Address not provided'}</p></div>
        {p.profileStatus === 'verified' && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid var(--gold)', borderRadius: 999, padding: '8px 12px', fontWeight: 700 }}><ShieldCheck size={16}/>Verified Profile</span>}
      </div>
      {data.pendingChanges && <p style={{ marginBottom: 0 }}>Some plant information is awaiting verification.</p>}
    </header>

    <Section title="Plant Overview" icon={<Building2 size={20}/>} rows={[
      ['Production Capacity', show(p.productionCapacityM3PerHour, ' m³/hr')], ['Daily Supply Capacity', show(p.maximumDailySupplyCapacityM3, ' m³/day')], ['Plant Make & Model', [p.plantMake,p.plantModel].filter(Boolean).join(' ') || 'Not Provided'], ['Working Hours', p.works24Hours ? '24 Hours' : (p.workingHoursStart && p.workingHoursEnd ? `${p.workingHoursStart} – ${p.workingHoursEnd}` : 'Not Provided')], ['Minimum Order', show(p.minimumOrderQuantityM3, ' m³')]
    ]}/>
    <Section title="Fleet and Delivery" icon={<Truck size={20}/>} rows={[
      ['Transit Mixers', show(p.numberOfTransitMixers)], ['In-house Pumps', show(p.numberOfPumps)], ['In-house Pump', label(p.inhouseConcretePumpAvailable)], ['External Pump Arrangement', label(p.externalPumpArrangementAvailable)], ['GPS Tracking', label(p.gpsTrackingAvailable)], ['TM-linked Challan', label(p.challanLinkedWithTm)], ['TM-linked Batch Report', label(p.batchReportLinkedWithTm)]
    ]}/>
    <Section title="Quality and Laboratory" icon={<FlaskConical size={20}/>} rows={[
      ['Laboratory', label(p.laboratoryAvailable)], ['Quality Engineer', label(p.qualityEngineerAvailable)], ['Cube Testing', label(p.cubeTestingAvailable)], ['Cube Test Reports', label(p.cubeTestingReportsAvailable)], ['Testing Frequency', show(p.cubeTestingFrequency)], ['Laboratory Details', show(p.laboratoryDetails)]
    ]}/>
    <Section title="Infrastructure" icon={<Gauge size={20}/>} rows={[
      ['DG', label(p.dieselGeneratorAvailable)], ['DG Capacity', show(p.dieselGeneratorCapacityKva, ' kVA')], ['Batching Cabin Camera', label(p.batchingCabinCameraAvailable)], ['Silos', show(p.numberOfSilos)], ['Cement Storage', show(p.cementStorageCapacityMt, ' MT')], ['Fly Ash Storage', show(p.flyAshStorageCapacityMt, ' MT')], ['Aggregate Storage', show(p.aggregateStorageCapacityMt, ' MT')], ['Weighbridge', label(p.weighbridgeAvailable)]
    ]}/>
    <Section title="Breakdown and Backup" icon={<Wrench size={20}/>} rows={[
      ['Supporting Plant', label(p.supportingPlantAvailable)], ['Backup Plant Name', show(p.supportingPlantName)], ['Backup Plant Distance', show(p.supportingPlantDistanceKm, ' km')], ['Breakdown Support', show(p.breakdownBackupDescription)], ['Emergency Support', label(p.emergencySupportAvailable)]
    ]}/>
    <Section title="Reports" icon={<FileCheck2 size={20}/>} rows={[
      ['Batch Report', label(p.batchReportAvailable)], ['Batch Report Linked with TM', label(p.batchReportLinkedWithTm)], ['Challan', label(p.challanAvailable)], ['Challan Linked with TM', label(p.challanLinkedWithTm)], ['Cube Test Reports', label(p.cubeTestingReportsAvailable)]
    ]}/>
    <Section title="Payment Options" icon={<WalletCards size={20}/>} rows={[
      ['Cash Payment', label(p.cashPaymentAvailable)], ['Small Quantity Cash Orders', label(p.smallQuantityCashPaymentAvailable)], ['Credit Facility', p.creditPaymentAvailable ? 'Subject to approval' : label(p.creditPaymentAvailable)], ['Credit Period', p.creditPaymentAvailable && (p.creditDaysMin != null || p.creditDaysMax != null) ? `${p.creditDaysMin ?? 0}–${p.creditDaysMax ?? p.creditDaysMin} days` : 'Not Provided'], ['Advance Payment', p.advancePaymentRequired ? 'May be required' : label(p.advancePaymentRequired)], ['Payment Notes', show(p.paymentTermsNotes)]
    ]}/>
    <p className="card" style={{ padding: 14, margin: 0 }}>Credit terms are subject to Plant Owner approval and customer verification.</p>

    <section className="card" style={{ padding: 18 }}><h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><BadgeCheck size={20}/>Certificates and Compliance</h2>
      {certs.length === 0 ? <p>No customer-visible certificates have been added.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>{certs.map(c => <article key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, overflowWrap: 'anywhere' }}><strong>{c.certificateName}</strong><p>{c.verificationStatus === 'verified' ? 'Verified' : 'Declared by Plant'}</p><p>{c.expiryDate ? `Valid until ${c.expiryDate}` : 'Validity not provided'}</p>{c.documentUrl && <a className="btn" href={c.documentUrl} target="_blank" rel="noreferrer">View Document</a>}</article>)}</div>}
    </section>
    {p.additionalInformation && <Section title="Additional Plant Information" icon={<CheckCircle2 size={20}/>} rows={[["Details", p.additionalInformation]]}/>} 
  </div>;
}
