import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { api, type DashboardKPIs, type AdminPlant } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { RoleHomeBooster, type OrderLike } from '@/v138';
import {
  TrendingUp, Clock, Users, IndianRupee, Building2, UserCog, Zap, ScrollText,
  Activity, TriangleAlert, ClipboardList, Truck, Radio, Wallet, Timer, Layers,
  FileText, TrendingUp as Forecast, Repeat, Fuel, FlaskConical, BarChart3,
  CalendarCheck, User,
} from 'lucide-react';
import {
  Screen, SectionHead, StatCard, QuickAction, QuickGrid, ListRow, StatusPill,
} from './deliveryKit';
import { greeting, firstNameOf, fmtRs, statusColor, statusBg } from './format';
import PendingExpensesCard from './PendingExpensesCard';

export default function AdminHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [plants, setPlants] = useState<AdminPlant[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderLike[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<AdminPlant[]>('/plants'),
      api.get<OrderLike[]>('/orders?limit=20'),
    ]).then(([k, p, o]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (p.status === 'fulfilled') setPlants(p.value);
      if (o.status === 'fulfilled') setRecentOrders(Array.isArray(o.value) ? o.value : []);
    });
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const recentPlants = plants.slice(0, 3);
  const boosterOrders = useMemo(() => recentOrders, [recentOrders]);

  return (
    <Screen>
      <div>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{greeting()},</p>
        <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          {firstNameOf(user?.name, 'Admin')}
        </h1>
      </div>

      {kpis && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatCard value={Number(kpis.todayDispatch).toFixed(1)} label="Dispatched today (m³)" color="#15803d" icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard value={kpis.activeOrders} label="Active orders" color="#b45309" icon={<Clock className="h-4 w-4" />} />
          <StatCard value={kpis.totalClients} label="Clients" color="#0284c7" icon={<Users className="h-4 w-4" />} />
          <StatCard value={fmtRs(Number(kpis.outstandingAmount))} label="Outstanding" color="#ef4444" icon={<IndianRupee className="h-4 w-4" />} />
        </div>
      )}

      <RoleHomeBooster role={user?.role} orders={boosterOrders} onNavigate={go} maxAlerts={4} />

      {can('/expense-review') && <PendingExpensesCard onViewAll={() => go('/expense-review')} />}

      {recentPlants.length > 0 && can('/plants') && (
        <>
          <SectionHead title="Plants" actionLabel="View All" onAction={() => go('/plants')} />
          <div className="space-y-2.5">
            {recentPlants.map(p => (
              <ListRow
                key={p.id}
                icon={<Building2 className="h-5 w-5" />}
                title={p.name}
                badge={<StatusPill label={p.networkStatus} color={statusColor(p.networkStatus === 'active' ? 'delivered' : 'pending')} bg={statusBg(p.networkStatus === 'active' ? 'delivered' : 'pending')} />}
                sub={p.city || p.plantCode || '—'}
                onClick={() => go('/plants')}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Quick Actions" />
      <QuickGrid cols={4}>
        {can('/plants') && <QuickAction label="Plants" icon={<Building2 className="h-6 w-6" />} onClick={() => go('/plants')} />}
        {can('/users') && <QuickAction label="Users" icon={<Users className="h-6 w-6" />} onClick={() => go('/users')} />}
        {can('/user-management') && <QuickAction label="User Mgmt" icon={<UserCog className="h-6 w-6" />} onClick={() => go('/user-management')} />}
        {can('/automations') && <QuickAction label="Automations" icon={<Zap className="h-6 w-6" />} onClick={() => go('/automations')} />}
        {can('/audit-log') && <QuickAction label="Audit Log" icon={<ScrollText className="h-6 w-6" />} onClick={() => go('/audit-log')} />}
        {can('/activity-log') && <QuickAction label="Activity Log" icon={<Activity className="h-6 w-6" />} onClick={() => go('/activity-log')} />}
        {can('/emergencies') && <QuickAction label="Emergencies" tint="#ef4444" bg="#fef2f2" icon={<TriangleAlert className="h-6 w-6" />} onClick={() => go('/emergencies')} />}
        {can('/orders') && <QuickAction label="Orders" icon={<ClipboardList className="h-6 w-6" />} onClick={() => go('/orders')} />}
        {can('/dispatch') && <QuickAction label="Dispatch" icon={<Truck className="h-6 w-6" />} onClick={() => go('/dispatch')} />}
        {can('/live-drivers') && <QuickAction label="Live Drivers" icon={<Radio className="h-6 w-6" />} onClick={() => go('/live-drivers')} />}
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
