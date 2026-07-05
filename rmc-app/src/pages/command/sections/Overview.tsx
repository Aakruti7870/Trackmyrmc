import { useEffect, useState } from 'react';
import { Activity, Truck, Package, Factory, IndianRupee, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { api, type DashboardKPIs } from '@/lib/api';
import {
  GlassPanel, SectionHeading, StatCard, MiniBars, LiveDot, SampleTag, Badge,
} from '../ui';
import { mix } from '../tokens';
import { GMV_TREND, WEEKLY_DISPATCH, COMPLAINTS, inr } from '../data';
import LiveDutyMap from '@/components/LiveDutyMap';

export default function Overview({ accent }: { accent: string }) {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api.get<DashboardKPIs>('/dashboard/kpis')
      .then(d => { if (alive) setKpis(d); })
      .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<Activity size={20} />} accent={accent}
        title="Live Command Center"
        subtitle="Platform-wide pulse across every plant, refreshed every 30s"
        right={<LiveDot color="var(--green)" />}
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
        <StatCard icon={<Factory size={17} />} label="Production today" accent="var(--gold)"
          value={kpis ? `${kpis.todayProduction.toLocaleString()} m³` : '…'} loading={!kpis}
          sub={kpis ? `${kpis.todayBatches} batches` : undefined} trend={{ value: '8%', up: true }} />
        <StatCard icon={<Truck size={17} />} label="Dispatched today" accent="var(--blue)"
          value={kpis ? `${kpis.todayDispatch.toLocaleString()} m³` : '…'} loading={!kpis}
          sub={kpis ? `${kpis.todayChallans} challans` : undefined} trend={{ value: '5%', up: true }} />
        <StatCard icon={<Package size={17} />} label="Active orders" accent="#a78bfa"
          value={kpis ? kpis.activeOrders : '…'} loading={!kpis}
          sub={kpis ? `${kpis.pendingOrders} pending` : undefined} />
        <StatCard icon={<Truck size={17} />} label="Fleet active" accent="var(--orange)"
          value={kpis ? `${kpis.activeVehicles}/${kpis.totalVehicles}` : '…'} loading={!kpis}
          sub={kpis ? `${kpis.maintenanceVehicles} in service` : undefined} />
        <StatCard icon={<IndianRupee size={17} />} label="Outstanding" accent="var(--red)"
          value={kpis ? inr(kpis.outstandingAmount) : '…'} loading={!kpis} sub="Receivables" />
        <StatCard icon={<Users size={17} />} label="Total customers" accent="var(--green)"
          value={kpis ? kpis.totalClients : '…'} loading={!kpis} trend={{ value: '3', up: true }} />
      </div>

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <GlassPanel accent="var(--green)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--green)" />
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Gross merchandise value</span>
            </div>
            <SampleTag />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 12 }}>
            {inr(GMV_TREND.reduce((s, d) => s + d.value, 0) * 1e5)} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>this week</span>
          </div>
          <MiniBars data={GMV_TREND} accent="var(--green)" height={78} />
        </GlassPanel>

        <GlassPanel accent="var(--blue)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Truck size={16} color="var(--blue)" />
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Weekly dispatch (m³)</span>
            </div>
            <SampleTag />
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 12 }}>
            {WEEKLY_DISPATCH.reduce((s, d) => s + d.value, 0).toLocaleString()} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>m³</span>
          </div>
          <MiniBars data={WEEKLY_DISPATCH} accent="var(--blue)" height={78} />
        </GlassPanel>

        <GlassPanel accent="var(--red)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--red)" />
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Open complaints</span>
            </div>
            <SampleTag />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COMPLAINTS.filter(c => c.status === 'open').map(c => {
              const col = c.priority === 'high' ? 'var(--red)' : c.priority === 'medium' ? 'var(--orange)' : 'var(--muted)';
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10,
                  background: mix(col, 8), border: `1px solid ${mix(col, 22)}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subject}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.plant} • {c.ageHrs}h ago</div>
                  </div>
                  <Badge color={col}>{c.priority}</Badge>
                </div>
              );
            })}
          </div>
        </GlassPanel>
      </div>

      <div style={{ marginTop: 16 }}>
        <LiveDutyMap title="Live Duty Map — all plants" />
      </div>
    </div>
  );
}
