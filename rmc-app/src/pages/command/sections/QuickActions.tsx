import { useLocation } from 'wouter';
import type { ReactNode } from 'react';
import {
  Zap, UserPlus, Building2, Truck, Package, BarChart3, Users, Bell, ShieldCheck, LayoutDashboard,
} from 'lucide-react';
import { SectionHeading, GlassPanel, SocialLinks, } from '../ui';
import { mix } from '../tokens';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/permissions';

interface Action { label: string; icon: ReactNode; color: string; go?: string; onClick?: () => void }

export default function QuickActions({ accent, onInvite }: { accent: string; onInvite: () => void }) {
  const [, setLoc] = useLocation();
  const { user } = useAuth();

  // Shortcut cards are permission-aware: a card that routes to a module the
  // signed-in role can't open (per role permissions) is not rendered at all.
  const actions: Action[] = [
    { label: 'Invite owner / staff', icon: <UserPlus size={20} />, color: '#e879f9', onClick: onInvite },
    { label: 'Full dashboard', icon: <LayoutDashboard size={20} />, color: 'var(--gold)', go: '/' },
    { label: 'Plants', icon: <Building2 size={20} />, color: '#a78bfa', go: '/plants' },
    { label: 'Orders', icon: <Package size={20} />, color: 'var(--blue)', go: '/orders' },
    { label: 'Fleet', icon: <Truck size={20} />, color: 'var(--orange)', go: '/vehicles' },
    { label: 'Customers', icon: <Users size={20} />, color: 'var(--green)', go: '/clients' },
    { label: 'Reports', icon: <BarChart3 size={20} />, color: '#22d3ee', go: '/reports' },
    { label: 'Users & access', icon: <ShieldCheck size={20} />, color: 'var(--red)', go: '/users' },
    { label: 'Audit log', icon: <Bell size={20} />, color: '#f59e0b', go: '/audit-log' },
  ].filter(a => !a.go || (user && canAccess(user.role, a.go)));

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<Zap size={20} />} accent={accent}
        title="Quick Actions"
        subtitle="Jump straight to the tools you use most"
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 18 }}>
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => (a.onClick ? a.onClick() : a.go ? setLoc(a.go) : undefined)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
              padding: 16, borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              background: `linear-gradient(150deg, ${mix(a.color, 18)}, ${mix(a.color, 5)}), var(--surface)`,
              border: `1px solid ${mix(a.color, 28)}`, color: 'var(--text)',
              transition: 'transform .14s, box-shadow .14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 26px ${mix(a.color, 26)}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <span style={{
              width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: mix(a.color, 22), color: a.color, border: `1px solid ${mix(a.color, 40)}`,
            }}>{a.icon}</span>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{a.label}</span>
          </button>
        ))}
      </div>

      <GlassPanel accent={accent}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Follow CONCRETE KING</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Official channels — links coming soon</div>
          </div>
          <SocialLinks />
        </div>
      </GlassPanel>
    </div>
  );
}
