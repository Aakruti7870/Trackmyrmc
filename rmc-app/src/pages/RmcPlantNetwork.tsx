import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronRight, ExternalLink,
  Loader2, MapPin, Play, RefreshCw, Search, StopCircle, XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

const TABS = ['Dashboard', 'Discover Plants', 'Review Queue', 'Onboarding', 'Active Plants', 'Inactive Plants', 'Import History', 'Market Coverage'] as const;
type Tab = typeof TABS[number];
type Scope = 'MARKET' | 'DISTRICT' | 'MAHARASHTRA';

interface MarketArea {
  id: number;
  district: string;
  marketName: string;
  locality: string;
  isEnabled: boolean;
  lastScannedAt: string | null;
  nextScanEligibleAt: string | null;
}

interface ImportRun {
  id: number;
  scopeType: string;
  district: string | null;
  status: string;
  totalQueries: number;
  completedQueries: number;
  totalResults: number;
  insertedCandidates: number;
  updatedCandidates: number;
  duplicateCandidates: number;
  rejectedCandidates: number;
  errorCount: number;
  createdAt: string;
  completedAt: string | null;
}

interface Candidate {
  id: number;
  googlePlaceId: string;
  discoveredName: string;
  formattedAddress: string | null;
  locality: string | null;
  district: string | null;
  latitude: string;
  longitude: string;
  googleMapsUri: string | null;
  googleBusinessStatus: string | null;
  googleTypes: string[];
  confidenceScore: number;
  confidenceReasons: { rule: string; points: number }[];
  discoveryStatus: string;
  possibleDuplicateOfPlantId: number | null;
  reviewedAt: string | null;
  lastDiscoveredAt: string;
}

interface NetworkPlant {
  id: number;
  plantName: string;
  address: string | null;
  locality: string | null;
  district: string | null;
  mobileNumber: string | null;
  capacityM3PerHour: string | null;
  availableGrades: string[];
  deliveryRadiusKm: number | null;
  operationalStatus: string;
  onboardingStatus: string;
  publicationStatus: string;
  verificationLevel: string;
  isActive: boolean;
  activatedAt: string | null;
}

interface DashboardData {
  totalCandidates: number;
  highConfidenceCandidates: number;
  pendingReview: number;
  rejectedCandidates: number;
  possibleDuplicates: number;
  approvedPlants: number;
  onboardingPending: number;
  activePlants: number;
  temporarilyClosedPlants: number;
  districtCoverage: number;
  lastImport: ImportRun | null;
}

const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
  boxShadow: '0 6px 18px rgba(var(--shadow-rgb),.06)',
};
const input: React.CSSProperties = {
  width: '100%', minHeight: 42, padding: '9px 12px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--chip-bg)', color: 'var(--text)',
};

function label(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function StatusBadge({ value }: { value: string }) {
  const good = ['APPROVED', 'PUBLISHED', 'ACTIVE', 'ACCEPTING_ORDERS', 'COMPLETED'].includes(value);
  const danger = ['FAILED', 'REJECTED', 'PERMANENTLY_CLOSED', 'CANCELLED'].includes(value);
  const color = good ? 'var(--green)' : danger ? 'var(--red)' : 'var(--gold)';
  return <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, color, background: `color-mix(in srgb, ${color} 11%, transparent)` }}>{label(value)}</span>;
}

function Progress({ run }: { run: ImportRun }) {
  const pct = run.totalQueries > 0 ? Math.round(run.completedQueries / run.totalQueries * 100) : 0;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{run.completedQueries}/{run.totalQueries} queries</span><strong>{pct}%</strong></div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--chip-bg)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold)', transition: 'width .25s' }} /></div>
    </div>
  );
}

