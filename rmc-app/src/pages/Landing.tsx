import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import SplashScreen from '@/components/SplashScreen';
import { BrandCredits } from '@/components/BrandLogo';
import { SUPPORT_WHATSAPP_URL } from '@/lib/brand';
import { hasSeenSplash } from '@/lib/onboarding';

/* SPA navigation helper */
function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

type Tab = 'customer' | 'staff' | 'partner';

/* ══════════════════════════════════════════════════════════
   Screen 2 — Landing / login entry
   Layout: brand header → RMC scene SVG → dark login card
══════════════════════════════════════════════════════════ */
function LandingScreen() {
  const [tab, setTab]     = useState<Tab>('customer');
  const [phone, setPhone] = useState('');

  function handleGetOtp(e: React.FormEvent) {
    e.preventDefault();
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) return;
    navigate(`/login?phone=${encodeURIComponent(clean)}`);
  }

  return (
    <div style={{
      width: '100%', height: '100vh',
      display: 'flex', flexDirection: 'column',
      background: '#F0F0EE',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>

      {/* ── Brand header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 22px 12px', flexShrink: 0,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, #9BA342, #707439)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(112,116,57,0.28)',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="2" y="12" width="14" height="9" rx="2" fill="white" opacity="0.95"/>
            <path d="M16 13.5 L16 12 L24 12 L26 17 L16 17 Z" fill="white" opacity="0.88"/>
            <circle cx="7" cy="12" r="4" fill="white" opacity="0.6"/>
            <circle cx="6"  cy="22" r="2.8" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1"/>
            <circle cx="20" cy="22" r="2.8" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1F1F1E', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            TrackMy<span style={{ color: '#8B923F' }}>RMC</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#8A8A85', fontWeight: 500, lineHeight: 1 }}>
            Moving Concrete. Building Trust.
          </div>
        </div>
      </div>

      {/* ── Scene illustration ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        <SceneSVG />
      </div>

      {/* ── Dark login card ── */}
      <div style={{
        flexShrink: 0,
        background: '#111110',
        borderRadius: '28px 28px 0 0',
        padding: '26px 22px',
        paddingBottom: 'max(26px, calc(26px + env(safe-area-inset-bottom, 0px)))',
        overflowY: 'auto',
        maxHeight: '64vh',
      }}>

        {/* Headline */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#F2F2F0', lineHeight: 1.2 }}>
            Ready Mix Concrete,
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#9BA342', lineHeight: 1.2 }}>
            On Time, Every Time.
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 12, padding: 4, marginBottom: 18,
        }}>
          {(['customer', 'staff', 'partner'] as Tab[]).map(t => (
            <button
              key={t} type="button" onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '9px 6px', borderRadius: 9,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                background: tab === t ? '#9BA342' : 'transparent',
                color:      tab === t ? '#ffffff' : '#8A8A85',
                transition: 'all 0.18s ease', textTransform: 'capitalize',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Customer — phone OTP */}
        {tab === 'customer' && (
          <form onSubmit={handleGetOtp}>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 12px', lineHeight: 1.5 }}>
              Enter your mobile number to get started.
            </p>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.08)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              borderRadius: 14, overflow: 'hidden', marginBottom: 14,
            }}>
              <div style={{
                padding: '14px 14px 14px 16px',
                fontSize: 15, fontWeight: 700, color: '#F2F2F0',
                borderRight: '1.5px solid rgba(255,255,255,0.1)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>+91</div>
              <input
                type="tel" inputMode="numeric"
                placeholder="98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                maxLength={11} required
                style={{
                  flex: 1, padding: '14px',
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 16, fontWeight: 600, color: '#F2F2F0',
                  fontFamily: 'inherit', letterSpacing: '0.03em',
                }}
              />
            </div>
            <button type="submit" style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: '#9BA342', color: '#ffffff',
              fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, marginBottom: 10,
              boxShadow: '0 6px 20px rgba(112,116,57,0.35)',
            }}>
              Get OTP <span style={{ fontSize: 18 }}>&#x2192;</span>
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, color: '#8A8A85', marginBottom: 16,
            }}>
              <ShieldCheck size={13} color="#9BA342" />
              Secure OTP login &#183; No password needed
            </div>
            {/* Staff link */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => navigate('/login?staff=1')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9BA342', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                }}
              >
                Staff login with email
              </button>
            </div>
          </form>
        )}

        {/* Staff */}
        {tab === 'staff' && (
          <div>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 14px', lineHeight: 1.5 }}>
              Staff accounts are provisioned by your plant admin. Sign in with your work email.
            </p>
            <button
              type="button" onClick={() => navigate('/login?staff=1')}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: '#9BA342', color: '#ffffff',
                fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
                cursor: 'pointer', marginBottom: 16,
                boxShadow: '0 6px 20px rgba(112,116,57,0.35)',
              }}
            >
              Staff login with email &#x2192;
            </button>
          </div>
        )}

        {/* Partner */}
        {tab === 'partner' && (
          <div>
            <p style={{ fontSize: 13, color: '#8A8A85', margin: '0 0 14px', lineHeight: 1.5 }}>
              Register your RMC plant on the TrackMyRMC network and reach more customers.
            </p>
            <button
              type="button" onClick={() => navigate('/login?partner=1')}
              style={{
                width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                background: '#9BA342', color: '#ffffff',
                fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
                cursor: 'pointer', marginBottom: 16,
                boxShadow: '0 6px 20px rgba(112,116,57,0.35)',
              }}
            >
              Register as Partner &#x2192;
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11.5, color: '#555', lineHeight: 1.8 }}>
          <div>
            By continuing you agree to our{' '}
            <button type="button" onClick={() => navigate('/terms')}
              style={{ background:'none',border:'none',cursor:'pointer',color:'#9BA342',fontWeight:600,fontFamily:'inherit',fontSize:'inherit',padding:0,textDecoration:'underline',textUnderlineOffset:2 }}>
              Terms
            </button>
            {' '}&amp;{' '}
            <button type="button" onClick={() => navigate('/privacy')}
              style={{ background:'none',border:'none',cursor:'pointer',color:'#9BA342',fontWeight:600,fontFamily:'inherit',fontSize:'inherit',padding:0,textDecoration:'underline',textUnderlineOffset:2 }}>
              Privacy Policy
            </button>
          </div>
          <div>
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: '#555', textDecoration: 'none' }}>
              &#9711; Need help? Chat with support
            </a>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
          <div style={{ opacity: 0.6 }}>
            <BrandCredits oneRow align="center" />
          </div>
        </div>
      </div>

      <style>{`input::placeholder{color:rgba(242,242,240,0.32)} input:focus{outline:none}`}</style>
    </div>
  );
}

