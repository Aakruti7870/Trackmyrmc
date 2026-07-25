import { Link, useLocation } from 'wouter';
import type { ElementType } from 'react';
import {
  Home, ClipboardList, MapPin, Menu, Route, CalendarClock, Timer,
  BarChart3, Truck, Factory, MessageCircle, Wallet, User, Siren, Plus,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';
import NotificationBell from '@/components/NotificationBell';
import { AiHeaderButton } from '@/components/ai/AIHelpAgent';
import NewWidgetMenu from '@/components/NewWidgetMenu';
import { RED } from '@/pages/home/deliveryKit';

const INK = '#12211d';
const MUTED = '#5c6f66';
const TEAL = '#0f766e';
const TEAL_SOFT = 'rgba(15,118,110,0.12)';
const LINE = '#e5eae7';

export const MOBILE_HEADER_HEIGHT = 52;
export const BOTTOM_NAV_HEIGHT = 68;

type Tab = { icon: ElementType; label: string; href: string; more?: boolean };
type Fab = { icon: ElementType; label: string; href: string; color: 'teal' | 'red' };
type RoleNav = { tabs: Tab[]; fab?: Fab };

const MORE: Tab = { icon: Menu, label: 'More', href: '__more', more: true };
const HOME: Tab = { icon: Home, label: 'Home', href: '/home' };

const NAV: Record<string, RoleNav> = {
  client: {
    tabs: [HOME, { icon: ClipboardList, label: 'Orders', href: '/my-orders' }, { icon: MapPin, label: 'Plants', href: '/nearby-plants' }, MORE],
    fab: { icon: Plus, label: 'Place Order', href: '/nearby-plants', color: 'teal' },
  },
  driver: {
    tabs: [HOME, { icon: Route, label: 'Trips', href: '/my-trips' }, { icon: CalendarClock, label: 'Attendance', href: '/attendance' }, MORE],
    fab: { icon: Siren, label: 'SOS', href: '/sos', color: 'red' },
  },
  plant_operator: {
    tabs: [HOME, { icon: Timer, label: 'Freshness', href: '/freshness' }, { icon: BarChart3, label: 'Reports', href: '/reports' }, MORE],
    fab: { icon: Plus, label: 'New Batch', href: '/reports?tab=batch', color: 'teal' },
  },
  dispatcher: {
    tabs: [HOME, { icon: ClipboardList, label: 'Orders', href: '/orders' }, { icon: Truck, label: 'Dispatch', href: '/dispatch' }, MORE],
    fab: { icon: Plus, label: 'New Order', href: '/orders?new=1', color: 'teal' },
  },
  supervisor: {
    tabs: [HOME, { icon: CalendarClock, label: 'Live', href: '/attendance' }, { icon: BarChart3, label: 'Reports', href: '/reports' }, MORE],
    fab: { icon: Plus, label: 'New Order', href: '/orders?new=1', color: 'teal' },
  },
  admin: {
    tabs: [HOME, { icon: MessageCircle, label: 'WhatsApp', href: '/whatsapp' }, { icon: BarChart3, label: 'Reports', href: '/reports' }, MORE],
    fab: { icon: Plus, label: 'New Order', href: '/orders?new=1', color: 'teal' },
  },
  authority: {
    tabs: [HOME, { icon: Factory, label: 'Plants', href: '/plants' }, { icon: BarChart3, label: 'Reports', href: '/reports' }, MORE],
    fab: { icon: Plus, label: 'New Order', href: '/orders?new=1', color: 'teal' },
  },
  plant_owner: {
    tabs: [HOME, { icon: Factory, label: 'Plants', href: '/plants' }, { icon: BarChart3, label: 'Reports', href: '/reports' }, MORE],
    fab: { icon: Plus, label: 'New Order', href: '/orders?new=1', color: 'teal' },
  },
  accountant: {
    tabs: [HOME, { icon: BarChart3, label: 'Reports', href: '/reports' }, { icon: Receipt, label: 'Challans', href: '/challans' }, MORE],
    fab: { icon: Wallet, label: 'Review', href: '/expense-review', color: 'teal' },
  },
};

const DEFAULT_NAV: RoleNav = {
  tabs: [HOME, { icon: ClipboardList, label: 'Orders', href: '/orders' }, { icon: BarChart3, label: 'Reports', href: '/reports' }, MORE],
};

const basePath = (href: string) => href.split('?')[0];

function navFor(role: string, allow: (p: string) => boolean): RoleNav {
  const cfg = NAV[role] || DEFAULT_NAV;
  const tabs = cfg.tabs.filter(t => t.more || t.href === '/home' || allow(basePath(t.href)));
  const fab = cfg.fab && allow(basePath(cfg.fab.href)) ? cfg.fab : undefined;
  return { tabs, fab };
}

function isActive(location: string, href: string): boolean {
  const p = basePath(href);
  if (p === '/home') return location === '/home';
  if (p === '/') return location === '/';
  return location.startsWith(p);
}

export function DeliveryHeader({ onProfile }: { onProfile: () => void }) {
  return (
    <>
      <div
        id="delivery-mobile-header-spacer"
        style={{ display: 'none', height: `calc(${MOBILE_HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`, flexShrink: 0 }}
      />
      <div
        id="delivery-mobile-header"
        style={{
          display: 'none', background: '#fff', borderBottom: `1px solid ${LINE}`,
          padding: '8px 12px', paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
          alignItems: 'center', justifyContent: 'space-between', gap: 8,
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
          height: `calc(${MOBILE_HEADER_HEIGHT}px + env(safe-area-inset-top, 0px))`,
          boxSizing: 'border-box',
          boxShadow: '0 2px 12px rgba(11,61,46,0.08)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: TEAL }}>
            <Truck className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <span className="truncate text-[19px] font-extrabold tracking-tight" style={{ color: INK }}>
            Track<span style={{ color: TEAL }}>My</span>RMC
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div aria-label="Open Assistance" title="Assistance" className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: LINE, background: '#fff' }}>
            <AiHeaderButton />
          </div>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: LINE, background: '#fff' }}>
            <NotificationBell />
          </div>
          <button
            onClick={onProfile}
            className="flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: TEAL_SOFT, border: `1.5px solid ${TEAL}` }}
            aria-label="Open profile menu"
          >
            <User className="h-[18px] w-[18px]" style={{ color: TEAL }} />
          </button>
        </div>
      </div>
    </>
  );
}

