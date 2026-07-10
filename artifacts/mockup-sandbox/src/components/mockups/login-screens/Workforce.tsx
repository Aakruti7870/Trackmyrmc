import {
  Truck, ArrowRight, Phone, MessageCircle, ShieldCheck, Bell, Moon,
  Home, Search, User, Plus, TrendingUp,
} from 'lucide-react';

/**
 * DEMO — Login redesigned in the "Workforce" reference design language
 * (segmented pill tabs, rounded metric cards with mini charts, an isometric
 * hero card, and a floating dark bottom nav with a center FAB) while keeping
 * CONCRETE KING's real teal theme, button structure, and hero illustration.
 *
 * Day-mode teal tokens are hardcoded (the sandbox has no app CSS vars):
 *   page #f4f7f5 · ink #12211d · muted #6b7c76 · teal #178a6e · dark #0f766e
 */

const C = {
  page: '#f4f7f5',
  ink: '#12211d',
  muted: '#6b7c76',
  teal: '#178a6e',
  tealDark: '#0f766e',
  tealTint: '#e5f0ec',
  tealSoft: '#eef5f2',
  white: '#ffffff',
  border: '#e5ece9',
  wa: '#25d366',
};

export function Workforce() {
  return (
    <div style={{
      width: 390, minHeight: 844, margin: '0 auto', position: 'relative',
      background: C.page, color: C.ink, overflow: 'hidden',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* soft ambient glow, like the reference's airy backdrop */}
      <div style={{
        position: 'absolute', top: -120, right: -80, width: 300, height: 300,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(23,138,110,0.14), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', padding: '20px 18px 120px' }}>
        {/* ---------- Header: brand + two circular buttons ---------- */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 13, background: C.teal,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 18px rgba(23,138,110,0.32)',
            }}>
              <Truck size={22} color="#fff" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2, lineHeight: 1 }}>
                CONCRETE KING
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, fontWeight: 600 }}>
                TrackMyRMC
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            <button style={circleBtn(C.white, C.ink)}>
              <Bell size={18} strokeWidth={2} />
            </button>
            <button style={circleBtn(C.ink, '#fff')}>
              <Moon size={17} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ---------- Segmented pill tabs (login doors) ---------- */}
        <div style={{
          display: 'flex', gap: 4, marginTop: 20, padding: 4,
          background: C.white, borderRadius: 999, border: `1px solid ${C.border}`,
          boxShadow: '0 1px 2px rgba(15,33,29,0.04)',
        }}>
          {['Customer', 'Staff', 'Partner'].map((t, i) => (
            <div key={t} style={{
              flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 999,
              fontSize: 13, fontWeight: 700,
              background: i === 0 ? C.teal : 'transparent',
              color: i === 0 ? '#fff' : C.muted,
              boxShadow: i === 0 ? '0 6px 14px rgba(23,138,110,0.28)' : 'none',
            }}>
              {t}
            </div>
          ))}
        </div>

        {/* ---------- Hero card (isometric illustration) ---------- */}
        <div style={{
          marginTop: 16, background: C.white, borderRadius: 26, padding: 14,
          border: `1px solid ${C.border}`,
          boxShadow: '0 14px 34px rgba(15,33,29,0.07)',
        }}>
          <div style={{
            position: 'relative', borderRadius: 20, overflow: 'hidden',
            background: `linear-gradient(160deg, ${C.tealSoft}, ${C.tealTint})`,
            padding: '10px 10px 0',
          }}>
            {/* floating status chip */}
            <div style={{
              position: 'absolute', top: 12, left: 12, zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
              padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              color: C.tealDark, boxShadow: '0 4px 10px rgba(15,33,29,0.08)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, boxShadow: '0 0 0 3px rgba(23,138,110,0.18)' }} />
              Live marketplace
            </div>
            {/* rating-style chip, mirrors reference tag */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 5,
              background: C.ink, padding: '5px 10px', borderRadius: 999,
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
              <TrendingUp size={12} color={C.wa} strokeWidth={2.6} /> 500+ plants
            </div>
            <img
              src="/__mockup/images/login-hero-plant.webp"
              alt="RMC batching plant — empowering everyone"
              style={{ width: '100%', height: 190, objectFit: 'contain', display: 'block', mixBlendMode: 'multiply' }}
            />
          </div>
          <div style={{ padding: '13px 6px 4px' }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4, lineHeight: 1.15 }}>
              Ready Mix Concrete,<br />
              <span style={{ color: C.teal }}>On Time, Every Time.</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 7, fontWeight: 500, lineHeight: 1.45 }}>
              Discover approved plants near you and place orders in minutes.
            </div>
          </div>
        </div>

        {/* ---------- Metric mini-cards (reference card + chart language) ---------- */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={metricCard()}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>98%</div>
            <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginTop: 2 }}>On-time delivery</div>
            {/* mini bar sparkline */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 30, marginTop: 10 }}>
              {[10, 16, 12, 22, 18, 26, 24].map((h, i) => (
                <span key={i} style={{
                  flex: 1, height: h, borderRadius: 3,
                  background: i === 5 ? C.teal : C.tealTint,
                }} />
              ))}
            </div>
          </div>
          <div style={metricCard()}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>4.8★</div>
            <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginTop: 2 }}>Customer rating</div>
            {/* mini gauge */}
            <div style={{ position: 'relative', width: 54, height: 30, marginTop: 10 }}>
              <svg width="54" height="30" viewBox="0 0 54 30">
                <path d="M4 28 A23 23 0 0 1 50 28" fill="none" stroke={C.tealTint} strokeWidth="6" strokeLinecap="round" />
                <path d="M4 28 A23 23 0 0 1 44 11" fill="none" stroke={C.teal} strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* ---------- Login input card (app button structure) ---------- */}
        <div style={{
          marginTop: 12, background: C.white, borderRadius: 22, padding: 18,
          border: `1px solid ${C.border}`, boxShadow: '0 10px 26px rgba(15,33,29,0.06)',
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Enter your mobile number</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontWeight: 500 }}>
            We'll send a one-time code on WhatsApp.
          </div>

          {/* phone input group */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginTop: 13,
            background: C.page, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: '4px 4px 4px 12px',
          }}>
            <Phone size={17} color={C.teal} strokeWidth={2.2} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>+91</span>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#a9b5b0' }}>98765 43210</div>
          </div>

          {/* primary CTA — app's teal pill button structure */}
          <button style={{
            marginTop: 12, width: '100%', height: 52, borderRadius: 15, border: 'none',
            background: C.teal, color: '#fff', fontSize: 15.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', boxShadow: '0 10px 22px rgba(23,138,110,0.30)',
          }}>
            Continue <ArrowRight size={19} strokeWidth={2.4} />
          </button>

          {/* divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 12px' }}>
            <span style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>or</span>
            <span style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          {/* WhatsApp secondary — outline button structure */}
          <button style={{
            width: '100%', height: 50, borderRadius: 15, background: C.white,
            border: `1.5px solid ${C.border}`, color: C.ink, fontSize: 14.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer',
          }}>
            <MessageCircle size={18} color={C.wa} strokeWidth={2.2} /> Continue on WhatsApp
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginTop: 14, fontSize: 11, color: C.muted, fontWeight: 500,
          }}>
            <ShieldCheck size={13} color={C.teal} /> Secure OTP login · No password needed
          </div>
        </div>
      </div>

      {/* ---------- Floating dark bottom nav with center FAB ---------- */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 22,
        display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 26,
          background: C.ink, borderRadius: 999, padding: '13px 26px',
          boxShadow: '0 16px 34px rgba(15,33,29,0.34)',
        }}>
          <Home size={21} color="#fff" strokeWidth={2} />
          <Search size={21} color="rgba(255,255,255,0.55)" strokeWidth={2} />
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: C.teal,
            display: 'grid', placeItems: 'center', marginTop: -30,
            boxShadow: '0 12px 24px rgba(23,138,110,0.5)', border: '4px solid ' + C.page,
          }}>
            <Plus size={26} color="#fff" strokeWidth={2.6} />
          </div>
          <Bell size={21} color="rgba(255,255,255,0.55)" strokeWidth={2} />
          <User size={21} color="rgba(255,255,255,0.55)" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function circleBtn(bg: string, fg: string): React.CSSProperties {
  return {
    width: 42, height: 42, borderRadius: '50%', background: bg, color: fg,
    border: bg === '#ffffff' ? '1px solid #e5ece9' : 'none',
    display: 'grid', placeItems: 'center', cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(15,33,29,0.06)',
  };
}

function metricCard(): React.CSSProperties {
  return {
    flex: 1, background: '#ffffff', borderRadius: 18, padding: '14px 14px 12px',
    border: '1px solid #e5ece9', boxShadow: '0 8px 20px rgba(15,33,29,0.05)',
  };
}
