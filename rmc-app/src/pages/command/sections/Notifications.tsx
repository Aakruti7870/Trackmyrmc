import { useEffect, useState } from 'react';
import { Bell, Mail, MessageCircle, Radio, History } from 'lucide-react';
import { api } from '@/lib/api';
import { SectionHeading, GlassPanel, StatCard, Badge, SampleTag, } from '../ui';
import { mix } from '../tokens';

interface AuditRow { id: number; action?: string; entity?: string; actorName?: string | null; createdAt?: string }

const CHANNELS = [
  { name: 'WhatsApp', icon: <MessageCircle size={15} />, color: '#25D366', status: 'Live', detail: 'Meta Cloud API' },
  { name: 'Email', icon: <Mail size={15} />, color: 'var(--blue)', status: 'Live', detail: 'SMTP configured' },
  { name: 'Web Push', icon: <Radio size={15} />, color: '#a78bfa', status: 'Live', detail: 'VAPID subscriptions' },
];

export default function Notifications({ accent }: { accent: string }) {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get<AuditRow[] | { items?: AuditRow[] }>('/audit-logs')
      .then(d => {
        if (!alive) return;
        const rows = Array.isArray(d) ? d : (d?.items ?? []);
        setAudit(rows.slice(0, 8));
        setLoaded(true);
      })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<Bell size={20} />} accent={accent}
        title="Notifications &amp; Activity"
        subtitle="Delivery channels and the platform audit trail"
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', marginBottom: 16 }}>
        {CHANNELS.map(c => (
          <StatCard key={c.name} icon={c.icon} label={c.name} accent={c.color} value={c.status} sub={c.detail} />
        ))}
      </div>

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
        <GlassPanel accent={accent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <History size={16} color={accent} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Recent activity</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {audit.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: mix(accent, 90), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.action || 'Event'}{a.entity ? ` · ${a.entity}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.actorName || 'System'}</div>
                </div>
                {a.createdAt && <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(a.createdAt).toLocaleString()}</span>}
              </div>
            ))}
            {loaded && audit.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No recent activity recorded.</div>
            )}
          </div>
        </GlassPanel>

        <GlassPanel accent="var(--orange)">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Broadcast reach</span>
            <SampleTag />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { k: 'Messages sent (7d)', v: '3,412', c: 'var(--green)' },
              { k: 'Delivery rate', v: '98.1%', c: 'var(--blue)' },
              { k: 'Push subscribers', v: '284', c: '#a78bfa' },
              { k: 'Failed / retried', v: '19', c: 'var(--red)' },
            ].map(m => (
              <div key={m.k} style={{ padding: 12, borderRadius: 12, background: mix(m.c, 10), border: `1px solid ${mix(m.c, 24)}` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{m.v}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{m.k}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Badge color="var(--green)" dot>All channels operational</Badge>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
