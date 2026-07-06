import { useState, useEffect } from 'react';
import { api, type DashboardKPIs, type Order, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { Clock, Radio, CarFront, TrendingUp, Truck, ClipboardList, Timer, BarChart3, AlertCircle } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile, AlertBand } from './primitives';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';

export default function DispatcherHome() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Order[]>('/orders'),
      api.get<Challan[]>('/challans'),
    ]).then(([k, o, c]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (o.status === 'fulfilled') setOrders(o.value);
      if (c.status === 'fulfilled') setChallans(c.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const pending = orders.filter(o => o.status === 'pending');
  const inTransit = challans.filter(c => c.status === 'dispatched');
  const recent = challans.slice(0, 3);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name)} subtitle={greeting()} />

      {pending.length > 0 && can('/dispatch') && (
        <AlertBand
          tone="var(--gold)"
          icon={AlertCircle}
          title={`${pending.length} order${pending.length === 1 ? '' : 's'} need dispatch`}
          sub="Assign trucks to waiting orders"
          href="/dispatch"
          actionLabel="Dispatch"
        />
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
              sub={`${ch.clientName || '—'} · ${ch.quantity} m³${ch.vehicleNo ? ' · ' + ch.vehicleNo : ''}`}
              badge={{ label: statusLabel(ch.status), color: statusColor(ch.status), bg: statusBg(ch.status) }}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/dispatch') && <ActionTile href="/dispatch" label="New challan" sub="Assign & dispatch" icon={Truck} color="var(--green)" />}
        {can('/orders') && <ActionTile href="/orders" label="Orders" sub="Manage orders" icon={ClipboardList} color="var(--gold)" />}
        {can('/vehicles') && <ActionTile href="/vehicles" label="Fleet" sub="Transit mixers" icon={CarFront} color="var(--blue)" />}
        {can('/freshness') && <ActionTile href="/freshness" label="Freshness" sub="Pour-by guard" icon={Timer} color="var(--orange)" />}
        {can('/reports') && <ActionTile href="/reports" label="Reports" sub="Analytics" icon={BarChart3} color="var(--muted)" />}
      </ActionGrid>
    </div>
  );
}
