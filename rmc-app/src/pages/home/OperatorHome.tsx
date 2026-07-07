import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type DashboardKPIs, type BatchRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  Boxes, Layers, Truck, ClipboardList, FlaskConical, Timer, BarChart3,
  CalendarCheck, User, Plus,
} from 'lucide-react';
import {
  Screen, SectionHead, StatCard, QuickAction, QuickGrid, ListRow,
} from './deliveryKit';
import { greeting, firstNameOf } from './format';

export default function OperatorHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [batches, setBatches] = useState<BatchRecord[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<BatchRecord[]>('/batches'),
    ]).then(([k, b]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (b.status === 'fulfilled') setBatches(b.value);
    });
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const recentBatches = batches.slice(0, 3);

  return (
    <Screen>
      <div>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{greeting()},</p>
        <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          {firstNameOf(user?.name, 'Operator')}
        </h1>
      </div>

      {kpis && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <StatCard value={Number(kpis.todayProduction).toFixed(1)} label="Produced today (m³)" color="#15803d" icon={<Boxes className="h-4 w-4" />} />
          <StatCard value={kpis.todayBatches} label="Batches today" color="var(--gold)" icon={<Layers className="h-4 w-4" />} />
          <StatCard value={Number(kpis.todayDispatch).toFixed(1)} label="Dispatched (m³)" color="#0284c7" icon={<Truck className="h-4 w-4" />} />
          <StatCard value={`${kpis.activeVehicles}/${kpis.totalVehicles}`} label="Vehicles online" color="var(--gold)" icon={<Truck className="h-4 w-4" />} />
        </div>
      )}

      {recentBatches.length > 0 && (
        <>
          <SectionHead title="Recent Batches" actionLabel={can('/batch-report') ? 'View All' : undefined} onAction={() => go('/batch-report')} />
          <div className="space-y-2.5">
            {recentBatches.map(b => (
              <ListRow
                key={b.id}
                icon={<Layers className="h-5 w-5" />}
                title={`${b.batchNo} · ${b.grade}`}
                sub={`${b.quantity} m³${b.operator ? ` · ${b.operator}` : ''}`}
                onClick={can('/batch-report') ? () => go('/batch-report') : undefined}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Quick Actions" />
      <QuickGrid cols={4}>
        {can('/batch-report') && <QuickAction label="New Batch" icon={<Plus className="h-6 w-6" />} onClick={() => go('/batch-report')} />}
        {can('/batch-report') && <QuickAction label="Batch Report" icon={<ClipboardList className="h-6 w-6" />} onClick={() => go('/batch-report')} />}
        {can('/mix-design') && <QuickAction label="Mix Design" icon={<FlaskConical className="h-6 w-6" />} onClick={() => go('/mix-design')} />}
        {can('/freshness') && <QuickAction label="Freshness" icon={<Timer className="h-6 w-6" />} onClick={() => go('/freshness')} />}
        {can('/shift-report') && <QuickAction label="Shift Report" icon={<BarChart3 className="h-6 w-6" />} onClick={() => go('/shift-report')} />}
        {can('/reports') && <QuickAction label="Reports" icon={<BarChart3 className="h-6 w-6" />} onClick={() => go('/reports')} />}
        {can('/attendance') && <QuickAction label="Attendance" icon={<CalendarCheck className="h-6 w-6" />} onClick={() => go('/attendance')} />}
        {can('/profile') && <QuickAction label="Profile" icon={<User className="h-6 w-6" />} onClick={() => go('/profile')} />}
      </QuickGrid>
    </Screen>
  );
}
