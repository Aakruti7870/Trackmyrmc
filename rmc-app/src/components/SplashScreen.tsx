import { useState, useEffect, useRef } from 'react';
import { markSplashSeen } from '@/lib/onboarding';

/* 5-second animated brand splash.
   Tap anywhere or wait for the timer — either dismisses and calls onDone(). */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [out, setOut]      = useState(false);
  const dismissed          = useRef(false);
  const prefersReduced     =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    markSplashSeen();
    setOut(true);
  }

  // Auto-dismiss after 5 s.
  useEffect(() => {
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Call onDone after the fade-out animation finishes.
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
        background: '#F5F5F2',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop:    'max(env(safe-area-inset-top, 0px), 36px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 36px)',
        opacity:    out ? 0 : 1,
        transition: out && !prefersReduced ? 'opacity 0.38s ease' : 'none',
        userSelect: 'none',
      }}
    >
      {/* ── Wordmark ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        animation: prefersReduced ? 'none' : 'spLogoIn 0.65s cubic-bezier(0.34,1.56,0.64,1) both 0.15s',
      }}>
        {/* App icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, #9BA342, #707439)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 32px rgba(112,116,57,0.32)',
        }}>
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
            <rect x="3" y="18" width="20" height="13" rx="2.5" fill="white" opacity="0.95"/>
            <path d="M23 20 L23 18 L36 18 L39 25 L23 25 Z" fill="white" opacity="0.88"/>
            <circle cx="11" cy="18" r="6" fill="white" opacity="0.6"/>
            <circle cx="9"  cy="32" r="4" fill="rgba(255,255,255,0.45)" stroke="white" strokeWidth="1.5"/>
            <circle cx="30" cy="32" r="4" fill="rgba(255,255,255,0.45)" stroke="white" strokeWidth="1.5"/>
            {/* pin on cab */}
            <path d="M33 7 C33 10.3 29 14 29 14 C29 14 25 10.3 25 7 C25 4.8 26.8 3 29 3 C31.2 3 33 4.8 33 7Z" fill="#C19B4D"/>
            <circle cx="29" cy="7" r="2.2" fill="white"/>
          </svg>
        </div>
        {/* Text wordmark */}
        <div style={{
          fontSize: 32, fontWeight: 900,
          letterSpacing: '-0.05em', color: '#1F1F1E',
          fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1,
        }}>
          TRACK<span style={{ color: '#8B923F' }}>MY</span>RMC
        </div>
      </div>

      {/* ── Fleet illustration ── */}
      <div style={{
        flex: 1, width: '100%', maxWidth: 480,
        padding: '0 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FleetSVG reduced={prefersReduced} />
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{
        textAlign: 'center',
        animation: prefersReduced ? 'none' : 'spCtaIn 0.5s ease both 0.75s',
      }}>
        <div style={{ fontSize: 13, color: '#8A8A85', fontFamily: 'Inter,system-ui,sans-serif', marginBottom: 4 }}>
          Do more with TrackMyRMC
        </div>
        <div style={{
          fontSize: 19, fontWeight: 800, color: '#1F1F1E',
          fontFamily: 'Inter,system-ui,sans-serif', letterSpacing: '-0.025em',
        }}>
          Continue To LOGIN &gt;
        </div>
      </div>

      <style>{`
        @keyframes spLogoIn  { from{opacity:0;transform:scale(0.72) translateY(-10px)} to{opacity:1;transform:none} }
        @keyframes spCtaIn   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes spTruckR  { from{opacity:0;transform:translateX(55px)} to{opacity:1;transform:none} }
        @keyframes spTruckL  { from{opacity:0;transform:translateX(-55px)} to{opacity:1;transform:none} }
        @keyframes spSiloIn  { from{opacity:0;transform:translateY(-20px) scale(0.88)} to{opacity:1;transform:none} }
        @keyframes spPhone   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
      `}</style>
    </div>
  );
}

