import { useState, useEffect, useRef } from 'react';
import { markSplashSeen } from '@/lib/onboarding';

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
  }, [prefersReduced]);

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
        background: '#08111f',
        opacity:    out ? 0 : 1,
        transition: out && !prefersReduced
          ? `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`
          : 'none',
        userSelect: 'none', cursor: 'default',
        overflow: 'hidden',
      }}
    >
      {/* ── Full-bleed fleet background ───────────────────────────────────── */}
      <img
        src="/splash-fleet.jpg"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center bottom',
          opacity: 0.60,
        }}
      />

      {/* ── Gradient overlay — top heavy so brand text is always readable ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(8,17,31,0.92) 0%, rgba(8,17,31,0.45) 45%, rgba(8,17,31,0.80) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Centered brand identity ───────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 48px)',
        gap: 14,
        animation: prefersReduced ? 'none' : 'spBrandIn 0.6s cubic-bezier(0.22,1,0.36,1) both 0.05s',
      }}>
        {/* Wordmark */}
        <div style={{
          fontSize: 'clamp(30px, 8vw, 40px)',
          fontWeight: 900,
          letterSpacing: '0.10em',
          color: '#FFFFFF',
          fontFamily: '"Inter", "Arial Black", system-ui, sans-serif',
          lineHeight: 1,
          textAlign: 'center',
          textShadow: '0 2px 12px rgba(0,0,0,0.40)',
        }}>
          TRACKMYRMC
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 11.5,
          fontWeight: 500,
          letterSpacing: '0.20em',
          color: '#FBBF24',
          fontFamily: '"Inter", system-ui, sans-serif',
          textTransform: 'uppercase',
          textAlign: 'center',
          opacity: 0.90,
        }}>
          Ready Mix Concrete Platform
        </div>
      </div>

      {/* ── Bottom progress bar ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
      }}>
        <div style={{
          height: 3,
          background: 'rgba(255,255,255,0.12)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
            transformOrigin: 'left center',
            transform: `scaleX(${progress / 100})`,
            transition: prefersReduced ? 'none' : 'transform 0.08s linear',
            borderRadius: '0 2px 2px 0',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spBrandIn {
          from { opacity:0; transform:translateY(10px) scale(0.97) }
          to   { opacity:1; transform:translateY(0) scale(1) }
        }
      `}</style>
    </div>
  );
}
