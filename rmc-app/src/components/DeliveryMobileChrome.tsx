import { Link, useLocation } from 'wouter';
import type { CSSProperties, ElementType } from 'react';
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
import { ConcreteKingLogo } from '@/components/BrandLogo';

// Theme tokens (Concrete Gold by day, Infra Green by night — see automatic-theme.css).
// No hard-coded brand colours here so this chrome follows the automatic theme.
const INK = 'var(--text)';
const MUTED = 'var(--muted)';
const TEAL = 'var(--gold)';
const TEAL_SOFT = 'color-mix(in srgb, var(--gold) 12%, transparent)';
const LINE = 'var(--line)';
const RED = 'var(--red)';
const SURFACE = 'var(--surface)';

export const MOBILE_HEADER_HEIGHT = 52;
export const BOTTOM_NAV_HEIGHT = 68;

type Tab = { icon: ElementType; label: string; href: string; more?: boolean };
type Fab = { icon: ElementType; label: string; href: string; color: 'teal' | 'red' };
type RoleNav = { tabs: Tab[]; fab?: Fab };

const MORE: Tab = { icon: Menu, label: 'More', href: '__more', more: true };
const HOME: Tab = { icon: Home, label: 'Home', href: '/home' };

// Per-role bottom navigation. Customer navigation is intentionally fixed as:
// HOME | ORDERS | NEW | PLANTS | MORE. The NEW services widget is inserted in
// the centre below, so it must not be added as a normal tab here.
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
  return location === p || location.startsWith(`${p}/`);
}

export function DeliveryHeader({ onProfile }: { onProfile: () => void }) {
  return (
    <>
      {/* Spacer keeps page content below the fixed header (same display rules). */}
      <div
        id="delivery-mobile-header-spacer"
        style={{ display: 'none', height: 'calc(52px + env(safe-area-inset-top, 0px))', flexShrink: 0 }}
      />
      <div
        id="delivery-mobile-header"
        style={{
          display: 'none', background: 'var(--header-bg)',
          borderBottom: '1px solid var(--header-border)',
          // Scope CSS vars so every child component (NotificationBell, AiHeaderButton, etc.)
          // inherits header-appropriate colours without per-component changes.
          '--text': 'var(--header-text)',
          '--muted': 'var(--header-muted)',
          '--gold': 'var(--header-accent)',
          '--surface': 'var(--header-surface)',
          '--line': 'var(--header-border)',
          padding: '8px 16px', paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
          height: 'calc(52px + env(safe-area-inset-top, 0px))',
          boxShadow: '0 2px 12px rgba(var(--shadow-rgb),.14)',
        } as CSSProperties}
      >
        <div className="flex items-center gap-2" style={{ minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flexShrink: 0 }}>
            <ConcreteKingLogo size={32} />
          </div>
          <span className="text-[19px] font-extrabold tracking-tight" style={{ color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Track<span style={{ color: TEAL }}>My</span>RMC
          </span>
        </div>
        <div className="flex items-center gap-2.5" style={{ flexShrink: 0 }}>
          <AiHeaderButton />
          <div
            className="relative flex h-9 w-9 items-center justify-center rounded-full border"
            style={{ borderColor: LINE, background: SURFACE }}
          >
            <NotificationBell />
          </div>
          <button
            type="button"
            onClick={onProfile}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: TEAL_SOFT, border: `1.5px solid ${TEAL}` }}
            aria-label="Open account and more menu"
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
  const slotClass = 'flex flex-1 min-w-0 min-h-12 flex-col items-center justify-center gap-1';
  const inner = (
    <>
      <Icon className="h-5 w-5" style={{ color, flexShrink: 0 }} aria-hidden="true" />
      <span
        className="text-[10px] font-semibold"
        style={{ color, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >{tab.label}</span>
    </>
  );
  if (tab.more) {
    return (
      <button type="button" onClick={onMore} className={slotClass} aria-label="Open more navigation options">
        {inner}
      </button>
    );
  }
  return (
    <Link
      href={tab.href}
      onClick={onNavigate}
      className={slotClass}
      style={{ textDecoration: 'none' }}
      aria-label={`Go to ${tab.label}`}
      aria-current={active ? 'page' : undefined}
    >
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

  // Every role gets the existing NEW services menu in the centre. For clients,
  // this produces the required HOME | ORDERS | NEW | PLANTS | MORE sequence.
  const showNew = true;
  const centerFab = showNew ? undefined : fab;
  const hasCenter = showNew || !!centerFab;
  const left = hasCenter ? tabs.slice(0, 2) : tabs;
  const right = hasCenter ? tabs.slice(2) : [];
  const fabColor = centerFab?.color === 'red' ? RED : TEAL;
  const fabShadow = centerFab?.color === 'red'
    ? '0 8px 20px color-mix(in srgb, var(--red) 40%, transparent)'
    : '0 8px 20px color-mix(in srgb, var(--gold) 35%, transparent)';
  const FabIcon = centerFab?.icon;

  return (
    <nav
      id="delivery-bottom-nav"
      aria-label="Primary mobile navigation"
      className="mx-auto"
      style={{
        display: 'none', position: 'fixed', left: 0, right: 0,
        bottom: 0, zIndex: 55, width: '100%',
        background: SURFACE, borderTop: `1px solid ${LINE}`,
        height: 'calc(74px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box',
        padding: '2px max(6px, env(safe-area-inset-left, 0px)) 0 max(6px, env(safe-area-inset-right, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 -4px 18px rgba(var(--shadow-rgb),.14)',
      }}
    >
      {left.map((t, i) => <Slot key={`l${i}`} tab={t} location={location} onMore={onMore} onNavigate={() => onNavigate?.()} />)}
      {/* flex:'1 1 0' gives the center slot equal width to each tab so the
          absolute FAB button sits precisely in the middle without bleeding
          into adjacent slots. position:relative makes the nav the containing
          block for the absolute button (nav is position:fixed). */}
      {showNew && (
        <div style={{ flex: '1 1 0', position: 'relative', minWidth: 0 }}>
          <NewWidgetMenu role={user.role} onNavigate={() => onNavigate?.()} />
        </div>
      )}
      {centerFab && FabIcon && (
        <div className="flex flex-col items-center" style={{ transform: 'translateY(-4px)' }}>
          <button
            type="button"
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
