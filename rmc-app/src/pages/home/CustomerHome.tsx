import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import { useLocation } from 'wouter';
import { api, type Order, type Challan } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import { useToast } from '@/lib/toast';
import {
  Plus, Truck, ClipboardList, MapPin, BadgeIndianRupee, RotateCcw, Headphones,
  Wallet, Receipt, FileText, Download, Check, Navigation, PackageSearch,
  Calculator, X, Sparkles, Compass, HardHat, Users, Layers, Boxes,
  Factory, Wind, Mountain, FlaskConical, ChevronRight,
} from 'lucide-react';
import {
  Screen, Card, SectionHead, QuickAction, QuickGrid, InfoPrompt, StatusPill,
  StatCard, StatRow, Stepper, ListRow, type StepState, TEAL,
  INK, MUTED, GREEN, BLUE,
} from './deliveryKit';
import { statusColor, statusBg, statusLabel, greeting, firstNameOf } from './format';
import LiveFleetMap from '@/components/LiveFleetMap';

const ON_ROAD = ['dispatched', 'in_transit', 'reached_site', 'unloading'];

// ---------------------------------------------------------------------------
// Premium Cream + Dark Green + Gold palette (customer home only).
// The page wrapper overrides the theme CSS variables locally, so every kit
// component inside re-skins to this palette in both Day and Night modes.
// ---------------------------------------------------------------------------
const CREAM = '#F8F5EC';
const DGREEN = '#0B3D2E';
const DGREEN_DEEP = '#06281d';
const DGREEN_HI = '#14563f';
const GOLD = '#D6A936';
const GOLD_LIGHT = '#F4D27A';
const CARD_BG = '#FFFFFF';
const TXT = '#102820';
const TXT_MUTED = '#5c6f66';
const LINE_CREAM = '#e7e2d3';

const PREMIUM_VARS: CSSProperties = {
  ['--bg' as string]: CREAM,
  ['--text' as string]: TXT,
  ['--muted' as string]: TXT_MUTED,
  ['--line' as string]: LINE_CREAM,
  ['--gold' as string]: DGREEN,
  ['--gold-dark' as string]: DGREEN_DEEP,
  ['--gold-hi' as string]: DGREEN_HI,
  ['--gold-soft' as string]: 'rgba(11,61,46,0.10)',
  ['--gold-tint' as string]: 'rgba(214,169,54,0.14)',
  ['--prompt-bg' as string]: '#fbf8ef',
  ['--prompt-border' as string]: LINE_CREAM,
  ['--prompt-icon-bg' as string]: 'rgba(214,169,54,0.18)',
  // Card surfaces (glass-card etc.) go white-on-cream in both Day and Night.
  ['--surface' as string]: CARD_BG,
  ['--glass-border' as string]: LINE_CREAM,
  ['--chip-bg' as string]: '#fbf8ef',
  ['--shadow-rgb' as string]: '11,61,46',
};

type SheetKey = 'services' | 'calculator' | 'owner' | null;

const UPCOMING_ITEMS: { label: string; icon: ReactNode }[] = [
  { label: 'Hire Surveyor', icon: <Compass className="h-4.5 w-4.5" /> },
  { label: 'Hire RCC Contractor', icon: <HardHat className="h-4.5 w-4.5" /> },
  { label: 'Hire Labour Contractor', icon: <Users className="h-4.5 w-4.5" /> },
  { label: 'Core Shuttering & Staging Equipment', icon: <Layers className="h-4.5 w-4.5" /> },
  { label: 'Reinforcement & Framework Materials', icon: <Boxes className="h-4.5 w-4.5" /> },
];

const OWNER_ITEMS: { label: string; icon: ReactNode }[] = [
  { label: 'Cement Owner', icon: <Factory className="h-4.5 w-4.5" /> },
  { label: 'Flyash Vendor', icon: <Wind className="h-4.5 w-4.5" /> },
  { label: 'Aggregate Vendor', icon: <Mountain className="h-4.5 w-4.5" /> },
  { label: 'Admixture Vendor', icon: <FlaskConical className="h-4.5 w-4.5" /> },
];

