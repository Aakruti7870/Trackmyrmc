import { useState, useEffect } from 'react';
import { api, type DashboardKPIs, type BatchRecord } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { Boxes, Layers, Package, ClipboardList, FlaskConical, Timer, BarChart3, CalendarClock } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile } from './primitives';
import { greeting, firstNameOf } from './format';

export default function OperatorHome() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<DashboardKPIs>('/dashboard/kpis'),
      api.get<BatchRecord[]>('/batches'),
    ]).then(([k, b]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (b.status === 'fulfilled') setBatches(b.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const recentBatches = batches.slice(0, 3);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name, 'Operator')} subtitle={greeting()} />

      {kpis && (
        <StatRow cols={3}>
          <StatTile label="Production" value={Number(kpis.todayProduction).toFixed(1)} sub="m³ today" color="var(--blue)" icon={Boxes} />
          <StatTile label="Batches" value={kpis.todayBatches} sub="today" color="var(--gold)" icon={Layers} />
          <StatTile label="Dispatch" value={Number(kpis.todayDispatch).toFixed(1)} sub="m³ today" color="var(--green)" icon={Package} />
        </StatRow>
      )}

      {recentBatches.length > 0 && (
        <Section title="Recent batches" href={can('/batch-report') ? '/batch-report' : undefined}>
          {recentBatches.map(b => (
            <RowLink
              key={b.id}
              href="/batch-report"
              title={`${b.batchNo} · ${b.grade}`}
              sub={`${b.quantity} m³${b.operator ? ' · ' + b.operator : ''}`}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/batch-report') && <ActionTile href="/batch-report" label="Log batch" sub="Record production" icon={ClipboardList} color="var(--gold)" />}
        {can('/mix-design') && <ActionTile href="/mix-design" label="Mix design" sub="Grade proportions" icon={FlaskConical} color="var(--blue)" />}
        {can('/freshness') && <ActionTile href="/freshness" label="Freshness" sub="Pour-by guard" icon={Timer} color="var(--orange)" />}
        {can('/reports') && <ActionTile href="/reports" label="Reports" sub="Production analytics" icon={BarChart3} color="var(--green)" />}
        {can('/attendance') && <ActionTile href="/attendance" label="Attendance" sub="Clock in / out" icon={CalendarClock} color="var(--muted)" />}
      </ActionGrid>
    </div>
  );
}
