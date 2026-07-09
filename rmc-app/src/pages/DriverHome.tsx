import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { api, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import {
  Truck, ClipboardList, Wallet, TriangleAlert, FileText, Check,
  Navigation, Phone, MessageCircle, Clock, MapPin, User, PackageSearch,
} from 'lucide-react';
import {
  Screen, Card, SectionHead, StatCard, StatRow, QuickAction, QuickGrid, InfoPrompt,
  Stepper, ListRow, StatusPill, Chip, EmptyNote, type StepState,
  TEAL, INK, MUTED, LINE, GREEN, BLUE, RED,
} from './home/deliveryKit';
import { greeting, firstNameOf } from './home/format';

interface ExpenseLite { id: number; status: 'pending' | 'approved' | 'rejected' }

function navUrlFor(c: Challan): string | null {
  const dest = c.siteLat != null && c.siteLng != null
    ? `${c.siteLat},${c.siteLng}`
    : (c.siteAddress || c.siteName)
      ? encodeURIComponent(c.siteAddress || c.siteName || '')
      : null;
  return dest ? `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving` : null;
}

function tripSteps(c: Challan): { label: string; icon: React.ReactNode; state: StepState }[] {
  const delivered = c.status === 'delivered';
  const arrived = c.siteArrivalTime != null;
  const released = c.siteReleaseTime != null;
  const S = (done: boolean, active: boolean): StepState => (done ? 'done' : active ? 'active' : 'todo');
  return [
    { label: 'Dispatched', icon: <Truck className="h-3.5 w-3.5" />, state: S(true, false) },
    { label: 'In transit', icon: <Navigation className="h-3.5 w-3.5" />, state: S(arrived || delivered, !arrived && !delivered) },
    { label: 'Reached', icon: <MapPin className="h-3.5 w-3.5" />, state: S((arrived && released) || delivered, arrived && !released && !delivered) },
    { label: 'Unloading', icon: <Clock className="h-3.5 w-3.5" />, state: S(delivered, released && !delivered) },
    { label: 'Delivered', icon: <Check className="h-3.5 w-3.5" />, state: S(delivered, false) },
  ];
}

export default function DriverHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [trips, setTrips] = useState<Challan[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<Challan[]>('/me/trips'),
      api.get<ExpenseLite[]>('/expenses/mine'),
    ]).then(([t, e]) => {
      if (t.status === 'fulfilled') setTrips(t.value);
      if (e.status === 'fulfilled') setExpenses(e.value);
    }).finally(() => setLoading(false));
  }, []);

  const can = (p: string) => (user ? canAccess(user.role, p) : false);
  const go = (p: string) => navigate(p);
  const activeTrips = trips.filter(c => c.status === 'dispatched' || (c.siteArrivalTime != null && c.siteReleaseTime == null));
  const deliveredToday = trips.filter(c => c.status === 'delivered').length;
  const pendingClaims = expenses.filter(e => e.status === 'pending').length;
  const primary = activeTrips[0];
  const primaryNavUrl = primary ? navUrlFor(primary) : null;
  const recent = trips.filter(c => c.status === 'delivered').slice(0, 3);

  return (
    <Screen>
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px]" style={{ color: MUTED }}>{greeting()},</p>
          <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: INK }}>
            {firstNameOf(user?.name, 'Driver')}
          </h1>
          <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
            {activeTrips.length > 0 ? 'You have deliveries lined up today.' : 'Have a safe day on the road.'}
          </p>
        </div>
        {user?.truckNo && <Chip icon={<Truck className="h-3.5 w-3.5" />} label={user.truckNo} />}
      </div>

      {/* Always-on driver essentials — Start/End Shift + Emergency SOS stay
          permanently visible; the on-road help set lives in the NEW menu. */}
      {(can('/attendance') || can('/sos')) && (
        <div className="mt-1 grid grid-cols-2 gap-3">
          {can('/attendance') && (
            <button
              onClick={() => go('/attendance')}
              className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left active:scale-[.98]"
              style={{ background: TEAL, color: '#fff', boxShadow: '0 8px 20px rgba(15,118,110,0.30)', transition: 'transform .1s ease' }}
            >
              <Clock className="h-6 w-6" />
              <span className="text-[14px] font-extrabold leading-tight">Start / End Shift</span>
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>Clock in &amp; out</span>
            </button>
          )}
          {can('/sos') && (
            <button
              onClick={() => go('/sos')}
              className="flex flex-col items-start gap-2 rounded-2xl p-4 text-left active:scale-[.98]"
              style={{ background: RED, color: '#fff', boxShadow: '0 8px 20px rgba(239,68,68,0.30)', transition: 'transform .1s ease' }}
            >
              <TriangleAlert className="h-6 w-6" />
              <span className="text-[14px] font-extrabold leading-tight">Emergency SOS</span>
              <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>Raise an alert now</span>
            </button>
          )}
        </div>
      )}

      {/* Today stats */}
      <StatRow>
        <StatCard value={loading ? '—' : activeTrips.length} label="Active trips" color={BLUE} icon={<Truck className="h-4 w-4" />} />
        <StatCard value={loading ? '—' : deliveredToday} label="Delivered today" color={GREEN} icon={<Check className="h-4 w-4" strokeWidth={3} />} />
        <StatCard value={loading ? '—' : pendingClaims} label="Pending claims" color={TEAL} icon={<Wallet className="h-4 w-4" />} />
      </StatRow>

      {/* Active trip */}
      {primary && (
        <>
          <SectionHead title="Active Trip" actionLabel={can('/my-trips') ? 'My Trips' : undefined} onAction={() => go('/my-trips')} />
          <Card style={{ padding: 16 }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-bold" style={{ color: INK }}>#{primary.challanNo}</span>
                  <StatusPill label={primary.status} color={BLUE} bg="#e0f2fe" />
                </div>
                <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  {primary.grade} · {primary.quantity} m³{primary.vehicleNo ? ` · ${primary.vehicleNo}` : ''}
                </p>
              </div>
              <Truck className="h-8 w-8" style={{ color: BLUE }} />
            </div>

            {(primary.siteName || primary.siteAddress) && (
              <div className="mt-3 flex items-start gap-2 rounded-xl p-2.5" style={{ background: '#f7f5f1' }}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
                <div className="text-[12px]" style={{ color: INK }}>
                  <span className="font-semibold">{primary.siteName || primary.siteAddress}</span>
                  {primary.clientName && <span style={{ color: MUTED }}> · {primary.clientName}</span>}
                </div>
              </div>
            )}

            <Stepper steps={tripSteps(primary)} />

            <div className="mt-4 flex gap-2">
              {primaryNavUrl && (
                <a
                  href={primaryNavUrl} target="_blank" rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white"
                  style={{ background: TEAL }}
                >
                  <Navigation className="h-4 w-4" /> Navigate
                </a>
              )}
              {primary.contactNumber && (
                <>
                  <a href={`tel:${primary.contactNumber}`} className="flex h-10 w-11 items-center justify-center rounded-xl border" style={{ borderColor: LINE }}>
                    <Phone className="h-[18px] w-[18px]" style={{ color: TEAL }} />
                  </a>
                  <a href={`https://wa.me/${primary.contactNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex h-10 w-11 items-center justify-center rounded-xl border" style={{ borderColor: LINE }}>
                    <MessageCircle className="h-[18px] w-[18px]" style={{ color: GREEN }} />
                  </a>
                </>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Quick actions */}
      <SectionHead title="Quick Actions" />
      <QuickGrid cols={3}>
        {can('/my-trips') && <QuickAction label="My Trips" icon={<ClipboardList className="h-6 w-6" />} onClick={() => go('/my-trips')} />}
        {can('/expenses') && <QuickAction label="Expenses" icon={<Wallet className="h-6 w-6" />} onClick={() => go('/expenses')} />}
        {can('/challans') && <QuickAction label="Challans" icon={<FileText className="h-6 w-6" />} onClick={() => go('/challans')} />}
        {can('/profile') && <QuickAction label="Profile" icon={<User className="h-6 w-6" />} onClick={() => go('/profile')} />}
      </QuickGrid>

      {/* Add expense prompt */}
      {can('/expenses') && (
        <InfoPrompt
          icon={<Wallet className="h-5 w-5" />}
          title="Log today's fuel & toll"
          sub="Add receipts to get reimbursed faster."
          actionLabel="Add"
          onAction={() => go('/expenses')}
        />
      )}

      {/* Recent challans */}
      {recent.length > 0 && (
        <>
          <SectionHead title="Recent Challans" actionLabel={can('/challans') ? 'View All' : undefined} onAction={() => go('/challans')} />
          <div className="space-y-2.5">
            {recent.map(c => (
              <ListRow
                key={c.id}
                mono
                icon={<FileText className="h-5 w-5" />}
                title={`#${c.challanNo}`}
                badge={<StatusPill label="Delivered" color={GREEN} bg="#e8f5ec" />}
                sub={`${c.grade} · ${c.quantity} m³${c.siteName ? ` · ${c.siteName}` : ''}`}
                onClick={can('/challans') ? () => go('/challans') : undefined}
              />
            ))}
          </div>
        </>
      )}

      {!loading && trips.length === 0 && (
        <EmptyNote icon={<PackageSearch className="h-7 w-7" />} text="No trips assigned yet. New deliveries will appear here." />
      )}
    </Screen>
  );
}
