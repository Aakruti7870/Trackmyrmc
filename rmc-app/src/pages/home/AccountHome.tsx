import { useState, useEffect } from 'react';
import { api, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { CheckCircle, Wallet, BarChart3, FileText, User } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile, AlertBand } from './primitives';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';

interface Expense { id: number; status: string }

export default function AccountHome() {
  const { user } = useAuth();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<Challan[]>('/challans'),
      api.get<Expense[]>('/expenses'),
    ]).then(([c, e]) => {
      if (c.status === 'fulfilled') setChallans(c.value);
      if (e.status === 'fulfilled') setExpenses(e.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const delivered = challans.filter(c => c.status === 'delivered');
  const pendingExpenses = expenses.filter(e => e.status === 'pending');
  const recent = challans.slice(0, 3);
  const hasStats = !loading && (challans.length > 0 || expenses.length > 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name, 'there')} subtitle={greeting()} />

      {pendingExpenses.length > 0 && can('/expense-review') && (
        <AlertBand tone="var(--gold)" icon={Wallet} title={`${pendingExpenses.length} expense${pendingExpenses.length === 1 ? '' : 's'} to review`} sub="Approvals waiting" href="/expense-review" actionLabel="Review" />
      )}

      {hasStats && (
        <StatRow cols={2}>
          <StatTile label="Deliveries" value={delivered.length} sub="delivered" color="var(--green)" icon={CheckCircle} />
          <StatTile label="To review" value={pendingExpenses.length} sub="expenses" color="var(--gold)" icon={Wallet} />
        </StatRow>
      )}

      {recent.length > 0 && (
        <Section title="Recent deliveries" href={can('/challans') ? '/challans' : undefined}>
          {recent.map(ch => (
            <RowLink
              key={ch.id}
              href="/challans"
              title={`#${ch.challanNo} · ${ch.grade}`}
              sub={`${ch.clientName || '—'} · ${ch.quantity} m³`}
              badge={{ label: statusLabel(ch.status), color: statusColor(ch.status), bg: statusBg(ch.status) }}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/reports') && <ActionTile href="/reports" label="Reports" sub="Financial analytics" icon={BarChart3} color="var(--green)" />}
        {can('/challans') && <ActionTile href="/challans" label="Deliveries" sub="Billing documents" icon={FileText} color="var(--blue)" />}
        {can('/expense-review') && <ActionTile href="/expense-review" label="Expenses" sub="Review & approve" icon={Wallet} color="var(--orange)" />}
        {can('/profile') && <ActionTile href="/profile" label="Account" sub="Profile & settings" icon={User} color="var(--muted)" />}
      </ActionGrid>
    </div>
  );
}
