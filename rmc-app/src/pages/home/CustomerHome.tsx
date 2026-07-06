import { useState, useEffect } from 'react';
import { api, type Order, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { MapPin, PackageSearch, Truck, FileText, User, Clock, CheckCircle, Navigation } from 'lucide-react';
import { HomeHeader, StatTile, StatRow, Section, RowLink, ActionGrid, ActionTile, AlertBand } from './primitives';
import { greeting, firstNameOf, statusColor, statusBg, statusLabel } from './format';

export default function CustomerHome() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<Order[]>('/me/orders'),
      api.get<Challan[]>('/me/challans'),
    ]).then(([o, c]) => {
      if (o.status === 'fulfilled') setOrders(o.value);
      if (c.status === 'fulfilled') setChallans(c.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'in_progress');
  const inTransit = challans.filter(c => c.status === 'dispatched');
  const delivered = challans.filter(c => c.status === 'delivered');
  const recentOrders = orders.slice(0, 3);
  const primary = inTransit[0];
  const hasStats = !loading && (orders.length > 0 || challans.length > 0);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <HomeHeader name={firstNameOf(user?.name)} subtitle={greeting()} />

      {primary && (
        <AlertBand
          tone="var(--blue)"
          icon={Truck}
          title="On the way"
          sub={`${primary.challanNo}${primary.siteName ? ' → ' + primary.siteName : ''} · ${primary.grade} · ${primary.quantity} m³`}
          href="/my-orders?tab=deliveries"
          actionLabel="Track"
        />
      )}

      {hasStats && (
        <StatRow cols={3}>
          <StatTile label="Active" value={activeOrders.length} color="var(--gold)" icon={Clock} />
          <StatTile label="In transit" value={inTransit.length} color="var(--blue)" icon={Navigation} />
          <StatTile label="Delivered" value={delivered.length} color="var(--green)" icon={CheckCircle} />
        </StatRow>
      )}

      {recentOrders.length > 0 && (
        <Section title="Recent orders" href={can('/my-orders') ? '/my-orders' : undefined}>
          {recentOrders.map(o => (
            <RowLink
              key={o.id}
              href="/my-orders"
              title={`${o.orderNo} · ${o.grade}`}
              sub={`${o.quantity} m³${o.plantName ? ' · ' + o.plantName : ''}`}
              badge={{ label: statusLabel(o.status), color: statusColor(o.status), bg: statusBg(o.status) }}
            />
          ))}
        </Section>
      )}

      <h2 style={{ fontSize: 14, fontWeight: 800, margin: '18px 0 10px' }}>Quick actions</h2>
      <ActionGrid>
        {can('/nearby-plants') && <ActionTile href="/nearby-plants" label="Find plants" sub="Order concrete nearby" icon={MapPin} color="var(--gold)" />}
        {can('/my-orders') && <ActionTile href="/my-orders" label="My orders" sub="Track & reorder" icon={PackageSearch} color="var(--blue)" />}
        {can('/my-orders') && <ActionTile href="/my-orders?tab=deliveries" label="Deliveries" sub="Delivery history" icon={Truck} color="var(--green)" />}
        {can('/my-orders') && <ActionTile href="/my-orders?tab=billing" label="Billing" sub="Statements & dues" icon={FileText} color="var(--orange)" />}
        {can('/profile') && <ActionTile href="/profile" label="Account" sub="Profile & settings" icon={User} color="var(--muted)" />}
      </ActionGrid>
    </div>
  );
}
