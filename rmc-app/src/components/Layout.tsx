import { Link, useLocation, useSearch } from 'wouter';
import {
  LayoutDashboard, ClipboardList, Truck, Users, CarFront,
  FileText, BarChart3, Menu, X, UserCheck, LogOut, FlaskConical,
  ChevronDown, PackageSearch, Route, ShieldCheck, Settings, Search, History, ClipboardCheck, Repeat,
  Timer, TrendingUp, Fuel, MapPin, Factory, Sun, Moon, CalendarClock,
  Crown, Building2, HardHat, Wallet, User, Zap, MessageCircle,
  Home, Siren,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/lib/toast';
import { allowedPaths as roleAllowedPaths } from '@/lib/permissions';
import { useSSE, type SSEStatus } from '@/lib/useSSE';
import { formatNotification } from '@/lib/notifications';
import { PLATFORM_NAME } from '@/lib/brand';
import CommandPalette from '@/components/CommandPalette';
import NotificationBell from '@/components/NotificationBell';
import AIHelpAgent, { AiHeaderButton } from '@/components/ai/AIHelpAgent';
import InstallAppButton from '@/components/InstallAppButton';
import { ConcreteKingLogo, BrandCredits } from '@/components/BrandLogo';

const ALL_NAV_ITEMS = [
  { path: '/command',      label: 'Command Center', icon: Crown },
  { path: '/',             label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/my-orders',   label: 'My Orders',  icon: PackageSearch },
  { path: '/nearby-plants', label: 'Find Plants', icon: MapPin },
  { path: '/my-trips',    label: 'My Trips',   icon: Route },
  { path: '/orders',      label: 'Orders',     icon: ClipboardList },
  { path: '/dispatch',    label: 'Dispatch',   icon: Truck },
  { path: '/freshness',   label: 'Freshness Guard', icon: Timer },
  { path: '/forecast',    label: 'Demand Forecast', icon: TrendingUp },
  { path: '/clients',     label: 'Clients',    icon: Users },
  { path: '/vehicles',    label: 'Fleet',      icon: CarFront },
  { path: '/drivers',     label: 'Drivers',    icon: UserCheck },
  { path: '/attendance',  label: 'Attendance', icon: CalendarClock },
  { path: '/mix-design',  label: 'Mix Design', icon: FlaskConical },
  { path: '/reports',     label: 'Reports',    icon: BarChart3 },
  { path: '/recurring',   label: 'Recurring',  icon: Repeat },
  { path: '/fuel-log',    label: 'Fuel Log',   icon: Fuel },
  { path: '/plants',      label: 'Plants',     icon: Factory },
  { path: '/users',       label: 'Users',      icon: ShieldCheck },
  { path: '/user-management', label: 'Plant Users', icon: UserCheck },
  { path: '/activity-log', label: 'Activity & Audit', icon: History },
  { path: '/automations', label: 'Automations', icon: Zap },
  { path: '/whatsapp',    label: 'WhatsApp',   icon: MessageCircle },
];

// Clients get a curated, deep-linked menu of three pages. The rich "My Orders"
// page exposes Deliveries (delivery history) and Financial Statement (billing
// ledger) as internal tabs; we surface them here as first-class sidebar entries
// via ?tab= deep links plus a window event (so they switch even when the user is
// already on the page).
const CLIENT_NAV: { path: string; label: string; icon: typeof LayoutDashboard; tab?: string }[] = [
  { path: '/my-orders',     label: 'My Orders',           icon: PackageSearch, tab: 'today' },
  { path: '/my-orders',     label: 'Deliveries',          icon: Truck,         tab: 'deliveries' },
  { path: '/my-orders',     label: 'Financial Statement', icon: FileText,      tab: 'billing' },
  { path: '/nearby-plants', label: 'Find Plants',         icon: MapPin },
  { path: '/profile',       label: 'Account',             icon: Settings },
];

// Drivers get a phone-first bottom tab bar on mobile (and these entries in the
// sidebar on desktop). Five fixed destinations mirroring the driver app scope.
const DRIVER_NAV: { path: string; label: string; icon: typeof LayoutDashboard }[] = [
  { path: '/home',     label: 'Home',     icon: Home },
  { path: '/my-trips', label: 'Trips',    icon: Route },
  { path: '/expenses', label: 'Expenses', icon: Wallet },
  { path: '/sos',      label: 'SOS',      icon: Siren },
  { path: '/profile',  label: 'Profile',  icon: User },
];

const ROLE_COLOR: Record<string, string> = {
  authority: '#e879f9',
  plant_owner: '#f59e0b',
  admin: 'var(--gold)',
  supervisor: '#14b8a6',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  accountant: '#06b6d4',
  quality_engineer: '#84cc16',
  fleet_manager: '#fb7185',
  store_manager: '#c084fc',
  client: '#a78bfa',
  driver: '#f97316',
};

// Professional role emblem shown in the user badge — gives at-a-glance
// recognition of the signed-in user's role (no emoji, theme-aware colour).
const ROLE_ICON: Record<string, typeof ShieldCheck> = {
  authority: Crown,
  plant_owner: Building2,
  admin: ShieldCheck,
  supervisor: ClipboardCheck,
  dispatcher: Truck,
  plant_operator: HardHat,
  accountant: Wallet,
  quality_engineer: ClipboardCheck,
  fleet_manager: Truck,
  store_manager: Building2,
  client: User,
  driver: CarFront,
};

function SSEDot({ status, onReconnect }: { status: SSEStatus; onReconnect: () => void }) {
  const isLive = status === 'connected';
  const isReconnecting = status === 'reconnecting' || status === 'connecting';
  const isClosed = status === 'closed';
  const color = isLive ? 'var(--green)' : isReconnecting ? 'var(--gold)' : 'var(--red)';
  const label = isLive ? 'Live' : isReconnecting ? 'Reconnecting…' : 'Offline';

  return (
    <div
      onClick={isClosed ? onReconnect : undefined}
      title={isClosed ? 'Click to reconnect' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 999,
        background: `color-mix(in srgb, ${color} 7%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 19%, transparent)`,
        fontSize: 10, fontWeight: 700, color,
        cursor: isClosed ? 'pointer' : 'default',
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block',
        animation: isLive ? 'ssePulse 2s ease-in-out infinite' : (isReconnecting ? 'sseBlink .9s step-end infinite' : 'none'),
      }} />
      {isClosed ? 'Offline — tap to retry' : label}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const search = useSearch();
  const currentTab = new URLSearchParams(search).get('tab') || 'today';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { status: sseStatus, reconnect, subscribe } = useSSE();
  const { theme, themes, setTheme } = useTheme();
  const { showToast } = useToast();

  const isClient = user?.role === 'client';
  const isDriver = user?.role === 'driver';

  useEffect(() => {
    const toastFor = (event: 'challan.created' | 'challan.updated' | 'order.updated') => (data: unknown) => {
      const n = formatNotification(event, data, isClient);
      if (n) showToast(n.message, n.type);
    };
    const unsubCreated = subscribe('challan.created', toastFor('challan.created'));
    const unsubUpdated = subscribe('challan.updated', toastFor('challan.updated'));
    const unsubOrder = subscribe('order.updated', toastFor('order.updated'));

    // Plant-wide concrete freshness escalation (staff only). Surfaces as an
    // error toast so dispatchers see at-risk loads from anywhere in the app.
    const unsubFresh = subscribe('challan.freshness', (data: unknown) => {
      const d = data as { challanNo?: string; grade?: string; siteName?: string | null; level?: string };
      if (!d?.challanNo) return;
      const where = d.siteName ? ` → ${d.siteName}` : '';
      const verb = d.level === 'expired' ? 'has EXPIRED' : 'is running critically low';
      showToast(`Load ${d.challanNo} (${d.grade})${where} ${verb} — pour now`, 'error');
    });

    // A customer asked to onboard a discovered plant (admins/authority only,
    // scoped server-side). Prompts staff to open the Onboarding-requests tab.
    const unsubInvite = subscribe('plant.invite', (data: unknown) => {
      const d = data as { name?: string; requestedByName?: string | null };
      if (!d?.name) return;
      const who = d.requestedByName ? ` by ${d.requestedByName}` : '';
      showToast(`New plant onboarding request${who}: ${d.name}`, 'info');
    });

    // A customer's WhatsApp order/dispatch/delivery update failed to deliver
    // (staff only, scoped server-side). Surfaces as an error toast so staff can
    // phone the customer instead — names the order/challan, phone and error code.
    const unsubWaFailed = subscribe('whatsapp.failed', (data: unknown) => {
      const d = data as {
        event?: string; toPhone?: string; errorCode?: string | null;
        orderNo?: string | null; challanNo?: string | null;
      };
      const ref = d?.challanNo ? `Challan ${d.challanNo}` : d?.orderNo ? `Order ${d.orderNo}` : 'an update';
      const phone = d?.toPhone ? ` to ${d.toPhone}` : '';
      const code = d?.errorCode ? ` (error ${d.errorCode})` : '';
      showToast(`WhatsApp update for ${ref}${phone} failed${code} — call the customer`, 'error');
    });

    // A WhatsApp order/dispatch/delivery update was permanently abandoned for a
    // customer (staff only, scoped server-side). Surfaced as an error toast so a
    // dispatcher can phone the customer instead of finding the gap in the audit
    // log later. Names the update type and recipient phone so staff know who to
    // call.
    const unsubGaveUp = subscribe('whatsapp.gave_up', (data: unknown) => {
      const d = data as { event?: string; toPhone?: string };
      if (!d?.toPhone) return;
      const kind = d.event ? d.event.replace(/[._-]/g, ' ') : 'WhatsApp';
      showToast(`No ${kind} WhatsApp update reached ${d.toPhone} — please call the customer`, 'error');
    });

    // A customer messaged our WhatsApp business number (platform staff only,
    // scoped server-side). Toast a preview + re-dispatch as a window event so an
    // open WhatsApp inbox page refreshes instantly.
    const unsubWaMsg = subscribe('whatsapp.message', (data: unknown) => {
      const d = data as { phone?: string; name?: string | null; preview?: string };
      if (!d?.phone) return;
      const who = d.name || d.phone;
      const preview = d.preview ? `: ${d.preview}` : '';
      showToast(`WhatsApp from ${who}${preview}`, 'info');
      window.dispatchEvent(new CustomEvent('whatsapp-message', { detail: d }));
    });

    // A checked-in staffer's live GPS aged out while still on duty — their phone
    // went dark, not a normal check-out (supervisory roles only, scoped
    // server-side). Surfaced as an error toast so a supervisor can call/check on
    // them instead of the marker just silently vanishing from the duty map.
    const unsubDutyStale = subscribe('duty.stale', (data: unknown) => {
      const d = data as { name?: string; role?: string | null; count?: number };
      // Batch alert: many staffers aged out in one sweep (shift change / signal
      // blackout) — a single grouped toast instead of one per person.
      if (typeof d?.count === 'number' && d.count > 1) {
        showToast(`${d.count} staffers have gone offline — GPS inactive, check on them`, 'error');
        return;
      }
      if (!d?.name) return;
      const role = d.role ? d.role.replace(/[._-]/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) : null;
      const who = role ? `${d.name} (${role})` : d.name;
      showToast(`${who} has gone offline — GPS inactive, check on them`, 'error');
    });

    // A driver raised an SOS/emergency (supervisory roles only, scoped
    // server-side). Surfaced as a red error toast so a supervisor responds at
    // once, wherever they are in the app.
    const unsubEmergency = subscribe('emergency.raised', (data: unknown) => {
      const d = data as { type?: string; driverName?: string | null; message?: string | null };
      const who = d?.driverName ? d.driverName : 'A driver';
      const kind = d?.type ? d.type.replace(/[._-]/g, ' ') : 'emergency';
      const extra = d?.message ? ` — ${d.message}` : '';
      showToast(`SOS: ${who} reported a ${kind}${extra}`, 'error');
    });

    return () => { unsubCreated(); unsubUpdated(); unsubOrder(); unsubFresh(); unsubInvite(); unsubWaFailed(); unsubGaveUp(); unsubWaMsg(); unsubDutyStale(); unsubEmergency(); };
  }, [subscribe, showToast, isClient]);

  const roleColor = user ? (ROLE_COLOR[user.role] || 'var(--muted)') : 'var(--muted)';
  const roleLabel = user?.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
  const RoleIcon = user ? (ROLE_ICON[user.role] || User) : User;

  // Override-aware allow-list (built-in defaults merged with the DB-backed
  // role overrides loaded at bootstrap) so a permission removed in Settings
  // also disappears from the menu, not just from route access.
  const allowedPaths = user ? roleAllowedPaths(user.role) : [];
  // The WhatsApp inbox is platform-staff only (one shared business number), so
  // hide it from plant-bound admins even though the admin role lists the path;
  // the API enforces the same boundary with a 403.
  const isPlatformStaff = !!user && (user.role === 'authority' || (user.role === 'admin' && user.plantId == null));
  const navItems: { path: string; label: string; icon: typeof LayoutDashboard; tab?: string }[] =
    isClient
      ? CLIENT_NAV.filter(item => allowedPaths.includes(item.path))
      : isDriver
        ? DRIVER_NAV.filter(item => allowedPaths.includes(item.path))
        : ALL_NAV_ITEMS.filter(item =>
            allowedPaths.includes(item.path) && (item.path !== '/whatsapp' || isPlatformStaff));

  // Mobile bottom tab bar (non-driver, phones only): show up to 5 items inline;
  // if there are more, show the first 4 + a "More" tab that opens the full menu
  // sheet — so nothing (incl. account, theme, sign-out) is lost on mobile.
  const mobileHasMore = navItems.length > 5;
  const mobilePrimary = mobileHasMore ? navItems.slice(0, 4) : navItems;

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 14,
            boxShadow: '0 18px 38px color-mix(in srgb, var(--gold) 28%, transparent)',
          }}>
            <ConcreteKingLogo size={44} />
          </div>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase',
              background: 'linear-gradient(90deg,var(--gold-hi),var(--gold),var(--text))',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
            }}>{PLATFORM_NAME}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Command Center</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <SSEDot status={sseStatus} onReconnect={reconnect} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell />
            <AiHeaderButton />
          </div>
        </div>
      </div>

      {/* Quick search → opens the command palette (⌘K) */}
      <button
        onClick={() => { window.dispatchEvent(new Event('open-command-palette')); setMobileOpen(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '9px 12px', marginBottom: 12, borderRadius: 12, cursor: 'pointer',
          background: 'var(--chip-bg)', border: '1px solid var(--line)',
          color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, textAlign: 'left',
        }}
      >
        <Search size={14} />
        <span style={{ flex: 1 }}>Quick search…</span>
        <span style={{ fontSize: 10, fontWeight: 700, border: '1px solid var(--line)', borderRadius: 6, padding: '1px 5px' }}>⌘K</span>
      </button>

      {/* Nav */}
      <nav style={{ display: 'grid', gap: 3, flex: 1 }}>
        {navItems.map(({ path, label, icon: Icon, tab }) => {
          const active = tab
            ? (location.startsWith('/my-orders') && currentTab === tab)
            : (path === '/' ? location === '/' : location.startsWith(path));
          const href = tab && tab !== 'today' ? `${path}?tab=${tab}` : path;
          return (
            <Link
              key={`${path}:${tab ?? ''}`}
              href={href}
              onClick={() => {
                setMobileOpen(false);
                if (tab) window.dispatchEvent(new CustomEvent('myorders:set-tab', { detail: tab }));
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 12, textDecoration: 'none',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--text)' : 'var(--muted)',
                background: active ? 'linear-gradient(135deg,var(--surface),var(--panel2))' : 'transparent',
                border: active ? '1px solid rgba(255,255,255,.09)' : '1px solid transparent',
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,.08),0 10px 26px rgba(0,0,0,.22)' : 'none',
                transition: 'all .18s ease',
              }}
            >
              <Icon size={15} />
              {label}
              {active && (
                <div style={{
                  marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--gold)', boxShadow: '0 0 8px var(--gold)'
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Install app (PWA) */}
      <div style={{ margin: '12px 0 2px' }}>
        <InstallAppButton variant="sidebar" />
      </div>

      {/* User profile */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 12, cursor: 'pointer', position: 'relative',
            background: userMenuOpen ? 'var(--menu-hover)' : 'transparent',
          }}
          onClick={() => setUserMenuOpen(o => !o)}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${roleColor} 27%, transparent)`,
            display: 'grid', placeItems: 'center',
            color: roleColor,
          }}>
            <RoleIcon size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 10, color: roleColor, fontWeight: 600, textTransform: 'capitalize' }}>
              {roleLabel}
            </div>
          </div>
          <ChevronDown size={13} style={{ color: 'var(--muted)', transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </div>
        {userMenuOpen && (
          <div style={{
            marginTop: 4, background: 'var(--menu-bg)', border: '1px solid var(--line)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {allowedPaths.includes('/profile') && (
              <Link
                href="/profile"
                onClick={() => { setUserMenuOpen(false); setMobileOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '10px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', boxSizing: 'border-box',
                }}
              >
                <Settings size={14} />
                Account Settings
              </Link>
            )}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--surface)' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8,
              }}>
                Theme
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {themes.map(t => {
                  const selected = t.id === theme.id;
                  const Icon = t.id === 'night' ? Moon : Sun;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                        fontSize: 12.5, fontWeight: 700,
                        background: selected ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'var(--chip-bg)',
                        border: selected ? '1px solid color-mix(in srgb, var(--gold) 55%, transparent)' : '1px solid var(--line)',
                        color: selected ? 'var(--gold)' : 'var(--muted)',
                        transition: 'all .15s',
                      }}
                    >
                      <Icon size={14} />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={() => { logout(); setUserMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--red)', fontSize: 13, fontWeight: 600,
                borderTop: '1px solid var(--surface)',
              }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Sponsor / partner credits */}
      <div style={{ marginTop: 12 }}>
        <BrandCredits align="left" />
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CommandPalette />
      <AIHelpAgent />
      {/* Mobile header */}
      <div style={{
        display: isDriver ? 'flex' : 'none', background: 'var(--header-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--line)', padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }} id="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ConcreteKingLogo size={36} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>TrackMyRMC</span>
          <SSEDot status={sseStatus} onReconnect={reconnect} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NotificationBell />
          <AiHeaderButton />
          {/* Everyone navigates via the bottom tab bar on mobile — no hamburger. */}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar + mobile drawer — every non-driver role. Drivers get a
            bottom tab bar instead (no sidebar / drawer / hamburger at any width). */}
        {!isDriver && (
          <>
            <aside id="desktop-sidebar" style={{
              width: 240, flexShrink: 0,
              background: 'linear-gradient(180deg,var(--sidebar-1),var(--sidebar-2))',
              backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
              borderRight: '1px solid var(--line)', padding: '18px 14px',
              position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
            }}>
              {SidebarContent()}
            </aside>

            {/* Mobile overlay */}
            {mobileOpen && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--overlay)', backdropFilter: 'blur(2px)' }}
                onClick={() => setMobileOpen(false)} />
            )}
            {/* "More" menu — slides up as a bottom card sheet on mobile. */}
            <div id="mobile-sidebar" style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '86vh', zIndex: 45,
              background: 'linear-gradient(180deg,var(--sidebar-1),var(--sidebar-2))',
              backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
              borderTop: '1px solid var(--line)',
              borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: '10px 14px',
              paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              transform: mobileOpen ? 'translateY(0)' : 'translateY(110%)',
              transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
              boxShadow: '0 -20px 60px rgba(0,0,0,.4)',
              pointerEvents: mobileOpen ? 'auto' : 'none',
            }}>
              <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--line)', margin: '2px auto 12px', flexShrink: 0 }} />
              {SidebarContent()}
            </div>
          </>
        )}

        <main id="app-main" className={isDriver ? 'has-bottom-nav' : 'has-bottom-nav-mobile'} style={{ flex: 1, padding: '22px', minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      {/* Driver bottom tab bar — the driver's sole navigation, shown at all widths. */}
      {isDriver && (
        <nav id="driver-bottom-nav" style={{
          display: 'flex', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 55,
          background: 'var(--header-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
          borderTop: '1px solid var(--line)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          alignItems: 'stretch', justifyContent: 'space-around',
        }}>
          {DRIVER_NAV.filter(item => allowedPaths.includes(item.path)).map(({ path, label, icon: Icon }) => {
            const active = path === '/home' ? location === '/home' : location.startsWith(path);
            const isSos = path === '/sos';
            const color = active ? (isSos ? 'var(--red)' : 'var(--gold)') : 'var(--muted)';
            return (
              <Link
                key={path}
                href={path}
                onClick={() => setMobileOpen(false)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  padding: '8px 2px 7px', textDecoration: 'none',
                  color, fontSize: 10.5, fontWeight: active ? 800 : 600,
                }}
              >
                <Icon size={21} />
                {label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Mobile bottom tab bar — non-driver roles, phones only. The sidebar
          stays on desktop; this replaces the mobile drawer/hamburger. */}
      {!isDriver && (
        <nav id="mobile-bottom-nav" style={{
          display: 'none', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 55,
          background: 'var(--header-bg)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
          borderTop: '1px solid var(--line)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          alignItems: 'stretch', justifyContent: 'space-around',
        }}>
          {mobilePrimary.map(({ path, label, icon: Icon, tab }) => {
            const active = tab
              ? (location.startsWith('/my-orders') && currentTab === tab)
              : (path === '/' ? location === '/' : location.startsWith(path));
            const href = tab && tab !== 'today' ? `${path}?tab=${tab}` : path;
            return (
              <Link
                key={`${path}:${tab ?? ''}`}
                href={href}
                onClick={() => { setMobileOpen(false); if (tab) window.dispatchEvent(new CustomEvent('myorders:set-tab', { detail: tab })); }}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  padding: '8px 2px 7px', textDecoration: 'none',
                  color: active ? 'var(--gold)' : 'var(--muted)', fontSize: 10.5, fontWeight: active ? 800 : 600,
                }}
              >
                <Icon size={21} />
                <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              </Link>
            );
          })}
          {mobileHasMore && (
            <button
              onClick={() => setMobileOpen(o => !o)}
              style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '8px 2px 7px', background: 'none', border: 'none', cursor: 'pointer',
                color: mobileOpen ? 'var(--gold)' : 'var(--muted)', fontSize: 10.5, fontWeight: mobileOpen ? 800 : 600,
              }}
            >
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
              More
            </button>
          )}
        </nav>
      )}

      <style>{`
        /* Driver main always clears the fixed bottom tab bar (all widths). */
        #app-main.has-bottom-nav { padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
        @media (max-width: 900px) {
          #desktop-sidebar { display: none !important; }
          #mobile-header { display: flex !important; }
          #driver-bottom-nav { display: flex !important; }
          #mobile-bottom-nav { display: flex !important; }
          /* Non-driver main clears the mobile bottom tab bar on phones only. */
          #app-main.has-bottom-nav-mobile { padding-bottom: calc(76px + env(safe-area-inset-bottom, 0px)); }
        }
        @keyframes ssePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
          50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }
        @keyframes sseBlink {
          0%,100% { opacity: 1; } 50% { opacity: .25; }
        }
      `}</style>
    </div>
  );
}
