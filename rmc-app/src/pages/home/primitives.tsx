import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { cardStyle } from './format';

export function HomeHeader({ name, subtitle, pill }: { name: string; subtitle: string; pill?: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{subtitle},</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '2px 0 0' }}>{name}</h1>
      {pill && <div style={{ marginTop: 8 }}>{pill}</div>}
    </div>
  );
}

export function StatRow({ cols = 3, children }: { cols?: number; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, marginBottom: 18 }}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, color, icon: Icon, sub }: {
  label: string; value: number | string; color: string; icon: ElementType; sub?: string;
}) {
  return (
    <div style={{ ...cardStyle, padding: 14, textAlign: 'center' }}>
      <Icon size={18} style={{ color, marginBottom: 6 }} />
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Section({ title, href, actionLabel = 'View all', children }: {
  title: string; href?: string; actionLabel?: string; children: ReactNode;
}) {
  return (
    <div style={{ ...cardStyle, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
        {href && (
          <Link href={href} style={{ color: 'var(--blue)', fontSize: 12, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            {actionLabel} <ArrowRight size={12} />
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

export function RowLink({ href, title, sub, badge, right }: {
  href: string; title: string; sub?: string;
  badge?: { label: string; color: string; bg: string }; right?: ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--chip-bg)', border: '1px solid var(--line)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
        </div>
        {badge && (
          <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, textTransform: 'capitalize' }}>{badge.label}</span>
        )}
        {right}
      </div>
    </Link>
  );
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>{children}</div>;
}

export function ActionTile({ href, label, sub, icon: Icon, color }: {
  href: string; label: string; sub: string; icon: ElementType; color: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ ...cardStyle, cursor: 'pointer', height: '100%', boxSizing: 'border-box' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${color} 14%, transparent)`, color, marginBottom: 10 }}>
          <Icon size={20} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </Link>
  );
}

export function AlertBand({ tone, icon: Icon, title, sub, href, actionLabel }: {
  tone: string; icon: ElementType; title: string; sub: string; href: string; actionLabel: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ ...cardStyle, marginBottom: 18, borderColor: `color-mix(in srgb, ${tone} 40%, transparent)`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: tone, display: 'flex', alignItems: 'center', gap: 4 }}>{actionLabel} <ArrowRight size={14} /></span>
      </div>
    </Link>
  );
}
