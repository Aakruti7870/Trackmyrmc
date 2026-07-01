// Shared premium UI primitives for the Authority Command Center.
// Everything is theme-token driven (var(--...)) so it re-skins with Day/Night.
import type { CSSProperties, ReactNode } from 'react';
import { mix } from './tokens';

export function GlassPanel({
  children, accent, style, onClick, className,
}: {
  children: ReactNode; accent?: string; style?: CSSProperties;
  onClick?: () => void; className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        position: 'relative',
        borderRadius: 18,
        padding: 18,
        background: 'linear-gradient(160deg, var(--glass-1), var(--glass-2))',
        border: `1px solid ${accent ? mix(accent, 26, 'var(--glass-border)') : 'var(--glass-border)'}`,
        boxShadow: accent
          ? `0 16px 40px ${mix(accent, 12)}, inset 0 1px 0 ${mix('#ffffff', 8)}`
          : '0 14px 34px rgba(var(--shadow-rgb),.28)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {accent && (
        <span aria-hidden style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }} />
      )}
      {children}
    </div>
  );
}

export function SectionHeading({
  icon, title, subtitle, accent, right,
}: {
  icon?: ReactNode; title: string; subtitle?: string; accent?: string; right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {icon && (
        <div style={{
          width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0,
          background: accent ? mix(accent, 16) : 'var(--surface)',
          border: `1px solid ${accent ? mix(accent, 34) : 'var(--line)'}`,
          color: accent ?? 'var(--gold)',
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.3 }}>{title}</h2>
        {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted)' }}>{subtitle}</p>}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  );
}

export function StatCard({
  icon, label, value, sub, accent = 'var(--gold)', trend, loading,
}: {
  icon?: ReactNode; label: string; value: ReactNode; sub?: string;
  accent?: string; trend?: { value: string; up: boolean }; loading?: boolean;
}) {
  return (
    <div style={{
      position: 'relative', borderRadius: 16, padding: 16, overflow: 'hidden',
      background: `linear-gradient(150deg, ${mix(accent, 22)}, ${mix(accent, 6)}), var(--surface)`,
      border: `1px solid ${mix(accent, 30)}`,
      boxShadow: `0 10px 26px ${mix(accent, 12)}`,
    }}>
      <div aria-hidden style={{
        position: 'absolute', right: -18, top: -18, width: 82, height: 82, borderRadius: '50%',
        background: mix(accent, 18), filter: 'blur(2px)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, position: 'relative' }}>
        {icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: mix(accent, 24), color: accent, border: `1px solid ${mix(accent, 40)}`,
          }}>{icon}</div>
        )}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.2 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, position: 'relative' }}>
        <div style={{ fontSize: 27, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
          {loading ? '…' : value}
        </div>
        {trend && (
          <span style={{
            fontSize: 11.5, fontWeight: 800, marginBottom: 3,
            color: trend.up ? 'var(--green)' : 'var(--red)',
          }}>{trend.up ? '▲' : '▼'} {trend.value}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6, position: 'relative' }}>{sub}</div>}
    </div>
  );
}

export function Badge({ children, color = 'var(--gold)', dot }: { children: ReactNode; color?: string; dot?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
      fontSize: 10.5, fontWeight: 800, color, background: mix(color, 12),
      border: `1px solid ${mix(color, 28)}`, whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />}
      {children}
    </span>
  );
}

export function LiveDot({ color = 'var(--green)', label = 'LIVE' }: { color?: string; label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
        boxShadow: `0 0 0 0 ${mix(color, 60)}`, animation: 'ccPulse 1.8s ease-out infinite',
      }} />
      {label}
    </span>
  );
}

// A small tag that marks a card as illustrative sample data (no live API yet).
export function SampleTag({ text = 'Sample data' }: { text?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999,
      fontSize: 9.5, fontWeight: 800, letterSpacing: 0.4, textTransform: 'uppercase',
      color: 'var(--muted)', background: mix('#94a3b8', 12), border: '1px dashed var(--line)',
    }}>{text}</span>
  );
}

// Horizontal labelled bar (for distributions / rankings).
export function BarRow({ label, value, max, accent = 'var(--gold)', suffix = '' }: {
  label: string; value: number; max: number; accent?: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--muted)', fontWeight: 700 }}>{value.toLocaleString()}{suffix}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, ${mix(accent, 60)}, ${accent})`,
          transition: 'width .6s cubic-bezier(.2,.8,.2,1)',
        }} />
      </div>
    </div>
  );
}

