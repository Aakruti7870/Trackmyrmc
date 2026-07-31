import { useState, useEffect, useRef } from 'react';
import { markSplashSeen } from '@/lib/onboarding';
import { ConcreteKingLogo } from '@/components/BrandLogo';

/* ─────────────────────────────────────────────────────────────────────────────
   Professional splash screen
   Auto-dismisses after 3.8 s (or tap). No "Continue to login" copy —
   the loading bar is the only affordance the user needs.
───────────────────────────────────────────────────────────────────────────── */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [out, setOut]         = useState(false);
  // Lazy initialiser: if the user prefers reduced motion, start the bar at 100
  // so no animation runs and we avoid calling setState synchronously in an effect.
  const prefersReduced        =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [progress, setProgress] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 0,
  );
  const dismissed             = useRef(false);

  const HOLD_MS   = 3800;   // visible duration before fade
  const FADE_MS   = 420;    // fade-out duration

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    markSplashSeen();
    setOut(true);
  }

  // Smooth progress bar that fills in HOLD_MS.
  // Skip when reduced-motion: state was already initialised to 100 above.
  useEffect(() => {
    if (prefersReduced) return;
    const start   = performance.now();
    let raf: number;
    function tick(now: number) {
      const pct = Math.min(((now - start) / HOLD_MS) * 100, 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // run once on mount

  // Auto-dismiss
  useEffect(() => {
    const t = setTimeout(dismiss, HOLD_MS);
    return () => clearTimeout(t);
  }, []); // run once on mount

  // Call onDone after fade finishes
  useEffect(() => {
    if (!out) return;
    const t = setTimeout(onDone, FADE_MS + 30);
    return () => clearTimeout(t);
  }, [out, onDone]);

  return (
    <div
      role="presentation"
      aria-label="TrackMyRMC loading"
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        /* safe areas */
        paddingTop:    'max(env(safe-area-inset-top, 0px), 0px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
        /* fade out */
        opacity:    out ? 0 : 1,
        transition: out && !prefersReduced
          ? `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`
          : 'none',
        userSelect: 'none', cursor: 'default',
        overflow: 'hidden',
      }}
    >

      {/* ── Brand header ─────────────────────────────────────────────────── */}
      <div style={{
        width: '100%',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 52px)',
        paddingBottom: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
        animation: prefersReduced ? 'none' : 'spHeaderIn 0.55s cubic-bezier(0.22,1,0.36,1) both 0.05s',
      }}>
        {/* Brand mark — the official Concrete King crown, matching the sidebar, login, and PWA icons */}
        <div style={{
          display: 'grid', placeItems: 'center',
          boxShadow: '0 6px 28px var(--glow-1), 0 2px 8px rgba(0,0,0,0.10)',
          borderRadius: 17,
        }}>
          <ConcreteKingLogo size={60} />
        </div>

        {/* Wordmark */}
        <div style={{
          fontSize: 'clamp(28px, 7.5vw, 38px)',
          fontWeight: 900,
          letterSpacing: '0.11em',
          color: '#111110',
          fontFamily: '"Inter", "Arial Black", system-ui, sans-serif',
          lineHeight: 1,
          textAlign: 'center',
        }}>
          TRACKMYRMC
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.18em',
          color: 'var(--gold)',
          fontFamily: '"Inter", system-ui, sans-serif',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          Ready Mix Concrete Platform
        </div>
      </div>

      {/* ── Fleet 3D scene ───────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        width: '100%',
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '4px 0 0',
        animation: prefersReduced ? 'none' : 'spSceneIn 0.75s cubic-bezier(0.22,1,0.36,1) both 0.2s',
      }}>
        <img
          src="/splash-fleet.jpg"
          alt="RMC fleet — cement plant, mixer truck and pickup"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center bottom',
            display: 'block',
          }}
          draggable={false}
        />
      </div>

      {/* ── Footer: tagline + progress bar ───────────────────────────────── */}
      <div style={{
        width: '100%',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        padding: '10px 0',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)',
        animation: prefersReduced ? 'none' : 'spTaglineIn 0.55s cubic-bezier(0.22,1,0.36,1) both 0.5s',
      }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: '#8A8A85',
          fontFamily: '"Inter", system-ui, sans-serif',
          letterSpacing: '0.01em',
          textAlign: 'center',
        }}>
          Do more with TrackMyRMC
        </div>

        {/* Progress bar track */}
        <div style={{
          width: '100%',
          height: 3,
          background: '#F0F0EE',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, var(--gold-hi), var(--gold-dark))',
            transformOrigin: 'left center',
            transform: `scaleX(${progress / 100})`,
            transition: prefersReduced ? 'none' : 'transform 0.08s linear',
            borderRadius: '0 2px 2px 0',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spHeaderIn {
          from { opacity:0; transform:translateY(-18px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes spSceneIn {
          from { opacity:0; transform:scale(0.97) }
          to   { opacity:1; transform:scale(1) }
        }
        @keyframes spTaglineIn {
          from { opacity:0; transform:translateY(14px) }
          to   { opacity:1; transform:translateY(0) }
        }
      `}</style>
    </div>
  );
}
