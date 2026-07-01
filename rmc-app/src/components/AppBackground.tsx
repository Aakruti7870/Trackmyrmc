import { useState } from 'react';
import { useLocation } from 'wouter';
import { Images } from 'lucide-react';

/**
 * App-wide atmospheric background layer + a "next background" switcher.
 *
 * A single fixed, full-viewport photographic layer sits BEHIND all app content
 * (z-index -1). By default the image is chosen per app area (route) so every
 * screen shares the "command-center over a live plant" look. A floating button
 * (present on every screen) lets the user cycle to the next background; once
 * used, the chosen background becomes a global override, persisted in
 * localStorage, until they cycle back to "Auto".
 *
 * The photo is dimmed under a theme-aware scrim (var(--bg)) plus teal + blue
 * aurora glows so dense tables and forms stay fully readable.
 */

const IMG = {
  controlRoom: '/backgrounds/control-room.webp',
  fleet: '/backgrounds/fleet.webp',
  production: '/backgrounds/production.webp',
  site: '/backgrounds/site.webp',
  network: '/backgrounds/network.webp',
} as const;

// The order the "next background" button cycles through. `null` = Auto (per-area).
const CYCLE: (string | null)[] = [
  null,
  IMG.controlRoom,
  IMG.fleet,
  IMG.production,
  IMG.site,
  IMG.network,
];

const LABELS: Record<string, string> = {
  [IMG.controlRoom]: 'Control Room',
  [IMG.fleet]: 'Fleet',
  [IMG.production]: 'Production',
  [IMG.site]: 'Site',
  [IMG.network]: 'Network',
};

// Checked in order; first matching prefix wins. '/' handled as exact match first.
const AREA_MAP: { prefix: string; img: string }[] = [
  { prefix: '/kiosk', img: IMG.controlRoom },
  { prefix: '/my-trips', img: IMG.fleet },
  { prefix: '/orders', img: IMG.fleet },
  { prefix: '/dispatch', img: IMG.fleet },
  { prefix: '/vehicles', img: IMG.fleet },
  { prefix: '/drivers', img: IMG.fleet },
  { prefix: '/track', img: IMG.fleet },
  { prefix: '/batch-report', img: IMG.production },
  { prefix: '/mix-design', img: IMG.production },
  { prefix: '/recurring', img: IMG.production },
  { prefix: '/fuel-log', img: IMG.production },
  { prefix: '/attendance', img: IMG.production },
  { prefix: '/shift-report', img: IMG.production },
  { prefix: '/freshness', img: IMG.production },
  { prefix: '/my-orders', img: IMG.site },
  { prefix: '/nearby-plants', img: IMG.site },
  { prefix: '/clients', img: IMG.site },
  { prefix: '/plants', img: IMG.site },
  { prefix: '/forecast', img: IMG.site },
];

const STORAGE_KEY = 'ck-bg-override';

function pickByRoute(path: string): string {
  if (path === '/') return IMG.controlRoom;
  const hit = AREA_MAP.find(a => path.startsWith(a.prefix));
  return hit ? hit.img : IMG.network;
}

function readOverride(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && Object.values(IMG).includes(v as (typeof IMG)[keyof typeof IMG]) ? v : null;
  } catch {
    return null;
  }
}

export default function AppBackground() {
  const [location] = useLocation();
  const [override, setOverride] = useState<string | null>(() => readOverride());

  const img = override ?? pickByRoute(location);

  const nextBackground = () => {
    const idx = CYCLE.indexOf(override);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setOverride(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private-mode / storage disabled — override stays in-memory only */
    }
  };

  const currentLabel = override ? LABELS[override] : 'Auto';

  return (
    <>
      {/* Photographic layer — sits behind all content */}
      <div
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}
      >
        {/* Re-keyed per image so it cross-fades on change */}
        <div
          key={img}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${img})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.22,
            transform: 'scale(1.04)',
            filter: 'saturate(1.06)',
            animation: 'appBgFade .8s ease',
          }}
        />
        {/* Readability scrim + aurora blend (theme-aware via var(--bg)) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(1200px 720px at 80% 6%, color-mix(in srgb, var(--gold) 14%, transparent), transparent 60%),
              radial-gradient(1000px 680px at 10% 96%, color-mix(in srgb, var(--blue) 12%, transparent), transparent 60%),
              linear-gradient(180deg,
                color-mix(in srgb, var(--bg) 70%, transparent) 0%,
                color-mix(in srgb, var(--bg) 84%, transparent) 52%,
                color-mix(in srgb, var(--bg-deep) 94%, transparent) 100%)
            `,
          }}
        />
      </div>

      {/* Floating "next background" switcher — on every screen */}
      <button
        type="button"
        onClick={nextBackground}
        title={`Background: ${currentLabel} — tap to change`}
        aria-label={`Change background. Current: ${currentLabel}`}
        style={{
          position: 'fixed',
          left: 'calc(16px + env(safe-area-inset-left, 0px))',
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 13px 9px 11px',
          borderRadius: 999,
          cursor: 'pointer',
          color: 'var(--text)',
          background: 'linear-gradient(135deg, var(--glass-1), var(--glass-2))',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          boxShadow: '0 14px 34px rgba(var(--shadow-rgb),.34)',
          fontSize: 12,
          fontWeight: 700,
          transition: 'transform .15s ease, border-color .15s ease',
        }}
        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--gold) 18%, transparent)',
            color: 'var(--gold)',
          }}
        >
          <Images size={13} />
        </span>
        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Backdrop</span>
        <span style={{ color: 'var(--gold)' }}>{currentLabel}</span>
      </button>

      <style>{`@keyframes appBgFade { from { opacity: 0; } to { opacity: .22; } }`}</style>
    </>
  );
}
