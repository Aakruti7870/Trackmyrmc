import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, MapPin, UserPlus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { SectionHeading, GlassPanel, StatCard, Badge, PrimaryButton, } from '../ui';
import { mix } from '../tokens';

interface PlantRow {
  id: number; name: string; plantCode?: string | null; city?: string | null;
  isActive?: boolean; verified?: boolean; plantStatus?: string | null;
}

export default function Plants({ accent, onInvite }: { accent: string; onInvite: () => void }) {
  const [plants, setPlants] = useState<PlantRow[]>([]);
  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<PlantRow[]>('/plants')
      .then(d => { if (alive) { setPlants(Array.isArray(d) ? d : []); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const verified = plants.filter(p => p.verified).length;
  const active = plants.filter(p => p.isActive).length;
  const leads = plants.filter(p => !p.verified).length;

  const filtered = plants.filter(p => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [p.name, p.plantCode, p.city].filter(Boolean).some(v => String(v).toLowerCase().includes(s));
  });

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<Building2 size={20} />} accent={accent}
        title="Plant Network"
        subtitle="Every RMC plant, verification status and reach"
        right={<PrimaryButton accent={accent} onClick={onInvite}><UserPlus size={15} /> Invite</PrimaryButton>}
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', marginBottom: 16 }}>
        <StatCard icon={<Building2 size={17} />} label="Total plants" accent={accent} value={loaded ? plants.length : '…'} />
        <StatCard icon={<CheckCircle2 size={17} />} label="Verified & live" accent="var(--green)" value={loaded ? verified : '…'} />
        <StatCard icon={<Clock size={17} />} label="Leads / pending" accent="var(--orange)" value={loaded ? leads : '…'} />
        <StatCard icon={<MapPin size={17} />} label="Active" accent="var(--blue)" value={loaded ? active : '…'} />
      </div>

      <GlassPanel accent={accent}>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="Search plants by name, code or city…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 34px', borderRadius: 10, fontSize: 13,
              background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)',
            }}
          />
        </div>

        <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(230px, 100%), 1fr))' }}>
          {filtered.map(p => {
            const ok = !!p.verified;
            const col = ok ? 'var(--green)' : 'var(--orange)';
            return (
              <div key={p.id} style={{
                padding: 14, borderRadius: 14, background: 'var(--surface)',
                border: `1px solid ${mix(col, 24)}`, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{p.plantCode || '—'}{p.city ? ` • ${p.city}` : ''}</div>
                  </div>
                  <Badge color={col} dot>{ok ? 'Verified' : 'Lead'}</Badge>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Badge color={p.isActive ? 'var(--green)' : 'var(--muted)'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                  {p.plantStatus && <Badge color="var(--blue)">{p.plantStatus}</Badge>}
                </div>
              </div>
            );
          })}
          {loaded && filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, gridColumn: '1 / -1' }}>
              {plants.length === 0 ? 'No plants in the directory yet.' : 'No plants match your search.'}
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