/* ─── SVG fleet illustration ──────────────────────────────────────────────── */
function FleetSVG({ reduced }: { reduced: boolean }) {
  const anim = (name: string, delay: string) =>
    reduced ? undefined : `${name} 0.65s cubic-bezier(0.34,1.56,0.64,1) both ${delay}`;

  return (
    <svg
      viewBox="0 0 380 268"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', maxHeight: 310, overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* Ground shadow */}
      <ellipse cx="190" cy="258" rx="168" ry="7" fill="rgba(31,31,30,0.055)" />
      <rect x="0" y="249" width="380" height="1" fill="rgba(31,31,30,0.07)"/>
      {/* Tile marks */}
      {[65,130,190,250,315].map(x => (
        <line key={x} x1={x} y1="249" x2={x} y2="256" stroke="rgba(31,31,30,0.05)" strokeWidth="1"/>
      ))}

      {/* ─── PICKUP TRUCK (left) ─── */}
      <g style={{ animation: anim('spTruckL', '0.9s') as string | undefined }}>
        <rect x="6"  y="202" width="90" height="36" rx="5" fill="#eeeeed" stroke="#e0e0dc" strokeWidth="1.2"/>
        <path d="M53 202 L53 180 Q54 172 61 172 L90 172 Q99 172 99 180 L99 202 Z" fill="#e5e5e3" stroke="#e0e0dc" strokeWidth="1"/>
        <path d="M60 175 L60 190 L94 190 L94 175 Q93 172 90 172 L64 172 Z" fill="#c6ddf5" opacity="0.72"/>
        <rect x="6" y="215" width="90" height="5" rx="1.5" fill="#C19B4D"/>
        {[24, 74].map(cx => (
          <g key={cx}>
            <circle cx={cx} cy="240" r="12.5" fill="#383838" stroke="#282828" strokeWidth="1.2"/>
            <circle cx={cx} cy="240" r="7"    fill="#666"/>
            <circle cx={cx} cy="240" r="2.5"  fill="#383838"/>
          </g>
        ))}
        <rect x="95" y="207" width="5" height="5" rx="1" fill="#fef9c4" opacity="0.88"/>
        <text x="22" y="211" fontSize="7" fontWeight="800" fill="#707439" fontFamily="sans-serif" opacity="0.75">TMR</text>
      </g>

      {/* ─── PLANT SILOS (centre) ─── */}
      <g style={{ animation: anim('spSiloIn', '0.3s') as string | undefined }}>
        {/* Silo 1 */}
        <rect x="130" y="68" width="34" height="148" rx="16" fill="#f2f2f0" stroke="#e0e0dc" strokeWidth="1.5"/>
        <rect x="130" y="92"  width="34" height="10" rx="3" fill="#9BA342" opacity="0.78"/>
        <rect x="130" y="126" width="34" height="7"  rx="3" fill="#9BA342" opacity="0.55"/>
        <ellipse cx="147" cy="68" rx="17" ry="5.5" fill="#e6e6e3" stroke="#d6d6d2" strokeWidth="1.2"/>
        {/* Silo 2 */}
        <rect x="166" y="92" width="29" height="124" rx="13" fill="#f2f2f0" stroke="#e0e0dc" strokeWidth="1.5"/>
        <rect x="166" y="110" width="29" height="9" rx="3" fill="#9BA342" opacity="0.78"/>
        <ellipse cx="180.5" cy="92" rx="14.5" ry="4.5" fill="#e6e6e3" stroke="#d6d6d2" strokeWidth="1.2"/>
        {/* Platform */}
        <rect x="126" y="112" width="72" height="9" rx="3" fill="#dadadc" stroke="#cacacc" strokeWidth="1"/>
        {/* Ladder */}
        <rect x="127" y="112" width="2.5" height="74" fill="#c8c8c4"/>
        {[122,134,146,158,170,182].map(y => (
          <line key={y} x1="127" y1={y} x2="129.5" y2={y} stroke="#b8b8b4" strokeWidth="1"/>
        ))}
        {/* Building */}
        <rect x="136" y="178" width="52" height="42" rx="4" fill="#eaeae8" stroke="#dadad6" strokeWidth="1"/>
        <rect x="141" y="186" width="14" height="12" rx="2" fill="#c6ddf5" opacity="0.68"/>
        <rect x="161" y="186" width="14" height="12" rx="2" fill="#c6ddf5" opacity="0.68"/>
        {/* Brand bar */}
        <rect x="136" y="205" width="52" height="11" rx="2.5" fill="#707439"/>
        <text x="162" y="213.5" fontSize="5" fontWeight="700" fill="white" textAnchor="middle" fontFamily="sans-serif">TRACKMYRMC</text>
        {/* Discharge chute */}
        <path d="M160 218 L149 248" stroke="#ccc" strokeWidth="3" strokeLinecap="round"/>
      </g>

      {/* ─── MIXER TRUCK (centre-right) ─── */}
      <g style={{ animation: anim('spTruckR', '0.62s') as string | undefined }}>
        <rect x="196" y="198" width="110" height="38" rx="5" fill="#eeeeed" stroke="#e0e0dc" strokeWidth="1.2"/>
        <path d="M272 198 L272 168 Q272 160 280 160 L298 160 Q308 160 308 168 L308 198 Z" fill="#e5e5e3" stroke="#e0e0dc" strokeWidth="1"/>
        <rect x="276" y="163" width="25" height="20" rx="2" fill="#c6ddf5" opacity="0.72"/>
        {/* Drum */}
        <ellipse cx="235" cy="192" rx="34" ry="23" fill="#f0f0ee" stroke="#e0e0dc" strokeWidth="1.5"/>
        {[0,1,2].map(i => (
          <path key={i}
            d={`M${207+i*3} ${182+i*5} Q235 ${170+i*5} ${263-i*3} ${182+i*5}`}
            stroke="#9BA342" strokeWidth="5.5" fill="none" strokeLinecap="round"
            opacity={0.72 - i*0.1}
          />
        ))}
        <ellipse cx="235" cy="192" rx="9" ry="7" fill="#9BA342" opacity="0.22"/>
        <rect x="218" y="213" width="34" height="5" rx="2" fill="#dadadc"/>
        {/* Wheels */}
        {[216, 245, 294].map(cx => (
          <g key={cx}>
            <circle cx={cx} cy="239" r="13"  fill="#383838" stroke="#282828" strokeWidth="1.2"/>
            <circle cx={cx} cy="239" r="7.5" fill="#666"/>
            <circle cx={cx} cy="239" r="3"   fill="#383838"/>
          </g>
        ))}
        <rect x="306" y="184" width="5" height="5" rx="1" fill="#fef9c4" opacity="0.88"/>
      </g>

      {/* ─── PHONE (right) ─── */}
      <g style={{
        animation: [
          anim('spSiloIn', '1.05s'),
          reduced ? '' : 'spPhone 3s ease-in-out infinite 2.3s',
        ].filter(Boolean).join(', '),
      }}>
        <rect x="318" y="110" width="54" height="92" rx="9" fill="#f2f2f0" stroke="#e0e0dc" strokeWidth="1.5"/>
        <rect x="323" y="116" width="44" height="78" rx="5" fill="#d8eaf5"/>
        {/* Map grid */}
        {[130,146,162].map(y=><line key={y} x1="323" y1={y} x2="367" y2={y} stroke="white" strokeWidth="0.8" opacity="0.6"/>)}
        {[339,354].map(x=><line key={x} x1={x} y1="116" x2={x} y2="194" stroke="white" strokeWidth="0.8" opacity="0.6"/>)}
        {/* Roads */}
        <path d="M323 144 Q345 142 367 144" stroke="#b8cede" strokeWidth="5" fill="none"/>
        <path d="M341 116 Q339 155 341 194" stroke="#b8cede" strokeWidth="5" fill="none"/>
        {/* Location pin */}
        <path d="M345 151 C345 148 341 144 341 141 C341 138.7 342.8 137 345 137 C347.2 137 349 138.7 349 141 C349 144 345 151 345 151Z" fill="#B94040"/>
        <circle cx="345" cy="141" r="2.5" fill="white"/>
        {/* Home button */}
        <circle cx="345" cy="202" r="4" fill="#e0e0dc" stroke="#d0d0cc" strokeWidth="1"/>
      </g>

      {/* ─── CONCRETE BLOCKS (right foreground) ─── */}
      <g style={{ animation: anim('spSiloIn', '1.2s') as string | undefined }}>
        <rect x="308" y="238" width="26" height="13" rx="2" fill="#d8d8d5" stroke="#c8c8c5" strokeWidth="1"/>
        <rect x="316" y="226" width="26" height="13" rx="2" fill="#e0e0dc" stroke="#d0d0cc" strokeWidth="1"/>
        <rect x="311" y="250" width="30" height="10" rx="2" fill="#d0d0cd" stroke="#c0c0bc" strokeWidth="1"/>
      </g>
    </svg>
  );
}
