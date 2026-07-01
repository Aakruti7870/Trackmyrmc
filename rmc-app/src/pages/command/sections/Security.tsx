import { ShieldCheck, LogIn, KeyRound, Ban, ShieldAlert, Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { SectionHeading, GlassPanel, StatCard, Badge, SampleTag, } from '../ui';
import { mix } from '../tokens';
import { SECURITY_EVENTS, ACTIVE_SESSIONS, type SecurityEvent } from '../data';

const EVENT_ICON: Record<SecurityEvent['type'], ReactNode> = {
  login: <LogIn size={14} />, otp: <KeyRound size={14} />,
  permission: <ShieldCheck size={14} />, blocked: <Ban size={14} />,
};

export default function Security({ accent }: { accent: string }) {
  return (
    <div className="cc-in">
      <SectionHeading
        icon={<ShieldCheck size={20} />} accent={accent}
        title="Security &amp; Access"
        subtitle="Authentication events, sessions and platform guards"
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
        <StatCard icon={<ShieldCheck size={17} />} label="2FA enforced" accent="var(--green)" value="On" sub="Super Admin logins" />
        <StatCard icon={<Monitor size={17} />} label="Active sessions" accent="var(--blue)" value={ACTIVE_SESSIONS.length} />
        <StatCard icon={<Ban size={17} />} label="Blocked attempts" accent="var(--red)" value={SECURITY_EVENTS.filter(e => !e.ok).length} sub="Last 24h" />
        <StatCard icon={<ShieldAlert size={17} />} label="Threat level" accent="var(--orange)" value="Low" />
      </div>

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <GlassPanel accent={accent}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Recent security events</span>
            <SampleTag />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECURITY_EVENTS.map(e => {
              const col = e.ok ? 'var(--green)' : 'var(--red)';
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, background: mix(col, 14), color: col }}>
                    {EVENT_ICON[e.type]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.actor}</div>
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{e.when}</span>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        <GlassPanel accent="var(--blue)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Active sessions</span>
            <SampleTag />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ACTIVE_SESSIONS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <Monitor size={16} color="var(--muted)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.device} • {s.ip}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <Badge color="var(--blue)">{s.role}</Badge>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{s.active}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
