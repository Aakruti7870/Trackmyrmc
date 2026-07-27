import { useState } from 'react';
import { MapPin, ClipboardList, Navigation, FileText, ChevronRight } from 'lucide-react';

interface Slide {
  icon: typeof MapPin;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  { icon: MapPin, title: 'Find approved RMC plants', body: 'Discover verified ready-mix concrete plants near your site.' },
  { icon: ClipboardList, title: 'Order concrete and track status', body: 'Place an order in seconds and follow it from approval to delivery.' },
  { icon: Navigation, title: 'Live transit mixer GPS', body: 'Watch your transit mixer move toward the site in real time.' },
  { icon: FileText, title: 'Digital challan and delivery records', body: 'Every delivery comes with a digital challan you can access anytime.' },
];

// Four-slide feature carousel shown once before the pre-login Landing screen.
// Purely informational — it never touches auth state and never blocks a
// returning/authenticated user (Landing only renders when signed out).
export default function FeatureCarousel({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="TrackMyRMC feature introduction"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--bg)', color: 'var(--text)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 18px' }}>
        <button
          type="button"
          onClick={onDone}
          aria-label="Skip introduction"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: 14, fontWeight: 700, padding: '8px 10px',
          }}
        >
          Skip
        </button>
      </div>

      <div
        key={index}
        aria-live="polite"
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 24px', maxWidth: 480, margin: '0 auto', width: '100%',
          minHeight: 0,
        }}
      >
        <div style={{
          width: 84, height: 84, borderRadius: 24, flexShrink: 0,
          background: 'color-mix(in srgb, var(--gold) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--gold) 32%, transparent)',
          display: 'grid', placeItems: 'center', marginBottom: 24,
        }}>
          <Icon size={38} style={{ color: 'var(--gold)' }} aria-hidden="true" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px', color: 'var(--text)', overflowWrap: 'anywhere' }}>
          {slide.title}
        </h2>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.55, margin: 0, overflowWrap: 'anywhere' }}>
          {slide.body}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingBottom: 18 }}>
        {SLIDES.map((s, i) => (
          <span
            key={s.title}
            aria-hidden="true"
            style={{
              width: i === index ? 22 : 8, height: 8, borderRadius: 999,
              background: i === index ? 'var(--gold)' : 'var(--line)',
              transition: 'width .2s, background .2s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '0 24px calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex(i => Math.max(0, i - 1))}
            aria-label="Previous slide"
            style={{
              flex: 1, minHeight: 48, padding: '12px 18px', borderRadius: 12,
              background: 'var(--chip-bg)', border: '1px solid var(--line)',
              color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? onDone() : setIndex(i => Math.min(SLIDES.length - 1, i + 1)))}
          aria-label={last ? 'Continue to TrackMyRMC' : 'Next slide'}
          style={{
            flex: 2, minHeight: 48, padding: '12px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
            color: '#111827', fontWeight: 800, fontSize: 14.5,
          }}
        >
          {last ? 'Continue' : 'Next'} <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
