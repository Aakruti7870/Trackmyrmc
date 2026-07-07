import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  Wallet, CheckCircle, FileText, Truck, BarChart3, Building2, CalendarCheck,
  User, IndianRupee,
} from 'lucide-react';
import {
  Screen, SectionHead, StatCard, QuickAction, QuickGrid, ListRow, StatusPill,
} from './deliveryKit';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';
import PendingExpensesCard from './PendingExpensesCard';

interface ExpenseLite { id: number; status: 'pending' | 'approved' | 'rejected' }

export default function AccountHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLite[]>([]);

  useEffect(() => {
    Promise.allSettled([
      api.get<Challan[]>('/challans'),
      api.get<ExpenseLite[]>('/expenses'),
    ]).then(([c, e]) => {
      if (c.status === 'fulfilled') setChallans(c.value);
      if (e.status === 'fulfilled') setExpenses(e.value);
    });
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const pendingExpenses = expenses.filter(e => e.status === 'pending').length;
  const delivered = challans.filter(c => c.status === 'delivered').length;
  const recent = challans.slice(0, 3);

  return (
    <Screen>
      <div>
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>{greeting()},</p>
        <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
          {firstNameOf(user?.name, 'there')}
        </h1>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <StatCard value={pendingExpenses} label="To review" color="#b45309" icon={<Wallet className="h-4 w-4" />} />
        <StatCard value={delivered} label="Delivered" color="#15803d" icon={<CheckCircle className="h-4 w-4" />} />
        <StatCard value={challans.length} label="Challans" color="#0284c7" icon={<FileText className="h-4 w-4" />} />
      </div>

      {can('/expense-review') && <PendingExpensesCard onViewAll={() => go('/expense-review')} />}

      {recent.length > 0 && (
        <>
          <SectionHead title="Recent Challans" actionLabel={can('/challans') ? 'View All' : undefined} onAction={() => go('/challans')} />
          <div className="space-y-2.5">
            {recent.map(ch => (
              <ListRow
                key={ch.id}
                mono
                icon={<FileText className="h-5 w-5" />}
                title={`#${ch.challanNo} · ${ch.grade}`}
                badge={<StatusPill label={statusLabel(ch.status)} color={statusColor(ch.status)} bg={statusBg(ch.status)} />}
                sub={`${ch.clientName || '—'} · ${ch.quantity} m³`}
                onClick={can('/challans') ? () => go('/challans') : undefined}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Quick Actions" />
      <QuickGrid cols={4}>
        {can('/expense-review') && <QuickAction label="Expenses" icon={<Wallet className="h-6 w-6" />} onClick={() => go('/expense-review')} />}
        {can('/challans') && <QuickAction label="Challans" icon={<FileText className="h-6 w-6" />} onClick={() => go('/challans')} />}
        {can('/clients') && <QuickAction label="Clients" icon={<Building2 className="h-6 w-6" />} onClick={() => go('/clients')} />}
        {can('/reports') && <QuickAction label="Reports" icon={<BarChart3 className="h-6 w-6" />} onClick={() => go('/reports')} />}
        {can('/dispatch') && <QuickAction label="Dispatch" icon={<Truck className="h-6 w-6" />} onClick={() => go('/dispatch')} />}
        {can('/fuel-log') && <QuickAction label="Fuel Log" icon={<IndianRupee className="h-6 w-6" />} onClick={() => go('/fuel-log')} />}
        {can('/attendance') && <QuickAction label="Attendance" icon={<CalendarCheck className="h-6 w-6" />} onClick={() => go('/attendance')} />}
        {can('/profile') && <QuickAction label="Profile" icon={<User className="h-6 w-6" />} onClick={() => go('/profile')} />}
      </QuickGrid>
    </Screen>
  );
}
