import { useState, useEffect } from 'react';
import { api, type DashboardKPIs, type AdminPlant } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { TrendingUp, Clock, Users, IndianRupee, Truck, ClipboardList, Factory, ShieldCheck, Zap, BarChart3 } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile } from './primitives';
import { greeting, firstNameOf, fmtRs, statusColor, statusBg } from './format';

export default function AdminHome() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [plants, setPlants] = useState<AdminPlant[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<AdminPlant[]>('/plants'),
    ]).then(([k, p]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (p.status === 'fulfilled') setPlants(p.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const recentPlants = plants.slice(0, 3);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name, 'Admin')} subtitle={greeting()} />

      {kpis && (
        <StatRow cols={2}>
          <StatTile label="Today dispatch" value={Number(kpis.todayDispatch).toFixed(1)} sub={`${kpis.todayChallans} challans`} color="var(--green)" icon={TrendingUp} />
          <StatTile label="Active orders" value={kpis.activeOrders} sub={`${kpis.pendingOrders} pending`} color="var(--gold)" icon={Clock} />
          <StatTile label="Clients" value={kpis.totalClients} sub="accounts" color="var(--blue)" icon={Users} />
          <StatTile label="Outstanding" value={fmtRs(Number(kpis.outstandingAmount))} sub="receivables" color="var(--red)" icon={IndianRupee} />
        </StatRow>
      )}

      {recentPlants.length > 0 && can('/plants') && (
        <Section title="Plants" href="/plants">
          {recentPlants.map(p => (
            <RowLink
              key={p.id}
              href="/plants"
              title={p.name}
              sub={p.city || p.plantCode || '—'}
              badge={{ label: p.networkStatus, color: statusColor(p.networkStatus === 'active' ? 'delivered' : 'pending'), bg: statusBg(p.networkStatus === 'active' ? 'delivered' : 'pending') }}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/dispatch') && <ActionTile href="/dispatch" label="Dispatch" sub="Assign trucks" icon={Truck} color="var(--green)" />}
        {can('/orders') && <ActionTile href="/orders" label="Orders" sub="Manage orders" icon={ClipboardList} color="var(--gold)" />}
        {can('/plants') && <ActionTile href="/plants" label="Plants" sub="Network" icon={Factory} color="var(--blue)" />}
        {can('/users') && <ActionTile href="/users" label="Users" sub="Roles & access" icon={ShieldCheck} color="var(--orange)" />}
        {can('/automations') && <ActionTile href="/automations" label="Automations" sub="Scheduled jobs" icon={Zap} color="var(--muted)" />}
        {can('/reports') && <ActionTile href="/reports" label="Reports" sub="Analytics" icon={BarChart3} color="var(--green)" />}
      </ActionGrid>
    </div>
  );
}
