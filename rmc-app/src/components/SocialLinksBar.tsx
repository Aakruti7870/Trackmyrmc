import { useConfig } from '@/lib/config';
import type { SocialLinks } from '@/lib/api';

// Brand marks are inline SVG (simple-icons paths) because lucide-react dropped
// its brand-logo set. Links come from the admin-editable "Social Appearance"
// settings (public bootstrap config), with sensible defaults baked in.

const BRAND_PATHS: Record<keyof SocialLinks, string> = {
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  playStore: 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z',
};

const PLATFORMS: { key: keyof SocialLinks; name: string; color: string }[] = [
  { key: 'youtube', name: 'YouTube', color: '#FF0000' },
  { key: 'instagram', name: 'Instagram', color: '#E4405F' },
  { key: 'facebook', name: 'Facebook', color: '#1877F2' },
  { key: 'whatsapp', name: 'WhatsApp', color: '#25D366' },
  { key: 'playStore', name: 'Google Play', color: '#34A853' },
];

function mix(color: string, pct: number) {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// Responsive row of social brand icons. Icon size scales with the viewport
// (clamped) so the row stays comfortable from phones up to desktop. The
// Google Play badge is always shown; while its link is unset it renders as a
// non-clickable "coming soon" mark.
export default function SocialLinksBar({
  compact = false,
  center = false,
}: {
  compact?: boolean;
  center?: boolean;
}) {
  const { socialLinks } = useConfig();
  const box = compact ? 'clamp(32px, 7.5vw, 38px)' : 'clamp(36px, 8.5vw, 44px)';
  const icon = compact ? 'clamp(16px, 3.8vw, 19px)' : 'clamp(18px, 4.2vw, 22px)';

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 'clamp(8px, 2vw, 12px)',
      alignItems: 'center', justifyContent: center ? 'center' : 'flex-start',
    }}>
      {PLATFORMS.map(p => {
        const href = socialLinks[p.key];
        const style: React.CSSProperties = {
          width: box, height: box, borderRadius: 12,
          display: 'grid', placeItems: 'center', textDecoration: 'none',
          color: p.color, background: mix(p.color, 14),
          border: `1px solid ${mix(p.color, 32)}`,
          flexShrink: 0,
        };
        const svg = (
          <svg style={{ width: icon, height: icon }} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d={BRAND_PATHS[p.key]} />
          </svg>
        );
        if (!href) {
          return (
            <span
              key={p.key}
              title={`${p.name} — coming soon`}
              aria-label={`${p.name} — coming soon`}
              style={{ ...style, opacity: 0.45, cursor: 'default' }}
            >
              {svg}
            </span>
          );
        }
        return (
          <a
            key={p.key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            title={p.name}
            aria-label={p.name}
            style={style}
          >
            {svg}
          </a>
        );
      })}
    </div>
  );
}
