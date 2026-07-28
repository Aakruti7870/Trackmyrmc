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
   Matches reference: brand header → scene photo → dark card
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
      background: '#EDF1EC',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>

      {/* ── Brand header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 20px 10px',
        flexShrink: 0,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg, #2E7D5A, #1A5C3F)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 12px rgba(26,92,63,0.28)',
        }}>
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="2" y="12" width="14" height="9" rx="2" fill="white" opacity="0.95"/>
            <path d="M16 13.5 L16 12 L24 12 L26 17 L16 17 Z" fill="white" opacity="0.88"/>
            <circle cx="7"  cy="22" r="2.8" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1"/>
            <circle cx="20" cy="22" r="2.8" fill="rgba(255,255,255,0.5)" stroke="white" strokeWidth="1"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1A1A18', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            TrackMy<span style={{ color: '#2E7D5A' }}>RMC</span>
          </div>
          <div style={{ fontSize: 11, color: '#6A7A6A', fontWeight: 500, lineHeight: 1.2 }}>
            Moving Concrete. Building Trust.
          </div>
        </div>
      </div>

      {/* ── Plant scene (real photo) ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', alignItems: 'flex-end',
        overflow: 'hidden',
      }}>
        <img
          src="/login-scene.jpg"
          alt="RMC plant — silos, mixer truck and concrete pump truck"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center bottom',
            display: 'block',
          }}
        />
      </div>

      {/* ── Dark login card ── */}
      <div style={{
        flexShrink: 0,
        background: '#0D2419',
        borderRadius: '24px 24px 0 0',
        padding: '22px 20px',
        paddingBottom: 'max(22px, calc(16px + env(safe-area-inset-bottom, 0px)))',
        overflowY: 'auto',
        maxHeight: '62vh',
      }}>

        {/* Headline */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#F2F2F0', lineHeight: 1.2 }}>
            Ready Mix Concrete,
          </div>
          <div style={{ fontSize: 21, fontWeight: 800, color: '#2DAA78', lineHeight: 1.2 }}>
            On Time, Every Time.
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(255,255,255,0.07)',
          borderRadius: 12, padding: 4, marginBottom: 16,
        }}>
          {(['customer', 'staff', 'partner'] as Tab[]).map(t => (
            <button
              key={t} type="button" onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 9,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                background: tab === t ? '#2DAA78' : 'transparent',
                color:      tab === t ? '#ffffff' : '#8A9A8A',
                transition: 'all 0.18s ease',
              }}
            >
              {t === 'customer' ? 'Customer' : t === 'staff' ? 'Staff' : 'Partner'}
            </button>
          ))}
        </div>

        {/* Customer — phone OTP */}
        {tab === 'customer' && (
          <form onSubmit={handleGetOtp}>
            <p style={{ fontSize: 13, color: '#8A9A8A', margin: '0 0 12px', lineHeight: 1.5 }}>
              Enter your mobile number to get started.
            </p>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.07)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              borderRadius: 12, overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                padding: '13px 14px 13px 16px',
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
                  flex: 1, padding: '13px',
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 16, fontWeight: 600, color: '#F2F2F0',
                  fontFamily: 'inherit', letterSpacing: '0.03em',
                }}
              />
            </div>
            <button type="submit" style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: '#2DAA78', color: '#ffffff',
              fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, marginBottom: 8,
              boxShadow: '0 4px 18px rgba(45,170,120,0.32)',
            }}>
              Get OTP <span style={{ fontSize: 18 }}>&#x2192;</span>
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 12, color: '#7A8A7A', marginBottom: 12,
            }}>
              <ShieldCheck size={13} color="#2DAA78" />
              Secure OTP login &#183; No password needed
            </div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => navigate('/login?staff=1')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#2DAA78', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
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
            <p style={{ fontSize: 13, color: '#8A9A8A', margin: '0 0 14px', lineHeight: 1.5 }}>
              Staff accounts are provisioned by your plant admin. Sign in with your work email.
            </p>
            <button
              type="button" onClick={() => navigate('/login?staff=1')}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: '#2DAA78', color: '#ffffff',
                fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
                cursor: 'pointer', marginBottom: 14,
                boxShadow: '0 4px 18px rgba(45,170,120,0.32)',
              }}
            >
              Staff login with email &#x2192;
            </button>
          </div>
        )}

        {/* Partner */}
        {tab === 'partner' && (
          <div>
            <p style={{ fontSize: 13, color: '#8A9A8A', margin: '0 0 14px', lineHeight: 1.5 }}>
              Register your RMC plant on the TrackMyRMC network and reach more customers.
            </p>
            <button
              type="button" onClick={() => navigate('/login?partner=1')}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: '#2DAA78', color: '#ffffff',
                fontSize: 16, fontWeight: 800, fontFamily: 'inherit',
                cursor: 'pointer', marginBottom: 14,
                boxShadow: '0 4px 18px rgba(45,170,120,0.32)',
              }}
            >
              Register as Partner &#x2192;
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11.5, color: '#4A5A4A', lineHeight: 1.9 }}>
          <div>
            By continuing you agree to our{' '}
            <button type="button" onClick={() => navigate('/terms')}
              style={{ background:'none',border:'none',cursor:'pointer',color:'#2DAA78',fontWeight:600,fontFamily:'inherit',fontSize:'inherit',padding:0,textDecoration:'underline',textUnderlineOffset:2 }}>
              Terms
            </button>
            {' '}&amp;{' '}
            <button type="button" onClick={() => navigate('/privacy')}
              style={{ background:'none',border:'none',cursor:'pointer',color:'#2DAA78',fontWeight:600,fontFamily:'inherit',fontSize:'inherit',padding:0,textDecoration:'underline',textUnderlineOffset:2 }}>
              Privacy Policy
            </button>
          </div>
          <div>
            <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: '#4A5A4A', textDecoration: 'none' }}>
              &#9711; Need help? Chat with support
            </a>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', opacity: 0.5 }}>
          <BrandCredits oneRow align="center" />
        </div>
      </div>

      <style>{`input::placeholder{color:rgba(242,242,240,0.28)} input:focus{outline:none}`}</style>
    </div>
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