function orderSteps(status: string): { label: string; icon: ReactNode; state: StepState }[] {
  const done = status === 'completed';
  const moving = status === 'in_progress';
  return [
    { label: 'Pending', icon: <Check className="h-4 w-4" />, state: done || moving ? 'done' : 'active' },
    { label: 'Dispatched', icon: <Truck className="h-4 w-4" />, state: done ? 'done' : moving ? 'done' : 'todo' },
    { label: 'On the way', icon: <Navigation className="h-4 w-4" />, state: done ? 'done' : moving ? 'active' : 'todo' },
    { label: 'Delivered', icon: <Check className="h-4 w-4" />, state: done ? 'done' : 'todo' },
  ];
}

// --- Bottom sheet -----------------------------------------------------------

function OptionRow({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{ borderColor: LINE_CREAM, background: '#fbf8ef' }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'rgba(214,169,54,0.16)', color: DGREEN }}
      >
        {icon}
      </span>
      <span className="text-[13px] font-semibold" style={{ color: DGREEN }}>{label}</span>
    </div>
  );
}

function GoldButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-4 w-full rounded-2xl py-3 text-[14px] font-extrabold active:scale-[.98]"
      style={{
        background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
        color: DGREEN, transition: 'transform .1s ease',
        boxShadow: '0 6px 18px rgba(214,169,54,0.35)',
      }}
    >
      {label}
    </button>
  );
}

function BottomSheet({
  open, onClose, title, description, children,
}: {
  open: boolean; onClose: () => void; title: string; description: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 70, background: 'rgba(6,40,29,0.55)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-1/2 bottom-0 w-full max-w-[420px] -translate-x-1/2 rounded-t-3xl px-5 pt-3"
        style={{
          zIndex: 75, background: CARD_BG, color: TXT,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          maxHeight: '82vh', overflowY: 'auto',
          animation: 'ckSheetUp .28s cubic-bezier(.4,0,.2,1)',
          boxShadow: '0 -18px 50px rgba(6,40,29,0.35)',
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: LINE_CREAM }} />
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-extrabold leading-tight" style={{ color: DGREEN }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: CREAM, color: DGREEN, border: `1px solid ${LINE_CREAM}` }}
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-snug" style={{ color: TXT_MUTED }}>{description}</p>
        {children}
      </div>
    </>
  );
}

// Simple slab-volume calculator shown inside the Calculator bottom sheet.
function VolumeCalc() {
  const [len, setLen] = useState('');
  const [wid, setWid] = useState('');
  const [thk, setThk] = useState('');
  const l = parseFloat(len), w = parseFloat(wid), t = parseFloat(thk);
  const ok = l > 0 && w > 0 && t > 0;
  const vol = ok ? l * w * (t / 1000) : 0;
  const withWastage = vol * 1.05;
  const field = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className="flex-1">
      <span className="text-[11px] font-semibold" style={{ color: TXT_MUTED }}>{label} ({unit})</span>
      <input
        type="number" inputMode="decimal" min="0" value={value}
        onChange={e => set(e.target.value)}
        placeholder="0"
        className="mt-1 w-full rounded-xl border px-3 py-2.5 text-[14px] font-bold outline-none"
        style={{ borderColor: LINE_CREAM, background: '#fbf8ef', color: DGREEN }}
      />
    </label>
  );
  return (
    <div className="mt-4">
      <div className="flex gap-2.5">
        {field('Length', len, setLen, 'm')}
        {field('Width', wid, setWid, 'm')}
        {field('Thickness', thk, setThk, 'mm')}
      </div>
      <div
        className="mt-3 rounded-2xl border p-3.5 text-center"
        style={{ borderColor: LINE_CREAM, background: CREAM }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_MUTED }}>
          Concrete needed
        </p>
        <p className="mt-0.5 text-[26px] font-extrabold leading-none" style={{ color: DGREEN }}>
          {ok ? withWastage.toFixed(2) : '—'} m³
        </p>
        <p className="mt-1 text-[11px]" style={{ color: TXT_MUTED }}>
          {ok ? `${vol.toFixed(2)} m³ + 5% wastage allowance` : 'Enter slab length, width and thickness'}
        </p>
      </div>
    </div>
  );
}

// --- Page --------------------------------------------------------------------

