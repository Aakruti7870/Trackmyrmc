import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'wouter';
import {
  Activity, MapPinned, Building2, Truck, Sparkles, BarChart3, ShieldCheck, Bell, Zap, UserPlus, Crown, Factory,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { CommandStyles, GlassPanel, PrimaryButton, Badge, SocialLinks } from './command/ui';
import { ACCENTS, AUTHORITY_ACCENT, mix } from './command/tokens';
import InviteDialog from './command/InviteDialog';
import Overview from './command/sections/Overview';
import MappingPlant from './command/sections/MappingPlant';
import Plants from './command/sections/Plants';
import Fleet from './command/sections/Fleet';
import Copilot from './command/sections/Copilot';
import Analytics from './command/sections/Analytics';
import Security from './command/sections/Security';
import Notifications from './command/sections/Notifications';
import QuickActions from './command/sections/QuickActions';

type TabKey = keyof typeof ACCENTS;

const TABS: { key: TabKey; label: string; icon: ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Activity size={16} /> },
  { key: 'map', label: 'Mapping Plant', icon: <MapPinned size={16} /> },
  { key: 'plants', label: 'Plants', icon: <Building2 size={16} /> },
  { key: 'fleet', label: 'Fleet', icon: <Truck size={16} /> },
  { key: 'copilot', label: 'Copilot', icon: <Sparkles size={16} /> },
  { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
  { key: 'security', label: 'Security', icon: <ShieldCheck size={16} /> },
  { key: 'notifications', label: 'Alerts', icon: <Bell size={16} /> },
  { key: 'actions', label: 'Actions', icon: <Zap size={16} /> },
];

export default function CommandCenter() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('overview');
  const [inviteOpen, setInviteOpen] = useState(false);
  const accent = ACCENTS[tab];

  return (
    <div style={{ position: 'relative', minHeight: '100%' }}>
      <CommandStyles />

      <div style={{ position: 'relative', zIndex: 1, padding: 'clamp(12px, 3vw, 22px)', maxWidth: 1240, margin: '0 auto' }}>
        <GlassPanel accent={AUTHORITY_ACCENT} style={{ marginBottom: 16, padding: 'clamp(16px, 3vw, 24px)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 15, display: 'grid', placeItems: 'center', flexShrink: 0,
                background: `linear-gradient(135deg, ${AUTHORITY_ACCENT}, ${mix(AUTHORITY_ACCENT, 55, '#000')})`,
                boxShadow: `0 10px 26px ${mix(AUTHORITY_ACCENT, 34)}`, color: '#160a17',
              }}>
                <Crown size={26} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h1 style={{ margin: 0, fontSize: 'clamp(20px, 4vw, 28px)', fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>
                    Command Center
                  </h1>
                  <Badge color={AUTHORITY_ACCENT} dot>Super Admin</Badge>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>
                  {user?.name ? `Welcome, ${user.name}` : 'Authority control room'} — everything, everywhere, in one view.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <SocialLinks compact />
              <Link href="/rmc-plant-network" style={{ textDecoration: 'none' }}>
                <PrimaryButton accent="#0f766e">
                  <Factory size={16} /> RMC Plant Network
                </PrimaryButton>
              </Link>
              <PrimaryButton accent={AUTHORITY_ACCENT} onClick={() => setInviteOpen(true)}>
                <UserPlus size={16} /> Invite
              </PrimaryButton>
            </div>
          </div>
        </GlassPanel>

        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 18,
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {TABS.map(t => {
            const on = tab === t.key;
            const a = ACCENTS[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0,
                  padding: '9px 15px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 800,
                  whiteSpace: 'nowrap', transition: 'all .16s',
                  background: on ? `linear-gradient(135deg, ${mix(a, 26)}, ${mix(a, 10)})` : 'var(--glass-1)',
                  color: on ? a : 'var(--muted)',
                  border: `1px solid ${on ? mix(a, 45) : 'var(--glass-border)'}`,
                  boxShadow: on ? `0 6px 18px ${mix(a, 22)}` : 'none',
                }}
              >
                {t.icon}{t.label}
              </button>
            );
          })}
        </div>

        <div key={tab}>
          {tab === 'overview' && <Overview accent={accent} />}
          {tab === 'map' && <MappingPlant accent={accent} />}
          {tab === 'plants' && <Plants accent={accent} onInvite={() => setInviteOpen(true)} />}
          {tab === 'fleet' && <Fleet accent={accent} />}
          {tab === 'copilot' && <Copilot accent={accent} />}
          {tab === 'analytics' && <Analytics accent={accent} />}
          {tab === 'security' && <Security accent={accent} />}
          {tab === 'notifications' && <Notifications accent={accent} />}
          {tab === 'actions' && <QuickActions accent={accent} onInvite={() => setInviteOpen(true)} />}
        </div>

        <div style={{ textAlign: 'center', padding: '26px 0 10px', color: 'var(--muted)', fontSize: 11.5 }}>
          CONCRETE KING • Authority Command Center
        </div>
      </div>

      {inviteOpen && <InviteDialog accent={AUTHORITY_ACCENT} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
