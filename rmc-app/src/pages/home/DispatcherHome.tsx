import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type DashboardKPIs, type Order, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  ClipboardList, Timer, Truck, TrendingUp, Building2, Users, FileText,
  Repeat, Fuel, FlaskConical, BarChart3, CalendarCheck, User, AlertCircle,
} from 'lucide-react';
import {
  Screen, SectionHead, StatCard, QuickAction, QuickGrid, ListRow, GradientBanner, StatusPill,
} from './deliveryKit';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';

export default function DispatcherHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Order[]>('/orders'),
      api.get<Challan[]>('/challans'),
    ]).then(([k, o, c]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (o.status === 'fulfilled') setOrders(o.value);
      if (c.status === 'fulfilled') setChallans(c.value);
    });
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const pending = orders.filter(o => o.status === 'pending');
  const inTransit = challans.filter(c => c.status === 'dispatched');
  const recent = challans.slice(0, 3);

  return (
    <Screen>
      <div>
        <p className="text-[13px]" style={{ color: '#78716c' }}>{greeting()},</p>
        <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: '#1c1917' }}>
          {firstNameOf(user?.name, 'there')}
        </h1>
      </div>

      {pending.length > 0 && can('/dispatch') && (
        <GradientBanner
          icon={<AlertCircle className="h-5 w-5" />}
          eyebrow="Needs dispatch"
          title={`${pending.length} order${pending.length === 1 ? '' : 's'} waiting`}
          actionLabel="Dispatch"
          onAction={() => go('/dispatch')}
        />
      )}

      {kpis && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatCard value={kpis.pendingOrders} label="Orders to dispatch" color="#b45309" icon={<ClipboardList className="h-4 w-4" />} />
          <StatCard value={inTransit.length} label="Challans in transit" color="#0284c7" icon={<Timer className="h-4 w-4" />} />
          <StatCard value={`${kpis.activeVehicles}/${kpis.totalVehicles}`} label="Vehicles available" color="#0f766e" icon={<Truck className="h-4 w-4" />} />
          <StatCard value={Number(kpis.todayDispatch).toFixed(1)} label="Dispatched today (m³)" color="#15803d" icon={<TrendingUp className="h-4 w-4" />} />
        </div>
      )}

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
                sub={`${ch.clientName || '—'} · ${ch.quantity} m³${ch.vehicleNo ? ` · ${ch.vehicleNo}` : ''}`}
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
        {can('/clients') && <QuickAction label="Clients" icon={<Building2 className="h-6 w-6" />} onClick={() => go('/clients')} />}
        {can('/vehicles') && <QuickAction label="Vehicles" icon={<Truck className="h-6 w-6" />} onClick={() => go('/vehicles')} />}
        {can('/drivers') && <QuickAction label="Drivers" icon={<Users className="h-6 w-6" />} onClick={() => go('/drivers')} />}
        {can('/freshness') && <QuickAction label="Freshness" icon={<Timer className="h-6 w-6" />} onClick={() => go('/freshness')} />}
        {can('/challans') && <QuickAction label="Challans" icon={<FileText className="h-6 w-6" />} onClick={() => go('/challans')} />}
        {can('/forecast') && <QuickAction label="Forecast" icon={<TrendingUp className="h-6 w-6" />} onClick={() => go('/forecast')} />}
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
