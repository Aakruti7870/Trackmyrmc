import { useId } from 'react';

/**
 * Concrete King mark — a crown seated on a monolithic concrete block, inside a
 * rounded badge filled with the app's teal gradient. Rendered as inline SVG so
 * it re-themes automatically (stops use var(--gold*)) and stays crisp at any size.
 */
export function ConcreteKingLogo({ size = 44 }: { size?: number }) {
  const uid = useId().replace(/[:]/g, '');
  const gBadge = `ck-badge-${uid}`;
  const gCrown = `ck-crown-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Concrete King"
    >
      <defs>
        <linearGradient id={gBadge} x1="5" y1="4" x2="43" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--gold-hi)" />
          <stop offset="0.5" stopColor="var(--gold)" />
          <stop offset="1" stopColor="var(--gold-dark)" />
        </linearGradient>
        <linearGradient id={gCrown} x1="12" y1="14" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9fff5" />
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect x="3" y="3" width="42" height="42" rx="13" fill={`url(#${gBadge})`} />
      <rect x="3.9" y="3.9" width="40.2" height="40.2" rx="12.1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.4" />

      {/* Crown */}
      <path d="M13 29 L13 20.2 L19.4 24.6 L24 16.2 L28.6 24.6 L35 20.2 L35 29 Z" fill={`url(#${gCrown})`} />
      {/* Concrete base block the crown sits on */}
      <rect x="13" y="30.6" width="22" height="3.6" rx="1.4" fill={`url(#${gCrown})`} />
      <rect x="15.5" y="35.2" width="17" height="2.2" rx="1.1" fill="rgba(255,255,255,0.55)" />

      {/* Gems */}
      <circle cx="13" cy="19" r="1.8" fill="#ffffff" />
      <circle cx="24" cy="14.6" r="2" fill="#ffffff" />
      <circle cx="35" cy="19" r="1.8" fill="#ffffff" />
    </svg>
  );
}

/**
 * Sponsor / partner credits — "Powered by GOLD e Tech" and "Sponsored by
 * VR INFRA". Rendered wherever the brand needs to breathe (sidebar footer,
 * login panel). `align` controls text alignment for the different placements.
 */
export function BrandCredits({ align = 'left' }: { align?: 'left' | 'center' }) {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: align === 'center' ? 'center' : 'flex-start',
    gap: 6,
    fontSize: 10.5,
    lineHeight: 1.5,
  };
  const label: React.CSSProperties = {
    color: 'var(--muted)',
    fontWeight: 600,
    letterSpacing: '.3px',
  };
  const name: React.CSSProperties = {
    fontWeight: 800,
    letterSpacing: '.2px',
    background: 'linear-gradient(90deg, var(--gold-hi), var(--gold))',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };

  return (
    <div
      style={{
        display: 'grid',
        gap: 5,
        padding: '11px 12px',
        borderRadius: 12,
        background: 'var(--chip-bg)',
        border: '1px solid var(--line)',
        textAlign: align,
      }}
    >
      <div style={rowStyle}>
        <span style={label}>Powered by</span>
        <span style={name}>GOLD e Tech</span>
      </div>
      <div style={rowStyle}>
        <span style={label}>Sponsored by</span>
        <span style={name}>VR INFRA</span>
      </div>
    </div>
  );
}
