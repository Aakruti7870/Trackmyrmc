import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, ClipboardList, Truck, Users, CarFront,
  FlaskConical, FileText, BarChart3, Menu, X
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/dispatch', label: 'Dispatch', icon: Truck },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/vehicles', label: 'Vehicles', icon: CarFront },
  { path: '/batch-report', label: 'Batch Report', icon: FileText },
  { path: '/mix-design', label: 'Mix Design', icon: FlaskConical },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16, flexShrink: 0,
          background: 'linear-gradient(145deg,#ffe08a,#ffb703 42%,#a16207)',
          display: 'grid', placeItems: 'center',
          fontWeight: 900, color: '#111827', fontSize: 15,
          boxShadow: '0 18px 38px rgba(255,183,3,.22),inset 0 2px 2px rgba(255,255,255,.7)',
        }}>
          RMC
        </div>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase',
            background: 'linear-gradient(90deg,#fff7d6,#fbbf24,#e2e8f0)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'
          }}>AAKRUTI INFRA RMC PLANT</div>
          <div style={{ fontSize: 11, color: '#9fb0c7', marginTop: 2 }}>Premium 3D Plant System</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'grid', gap: 4, flex: 1 }}>
        {navItems.map(({ path, label, icon: Icon }) => {
          const active = path === '/' ? location === '/' : location.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderRadius: 14,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? '#eef5ff' : '#9fb0c7',
                background: active ? 'linear-gradient(135deg,#1d2d47,#152239)' : 'transparent',
                border: active ? '1px solid rgba(255,255,255,.09)' : '1px solid transparent',
                boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,.08),0 10px 26px rgba(0,0,0,.22)' : 'none',
                transition: 'all .18s ease',
              }}
            >
              <Icon size={16} />
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

      <div style={{
        paddingTop: 16, fontSize: 12, color: '#9fb0c7',
        borderTop: '1px solid #263449', marginTop: 16
      }}>
        <div style={{ fontWeight: 600, color: '#eef5ff', fontSize: 13 }}>Live System</div>
        <div>Data stored locally</div>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Mobile header */}
      <div style={{
        display: 'none',
        background: 'rgba(8,17,31,.96)',
        borderBottom: '1px solid #263449',
        padding: '12px 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }} id="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(145deg,#ffe08a,#ffb703 42%,#a16207)',
            display: 'grid', placeItems: 'center',
            fontWeight: 900, color: '#111827', fontSize: 13,
            boxShadow: '0 0 20px rgba(247,201,72,.25)'
          }}>RMC</div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>AAKRUTI INFRA RMC PLANT</span>
        </div>
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{ background: 'none', color: '#eef5ff', padding: 4, border: 'none' }}
          data-testid="button-mobile-menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Main layout: sidebar + content */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Desktop sidebar */}
        <aside
          id="desktop-sidebar"
          style={{
            width: 265,
            flexShrink: 0,
            background: 'linear-gradient(180deg,rgba(8,17,31,.96),rgba(2,6,18,.96))',
            borderRight: '1px solid #263449',
            padding: '20px',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
            boxShadow: 'inset -1px 0 0 rgba(255,255,255,.05)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SidebarContent />
        </aside>

        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(5,9,20,.6)', backdropFilter: 'blur(2px)'
            }}
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          id="mobile-sidebar"
          style={{
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: 280,
            zIndex: 45,
            background: 'linear-gradient(180deg,rgba(8,17,31,.98),rgba(2,6,18,.98))',
            borderRight: '1px solid #263449',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform .25s ease',
          }}
        >
          <SidebarContent />
        </div>

        {/* Main content */}
        <main style={{
          flex: 1,
          padding: '22px',
          minWidth: 0,
          overflowX: 'hidden',
        }}>
          {children}
        </main>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          #desktop-sidebar { display: none !important; }
          #mobile-header { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
