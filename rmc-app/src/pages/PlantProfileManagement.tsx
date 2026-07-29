import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CheckCircle2, FilePlus2, Save, Send } from 'lucide-react';

type ProfileField = string | number | boolean | null;
type ProfileResponse = { profile: Record<string, ProfileField> | null; plant?: { id: number; name: string }; certificates?: Record<string, ProfileField>[] };
const boolFields = ['inhouseConcretePumpAvailable','externalPumpArrangementAvailable','laboratoryAvailable','qualityEngineerAvailable','cubeTestingAvailable','cubeTestingReportsAvailable','batchingCabinCameraAvailable','batchReportAvailable','batchReportLinkedWithTm','challanAvailable','challanLinkedWithTm','dieselGeneratorAvailable','supportingPlantAvailable','weighbridgeAvailable','gpsTrackingAvailable','plantManagerAvailable','safetyOfficerAvailable','emergencySupportAvailable','cashPaymentAvailable','smallQuantityCashPaymentAvailable','creditPaymentAvailable','advancePaymentRequired','works24Hours'];
const numericFields = ['productionCapacityM3PerHour','maximumDailySupplyCapacityM3','numberOfTransitMixers','numberOfPumps','minimumOrderQuantityM3','dieselGeneratorCapacityKva','supportingPlantDistanceKm','numberOfSilos','cementStorageCapacityMt','flyAshStorageCapacityMt','aggregateStorageCapacityMt','creditDaysMin','creditDaysMax'];

const fieldLabels: Record<string,string> = {
  productionCapacityM3PerHour:'Production capacity (m³/hr)', maximumDailySupplyCapacityM3:'Maximum daily supply (m³)', numberOfTransitMixers:'Transit Mixers', numberOfPumps:'Number of Pumps', minimumOrderQuantityM3:'Minimum order quantity (m³)', dieselGeneratorCapacityKva:'DG capacity (kVA)', supportingPlantDistanceKm:'Supporting plant distance (km)', numberOfSilos:'Number of silos', cementStorageCapacityMt:'Cement storage (MT)', flyAshStorageCapacityMt:'Fly ash storage (MT)', aggregateStorageCapacityMt:'Aggregate storage (MT)', creditDaysMin:'Minimum credit days', creditDaysMax:'Maximum credit days',
  inhouseConcretePumpAvailable:'In-house concrete pump', externalPumpArrangementAvailable:'External pump arrangement', laboratoryAvailable:'Laboratory available', qualityEngineerAvailable:'Quality Engineer available', cubeTestingAvailable:'Cube testing available', cubeTestingReportsAvailable:'Cube testing reports available', batchingCabinCameraAvailable:'Camera in batching cabin', batchReportAvailable:'Batch report available', batchReportLinkedWithTm:'Batch report linked with TM', challanAvailable:'Challan available', challanLinkedWithTm:'Challan linked with TM', dieselGeneratorAvailable:'DG available', supportingPlantAvailable:'Supporting plant available', weighbridgeAvailable:'Weighbridge available', gpsTrackingAvailable:'GPS tracking available', plantManagerAvailable:'Plant Manager available', safetyOfficerAvailable:'Safety Officer available', emergencySupportAvailable:'Emergency support available', cashPaymentAvailable:'Cash payment available', smallQuantityCashPaymentAvailable:'Small quantity cash orders', creditPaymentAvailable:'Credit payment available', advancePaymentRequired:'Advance payment required', works24Hours:'Works 24 hours',
};