export default function CustomerHome() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<SheetKey>(null);

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
  const onRoad = challans.filter(c => ON_ROAD.includes(c.status)).length;
  const completed = orders.filter(o => o.status === 'completed').length;

  return (
    <div style={PREMIUM_VARS}>
    <Screen bg={CREAM}>
      <style>{`
        @keyframes ckGoldPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(214,169,54,0.0), 0 4px 16px rgba(11,61,46,0.06); border-color: ${LINE_CREAM}; }
          50% { box-shadow: 0 0 0 4px rgba(214,169,54,0.18), 0 4px 22px rgba(214,169,54,0.30); border-color: ${GOLD}; }
        }
        @keyframes ckSheetUp {
          from { transform: translate(-50%, 100%); }
          to { transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Warm, personal welcome — premium dark green + gold */}
      <div
        className="relative overflow-hidden rounded-3xl p-5"
        style={{ background: `linear-gradient(120deg, ${DGREEN_DEEP} 0%, ${DGREEN} 55%, ${DGREEN_HI} 100%)` }}
      >
        <Truck className="pointer-events-none absolute -bottom-5 -right-4 h-40 w-40 text-white/10" strokeWidth={1.2} />
        <div className="relative z-10 max-w-[82%]">
          <p className="text-[12.5px] font-medium" style={{ color: GOLD_LIGHT }}>{greeting()},</p>
          <h1 className="text-[22px] font-extrabold leading-[1.1] text-white">
            {firstNameOf(user?.name, 'there')}
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-snug text-white/85">
            Order, track and manage your concrete deliveries in real time.
          </p>
          {can('/nearby-plants') && (
            <button
              onClick={() => go('/nearby-plants')}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-[13px] font-bold shadow-sm active:scale-[.98]"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
                color: DGREEN, transition: 'transform .1s ease',
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.8} /> Place a new order
            </button>
          )}
        </div>
      </div>

      {/* At a glance */}
      {can('/my-orders') && (
        <div className="mt-4">
          <StatRow>
            <StatCard value={loading ? '—' : activeOrders.length} label="Active orders" color={DGREEN} icon={<ClipboardList className="h-4 w-4" />} />
            <StatCard value={loading ? '—' : onRoad} label="On the road" color={BLUE} icon={<Truck className="h-4 w-4" />} />
            <StatCard value={loading ? '—' : completed} label="Completed" color={GREEN} icon={<Check className="h-4 w-4" strokeWidth={3} />} />
          </StatRow>
        </div>
      )}

      {/* Quick Actions — 2 balanced rows of 3, bigger tap targets */}
      <SectionHead title="Quick Actions" />
      <QuickGrid cols={3}>
        {can('/nearby-plants') && (
          <QuickAction
            label="Place Order" icon={<Truck className="h-6 w-6" />} onClick={() => go('/nearby-plants')}
            badge={
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: GOLD, color: DGREEN }}>
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

      {/* ---- Premium services & tools ---------------------------------- */}
      <SectionHead title="Services & Tools" />

      {/* WIDGET 1 — Upcoming Services (faint blinking golden glow) */}
      <button
        onClick={() => setSheet('services')}
        className="block w-full rounded-3xl border p-4 text-left active:scale-[.99]"
        style={{
          background: CARD_BG, borderColor: LINE_CREAM,
          animation: 'ckGoldPulse 2.6s ease-in-out infinite',
          transition: 'transform .1s ease',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(214,169,54,0.16)', color: GOLD }}>
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[14.5px] font-extrabold leading-tight" style={{ color: DGREEN }}>Upcoming Services</p>
              <p className="text-[11px] font-medium" style={{ color: TXT_MUTED }}>Planning Date: 15 Aug 2026</p>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold tracking-wide"
            style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DGREEN }}
          >
            V.1.13
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {UPCOMING_ITEMS.map(it => (
            <li key={it.label} className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: DGREEN }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ color: GOLD }}>
                {it.icon}
              </span>
              {it.label}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-1 text-[12px] font-bold" style={{ color: GOLD }}>
          See details <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
        </div>
      </button>

      {/* WIDGET 2 — Free Concrete Calculator (center main widget, bigger) */}
      <button
        onClick={() => setSheet('calculator')}
        className="mt-4 block w-full rounded-3xl p-6 text-center active:scale-[.99]"
        style={{
          background: `linear-gradient(150deg, ${DGREEN_DEEP} 0%, ${DGREEN} 60%, ${DGREEN_HI} 100%)`,
          border: `1.5px solid ${GOLD}`,
          boxShadow: '0 10px 28px rgba(11,61,46,0.25)',
          transition: 'transform .1s ease',
        }}
      >
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DGREEN, boxShadow: '0 6px 18px rgba(214,169,54,0.45)' }}
        >
          <Calculator className="h-8 w-8" strokeWidth={2.2} />
        </span>
        <h3 className="mt-3 text-[19px] font-extrabold text-white">Free Concrete Calculator</h3>
        <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] leading-snug text-white/80">
          Work out exactly how much concrete your slab needs — in seconds, free.
        </p>
        <span
          className="mt-4 inline-flex items-center gap-1.5 rounded-2xl px-6 py-3 text-[14px] font-extrabold"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DGREEN, boxShadow: '0 6px 18px rgba(214,169,54,0.4)' }}
        >
          <Calculator className="h-4.5 w-4.5" strokeWidth={2.5} /> Open Calculator
        </span>
      </button>

      {/* WIDGET 3 — For Owner */}
      <button
        onClick={() => setSheet('owner')}
        className="mt-4 block w-full rounded-3xl border p-4 text-left active:scale-[.99]"
        style={{ background: CARD_BG, borderColor: LINE_CREAM, transition: 'transform .1s ease', boxShadow: '0 4px 16px rgba(11,61,46,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(11,61,46,0.08)', color: DGREEN }}>
            <Factory className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14.5px] font-extrabold leading-tight" style={{ color: DGREEN }}>For Owner</p>
            <p className="text-[11px] font-medium" style={{ color: TXT_MUTED }}>Raw-material vendors for plant owners</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {OWNER_ITEMS.map(it => (
            <span
              key={it.label}
              className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11.5px] font-semibold"
              style={{ borderColor: LINE_CREAM, background: '#fbf8ef', color: DGREEN }}
            >
              <span style={{ color: GOLD }}>{it.icon}</span>
              {it.label}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1 text-[12px] font-bold" style={{ color: GOLD }}>
          See details <ChevronRight className="h-3.5 w-3.5" strokeWidth={3} />
        </div>
      </button>

      {/* Live Fleet Google Map — the exact staff card, scoped server-side to
          this customer's own in-transit loads (GET /api/me/live-fleet-map). */}
      {can('/my-orders') && (
        <div className="mt-6">
          <LiveFleetMap endpoint="/me/live-fleet-map" />
        </div>
      )}

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
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'rgba(11,61,46,0.10)', color: GREEN }}>
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          You have no orders yet — place your first order to get started.
        </div>
      )}

      {/* ---- Bottom sheets ---------------------------------------------- */}
      <BottomSheet
        open={sheet === 'services'}
        onClose={() => setSheet(null)}
        title="Upcoming Services — V.1.13"
        description="New services planned for release. Planning Date: 15 Aug 2026. Everything you need to take a project from survey to slab, in one app."
      >
        <div className="mt-4 space-y-2">
          {UPCOMING_ITEMS.map(it => <OptionRow key={it.label} icon={it.icon} label={it.label} />)}
        </div>
        <GoldButton
          label="Notify Me When Live"
          onClick={() => {
            setSheet(null);
            showToast('Great! Watch this space — we\u2019ll announce these services in the app.', 'success');
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={sheet === 'calculator'}
        onClose={() => setSheet(null)}
        title="Free Concrete Calculator"
        description="Enter your slab size to estimate the concrete volume you should order, including a 5% wastage allowance."
      >
        <VolumeCalc />
        {can('/nearby-plants') && (
          <GoldButton
            label="Find Plants & Place Order"
            onClick={() => { setSheet(null); go('/nearby-plants'); }}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={sheet === 'owner'}
        onClose={() => setSheet(null)}
        title="For Owner"
        description="Are you a plant owner? Source trusted raw-material vendors for your RMC plant — cement, flyash, aggregate and admixture suppliers."
      >
        <div className="mt-4 space-y-2">
          {OWNER_ITEMS.map(it => <OptionRow key={it.label} icon={it.icon} label={it.label} />)}
        </div>
        <GoldButton
          label="Talk to Support"
          onClick={() => { setSheet(null); go(can('/profile') ? '/profile' : '/home'); }}
        />
      </BottomSheet>
    </Screen>
    </div>
  );
}
