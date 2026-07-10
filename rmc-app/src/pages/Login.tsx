import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/lib/auth';
import { api, type User } from '@/lib/api';
import {
  Truck, ArrowRight, ArrowLeft, Mail, Lock, Eye, EyeOff,
  KeyRound, ShieldCheck, MessageCircle, Star, TrendingUp,
} from 'lucide-react';
import loginHero from '@/assets/login-hero-plant.webp';
import InstallAppButton from '@/components/InstallAppButton';
import OtpInput from '@/components/OtpInput';
import { defaultPath } from '@/lib/permissions';
import { BrandCredits } from '@/components/BrandLogo';
import { SUPPORT_WHATSAPP_URL } from '@/lib/brand';

// Theme-driven palette — reads the app-wide Day/Night tokens so the auth
// screen re-themes together with the rest of the app.
const C = {
  cream: 'var(--bg)',
  ink: 'var(--text)',
  muted: 'var(--muted)',
  faint: 'var(--muted)',
  teal: 'var(--gold)',
  tealDark: 'var(--gold-dark)',
  tealTint: 'var(--gold-tint)',
  tealBorder: 'var(--prompt-icon-bg)',
  emerald: '#10b981',
  amberTint: 'var(--gold-soft)',
  inputBg: 'var(--panel2)',
  inputBorder: 'var(--line)',
  white: 'var(--panel)',
  red: 'var(--red)',
};

// Dev-only banner revealing the generated code when no real delivery channel is
// configured (never shown in production).
function DevCodeBanner({ code }: { code: string }) {
  return (
    <div style={{
      marginBottom: 16, padding: '10px 14px', borderRadius: 12,
      background: C.tealTint, border: `1px solid ${C.tealBorder}`,
      fontSize: 13, color: C.teal,
    }}>
      <strong>Dev mode</strong> — your code is{' '}
      <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{code}</strong>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div style={{
      marginBottom: 16, padding: '10px 14px', borderRadius: 12,
      background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.35)',
      fontSize: 13, color: C.red, fontWeight: 500,
    }}>
      {message}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 16,
  border: `2px solid ${C.inputBorder}`, background: C.inputBg,
  fontSize: 16, fontWeight: 600, color: C.ink, outline: 'none',
  boxSizing: 'border-box', transition: 'all .15s',
  fontFamily: 'inherit',
};

function PrimaryButton({
  loading, label, icon, onClick, type = 'submit',
}: {
  loading: boolean; label: string; icon?: React.ReactNode;
  onClick?: () => void; type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type} disabled={loading} onClick={onClick}
      style={{
        width: '100%', padding: '15px', borderRadius: 16, border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: loading ? C.tealDark : C.teal, color: '#fff',
        fontWeight: 700, fontSize: 17, fontFamily: 'inherit',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
        boxShadow: '0 8px 20px rgba(15,118,110,0.2)', transition: 'all .15s',
      }}
    >
      {label}{icon}
    </button>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: C.teal, fontWeight: 600, fontSize: 15, fontFamily: 'inherit',
};

const textLink: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: C.teal, fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
  textDecoration: 'underline', textUnderlineOffset: 3,
};

// Circular icon button used in the header (matches the Workforce card language).
const circleBtn: React.CSSProperties = {
  width: 42, height: 42, borderRadius: '50%', background: C.white,
  border: `1px solid ${C.inputBorder}`, color: C.ink,
  display: 'grid', placeItems: 'center', cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(15,33,29,0.06)', fontFamily: 'inherit',
};