export default function PlantProfileManagement() {
  const { user } = useAuth();
  const plantId = user?.plantId;
  const [form, setForm] = useState<Record<string, ProfileField>>({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cert, setCert] = useState({ certificateType: 'Other', certificateName: '', certificateStatus: 'available', certificateNumber: '', issuingAuthority: '', expiryDate: '', documentUrl: '', isVisibleToCustomer: false });

  useEffect(() => { if (!plantId) return; api.get<ProfileResponse>(`/plants/${plantId}/profile`).then(r => setForm(r.profile ?? {})).catch(() => setForm({})); }, [plantId]);
  const completion = useMemo(() => Number(form.completionPercentage ?? 0), [form]);
  const set = (key: string, value: ProfileField) => setForm(v => ({ ...v, [key]: value }));
  const save = async () => {
    if (!plantId) return;
    setSaving(true); setError(''); setNotice('');
    try { const out = await api.put<Record<string, ProfileField>>(`/plants/${plantId}/profile`, form); setForm(out); setNotice('Plant profile saved.'); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  const submit = async () => { if (!plantId) return; try { await save(); const out = await api.post<Record<string, ProfileField>>(`/plants/${plantId}/profile/submit`, {}); setForm(out); setNotice('Submitted to Super Admin for verification.'); } catch (e) { setError((e as Error).message); } };
  const addCertificate = async () => {
    if (!plantId || !cert.certificateName.trim()) return;
    try { await api.post(`/plants/${plantId}/certificates`, { ...cert, documentUrl: cert.documentUrl.trim() || null, certificateNumber: cert.certificateNumber.trim() || null, issuingAuthority: cert.issuingAuthority.trim() || null, expiryDate: cert.expiryDate || null }); setNotice('Certificate added. Document upload was optional.'); setCert({ ...cert, certificateName: '', certificateNumber: '', issuingAuthority: '', expiryDate: '', documentUrl: '' }); }
    catch (e) { setError((e as Error).message); }
  };
  if (!plantId) return <div className="card" style={{ padding:20 }}>This account is not assigned to a plant.</div>;

  return <div style={{ display:'grid', gap:16, paddingBottom:28 }}>
    <header className="card" style={{ padding:20 }}><h1 style={{ marginTop:0 }}>About Plant Management</h1><p>Complete the plant capability profile and submit it for Super Admin verification.</p><div style={{ height:10, background:'var(--line)', borderRadius:999, overflow:'hidden' }}><div style={{ width:`${completion}%`, height:'100%', background:'var(--gold)' }}/></div><strong>{completion}% complete</strong></header>
    {error && <div className="card" style={{ padding:14 }}>{error}</div>}{notice && <div className="card" style={{ padding:14 }}><CheckCircle2 size={18}/> {notice}</div>}
    <section className="card" style={{ padding:18, display:'grid', gap:14 }}><h2>Capacity, Fleet and Infrastructure</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        {numericFields.map(k => <label key={k} style={{ display:'grid', gap:6 }}><span>{fieldLabels[k]}</span><input className="input" type="number" min="0" value={(form[k] as string | number | null) ?? ''} onChange={e => set(k, e.target.value === '' ? null : Number(e.target.value))}/></label>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10 }}>{boolFields.map(k => <label key={k} style={{ display:'flex', alignItems:'center', gap:8, minHeight:44 }}><input type="checkbox" checked={form[k] === true} onChange={e => set(k, e.target.checked)}/>{fieldLabels[k]}</label>)}</div>
    </section>
    <section className="card" style={{ padding:18, display:'grid', gap:12 }}><h2>Working Hours and Details</h2><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
      <label>Start Time<input className="input" type="time" value={(form.workingHoursStart as string | null) ?? ''} onChange={e => set('workingHoursStart', e.target.value || null)}/></label>
      <label>End Time<input className="input" type="time" value={(form.workingHoursEnd as string | null) ?? ''} onChange={e => set('workingHoursEnd', e.target.value || null)}/></label>
      <label>Plant Make<input className="input" value={(form.plantMake as string | null) ?? ''} onChange={e => set('plantMake', e.target.value)}/></label>
      <label>Plant Model<input className="input" value={(form.plantModel as string | null) ?? ''} onChange={e => set('plantModel', e.target.value)}/></label>
      <label>Supporting Plant Name<input className="input" value={(form.supportingPlantName as string | null) ?? ''} onChange={e => set('supportingPlantName', e.target.value)}/></label>
      <label>Cube Testing Frequency<input className="input" value={(form.cubeTestingFrequency as string | null) ?? ''} onChange={e => set('cubeTestingFrequency', e.target.value)}/></label>
    </div><label>Laboratory Details<textarea className="input" rows={3} value={(form.laboratoryDetails as string | null) ?? ''} onChange={e => set('laboratoryDetails', e.target.value)}/></label><label>Breakdown Backup Description<textarea className="input" rows={3} value={(form.breakdownBackupDescription as string | null) ?? ''} onChange={e => set('breakdownBackupDescription', e.target.value)}/></label><label>Payment Terms Notes<textarea className="input" rows={3} value={(form.paymentTermsNotes as string | null) ?? ''} onChange={e => set('paymentTermsNotes', e.target.value)}/></label><label>Additional Plant Information<textarea className="input" rows={4} value={(form.additionalInformation as string | null) ?? ''} onChange={e => set('additionalInformation', e.target.value)}/></label></section>
    <section className="card" style={{ padding:18, display:'grid', gap:12 }}><h2>Certificates</h2><p>PDF or image upload is optional. The certificate can be marked and submitted without a file.</p><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
      <label>Certificate Type<select className="input" value={cert.certificateType} onChange={e => setCert(c => ({ ...c, certificateType:e.target.value }))}><option>Pollution Control Certificate</option><option>Factory License</option><option>GST Registration</option><option>Batching Plant Calibration Certificate</option><option>Laboratory Equipment Calibration Certificate</option><option>ISO 9001</option><option>Other</option></select></label>
      <label>Certificate Name<input className="input" value={cert.certificateName} onChange={e => setCert(c => ({ ...c, certificateName:e.target.value }))}/></label>
      <label>Status<select className="input" value={cert.certificateStatus} onChange={e => setCert(c => ({ ...c, certificateStatus:e.target.value }))}><option value="available">Available</option><option value="not_available">Not Available</option><option value="applied">Applied For</option><option value="expired">Expired</option><option value="not_applicable">Not Applicable</option></select></label>
      <label>Certificate Number<input className="input" value={cert.certificateNumber} onChange={e => setCert(c => ({ ...c, certificateNumber:e.target.value }))}/></label>
      <label>Issuing Authority<input className="input" value={cert.issuingAuthority} onChange={e => setCert(c => ({ ...c, issuingAuthority:e.target.value }))}/></label>
      <label>Expiry Date<input className="input" type="date" value={cert.expiryDate} onChange={e => setCert(c => ({ ...c, expiryDate:e.target.value }))}/></label>
      <label>Optional document URL<input className="input" value={cert.documentUrl} onChange={e => setCert(c => ({ ...c, documentUrl:e.target.value }))}/></label>
      <label style={{ display:'flex', gap:8, alignItems:'center' }}><input type="checkbox" checked={cert.isVisibleToCustomer} onChange={e => setCert(c => ({ ...c, isVisibleToCustomer:e.target.checked }))}/>Visible to customers</label>
    </div><button className="btn" onClick={addCertificate}><FilePlus2 size={17}/> Add Certificate</button></section>
    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}><button className="btn" disabled={saving} onClick={save}><Save size={17}/>Save Draft</button><button className="btn primary" disabled={saving} onClick={submit}><Send size={17}/>Submit for Verification</button></div>
  </div>;
}
