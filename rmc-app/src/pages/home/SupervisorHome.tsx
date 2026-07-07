import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type DashboardKPIs, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  Clock, Radio, Truck, TrendingUp, ClipboardList, Wallet, Building2, Users,
  Timer, Layers, FileText, TrendingUp as Forecast, Repeat, Fuel, FlaskConical,
  BarChart3, CalendarCheck, User, TriangleAlert,
} from 'lucide-react';
import {
  Screen, SectionHead, StatCard, QuickAction, QuickGrid, ListRow, GradientBanner, StatusPill,
} from './deliveryKit';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';
import PendingExpensesCard from './PendingExpensesCard';

interface Emergency { id: number; status?: string; resolvedAt?: string | null }

export default function SupervisorHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Challan[]>('/challans'),
      api.get<Emergency[]>('/emergencies'),
    ]).then(([k, c, em]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (c.status === 'fulfilled') setChallans(c.value);
      if (em.status === 'fulfilled') setEmergencies(em.value);
    });
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const inTransit = challans.filter(c => c.status === 'dispatched');
  const recent = challans.slice(0, 3);
  const activeEmergencies = emergencies.filter(e => !e.resolvedAt && e.status !== 'resolved');

  return (
    <Screen>
      <div>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{greeting()},</p>
        <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          {firstNameOf(user?.name, 'there')}
        </h1>
      </div>

      {activeEmergencies.length > 0 && can('/emergencies') && (
        <GradientBanner
          icon={<TriangleAlert className="h-5 w-5" />}
          eyebrow="Emergency"
          title={`${activeEmergencies.length} active SOS`}
          actionLabel="Open"
          onAction={() => go('/emergencies')}
        />
      )}

      {kpis && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatCard value={kpis.activeOrders} label="Active orders" color="#b45309" icon={<Clock className="h-4 w-4" />} />
          <StatCard value={inTransit.length} label="In transit" color="#0284c7" icon={<Radio className="h-4 w-4" />} />
          <StatCard value={`${kpis.activeVehicles}/${kpis.totalVehicles}`} label="Vehicles available" color="var(--gold)" icon={<Truck className="h-4 w-4" />} />
          <StatCard value={Number(kpis.todayDispatch).toFixed(1)} label="Dispatched today (m³)" color="#15803d" icon={<TrendingUp className="h-4 w-4" />} />
        </div>
      )}

      {can('/expense-review') && <PendingExpensesCard onViewAll={() => go('/expense-review')} />}

      {recent.length > 0 && (
        <>
          <SectionHead title="Recent Dispatch" actionLabel={can('/dispatch') ? 'View All' : undefined} onAction={() => go('/dispatch')} />
          <div className="space-y-2.5">
            {recent.map(ch => (
              <ListRow
                key={ch.id}
                mono
                icon={<Truck className="h-5 w-5" />}
                title={`#${ch.challanNo} · ${ch.grade}`}
                badge={<StatusPill label={statusLabel(ch.status)} color={statusColor(ch.status)} bg={statusBg(ch.status)} />}
                sub={`${ch.clientName || '—'} · ${ch.quantity} m³`}
                onClick={can('/dispatch') ? () => go('/dispatch') : undefined}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Quick Actions" />
      <QuickGrid cols={4}>
        {can('/orders') && <QuickAction label="Orders" icon={<ClipboardList className="h-6 w-6" />} onClick={() => go('/orders')} />}
        {can('/dispatch') && <QuickAction label="Dispatch" icon={<Truck className="h-6 w-6" />} onClick={() => go('/dispatch')} />}
        {can('/live-drivers') && <QuickAction label="Live Drivers" icon={<Radio className="h-6 w-6" />} onClick={() => go('/live-drivers')} />}
        {can('/emergencies') && <QuickAction label="Emergencies" tint="#ef4444" bg="#fef2f2" icon={<TriangleAlert className="h-6 w-6" />} onClick={() => go('/emergencies')} />}
        {can('/expense-review') && <QuickAction label="Expenses" icon={<Wallet className="h-6 w-6" />} onClick={() => go('/expense-review')} />}
        {can('/clients') && <QuickAction label="Clients" icon={<Building2 className="h-6 w-6" />} onClick={() => go('/clients')} />}
        {can('/vehicles') && <QuickAction label="Vehicles" icon={<Truck className="h-6 w-6" />} onClick={() => go('/vehicles')} />}
        {can('/drivers') && <QuickAction label="Drivers" icon={<Users className="h-6 w-6" />} onClick={() => go('/drivers')} />}
        {can('/freshness') && <QuickAction label="Freshness" icon={<Timer className="h-6 w-6" />} onClick={() => go('/freshness')} />}
        {can('/batch-report') && <QuickAction label="Batch Report" icon={<Layers className="h-6 w-6" />} onClick={() => go('/batch-report')} />}
        {can('/challans') && <QuickAction label="Challans" icon={<FileText className="h-6 w-6" />} onClick={() => go('/challans')} />}
        {can('/forecast') && <QuickAction label="Forecast" icon={<Forecast className="h-6 w-6" />} onClick={() => go('/forecast')} />}
        {can('/recurring') && <QuickAction label="Recurring" icon={<Repeat className="h-6 w-6" />} onClick={() => go('/recurring')} />}
        {can('/fuel-log') && <QuickAction label="Fuel Log" icon={<Fuel className="h-6 w-6" />} onClick={() => go('/fuel-log')} />}
        {can('/mix-design') && <QuickAction label="Mix Design" icon={<FlaskConical className="h-6 w-6" />} onClick={() => go('/mix-design')} />}
        {can('/reports') && <QuickAction label="Reports" icon={<BarChart3 className="h-6 w-6" />} onClick={() => go('/reports')} />}
        {can('/attendance') && <QuickAction label="Attendance" icon={<CalendarCheck className="h-6 w-6" />} onClick={() => go('/attendance')} />}
        {can('/profile') && <QuickAction label="Profile" icon={<User className="h-6 w-6" />} onClick={() => go('/profile')} />}
      </QuickGrid>
    </Screen>
  );
}