// Rounded surface card (hero / metrics / auth) — one consistent card language.
const surfaceCard: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.inputBorder}`,
  boxShadow: '0 12px 30px rgba(15,33,29,0.06)',
};

export default function Login() {
  const { updateUser } = useAuth();
  const [, setLoc] = useLocation();
  const search = useSearch();

  // 'phone' is the default — most customers have no email. Arriving via the
  // landing "Staff Login" door (/login?staff=1) opens the staff path directly.
  const staffFirst = new URLSearchParams(search).get('staff') != null;
  const [mode, setMode] = useState<'phone' | 'email'>(staffFirst ? 'email' : 'phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Staff / owner sign-in (provisioned-only, passwordless except the Super Admin).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [staffStep, setStaffStep] = useState<'email' | 'password' | 'code'>('email');
  const [staffCodeMode, setStaffCodeMode] = useState<'staff' | 'superadmin'>('staff');
  const [staffCode, setStaffCode] = useState('');
  const [staffDevCode, setStaffDevCode] = useState<string | null>(null);

  // Phone OTP (customers).
  const [phone, setPhone] = useState('');
  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);

  // ---- Staff flow -----------------------------------------------------------

  async function sendStaffOtp() {
    const res = await api.post<{ ok: boolean; devMode?: boolean; devCode?: string }>(
      '/auth/staff/otp/send', { email: email.trim() },
    );
    setStaffDevCode(res.devCode ?? null);
    setStaffCodeMode('staff');
    setStaffCode('');
    setStaffStep('code');
  }

  async function handleStaffEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ method: 'password' | 'otp' }>(
        '/auth/staff/login-method', { email: email.trim() },
      );
      if (res.method === 'password') {
        setPassword('');
        setStaffStep('password');
      } else {
        await sendStaffOtp();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not continue. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Super Admin first factor: password verifies, then the server sends a code and
  // we move to the second-factor (code) step. No token is issued until the code
  // is verified at /auth/superadmin/verify.
  async function handleSuperAdminPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ otpRequired?: boolean; devCode?: string; token?: string; user?: User }>(
        '/auth/login', { email: email.trim(), password },
      );
      if (res.otpRequired) {
        setStaffDevCode(res.devCode ?? null);
        setStaffCodeMode('superadmin');
        setStaffCode('');
        setStaffStep('code');
      } else if (res.token && res.user) {
        updateUser(res.user, res.token);
        setLoc(defaultPath(res.user.role));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function verifyStaffCode(c = staffCode) {
    if (c.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const endpoint = staffCodeMode === 'superadmin' ? '/auth/superadmin/verify' : '/auth/staff/otp/verify';
      const data = await api.post<{ token: string; user: User }>(endpoint, { email: email.trim(), code: c });
      updateUser(data.user, data.token);
      setLoc(defaultPath(data.user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resendStaffCode() {
    setError('');
    setLoading(true);
    try {
      if (staffCodeMode === 'superadmin') {
        const res = await api.post<{ otpRequired?: boolean; devCode?: string }>(
          '/auth/login', { email: email.trim(), password },
        );
        setStaffDevCode(res.devCode ?? null);
      } else {
        await sendStaffOtp();
      }
      setStaffCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    } finally {
      setLoading(false);
    }
  }

  function resetStaff() {
    setStaffStep('email');
    setPassword('');
    setStaffCode('');
    setStaffDevCode(null);
    setError('');
  }

  // ---- Customer phone flow (unchanged endpoints) ----------------------------

  async function sendPhoneOtpCore() {
    const res = await api.post<{ ok: boolean; channel: string; devMode: boolean; devCode?: string }>(
      '/auth/otp/send', { phone },
    );
    setDevCode(res.devCode ?? null);
    setCode('');
    setOtpStep('code');
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPhoneOtpCore();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send the code');
    } finally {
      setLoading(false);
    }
  }

  async function resendPhoneOtp() {
    setError('');
    setLoading(true);
    try {
      await sendPhoneOtpCore();
      setCode('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp(c = code) {
    if (c.length < 6) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.post<{ token: string; user: User }>(
        '/auth/otp/verify', { phone, code: c },
      );
      updateUser(data.user, data.token);
      // Route by role: a driver whose number is on file lands on the driver
      // dashboard (/my-trips), a customer on /nearby-plants, etc.
      setLoc(defaultPath(data.user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  function resetOtp() {
    setOtpStep('phone');
    setCode('');
    setDevCode(null);
    setError('');
  }

  // ---- Segmented door tabs (Customer / Staff / Partner) ---------------------
  // These replace the old inline toggle links: same actions, clearer surface.
  function selectCustomer() { setMode('phone'); resetStaff(); setError(''); }
  function selectStaff() { setMode('email'); resetOtp(); setError(''); }

  const activeTab: 'customer' | 'staff' = mode === 'phone' ? 'customer' : 'staff';
  // Only the first step of each flow shows the marketing metric cards, keeping
  // the focused verification steps tight so everything stays on-screen.
  const isEntryStep =
    (mode === 'phone' && otpStep === 'phone') ||
    (mode === 'email' && staffStep === 'email');

  const heading = { fontSize: 22, fontWeight: 800, color: C.ink, lineHeight: 1.2, margin: 0, letterSpacing: '-0.3px' } as React.CSSProperties;
  const subheading = { margin: '6px 0 0', color: C.muted, fontSize: 14, fontWeight: 500 } as React.CSSProperties;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 999,
    fontSize: 13, fontWeight: 700, fontFamily: 'inherit', border: 'none', cursor: 'pointer',
    background: active ? C.teal : 'transparent',
    color: active ? '#fff' : C.muted,
    boxShadow: active ? '0 6px 14px rgba(23,138,110,0.28)' : 'none',
    transition: 'all .15s',
  });

  return (
    <div style={{
      minHeight: '100dvh', maxHeight: '100dvh', background: C.cream, color: C.ink,
      fontFamily: "'Outfit', var(--font-app, system-ui), sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto', position: 'relative',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
    }}>
      {/* Soft ambient glow, echoing the Workforce card's airy backdrop */}
      <div aria-hidden style={{
        position: 'absolute', top: -120, right: -80, width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--gold-tint), transparent 70%)',
        opacity: 0.7, pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 430, flex: 1, position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        padding: '0 0 calc(8px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* Header: back-to-home + brand */}
        <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setLoc('/')} aria-label="Back to home" style={circleBtn}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: C.teal,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 18px rgba(23,138,110,0.32)',
            }}>
              <Truck size={21} color="#fff" strokeWidth={2.2} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
              <span style={{ color: 'var(--text)' }}>TrackMy</span>
              <span style={{ color: C.teal }}>RMC</span>
            </span>
          </div>
          <span style={{ width: 42 }} aria-hidden />
        </div>

        {/* Segmented door tabs */}
        <div style={{
          margin: '16px 18px 0', display: 'flex', gap: 4, padding: 4,
          background: C.white, borderRadius: 999, border: `1px solid ${C.inputBorder}`,
          boxShadow: '0 1px 2px rgba(15,33,29,0.04)',
        }}>
          <button type="button" onClick={selectCustomer} style={tabStyle(activeTab === 'customer')}>Customer</button>
          <button type="button" onClick={selectStaff} style={tabStyle(activeTab === 'staff')}>Staff</button>
          <button type="button" onClick={() => setLoc('/partner')} style={tabStyle(false)}>Partner</button>
        </div>

        {/* Hero card with the plant illustration + floating chips */}
        <div style={{ margin: '16px 18px 0', padding: 12, borderRadius: 26, ...surfaceCard }}>
          <div style={{
            position: 'relative', borderRadius: 20, overflow: 'hidden',
            background: `linear-gradient(160deg, ${C.amberTint}, ${C.tealTint})`,
          }}>
            {/* Live status chip */}
            <div style={{
              position: 'absolute', top: 10, left: 10, zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)',
              padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              color: C.tealDark, boxShadow: '0 4px 10px rgba(15,33,29,0.08)',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, boxShadow: '0 0 0 3px rgba(23,138,110,0.18)' }} />
              Live marketplace
            </div>
            {/* Reach chip */}
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 2,
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--text)', padding: '5px 10px', borderRadius: 999,
              fontSize: 11, fontWeight: 700, color: 'var(--bg)',
            }}>
              <TrendingUp size={12} color={C.teal} strokeWidth={2.6} /> 500+ plants
            </div>
            {/* Fixed light card behind the render so it stays crisp at Night too
                (a multiply-blend against a dark page would wash it out). */}
            <div style={{ padding: 10 }}>
              <div style={{
                background: '#f3f1ec', borderRadius: 14, overflow: 'hidden', padding: 6,
              }}>
                <img
                  src={loginHero} alt="RMC batching plant — empowering everyone"
                  style={{ width: '100%', height: '20vh', maxHeight: 180, minHeight: 120, objectFit: 'contain', display: 'block', mixBlendMode: 'multiply' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Trust metric cards (only on the first step to protect vertical space) */}
        {isEntryStep && (
          <div style={{ margin: '12px 18px 0', display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, padding: '14px 14px 12px', borderRadius: 18, ...surfaceCard }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: C.ink }}>98%</div>
              <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginTop: 2 }}>On-time delivery</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 30, marginTop: 10 }}>
                {[10, 16, 12, 22, 18, 26, 24].map((h, i) => (
                  <span key={i} style={{ flex: 1, height: h, borderRadius: 3, background: i === 5 ? C.teal : C.tealTint }} />
                ))}
              </div>
            </div>
            <div style={{ flex: 1, padding: '14px 14px 12px', borderRadius: 18, ...surfaceCard }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: C.ink }}>
                4.8 <Star size={16} color={C.teal} fill={C.teal} />
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600, marginTop: 2 }}>Customer rating</div>
              <div style={{ width: 54, height: 30, marginTop: 10 }}>
                <svg width="54" height="30" viewBox="0 0 54 30">
                  <path d="M4 28 A23 23 0 0 1 50 28" fill="none" stroke={C.tealTint} strokeWidth="6" strokeLinecap="round" />
                  <path d="M4 28 A23 23 0 0 1 44 11" fill="none" stroke={C.teal} strokeWidth="6" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Auth card — the actual sign-in forms (all actions preserved) */}
        <div style={{ margin: '12px 18px 0', padding: '20px 20px', borderRadius: 24, ...surfaceCard }}>
          {mode === 'phone' ? (
            otpStep === 'phone' ? (
              <>
                <h1 style={heading}>
                  Ready Mix Concrete,<br />
                  <span style={{ color: C.teal }}>On Time, Every Time.</span>
                </h1>
                <p style={subheading}>Enter your mobile number to get started.</p>

                <form onSubmit={handleSendOtp} style={{ marginTop: 20 }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{
                      position: 'absolute', left: 6, display: 'flex', alignItems: 'center',
                      background: C.tealTint, border: `1px solid ${C.tealBorder}`,
                      borderRadius: 12, padding: '10px 12px',
                    }}>
                      <span style={{ color: C.teal, fontWeight: 700, fontSize: 16 }}>+91</span>
                    </div>
                    <input
                      type="tel" inputMode="numeric" value={phone} autoFocus required
                      onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="98765 43210"
                      style={{ ...fieldStyle, paddingLeft: 78 }}
                      onFocus={e => { e.currentTarget.style.borderColor = C.emerald; e.currentTarget.style.background = C.white; }}
                      onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.background = C.inputBg; }}
                    />
                  </div>

                  {error && <ErrorNote message={error} />}

                  <PrimaryButton loading={loading} label={loading ? 'Sending code…' : 'Get OTP'} icon={<ArrowRight size={18} />} />
                </form>

                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  marginTop: 14, fontSize: 11.5, color: C.muted, fontWeight: 500,
                }}>
                  <ShieldCheck size={13} style={{ color: C.teal }} /> Secure OTP login · No password needed
                </div>

                <div style={{ marginTop: 16 }}>
                  <InstallAppButton />
                </div>
              </>
            ) : (
              <>
                <h1 style={heading}>Verify your number</h1>
                <p style={subheading}>Enter the 6-digit code sent to +91 {phone}.</p>

                <form onSubmit={e => { e.preventDefault(); verifyPhoneOtp(); }} style={{ marginTop: 24 }}>
                  {devCode && <DevCodeBanner code={devCode} />}
                  <div style={{ marginBottom: 20 }}>
                    <OtpInput value={code} onChange={setCode} onComplete={verifyPhoneOtp} disabled={loading} autoFocus />
                  </div>

                  {error && <ErrorNote message={error} />}

                  <PrimaryButton loading={loading} label={loading ? 'Verifying…' : 'Verify & continue'} icon={<ArrowRight size={18} />} />
                </form>

                <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button type="button" onClick={resetOtp} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: C.muted, fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                  }}>
                    <ArrowLeft size={15} /> Change number
                  </button>
                  <button type="button" onClick={resendPhoneOtp} disabled={loading} style={linkBtn}>
                    Resend code
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              {staffStep === 'email' && (
                <>
                  <h1 style={heading}>Staff sign in</h1>
                  <p style={subheading}>Enter your work email to continue.</p>

                  <form onSubmit={handleStaffEmailContinue} style={{ marginTop: 20 }}>
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <Mail size={17} style={{ color: C.faint, position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@company.com" required autoFocus
                        style={{ ...fieldStyle, paddingLeft: 46 }}
                        onFocus={e => { e.currentTarget.style.borderColor = C.emerald; e.currentTarget.style.background = C.white; }}
                        onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.background = C.inputBg; }}
                      />
                    </div>

                    {error && <ErrorNote message={error} />}

                    <PrimaryButton loading={loading} label={loading ? 'Checking…' : 'Continue'} icon={<ArrowRight size={18} />} />

                    <p style={{ margin: '14px 2px 0', fontSize: 12, color: C.faint, textAlign: 'center' }}>
                      Staff accounts are created by your administrator. No sign-up here.
                    </p>
                  </form>
                </>
              )}

              {staffStep === 'password' && (
                <>
                  <h1 style={heading}>Enter your password</h1>
                  <div style={{ margin: '10px 0 0', fontSize: 14, color: C.muted, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} style={{ color: C.teal }} />
                    <span style={{ fontWeight: 700, color: C.ink }}>{email}</span>
                    <button type="button" onClick={resetStaff} style={{ ...textLink, fontSize: 13 }}>change</button>
                  </div>

                  <form onSubmit={handleSuperAdminPassword} style={{ marginTop: 20 }}>
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                      <Lock size={17} style={{ color: C.faint, position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type={showPw ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" required autoFocus
                        style={{ ...fieldStyle, padding: '14px 46px' }}
                        onFocus={e => { e.currentTarget.style.borderColor = C.emerald; e.currentTarget.style.background = C.white; }}
                        onBlur={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.background = C.inputBg; }}
                      />
                      <button type="button" onClick={() => setShowPw(s => !s)} style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      }}>
                        {showPw ? <EyeOff size={17} style={{ color: C.faint }} /> : <Eye size={17} style={{ color: C.faint }} />}
                      </button>
                    </div>

                    <div style={{ marginBottom: 18, textAlign: 'right' }}>
                      <button type="button" onClick={() => setLoc('/forgot-password')} style={textLink}>
                        Forgot password?
                      </button>
                    </div>

                    {error && <ErrorNote message={error} />}

                    <PrimaryButton loading={loading} label={loading ? 'Verifying…' : 'Continue'} icon={<Lock size={16} />} />
                  </form>
                </>
              )}

              {staffStep === 'code' && (
                <>
                  <h1 style={heading}>{staffCodeMode === 'superadmin' ? 'Two-factor code' : 'Login code'}</h1>
                  <p style={subheading}>Enter the 6-digit code sent to {email || 'your email'}.</p>

                  <form onSubmit={e => { e.preventDefault(); verifyStaffCode(); }} style={{ marginTop: 24 }}>
                    {staffDevCode && <DevCodeBanner code={staffDevCode} />}
                    <div style={{ marginBottom: 20 }}>
                      <OtpInput value={staffCode} onChange={setStaffCode} onComplete={verifyStaffCode} disabled={loading} autoFocus />
                    </div>

                    {error && <ErrorNote message={error} />}

                    <PrimaryButton loading={loading} label={loading ? 'Verifying…' : 'Verify & continue'} icon={<KeyRound size={16} />} />

                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button type="button" onClick={resetStaff} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: C.muted, fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                      }}>
                        <ArrowLeft size={15} /> Use a different email
                      </button>
                      <button type="button" onClick={resendStaffCode} disabled={loading} style={linkBtn}>
                        Resend code
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </div>

        {/* Legal + support */}
        <div style={{ margin: '18px 18px 0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12.5, color: C.faint, lineHeight: 1.6 }}>
            By continuing you agree to our{' '}
            <button type="button" onClick={() => setLoc('/terms')} style={{ ...textLink, fontSize: 12.5 }}>Terms</button>
            {' '}&amp;{' '}
            <button type="button" onClick={() => setLoc('/privacy')} style={{ ...textLink, fontSize: 12.5 }}>Privacy Policy</button>
          </p>
          <a
            href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
            style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
              color: C.muted, fontSize: 12.5, fontWeight: 600, textDecoration: 'none',
            }}
          >
            <MessageCircle size={13} /> Need help? Chat with support
          </a>
          <div style={{ marginTop: 14 }}>
            <BrandCredits oneRow />
          </div>
        </div>
      </div>
    </div>
  );
}
