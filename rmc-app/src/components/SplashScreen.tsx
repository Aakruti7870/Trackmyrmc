import { useState, useEffect, useRef } from 'react';
import { markSplashSeen } from '@/lib/onboarding';

/* 5-second animated brand splash.
   Tap anywhere or wait for the timer — either dismisses and calls onDone(). */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [out, setOut]  = useState(false);
  const dismissed      = useRef(false);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    markSplashSeen();
    setOut(true);
  }

  // Auto-dismiss after 5 s
  useEffect(() => {
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Call onDone after the fade-out animation finishes
  useEffect(() => {
    if (!out) return;
    const t = setTimeout(onDone, 380);
    return () => clearTimeout(t);
  }, [out, onDone]);

  return (
    <div
      role="presentation"
      aria-label="TrackMyRMC loading"
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: '#F6F6F4',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop:    'max(env(safe-area-inset-top, 0px), 48px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 40px)',
        opacity:    out ? 0 : 1,
        transition: out && !prefersReduced ? 'opacity 0.38s ease' : 'none',
        userSelect: 'none', cursor: 'pointer',
      }}
    >
      {/* ── Wordmark ── */}
      <div style={{
        textAlign: 'center',
        animation: prefersReduced ? 'none' : 'spLogoIn 0.6s ease both 0.1s',
      }}>
        <div style={{
          fontSize: 'clamp(30px, 8vw, 40px)',
          fontWeight: 900,
          letterSpacing: '0.08em',
          color: '#1A1A18',
          fontFamily: '"Inter", "Arial Black", system-ui, sans-serif',
          lineHeight: 1,
        }}>
          TRACKMYRMC
        </div>
      </div>

      {/* ── Fleet illustration (real photo) ── */}
      <div style={{
        flex: 1, width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 0',
        animation: prefersReduced ? 'none' : 'spFleetIn 0.7s ease both 0.3s',
        overflow: 'hidden',
      }}>
        <img
          src="/splash-fleet.jpg"
          alt="RMC fleet — mixer truck, silos, pickup and phone"
          style={{
            width: '100%',
            maxWidth: 480,
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{
        textAlign: 'center',
        animation: prefersReduced ? 'none' : 'spCtaIn 0.5s ease both 0.75s',
      }}>
        <div style={{
          fontSize: 13, color: '#8A8A85',
          fontFamily: 'Inter, system-ui, sans-serif',
          marginBottom: 5,
        }}>
          Do more with TrackMyRMC
        </div>
        <div style={{
          fontSize: 20, fontWeight: 800, color: '#1A1A18',
          fontFamily: 'Inter, system-ui, sans-serif',
          letterSpacing: '-0.02em',
        }}>
          Continue To LOGIN &gt;
        </div>
      </div>

      <style>{`
        @keyframes spLogoIn  { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:none } }
        @keyframes spFleetIn { from { opacity:0; transform:scale(0.96)        } to { opacity:1; transform:none } }
        @keyframes spCtaIn   { from { opacity:0; transform:translateY(12px)   } to { opacity:1; transform:none } }
      `}</style>
    </div>
  );
}