/* ─── RMC scene SVG (flat 2-D illustration) ───────────────────────────────── */
function SceneSVG() {
  return (
    <svg
      viewBox="0 0 390 220"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: 'auto', maxHeight: 230, display: 'block' }}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6EEF5"/>
          <stop offset="100%" stopColor="#F0F0EE"/>
        </linearGradient>
        <linearGradient id="drumG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f4f2"/>
          <stop offset="100%" stopColor="#e6e6e4"/>
        </linearGradient>
      </defs>
      <rect width="390" height="220" fill="url(#skyG)"/>

      {/* Crane (background right) */}
      <rect x="342" y="48" width="4" height="88" fill="#d4d4d0"/>
      <rect x="330" y="44" width="18" height="4" fill="#d4d4d0"/>
      <line x1="340" y1="48" x2="340" y2="72" stroke="#d4d4d0" strokeWidth="1"/>
      {/* Trees */}
      <ellipse cx="372" cy="88" rx="10" ry="13" fill="#c8d8c8" opacity="0.65"/>
      <rect x="371" y="99" width="2" height="16" fill="#b0c0a8" opacity="0.65"/>
      <ellipse cx="360" cy="93" rx="8"  ry="10" fill="#c8d8c8" opacity="0.45"/>

      {/* ── SILO 1 (taller) ── */}
      <rect x="96" y="14" width="38" height="158" rx="18" fill="#f4f4f2" stroke="#dcdcd8" strokeWidth="1.5"/>
      <rect x="96" y="38"  width="38" height="13" rx="4" fill="#8B923F" opacity="0.82"/>
      <rect x="96" y="72"  width="38" height="9"  rx="3" fill="#8B923F" opacity="0.56"/>
      <ellipse cx="115" cy="14" rx="19" ry="5.5" fill="#e8e8e5" stroke="#d8d8d4" strokeWidth="1.5"/>
      {/* RMC label */}
      <rect x="101" y="106" width="28" height="18" rx="4" fill="#707439"/>
      <text x="115" y="118" fontSize="8" fontWeight="800" fill="white" textAnchor="middle" fontFamily="sans-serif">RMC</text>
      {/* Ladder */}
      <rect x="97" y="34" width="2.5" height="92" fill="#c8c8c4"/>
      {[46,58,70,82,94,106,118].map(y => (
        <line key={y} x1="97" y1={y} x2="99.5" y2={y} stroke="#b4b4b0" strokeWidth="1"/>
      ))}
      {/* Discharge pipe */}
      <path d="M114 172 L104 210" stroke="#c8c8c4" strokeWidth="4" strokeLinecap="round"/>

      {/* ── SILO 2 (shorter) ── */}
      <rect x="136" y="38" width="32" height="134" rx="14" fill="#f4f4f2" stroke="#dcdcd8" strokeWidth="1.5"/>
      <rect x="136" y="58"  width="32" height="11" rx="3.5" fill="#8B923F" opacity="0.82"/>
      <rect x="136" y="88"  width="32" height="8"  rx="3"   fill="#8B923F" opacity="0.55"/>
      <ellipse cx="152" cy="38" rx="16" ry="5" fill="#e8e8e5" stroke="#d8d8d4" strokeWidth="1.5"/>
      <rect x="140" y="120" width="24" height="16" rx="3.5" fill="#707439"/>
      <text x="152" y="131" fontSize="7.5" fontWeight="800" fill="white" textAnchor="middle" fontFamily="sans-serif">RMC</text>

      {/* ── PLATFORM ── */}
      <rect x="92" y="58" width="78" height="10" rx="4" fill="#d8d8d4" stroke="#c8c8c4" strokeWidth="1"/>

      {/* ── PLANT BUILDING ── */}
      <rect x="104" y="172" width="62" height="42" rx="5" fill="#e8e8e6" stroke="#d8d8d4" strokeWidth="1"/>
      <rect x="110" y="180" width="16" height="14" rx="2.5" fill="#c0d8f0" opacity="0.7"/>
      <rect x="132" y="180" width="16" height="14" rx="2.5" fill="#c0d8f0" opacity="0.7"/>
      <rect x="104" y="200" width="62" height="12" rx="3" fill="#707439"/>
      <text x="135" y="209" fontSize="5.5" fontWeight="700" fill="white" textAnchor="middle" fontFamily="sans-serif">TRACKMYRMC</text>

      {/* ── MIXER TRUCK ── */}
      <rect x="172" y="190" width="114" height="38" rx="5" fill="#eeeeed" stroke="#dcdcd8" strokeWidth="1.2"/>
      <path d="M254 190 L254 162 Q254 154 262 154 L280 154 Q290 154 290 162 L290 190 Z" fill="#e4e4e2" stroke="#dcdcd8" strokeWidth="1"/>
      <rect x="258" y="158" width="26" height="20" rx="2.5" fill="#c0d8f0" opacity="0.72"/>
      {/* Drum */}
      <ellipse cx="212" cy="188" rx="34" ry="22" fill="url(#drumG)" stroke="#dcdcd8" strokeWidth="1.5"/>
      {[0,1,2].map(i => (
        <path key={i}
          d={`M${185+i*3} ${179+i*5} Q212 ${167+i*5} ${239-i*3} ${179+i*5}`}
          stroke="#8B923F" strokeWidth="5.5" fill="none" strokeLinecap="round"
          opacity={0.74 - i*0.12}
        />
      ))}
      <ellipse cx="212" cy="188" rx="9" ry="7" fill="#8B923F" opacity="0.2"/>
      <rect x="196" y="208" width="32" height="5" rx="2" fill="#d8d8d4"/>
      {/* Wheels */}
      {[192, 220, 268].map(cx => (
        <g key={cx}>
          <circle cx={cx} cy="231" r="13.5" fill="#383838" stroke="#282828" strokeWidth="1.2"/>
          <circle cx={cx} cy="231" r="7.5"  fill="#666"/>
          <circle cx={cx} cy="231" r="3"    fill="#383838"/>
        </g>
      ))}
      <rect x="288" y="177" width="5" height="5" rx="1" fill="#fdf9c0" opacity="0.9"/>

      {/* ── CONCRETE PUMP TRUCK ── */}
      <rect x="295" y="196" width="88" height="36" rx="5" fill="#eeeeed" stroke="#dcdcd8" strokeWidth="1.2"/>
      <rect x="358" y="180" width="27" height="18" rx="3" fill="#e4e4e2" stroke="#dcdcd8" strokeWidth="1"/>
      <rect x="361" y="183" width="19" height="11" rx="2" fill="#c0d8f0" opacity="0.7"/>
      {/* Outriggers */}
      {[303,315,363,373].map(x => (
        <rect key={x} x={x} y="231" width="5" height="9" rx="1" fill="#c4c4c0"/>
      ))}
      {/* Boom tower */}
      <rect x="323" y="162" width="14" height="36" rx="3" fill="#6a6a68"/>
      {/* Boom arm */}
      <line x1="330" y1="165" x2="245" y2="92" stroke="#5a5a58" strokeWidth="9"  strokeLinecap="round"/>
      <line x1="245" y1="92"  x2="228" y2="102" stroke="#5a5a58" strokeWidth="6" strokeLinecap="round"/>
      {/* Olive pipe */}
      <line x1="330" y1="170" x2="246" y2="97" stroke="#8B923F" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
      {/* Pump housing */}
      <rect x="327" y="192" width="26" height="20" rx="3" fill="#686868" stroke="#585858" strokeWidth="1"/>
      {/* Wheels */}
      {[312, 338, 372].map(cx => (
        <g key={cx}>
          <circle cx={cx} cy="235" r="12.5" fill="#383838" stroke="#282828" strokeWidth="1.2"/>
          <circle cx={cx} cy="235" r="7"    fill="#666"/>
          <circle cx={cx} cy="235" r="2.5"  fill="#383838"/>
        </g>
      ))}

      {/* ── GROUND ── */}
      <rect x="0" y="214" width="390" height="2" fill="rgba(31,31,30,0.07)"/>
      <ellipse cx="228" cy="216" rx="78" ry="4" fill="rgba(31,31,30,0.05)"/>
      <ellipse cx="338" cy="216" rx="55" ry="3.5" fill="rgba(31,31,30,0.04)"/>
    </svg>
  );
}

/* ══ Root — splash once per session, then landing ══════════════════════════ */
export default function Landing() {
  const [splashDone, setSplashDone] = useState(() => hasSeenSplash());

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }
  return <LandingScreen />;
}
