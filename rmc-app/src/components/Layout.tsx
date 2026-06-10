import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, ClipboardList, Truck, Users, CarFront,
  FileText, BarChart3, Menu, X, UserCheck, LogOut, FlaskConical,
  ChevronDown, PackageSearch, Route, ShieldCheck, Settings, Search, History,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useToast } from '@/lib/toast';
import { ROLE_ALLOWED_PATHS, type Role } from '@/lib/permissions';
import { useSSE, type SSEStatus } from '@/lib/useSSE';
import type { Challan } from '@/lib/types';
import CommandPalette from '@/components/CommandPalette';

const ALL_NAV_ITEMS = [
  { path: '/',             label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/my-orders',   label: 'My Orders',  icon: PackageSearch },
  { path: '/my-trips',    label: 'My Trips',   icon: Route },
  { path: '/orders',      label: 'Orders',     icon: ClipboardList },
  { path: '/dispatch',    label: 'Dispatch',   icon: Truck },
  { path: '/clients',     label: 'Clients',    icon: Users },
  { path: '/vehicles',    label: 'Fleet',      icon: CarFront },
  { path: '/drivers',     label: 'Drivers',    icon: UserCheck },
  { path: '/batch-report', label: 'Production', icon: FileText },
  { path: '/mix-design',  label: 'Mix Design', icon: FlaskConical },
  { path: '/reports',     label: 'Reports',    icon: BarChart3 },
  { path: '/users',       label: 'Users',      icon: ShieldCheck },
  { path: '/activity-log', label: 'Activity Log', icon: History },
];

const ROLE_COLOR: Record<string, string> = {
  admin: 'var(--gold)',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  client: '#a78bfa',
  driver: '#f97316',
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { status: sseStatus, reconnect, subscribe } = useSSE();
  const { theme, themes, setTheme } = useTheme();
  const { showToast } = useToast();

  useEffect(() => {
    const unsubCreated = subscribe('challan.created', (data: unknown) => {
      const c = data as Partial<Challan>;
      if (!c?.challanNo) return;
      showToast(`New challan ${c.challanNo} created`, 'info');
    });
    const unsubUpdated = subscribe('challan.updated', (data: unknown) => {
      const c = data as Partial<Challan>;
      if (!c?.challanNo || c.status !== 'delivered') return;
      showToast(`${c.challanNo} marked Delivered`, 'success');
    });
    const unsubOrder = subscribe('order.updated', (data: unknown) => {
      const o = data as { orderNo?: string; status?: string };
      if (!o?.orderNo || !o.status) return;
      const label = o.status
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase());
      showToast(`Order ${o.orderNo} now ${label}`, o.status === 'completed' ? 'success' : 'info');
    });
    return () => { unsubCreated(); unsubUpdated(); unsubOrder(); };
  }, [subscribe, showToast]);

  const roleColor = user ? (ROLE_COLOR[user.role] || 'var(--muted)') : 'var(--muted)';
  const roleLabel = user?.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

  const allowedPaths = user ? (ROLE_ALLOWED_PATHS[user.role as Role] ?? []) : [];
  const navItems = ALL_NAV_ITEMS.filter(item => allowedPaths.includes(item.path));

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(145deg,var(--gold-hi),var(--gold-mid) 42%,var(--gold-dark))',
            display: 'grid', placeItems: 'center',
            fontWeight: 900, color: '#111827', fontSize: 13,
            boxShadow: '0 18px 38px color-mix(in srgb, var(--gold) 22%, transparent),inset 0 2px 2px rgba(255,255,255,.7)',
          }}>
            RMC
          </div>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase',
              background: 'linear-gradient(90deg,var(--gold-hi),var(--gold),var(--text))',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
            }}>Aakruti Infra</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Command Center</div>
          </div>
        </div>
        <SSEDot status={sseStatus} onReconnect={reconnect} />
      </div>

      {/* Quick search → opens the command palette (⌘K) */}
      <button
        onClick={() => { window.dispatchEvent(new Event('open-command-palette')); setMobileOpen(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '9px 12px', marginBottom: 12, borderRadius: 12, cursor: 'pointer',
          background: 'rgba(255,255,255,.03)', border: '1px solid var(--line)',
          color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, textAlign: 'left',
        }}
      >
        <Search size={14} />
        <span style={{ flex: 1 }}>Quick search…</span>
        <span style={{ fontSize: 10, fontWeight: 700, border: '1px solid var(--line)', borderRadius: 6, padding: '1px 5px' }}>⌘K</span>
      </button>

      {/* Nav */}
      <nav style={{ display: 'grid', gap: 3, flex: 1 }}>
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = path === '/' ? location === '/' : location.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              onClick={() => setMobileOpen(false)}
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

      {/* User profile */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            borderRadius: 12, cursor: 'pointer', position: 'relative',
            background: userMenuOpen ? 'rgba(38,52,73,.5)' : 'transparent',
          }}
          onClick={() => setUserMenuOpen(o => !o)}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${roleColor} 27%, transparent)`,
            display: 'grid', placeItems: 'center',
            fontSize: 13, fontWeight: 800, color: roleColor,
          }}>
            {user?.name?.[0] || '?'}
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
            marginTop: 4, background: 'rgba(13,25,48,.95)', border: '1px solid var(--line)',
            borderRadius: 10, overflow: 'hidden',
          }}>
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
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--surface)' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8,
              }}>
                Theme
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {themes.map(t => {
                  const selected = t.id === theme.id;
                  return (
                    <button
                      key={t.id}
                      title={t.name}
                      onClick={() => setTheme(t.id)}
                      style={{
                        width: 24, height: 24, borderRadius: 8, cursor: 'pointer', padding: 0,
                        background: `linear-gradient(135deg, ${t.tokens['--gold-hi']}, ${t.tokens['--gold']} 55%, ${t.tokens['--gold-dark']})`,
                        border: selected ? '2px solid var(--text)' : `2px solid ${t.tokens['--line']}`,
                        boxShadow: selected ? `0 0 0 2px color-mix(in srgb, ${t.tokens['--gold']} 45%, transparent)` : 'none',
                        transition: 'box-shadow .15s, border-color .15s',
                      }}
                    />
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
    </>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <CommandPalette />
      {/* Mobile header */}
      <div style={{
        display: 'none', background: 'rgba(8,17,31,.96)',
        borderBottom: '1px solid var(--line)', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }} id="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(145deg,var(--gold-hi),var(--gold-mid) 42%,var(--gold-dark))',
            display: 'grid', placeItems: 'center',
            fontWeight: 900, color: '#111827', fontSize: 13,
          }}>RMC</div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>TrackMyRMC</span>
          <SSEDot status={sseStatus} onReconnect={reconnect} />
        </div>
        <button onClick={() => setMobileOpen(o => !o)}
          style={{ background: 'none', color: 'var(--text)', padding: 4, border: 'none' }}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar */}
        <aside id="desktop-sidebar" style={{
          width: 240, flexShrink: 0,
          background: 'linear-gradient(180deg,rgba(8,17,31,.97),rgba(2,6,18,.97))',
          borderRight: '1px solid var(--line)', padding: '18px 14px',
          position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {SidebarContent()}
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(5,9,20,.6)', backdropFilter: 'blur(2px)' }}
            onClick={() => setMobileOpen(false)} />
        )}
        <div id="mobile-sidebar" style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, zIndex: 45,
          background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(2,6,18,.98))',
          borderRight: '1px solid var(--line)', padding: '18px 14px',
          display: 'flex', flexDirection: 'column',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .25s ease',
        }}>
          {SidebarContent()}
        </div>

        <main style={{ flex: 1, padding: '22px', minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          #desktop-sidebar { display: none !important; }
          #mobile-header { display: flex !important; }
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
