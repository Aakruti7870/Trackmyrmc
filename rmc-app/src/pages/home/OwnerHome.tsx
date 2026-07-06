import { useState, useEffect } from 'react';
import { api, type DashboardKPIs, type Client } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { TrendingUp, Clock, Users, IndianRupee, BarChart3, Truck, ClipboardList, Factory, Zap } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile } from './primitives';
import { greeting, firstNameOf, fmtRs } from './format';

export default function OwnerHome() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Client[]>('/clients'),
    ]).then(([k, c]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (c.status === 'fulfilled') setClients(c.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const debtors = [...clients]
    .filter(c => Number(c.outstandingAmount) > 0)
    .sort((a, b) => Number(b.outstandingAmount) - Number(a.outstandingAmount))
    .slice(0, 3);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name, 'Owner')} subtitle={greeting()} />

      {kpis && (
        <StatRow cols={2}>
          <StatTile label="Today dispatch" value={Number(kpis.todayDispatch).toFixed(1)} sub={`${kpis.todayChallans} challans`} color="var(--green)" icon={TrendingUp} />
          <StatTile label="Active orders" value={kpis.activeOrders} sub={`${kpis.pendingOrders} pending`} color="var(--gold)" icon={Clock} />
          <StatTile label="Outstanding" value={fmtRs(Number(kpis.outstandingAmount))} sub="receivables" color="var(--red)" icon={IndianRupee} />
          <StatTile label="Clients" value={kpis.totalClients} sub="accounts" color="var(--blue)" icon={Users} />
        </StatRow>
      )}

      {debtors.length > 0 && can('/clients') && (
        <Section title="Top receivables" href="/clients">
          {debtors.map(c => (
            <RowLink
              key={c.id}
              href="/clients"
              title={c.name}
              sub={c.city || c.contactPerson || '—'}
              right={<span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: 'var(--red)' }}>{fmtRs(Number(c.outstandingAmount))}</span>}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/reports') && <ActionTile href="/reports" label="Reports" sub="Business analytics" icon={BarChart3} color="var(--green)" />}
        {can('/dispatch') && <ActionTile href="/dispatch" label="Dispatch" sub="Assign trucks" icon={Truck} color="var(--blue)" />}
        {can('/orders') && <ActionTile href="/orders" label="Orders" sub="Manage orders" icon={ClipboardList} color="var(--gold)" />}
        {can('/clients') && <ActionTile href="/clients" label="Clients" sub="Accounts & dues" icon={Users} color="var(--orange)" />}
        {can('/plants') && <ActionTile href="/plants" label="Plant" sub="Profile & setup" icon={Factory} color="var(--muted)" />}
        {can('/automations') && <ActionTile href="/automations" label="Automations" sub="Scheduled jobs" icon={Zap} color="var(--green)" />}
      </ActionGrid>
    </div>
  );
}
