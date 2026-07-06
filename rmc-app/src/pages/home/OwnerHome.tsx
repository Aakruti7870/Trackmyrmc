import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type DashboardKPIs, type Client } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  IndianRupee, TrendingUp, Clock, Users, Building2, ClipboardList, Truck,
  Wallet, BarChart3, FileText, Layers, CalendarCheck, User, Radio,
} from 'lucide-react';
import {
  Screen, SectionHead, StatCard, QuickAction, QuickGrid, ListRow,
} from './deliveryKit';
import { greeting, firstNameOf, fmtRs } from './format';
import PendingExpensesCard from './PendingExpensesCard';

export default function OwnerHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<Client[]>('/clients'),
    ]).then(([k, c]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (c.status === 'fulfilled') setClients(c.value);
    });
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const receivables = [...clients]
    .filter(c => Number(c.outstandingAmount) > 0)
    .sort((a, b) => Number(b.outstandingAmount) - Number(a.outstandingAmount))
    .slice(0, 3);

  return (
    <Screen>
      <div>
        <p className="text-[13px]" style={{ color: '#78716c' }}>{greeting()},</p>
        <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: '#1c1917' }}>
          {firstNameOf(user?.name, 'there')}
        </h1>
      </div>

      {kpis && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatCard value={fmtRs(Number(kpis.outstandingAmount))} label="Outstanding" color="#ef4444" icon={<IndianRupee className="h-4 w-4" />} />
          <StatCard value={Number(kpis.todayDispatch).toFixed(1)} label="Dispatched today (m³)" color="#15803d" icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard value={kpis.activeOrders} label="Active orders" color="#b45309" icon={<Clock className="h-4 w-4" />} />
          <StatCard value={kpis.totalClients} label="Clients" color="#0284c7" icon={<Users className="h-4 w-4" />} />
        </div>
      )}

      {can('/expense-review') && <PendingExpensesCard onViewAll={() => go('/expense-review')} />}

      {receivables.length > 0 && can('/clients') && (
        <>
          <SectionHead title="Top Receivables" actionLabel="Clients" onAction={() => go('/clients')} />
          <div className="space-y-2.5">
            {receivables.map(c => (
              <ListRow
                key={c.id}
                icon={<Building2 className="h-5 w-5" />}
                title={c.name}
                sub={c.city || c.contactPerson || '—'}
                right={<span className="text-[13px] font-bold" style={{ color: '#ef4444' }}>{fmtRs(Number(c.outstandingAmount))}</span>}
                onClick={() => go('/clients')}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Quick Actions" />
      <QuickGrid cols={4}>
        {can('/reports') && <QuickAction label="Reports" icon={<BarChart3 className="h-6 w-6" />} onClick={() => go('/reports')} />}
        {can('/clients') && <QuickAction label="Clients" icon={<Building2 className="h-6 w-6" />} onClick={() => go('/clients')} />}
        {can('/orders') && <QuickAction label="Orders" icon={<ClipboardList className="h-6 w-6" />} onClick={() => go('/orders')} />}
        {can('/dispatch') && <QuickAction label="Dispatch" icon={<Truck className="h-6 w-6" />} onClick={() => go('/dispatch')} />}
        {can('/live-drivers') && <QuickAction label="Live Drivers" icon={<Radio className="h-6 w-6" />} onClick={() => go('/live-drivers')} />}
        {can('/expense-review') && <QuickAction label="Expenses" icon={<Wallet className="h-6 w-6" />} onClick={() => go('/expense-review')} />}
        {can('/vehicles') && <QuickAction label="Vehicles" icon={<Truck className="h-6 w-6" />} onClick={() => go('/vehicles')} />}
        {can('/drivers') && <QuickAction label="Drivers" icon={<Users className="h-6 w-6" />} onClick={() => go('/drivers')} />}
        {can('/batch-report') && <QuickAction label="Batch Report" icon={<Layers className="h-6 w-6" />} onClick={() => go('/batch-report')} />}
        {can('/challans') && <QuickAction label="Challans" icon={<FileText className="h-6 w-6" />} onClick={() => go('/challans')} />}
        {can('/attendance') && <QuickAction label="Attendance" icon={<CalendarCheck className="h-6 w-6" />} onClick={() => go('/attendance')} />}
        {can('/profile') && <QuickAction label="Profile" icon={<User className="h-6 w-6" />} onClick={() => go('/profile')} />}
      </QuickGrid>
    </Screen>
  );
}
