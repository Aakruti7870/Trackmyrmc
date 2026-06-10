import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, ClipboardList, Truck, Users, CarFront,
  FileText, BarChart3, Menu, X, UserCheck, LogOut, FlaskConical,
  ChevronDown, PackageSearch, Route,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ROLE_ALLOWED_PATHS, type Role } from '@/lib/permissions';
import { useSSE, type SSEStatus } from '@/lib/useSSE';

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
];

const ROLE_COLOR: Record<string, string> = {
  admin: '#f7c948',
  dispatcher: '#38bdf8',
  plant_operator: '#22c55e',
  client: '#a78bfa',
  driver: '#f97316',
};

function SSEDot({ status }: { status: SSEStatus }) {
  const isLive = status === 'connected';
  const isReconnecting = status === 'reconnecting' || status === 'connecting';
  const color = isLive ? '#22c55e' : isReconnecting ? '#f7c948' : '#9fb0c7';
  const label = isLive ? 'Live' : isReconnecting ? 'Reconnecting…' : 'Offline';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 999,
      background: `${color}12`,
      border: `1px solid ${color}30`,
      fontSize: 10, fontWeight: 700, color,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block',
        animation: isLive ? 'ssePulse 2s ease-in-out infinite' : (isReconnecting ? 'sseBlink .9s step-end infinite' : 'none'),
      }} />
      {label}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { status: sseStatus } = useSSE();

  const roleColor = user ? (ROLE_COLOR[user.role] || '#9fb0c7') : '#9fb0c7';
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
            background: 'linear-gradient(145deg,#ffe08a,#ffb703 42%,#a16207)',
            display: 'grid', placeItems: 'center',
            fontWeight: 900, color: '#111827', fontSize: 13,
            boxShadow: '0 18px 38px rgba(255,183,3,.22),inset 0 2px 2px rgba(255,255,255,.7)',
          }}>
            RMC
          </div>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase',
              background: 'linear-gradient(90deg,#fff7d6,#fbbf24,#e2e8f0)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
            }}>Aakruti Infra</div>
            <div style={{ fontSize: 10, color: '#9fb0c7', marginTop: 1 }}>TrackMyRMC Platform</div>
          </div>
        </div>
        <SSEDot status={sseStatus} />
      </div>

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
                color: active ? '#eef5ff' : '#9fb0c7',
                background: active ? 'linear-gradient(135deg,#1d2d47,#152239)' : 'transparent',
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
                  background: '#f7c948', boxShadow: '0 0 8px #f7c948'
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      <div style={{ marginTop: 16, borderTop: '1px solid #263449', paddingTop: 14 }}>
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
            background: roleColor + '22', border: `1px solid ${roleColor}44`,
            display: 'grid', placeItems: 'center',
            fontSize: 13, fontWeight: 800, color: roleColor,
          }}>
            {user?.name?.[0] || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#eef5ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 10, color: roleColor, fontWeight: 600, textTransform: 'capitalize' }}>
              {roleLabel}
            </div>
          </div>
          <ChevronDown size={13} color="#9fb0c7" style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </div>
        {userMenuOpen && (
          <div style={{
            marginTop: 4, background: 'rgba(13,25,48,.95)', border: '1px solid #263449',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <button
              onClick={() => { logout(); setUserMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#ef4444', fontSize: 13, fontWeight: 600,
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
      {/* Mobile header */}
      <div style={{
        display: 'none', background: 'rgba(8,17,31,.96)',
        borderBottom: '1px solid #263449', padding: '12px 16px',
        alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }} id="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(145deg,#ffe08a,#ffb703 42%,#a16207)',
            display: 'grid', placeItems: 'center',
            fontWeight: 900, color: '#111827', fontSize: 13,
          }}>RMC</div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>TrackMyRMC</span>
          <SSEDot status={sseStatus} />
        </div>
        <button onClick={() => setMobileOpen(o => !o)}
          style={{ background: 'none', color: '#eef5ff', padding: 4, border: 'none' }}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar */}
        <aside id="desktop-sidebar" style={{
          width: 240, flexShrink: 0,
          background: 'linear-gradient(180deg,rgba(8,17,31,.97),rgba(2,6,18,.97))',
          borderRight: '1px solid #263449', padding: '18px 14px',
          position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          <SidebarContent />
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(5,9,20,.6)', backdropFilter: 'blur(2px)' }}
            onClick={() => setMobileOpen(false)} />
        )}
        <div id="mobile-sidebar" style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, zIndex: 45,
          background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(2,6,18,.98))',
          borderRight: '1px solid #263449', padding: '18px 14px',
          display: 'flex', flexDirection: 'column',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .25s ease',
        }}>
          <SidebarContent />
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
