import { useLocation } from 'wouter';

/**
 * App-wide atmospheric background layer.
 *
 * A single fixed, full-viewport photographic layer sits BEHIND all app content
 * (z-index -1). The image is chosen automatically per app area (route) so every
 * screen shares the "command-center over a live plant" look. There is no
 * user-facing switcher — the backdrop changes automatically as you move between
 * areas of the app.
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

function pickByRoute(path: string): string {
  if (path === '/') return IMG.controlRoom;
  const hit = AREA_MAP.find(a => path.startsWith(a.prefix));
  return hit ? hit.img : IMG.network;
}

export default function AppBackground() {
  const [location] = useLocation();
  const img = pickByRoute(location);

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

      <style>{`@keyframes appBgFade { from { opacity: 0; } to { opacity: .22; } }`}</style>
    </>
  );
}