function Slot({ tab, location, onMore, onNavigate }: { tab: Tab; location: string; onMore: () => void; onNavigate: () => void }) {
  const active = !tab.more && isActive(location, tab.href);
  const Icon = tab.icon;
  const color = active ? TEAL : MUTED;
  const inner = (
    <>
      <Icon className="h-5 w-5" style={{ color }} />
      <span className="text-[10px] font-medium" style={{ color }}>{tab.label}</span>
    </>
  );
  if (tab.more) {
    return <button onClick={onMore} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1" aria-label="Open more menu">{inner}</button>;
  }
  return (
    <Link href={tab.href} onClick={onNavigate} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-1" style={{ textDecoration: 'none' }}>
      {inner}
    </Link>
  );
}

export function DeliveryBottomNav({ onMore, onNavigate }: { onMore: () => void; onNavigate?: () => void }) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  if (!user) return null;
  const allow = (p: string) => canAccess(user.role, p);
  const { tabs, fab } = navFor(user.role, allow);

  const showNew = true;
  const centerFab = showNew ? undefined : fab;
  const hasCenter = showNew || !!centerFab;
  const left = hasCenter ? tabs.slice(0, 2) : tabs;
  const right = hasCenter ? tabs.slice(2) : [];
  const fabColor = centerFab?.color === 'red' ? RED : TEAL;
  const fabShadow = centerFab?.color === 'red' ? '0 8px 20px rgba(239,68,68,0.4)' : '0 8px 20px rgba(15,118,110,0.35)';
  const FabIcon = centerFab?.icon;

  return (
    <nav
      id="delivery-bottom-nav"
      className="mx-auto"
      style={{
        display: 'none', position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 0, zIndex: 55, width: '100%', maxWidth: 420,
        background: '#fff', borderTop: `1px solid ${LINE}`,
        height: `calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`, boxSizing: 'border-box',
        padding: '0 6px', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        alignItems: 'center', justifyContent: 'space-between',
      }}
    >
      {left.map((t, i) => <Slot key={`l${i}`} tab={t} location={location} onMore={onMore} onNavigate={() => onNavigate?.()} />)}
      {showNew && <div style={{ transform: 'translateY(-4px)' }}><NewWidgetMenu role={user.role} onNavigate={() => onNavigate?.()} /></div>}
      {centerFab && FabIcon && (
        <div className="flex flex-col items-center" style={{ transform: 'translateY(-4px)' }}>
          <button
            onClick={() => { onNavigate?.(); navigate(centerFab.href); }}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
            style={{ background: fabColor, boxShadow: fabShadow }}
            aria-label={centerFab.label}
          >
            <FabIcon className="h-7 w-7" strokeWidth={2.5} />
          </button>
          <span className="mt-1 text-[10px] font-medium" style={{ color: centerFab.color === 'red' ? RED : MUTED }}>{centerFab.label}</span>
        </div>
      )}
      {right.map((t, i) => <Slot key={`r${i}`} tab={t} location={location} onMore={onMore} onNavigate={() => onNavigate?.()} />)}
    </nav>
  );
}