// Vertical mini bar chart (trend). Values normalised to the tallest.
export function MiniBars({ data, accent = 'var(--gold)', height = 64 }: {
  data: { label: string; value: number }[]; accent?: string; height?: number;
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.map((d, i) => {
        const h = Math.max(6, Math.round((d.value / max) * (height - 18)));
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div title={`${d.label}: ${d.value}`} style={{
              width: '100%', maxWidth: 26, height: h, borderRadius: '6px 6px 3px 3px',
              background: `linear-gradient(180deg, ${accent}, ${mix(accent, 35)})`,
              boxShadow: `0 0 12px ${mix(accent, 30)}`,
            }} />
            <span style={{ fontSize: 9.5, color: 'var(--muted)', fontWeight: 700 }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// SVG donut for a small distribution (up to a handful of slices).
export function Donut({ slices, size = 120, thickness = 16 }: {
  slices: { label: string; value: number; color: string }[]; size?: number; thickness?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Precompute each slice's cumulative start offset via a prefix sum so nothing
  // is reassigned during render (react-hooks/immutability). n is tiny.
  const arcs = slices.map((s, i) => ({
    ...s,
    dash: (s.value / total) * c,
    start: slices.slice(0, i).reduce((sum, x) => sum + (x.value / total) * c, 0),
  }));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface)" strokeWidth={thickness} />
      {arcs.map((s, i) => (
        <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color}
          strokeWidth={thickness} strokeDasharray={`${s.dash} ${c - s.dash}`} strokeDashoffset={-s.start}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      ))}
      <text x="50%" y="48%" textAnchor="middle" fill="var(--text)" fontSize={size * 0.2} fontWeight={900}>{total}</text>
      <text x="50%" y="62%" textAnchor="middle" fill="var(--muted)" fontSize={size * 0.09} fontWeight={700}>total</text>
    </svg>
  );
}

export function PrimaryButton({ children, onClick, accent = 'var(--gold)', disabled, style }: {
  children: ReactNode; onClick?: () => void; accent?: string; disabled?: boolean; style?: CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: '10px 16px', borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'var(--surface)' : `linear-gradient(135deg, ${accent}, ${mix(accent, 55, '#000')})`,
      color: disabled ? 'var(--muted)' : '#0a1512', fontWeight: 800, fontSize: 13,
      boxShadow: disabled ? 'none' : `0 8px 22px ${mix(accent, 30)}`,
      opacity: disabled ? 0.7 : 1, transition: 'transform .12s', ...style,
    }}>{children}</button>
  );
}

export function GhostButton({ children, onClick, accent = 'var(--gold)', style }: {
  children: ReactNode; onClick?: () => void; accent?: string; style?: CSSProperties;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: '9px 14px', borderRadius: 12, cursor: 'pointer',
      background: mix(accent, 10), color: accent, border: `1px solid ${mix(accent, 34)}`,
      fontWeight: 800, fontSize: 12.5, ...style,
    }}>{children}</button>
  );
}

// Marketing social links. Placeholder hrefs (# ) until the real accounts land.
// Brand marks are inline SVG (simple-icons paths) because lucide-react dropped
// its brand-logo set.
const Svg = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d={d} />
  </svg>
);

const BRAND_PATHS = {
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
};

const SOCIALS: { name: string; color: string; href: string; icon: ReactNode }[] = [
  { name: 'Instagram', color: '#E4405F', href: '#', icon: <Svg d={BRAND_PATHS.instagram} /> },
  { name: 'YouTube', color: '#FF0000', href: '#', icon: <Svg d={BRAND_PATHS.youtube} /> },
  { name: 'Facebook', color: '#1877F2', href: '#', icon: <Svg d={BRAND_PATHS.facebook} /> },
  { name: 'LinkedIn', color: '#0A66C2', href: '#', icon: <Svg d={BRAND_PATHS.linkedin} /> },
  { name: 'GitHub', color: '#e5e7eb', href: '#', icon: <Svg d={BRAND_PATHS.github} /> },
  { name: 'WhatsApp', color: '#25D366', href: '#', icon: <Svg d={BRAND_PATHS.whatsapp} /> },
];

export function SocialLinks({ compact }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {SOCIALS.map(s => (
        <a
          key={s.name}
          href={s.href}
          target={s.href === '#' ? undefined : '_blank'}
          rel="noreferrer noopener"
          title={`${s.name} (link coming soon)`}
          aria-label={s.name}
          onClick={e => { if (s.href === '#') e.preventDefault(); }}
          style={{
            width: compact ? 36 : 42, height: compact ? 36 : 42, borderRadius: 12,
            display: 'grid', placeItems: 'center', textDecoration: 'none',
            color: s.color, background: mix(s.color, 14),
            border: `1px solid ${mix(s.color, 32)}`,
            transition: 'transform .14s, box-shadow .14s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${mix(s.color, 34)}`; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
        >
          {s.icon}
        </a>
      ))}
    </div>
  );
}

// Shared keyframes for the command center (injected once by the shell).
export function CommandStyles() {
  return (
    <style>{`
      @keyframes ccPulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent);} 70% { box-shadow: 0 0 0 7px transparent;} 100% { box-shadow: 0 0 0 0 transparent;} }
      @keyframes ccFadeUp { from { opacity: 0; transform: translateY(8px);} to { opacity: 1; transform: none;} }
      .cc-grid { display: grid; gap: 14px; }
      .cc-in { animation: ccFadeUp .4s ease both; }
      @media (prefers-reduced-motion: reduce) { .cc-in { animation: none; } }
    `}</style>
  );
}
