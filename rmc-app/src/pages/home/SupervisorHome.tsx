import { useState, useEffect } from 'react';
import { api, type DashboardKPIs, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { Clock, Radio, CarFront, TrendingUp, Truck, ClipboardList, Siren, Wallet, Users, BarChart3 } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile, AlertBand } from './primitives';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';

interface Expense { id: number; status: string }
interface Emergency { id: number; status?: string; resolvedAt?: string | null }

export default function SupervisorHome() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Challan[]>('/challans'),
      api.get<Expense[]>('/expenses'),
      api.get<Emergency[]>('/emergencies'),
    ]).then(([k, c, e, em]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (c.status === 'fulfilled') setChallans(c.value);
      if (e.status === 'fulfilled') setExpenses(e.value);
      if (em.status === 'fulfilled') setEmergencies(em.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const inTransit = challans.filter(c => c.status === 'dispatched');
  const recent = challans.slice(0, 3);
  const pendingExpenses = expenses.filter(e => e.status === 'pending');
  const activeEmergencies = emergencies.filter(e => !e.resolvedAt && e.status !== 'resolved');

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name)} subtitle={greeting()} />

      {activeEmergencies.length > 0 && can('/emergencies') && (
        <AlertBand tone="var(--red)" icon={Siren} title={`${activeEmergencies.length} active SOS`} sub="Driver emergencies need attention" href="/emergencies" actionLabel="Open" />
      )}
      {pendingExpenses.length > 0 && can('/expense-review') && (
        <AlertBand tone="var(--gold)" icon={Wallet} title={`${pendingExpenses.length} expense${pendingExpenses.length === 1 ? '' : 's'} to review`} sub="Approvals waiting" href="/expense-review" actionLabel="Review" />
      )}

      {kpis && (
        <StatRow cols={2}>
          <StatTile label="Active orders" value={kpis.activeOrders} sub={`${kpis.pendingOrders} pending`} color="var(--gold)" icon={Clock} />
          <StatTile label="In transit" value={inTransit.length} sub="on the road" color="var(--blue)" icon={Radio} />
          <StatTile label="Fleet" value={`${kpis.activeVehicles}/${kpis.totalVehicles}`} sub={`${kpis.maintenanceVehicles} in maint.`} color="var(--orange)" icon={CarFront} />
          <StatTile label="Today dispatch" value={Number(kpis.todayDispatch).toFixed(1)} sub={`${kpis.todayChallans} challans`} color="var(--green)" icon={TrendingUp} />
        </StatRow>
      )}

      {recent.length > 0 && (
        <Section title="Recent dispatch" href={can('/dispatch') ? '/dispatch' : undefined}>
          {recent.map(ch => (
            <RowLink
              key={ch.id}
              href="/dispatch"
              title={`#${ch.challanNo} · ${ch.grade}`}
              sub={`${ch.clientName || '—'} · ${ch.quantity} m³`}
              badge={{ label: statusLabel(ch.status), color: statusColor(ch.status), bg: statusBg(ch.status) }}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/dispatch') && <ActionTile href="/dispatch" label="Dispatch" sub="Assign trucks" icon={Truck} color="var(--green)" />}
        {can('/orders') && <ActionTile href="/orders" label="Orders" sub="Manage orders" icon={ClipboardList} color="var(--gold)" />}
        {can('/live-drivers') && <ActionTile href="/live-drivers" label="Live drivers" sub="On-shift map" icon={Users} color="var(--blue)" />}
        {can('/expense-review') && <ActionTile href="/expense-review" label="Expenses" sub="Approvals" icon={Wallet} color="var(--orange)" />}
        {can('/emergencies') && <ActionTile href="/emergencies" label="Emergencies" sub="Driver SOS" icon={Siren} color="var(--red)" />}
        {can('/reports') && <ActionTile href="/reports" label="Reports" sub="Analytics" icon={BarChart3} color="var(--muted)" />}
      </ActionGrid>
    </div>
  );
}
