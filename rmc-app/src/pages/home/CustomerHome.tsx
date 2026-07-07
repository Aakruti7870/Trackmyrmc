import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type Order, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  Plus, Truck, ClipboardList, MapPin, BadgeIndianRupee, RotateCcw, Headphones,
  Wallet, Receipt, FileText, Download, Check, Navigation, PackageSearch,
} from 'lucide-react';
import {
  Screen, Card, SectionHead, QuickAction, QuickGrid, InfoPrompt, StatusPill,
  Stepper, ListRow, type StepState, TEAL, TEAL_DEEP, TEAL_HI, INK, MUTED,
  TEAL_SOFT, GREEN,
} from './deliveryKit';
import { statusColor, statusBg, statusLabel } from './format';
import LiveFleetMap from '@/components/LiveFleetMap';

function orderSteps(status: string): { label: string; icon: React.ReactNode; state: StepState }[] {
  const done = status === 'completed';
  const moving = status === 'in_progress';
  return [
    { label: 'Pending', icon: <Check className="h-4 w-4" />, state: done || moving ? 'done' : 'active' },
    { label: 'Dispatched', icon: <Truck className="h-4 w-4" />, state: done ? 'done' : moving ? 'done' : 'todo' },
    { label: 'On the way', icon: <Navigation className="h-4 w-4" />, state: done ? 'done' : moving ? 'active' : 'todo' },
    { label: 'Delivered', icon: <Check className="h-4 w-4" />, state: done ? 'done' : 'todo' },
  ];
}

export default function CustomerHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
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
  const go = (p: string) => navigate(p);
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'in_progress');
  const primary = activeOrders[0] || orders[0];
  const otherRecent = orders.filter(o => o.id !== primary?.id).slice(0, 3);
  void challans;

  return (
    <Screen>
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl p-4"
        style={{ background: `linear-gradient(120deg, ${TEAL_DEEP} 0%, ${TEAL} 55%, ${TEAL_HI} 100%)` }}
      >
        <Truck className="pointer-events-none absolute -bottom-4 -right-4 h-40 w-40 text-white/10" strokeWidth={1.2} />
        <div className="relative z-10 max-w-[80%]">
          <h1 className="text-[20px] font-extrabold leading-[1.15] text-white">
            Ready Mix Concrete, On Time, Every Time.
          </h1>
          <p className="mt-1.5 text-[12px] leading-snug text-white/85">
            Order, track and manage concrete deliveries in real-time.
          </p>
          {can('/nearby-plants') && (
            <button
              onClick={() => go('/nearby-plants')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold shadow-sm"
              style={{ color: TEAL_DEEP }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} /> Place Order
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <SectionHead title="Quick Actions" />
      <QuickGrid cols={4}>
        {can('/nearby-plants') && (
          <QuickAction
            label="Place Order" icon={<Truck className="h-6 w-6" />} onClick={() => go('/nearby-plants')}
            badge={
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: TEAL }}>
                <Plus className="h-3 w-3" strokeWidth={3} />
              </span>
            }
          />
        )}
        {can('/my-orders') && <QuickAction label="My Orders" icon={<ClipboardList className="h-6 w-6" />} onClick={() => go('/my-orders')} />}
        {can('/my-orders') && <QuickAction label="Track Live" icon={<MapPin className="h-6 w-6" />} onClick={() => go('/my-orders?tab=deliveries')} />}
        {can('/my-orders') && <QuickAction label="Statement" icon={<BadgeIndianRupee className="h-6 w-6" />} onClick={() => go('/my-orders?tab=billing')} />}
        {can('/my-orders') && <QuickAction label="Reorder" icon={<RotateCcw className="h-6 w-6" />} onClick={() => go('/my-orders')} />}
        {can('/profile') && <QuickAction label="Support" icon={<Headphones className="h-6 w-6" />} onClick={() => go('/profile')} />}
      </QuickGrid>

      {/* Live Fleet Google Map — the exact staff card, scoped server-side to
          this customer's own in-transit loads (GET /api/me/live-fleet-map). */}
      {can('/my-orders') && <LiveFleetMap endpoint="/me/live-fleet-map" />}

      {/* My Orders */}
      {primary && (
        <>
          <SectionHead title="My Orders" actionLabel={can('/my-orders') ? 'View All' : undefined} onAction={() => go('/my-orders')} />
          <Card style={{ padding: 16 }} onClick={can('/my-orders') ? () => go('/my-orders') : undefined}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold" style={{ color: INK }}>{primary.orderNo}</span>
                  <StatusPill label={statusLabel(primary.status)} color={statusColor(primary.status)} bg={statusBg(primary.status)} />
                </div>
                <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  {primary.grade} · {primary.quantity} m³{primary.plantName ? ` · ${primary.plantName}` : ''}
                </p>
              </div>
              <Truck className="h-8 w-8" style={{ color: TEAL }} />
            </div>
            <Stepper steps={orderSteps(primary.status)} />
          </Card>
        </>
      )}

      {otherRecent.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {otherRecent.map(o => (
            <ListRow
              key={o.id}
              icon={<PackageSearch className="h-5 w-5" />}
              title={o.orderNo}
              badge={<StatusPill label={statusLabel(o.status)} color={statusColor(o.status)} bg={statusBg(o.status)} />}
              sub={`${o.grade} · ${o.quantity} m³${o.plantName ? ` · ${o.plantName}` : ''}`}
              onClick={can('/my-orders') ? () => go('/my-orders') : undefined}
            />
          ))}
        </div>
      )}

      {/* Billing & Documents */}
      {can('/my-orders') && (
        <>
          <SectionHead title="Billing & Documents" />
          <QuickGrid cols={5}>
            <QuickAction label="Statement" icon={<Wallet className="h-6 w-6" />} onClick={() => go('/my-orders?tab=billing')} />
            <QuickAction label="Dues" icon={<BadgeIndianRupee className="h-6 w-6" />} onClick={() => go('/my-orders?tab=billing')} />
            <QuickAction label="Challans" icon={<Receipt className="h-6 w-6" />} onClick={() => go('/my-orders?tab=deliveries')} />
            <QuickAction label="Ledger" icon={<FileText className="h-6 w-6" />} onClick={() => go('/my-orders?tab=billing')} />
            <QuickAction label="Invoices" icon={<Download className="h-6 w-6" />} onClick={() => go('/my-orders?tab=billing')} />
          </QuickGrid>
        </>
      )}

      {/* Find plants */}
      {can('/nearby-plants') && (
        <InfoPrompt
          icon={<MapPin className="h-5 w-5" />}
          title="Find plants near you"
          sub="Order concrete from approved RMC plants nearby."
          actionLabel="Find"
          onAction={() => go('/nearby-plants')}
        />
      )}

      {!loading && orders.length === 0 && (
        <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: MUTED }}>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: TEAL_SOFT, color: GREEN }}>
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          You have no orders yet — place your first order to get started.
        </div>
      )}
    </Screen>
  );
}