export default function RmcPlantNetwork() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('Dashboard');
  const [markets, setMarkets] = useState<MarketArea[]>([]);
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [plants, setPlants] = useState<NetworkPlant[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>('MARKET');
  const [district, setDistrict] = useState('');
  const [marketIds, setMarketIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [minConfidence, setMinConfidence] = useState(45);
  const [starting, setStarting] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);

  const load = useCallback(() => Promise.all([
    api.get<MarketArea[]>('/super-admin/rmc-discovery/markets'),
    api.get<ImportRun[]>('/super-admin/rmc-discovery/import-runs?limit=30'),
    api.get<DashboardData>('/super-admin/rmc-discovery/dashboard'),
    api.get<Candidate[]>('/super-admin/rmc-discovery/candidates?limit=100'),
    api.get<NetworkPlant[]>('/super-admin/rmc-discovery/plants?limit=200'),
  ]).then(([marketData, runData, dashData, candidateData, plantData]) => {
    setMarkets(marketData); setRuns(runData); setDashboard(dashData); setCandidates(candidateData); setPlants(plantData);
  }).catch(error => {
    showToast(error instanceof Error ? error.message : 'Could not load RMC Plant Network', 'error');
  }).finally(() => { setLoading(false); }), [showToast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const active = runs.find(r => r.status === 'QUEUED' || r.status === 'RUNNING');
    if (!active) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [runs, load]);

  const districts = useMemo(() => [...new Set(markets.map(m => m.district))].sort(), [markets]);
  const visibleMarkets = useMemo(() => district ? markets.filter(m => m.district === district) : markets, [markets, district]);
  const activeRun = runs.find(r => r.status === 'QUEUED' || r.status === 'RUNNING');
  const reviewRows = candidates.filter(c => !c.reviewedAt && c.discoveryStatus === 'NEEDS_REVIEW' && c.confidenceScore >= minConfidence && (!search || `${c.discoveredName} ${c.formattedAddress ?? ''}`.toLowerCase().includes(search.toLowerCase())));

  async function startImport() {
    if (scope === 'MARKET' && marketIds.length === 0) { showToast('Select at least one market.', 'error'); return; }
    if (scope === 'DISTRICT' && !district) { showToast('Select a district.', 'error'); return; }
    if (scope === 'MAHARASHTRA' && !window.confirm('A Maharashtra import generates many paid Google Places requests. Start the statewide import?')) return;
    setStarting(true);
    try {
      const result = await api.post<{ importRunId: number }>('/super-admin/rmc-discovery/import', {
        scope, marketAreaIds: scope === 'MARKET' ? marketIds : [], district: scope === 'DISTRICT' ? district : null,
      });
      showToast(`Import #${result.importRunId} queued`, 'success');
      await load();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Import could not start', 'error'); }
    finally { setStarting(false); }
  }

  async function cancelImport(id: number) {
    await api.post(`/super-admin/rmc-discovery/import-runs/${id}/cancel`, {});
    showToast('Cancellation requested', 'info'); await load();
  }

  async function rejectCandidate(c: Candidate) {
    const reason = window.prompt(`Reject ${c.discoveredName}:`, 'Not an operational RMC plant');
    if (!reason) return;
    await api.post(`/super-admin/rmc-discovery/candidates/${c.id}/reject`, { reason });
    showToast('Candidate rejected', 'success'); setSelected(null); await load();
  }

  async function markDuplicate(c: Candidate) {
    const raw = window.prompt('Existing plant ID, or leave blank for manual duplicate:', c.possibleDuplicateOfPlantId ? String(c.possibleDuplicateOfPlantId) : '');
    if (raw === null) return;
    const plantId = raw.trim() ? Number(raw) : null;
    await api.post(`/super-admin/rmc-discovery/candidates/${c.id}/mark-duplicate`, { plantId: Number.isInteger(plantId) ? plantId : null, reason: 'Reviewed as duplicate' });
    showToast('Candidate marked duplicate', 'success'); setSelected(null); await load();
  }

  async function approveDraft(c: Candidate) {
    if (!c.locality || !c.district || !c.formattedAddress) { showToast('Set address, locality and district before approval.', 'error'); return; }
    await api.post(`/super-admin/rmc-discovery/candidates/${c.id}/approve`, {
      plantName: c.discoveredName, address: c.formattedAddress, locality: c.locality, district: c.district,
      state: 'Maharashtra', latitude: Number(c.latitude), longitude: Number(c.longitude),
      availableGrades: [], deliveryRadiusKm: 25,
    });
    showToast('Approved as a private draft. Onboarding and activation are still required.', 'success'); setSelected(null); await load();
  }

  async function activatePlant(p: NetworkPlant) {
    if (!window.confirm(`Activate and publish ${p.plantName}? Confirm identity, contact, GPS, operation, order authority and delivery radius are verified.`)) return;
    const reason = window.prompt('Activation reason:', 'Plant details confirmed by Super Admin');
    if (!reason) return;
    await api.post(`/super-admin/rmc-discovery/plants/${p.id}/activate`, {
      operationalStatus: 'ACCEPTING_ORDERS', publicationStatus: 'PUBLISHED', verificationLevel: 'TRACKMYRMC_REGISTERED', reason,
      confirmations: { identityChecked: true, contactChecked: true, locationChecked: true, operational: true, authorisedForOrders: true, deliveryRadiusChecked: true },
    });
    showToast('Plant activated and published', 'success'); await load();
  }

  async function approveOnboarding(p: NetworkPlant) {
    await api.patch(`/super-admin/rmc-discovery/plants/${p.id}/status`, { onboardingStatus: 'APPROVED', verificationLevel: 'TRACKMYRMC_REGISTERED', reason: 'Onboarding documents and details verified' });
    showToast('Onboarding approved. Plant is still not public until activation.', 'success'); await load();
  }

  if (loading && !dashboard) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="spin" /> Loading RMC Plant Network…</div>;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0, fontSize: 24 }}>RMC Plant Network</h1><p style={{ margin: '5px 0 0', color: 'var(--muted)', fontSize: 13 }}>Discover → review → draft → onboard → verify → activate → publish</p></div>
        <button onClick={() => void load()} style={{ ...input, width: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div style={{ ...card, padding: 6, display: 'flex', gap: 4, overflowX: 'auto' }}>
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 12px', whiteSpace: 'nowrap', borderRadius: 10, background: tab === t ? 'var(--gold)' : 'transparent', color: tab === t ? '#fff' : 'var(--muted)', fontWeight: 700 }}>{t}</button>)}
      </div>

      {tab === 'Dashboard' && dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          {[
            ['Google candidates', dashboard.totalCandidates], ['High confidence', dashboard.highConfidenceCandidates], ['Pending review', dashboard.pendingReview],
            ['Approved onboarding', dashboard.approvedPlants], ['Onboarding pending', dashboard.onboardingPending], ['Active published', dashboard.activePlants],
            ['Temporarily closed', dashboard.temporarilyClosedPlants], ['Rejected', dashboard.rejectedCandidates], ['Possible duplicates', dashboard.possibleDuplicates], ['Districts covered', dashboard.districtCoverage],
          ].map(([name, value]) => <div key={String(name)} style={{ ...card, padding: 16 }}><div style={{ color: 'var(--muted)', fontSize: 12 }}>{name}</div><div style={{ fontSize: 25, fontWeight: 850, marginTop: 5 }}>{value}</div></div>)}
        </div>
      )}

      {tab === 'Discover Plants' && (
        <div style={{ ...card, padding: 18, display: 'grid', gap: 15 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 700 }}>Scope</label><select value={scope} onChange={e => setScope(e.target.value as Scope)} style={input}><option value="MARKET">Market/locality</option><option value="DISTRICT">District</option><option value="MAHARASHTRA">Maharashtra</option></select></div>
            {scope !== 'MAHARASHTRA' && <div><label style={{ fontSize: 12, fontWeight: 700 }}>District</label><select value={district} onChange={e => { setDistrict(e.target.value); setMarketIds([]); }} style={input}><option value="">Select district</option>{districts.map(d => <option key={d}>{d}</option>)}</select></div>}
          </div>
          {scope === 'MARKET' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>{visibleMarkets.map(m => <label key={m.id} style={{ ...card, padding: 10, display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={marketIds.includes(m.id)} onChange={e => setMarketIds(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id))} /><span><strong>{m.marketName}</strong><small style={{ display: 'block', color: 'var(--muted)' }}>{m.district}</small></span></label>)}</div>}
          <div style={{ padding: 12, borderRadius: 12, background: 'color-mix(in srgb,var(--gold) 9%,transparent)', fontSize: 12 }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />Google results enter a private review queue. Discovery never activates or publishes a plant.</div>
          <button disabled={starting || !!activeRun} onClick={() => void startImport()} style={{ minHeight: 44, borderRadius: 11, background: 'var(--gold)', color: '#fff', fontWeight: 800, opacity: starting || activeRun ? .55 : 1 }}><Play size={16} style={{ display: 'inline', marginRight: 7 }} />{starting ? 'Starting…' : 'Start Import'}</button>
          {activeRun && <div style={{ ...card, padding: 14, display: 'grid', gap: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Import #{activeRun.id}</strong><StatusBadge value={activeRun.status} /></div><Progress run={activeRun} /><div style={{ fontSize: 12, color: 'var(--muted)' }}>{activeRun.totalResults} results · {activeRun.insertedCandidates} new · {activeRun.updatedCandidates} updated · {activeRun.duplicateCandidates} duplicates · {activeRun.errorCount} errors</div><button onClick={() => void cancelImport(activeRun.id)} style={{ ...input, width: 'auto', color: 'var(--red)' }}><StopCircle size={14} style={{ display: 'inline', marginRight: 6 }} />Cancel import</button></div>}
        </div>
      )}

      {tab === 'Review Queue' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...card, padding: 12, display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10 }}><div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--muted)' }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or address" style={{ ...input, paddingLeft: 36 }} /></div><select value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))} style={input}><option value={45}>45+ confidence</option><option value={70}>70+ confidence</option></select></div>
          <div style={{ ...card, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 950 }}><thead><tr>{['Candidate','Locality','District','Confidence','Google status','Duplicate','Discovered','Actions'].map(h => <th key={h} style={{ padding: 12, textAlign: 'left', fontSize: 11, color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead><tbody>{reviewRows.map(c => <tr key={c.id} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 12 }}><strong>{c.discoveredName}</strong><small style={{ display: 'block', maxWidth: 300, color: 'var(--muted)' }}>{c.formattedAddress}</small></td><td style={{ padding: 12 }}>{c.locality || '—'}</td><td style={{ padding: 12 }}>{c.district || '—'}</td><td style={{ padding: 12 }}><strong>{c.confidenceScore}</strong></td><td style={{ padding: 12 }}>{c.googleBusinessStatus || 'Unknown'}</td><td style={{ padding: 12 }}>{c.possibleDuplicateOfPlantId ? `Plant #${c.possibleDuplicateOfPlantId}` : '—'}</td><td style={{ padding: 12 }}>{new Date(c.lastDiscoveredAt).toLocaleDateString('en-IN')}</td><td style={{ padding: 12 }}><button onClick={() => setSelected(c)} style={{ ...input, width: 'auto' }}>Review <ChevronRight size={14} style={{ display: 'inline' }} /></button></td></tr>)}</tbody></table>{reviewRows.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>No candidates match the current filters.</div>}</div>
        </div>
      )}

      {(tab === 'Onboarding' || tab === 'Active Plants' || tab === 'Inactive Plants') && (
        <div style={{ ...card, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}><thead><tr>{['Plant','Location','Verification','Onboarding','Operational','Publication','Capacity','Radius','Actions'].map(h => <th key={h} style={{ padding: 12, textAlign: 'left', fontSize: 11, color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead><tbody>{plants.filter(p => tab === 'Onboarding' ? p.onboardingStatus !== 'APPROVED' : tab === 'Active Plants' ? p.isActive && p.publicationStatus === 'PUBLISHED' : !(p.isActive && p.publicationStatus === 'PUBLISHED')).map(p => <tr key={p.id} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 12 }}><strong>{p.plantName}</strong></td><td style={{ padding: 12 }}>{[p.locality,p.district].filter(Boolean).join(', ') || '—'}</td><td style={{ padding: 12 }}><StatusBadge value={p.verificationLevel} /></td><td style={{ padding: 12 }}><StatusBadge value={p.onboardingStatus} /></td><td style={{ padding: 12 }}><StatusBadge value={p.operationalStatus} /></td><td style={{ padding: 12 }}><StatusBadge value={p.publicationStatus} /></td><td style={{ padding: 12 }}>{p.capacityM3PerHour || '—'}</td><td style={{ padding: 12 }}>{p.deliveryRadiusKm ? `${p.deliveryRadiusKm} km` : '—'}</td><td style={{ padding: 12, display: 'flex', gap: 7 }}>{p.onboardingStatus !== 'APPROVED' && <button onClick={() => void approveOnboarding(p)} style={{ ...input, width: 'auto' }}>Approve onboarding</button>}{p.onboardingStatus === 'APPROVED' && !p.isActive && <button onClick={() => void activatePlant(p)} style={{ ...input, width: 'auto', color: 'var(--green)' }}><CheckCircle2 size={14} style={{ display: 'inline' }} /> Activate</button>}</td></tr>)}</tbody></table></div>
      )}

      {tab === 'Import History' && <div style={{ display: 'grid', gap: 10 }}>{runs.map(r => <div key={r.id} style={{ ...card, padding: 14, display: 'grid', gap: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>Import #{r.id} · {label(r.scopeType)}</strong><StatusBadge value={r.status} /></div><Progress run={r} /><small style={{ color: 'var(--muted)' }}>{r.totalResults} results · {r.insertedCandidates} new · {r.duplicateCandidates} duplicates · {r.errorCount} errors · {new Date(r.createdAt).toLocaleString('en-IN')}</small></div>)}</div>}

      {tab === 'Market Coverage' && <div style={{ ...card, overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Market','District','Enabled','Last scanned','Next eligible'].map(h => <th key={h} style={{ padding: 12, textAlign: 'left', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead><tbody>{markets.map(m => <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}><td style={{ padding: 12 }}><MapPin size={13} style={{ display: 'inline' }} /> {m.marketName}</td><td style={{ padding: 12 }}>{m.district}</td><td style={{ padding: 12 }}>{m.isEnabled ? 'Yes' : 'No'}</td><td style={{ padding: 12 }}>{m.lastScannedAt ? new Date(m.lastScannedAt).toLocaleString('en-IN') : 'Never'}</td><td style={{ padding: 12 }}>{m.nextScanEligibleAt ? new Date(m.nextScanEligibleAt).toLocaleString('en-IN') : 'Now'}</td></tr>)}</tbody></table></div>}

      {selected && <div onClick={e => e.target === e.currentTarget && setSelected(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)', display: 'flex', justifyContent: 'flex-end' }}><div style={{ width: 'min(560px,100%)', height: '100%', overflowY: 'auto', background: 'var(--bg)', padding: 22, display: 'grid', alignContent: 'start', gap: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h2 style={{ margin: 0 }}>{selected.discoveredName}</h2><small style={{ color: 'var(--muted)' }}>Google-listed candidate · not verified</small></div><button onClick={() => setSelected(null)}><XCircle /></button></div><div style={{ ...card, padding: 14 }}><strong>Address</strong><p>{selected.formattedAddress || 'Missing'}</p><div>{selected.locality || 'Missing locality'} · {selected.district || 'Missing district'}</div><div>{selected.latitude}, {selected.longitude}</div>{selected.googleMapsUri && <a href={selected.googleMapsUri} target="_blank" rel="noreferrer">View on Google Maps <ExternalLink size={12} /></a>}</div><div style={{ ...card, padding: 14 }}><strong>Confidence: {selected.confidenceScore}</strong>{selected.confidenceReasons.map((r,i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}><span>{r.rule}</span><strong>{r.points > 0 ? '+' : ''}{r.points}</strong></div>)}</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}><button onClick={() => void approveDraft(selected)} style={{ minHeight: 44, borderRadius: 10, background: 'var(--green)', color: '#fff', fontWeight: 800 }}>Approve as Draft</button><button onClick={() => void markDuplicate(selected)} style={{ minHeight: 44, borderRadius: 10, background: 'var(--gold)', color: '#fff', fontWeight: 800 }}>Duplicate</button><button onClick={() => void rejectCandidate(selected)} style={{ minHeight: 44, borderRadius: 10, background: 'var(--red)', color: '#fff', fontWeight: 800 }}>Reject</button></div></div></div>}
    </div>
  );
}
