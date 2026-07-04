import { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/lib/auth';
import { api, type User } from '@/lib/api';
import { Building2, Lock, Mail, Eye, EyeOff, Phone, MessageCircle, ArrowLeft, Users, ShieldCheck, KeyRound } from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';
import { ConcreteKingLogo, BrandCredits } from '@/components/BrandLogo';
import InstallAppButton from '@/components/InstallAppButton';
import OtpInput from '@/components/OtpInput';
import { defaultPath } from '@/lib/permissions';
import { inputStyle } from '@/components/loginStyles';
import { ErrorBox, SubmitButton } from '@/components/loginUi';
import AuthLegalFooter from '@/components/AuthLegalFooter';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';

// Small dev-only banner that reveals the generated code when no real delivery
// channel is configured (never shown in production).
function DevCodeBanner({ code }: { code: string }) {
  return (
    <div style={{
      marginBottom: 18, padding: '10px 14px', borderRadius: 10,
      background: 'color-mix(in srgb, var(--blue) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--blue) 25%, transparent)',
      fontSize: 13, color: 'var(--blue)',
    }}>
      <strong>Dev mode</strong> — your code is <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{code}</strong>
    </div>
  );
}

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
  //  email    → look up the sign-in method for this address
  //  password → Super Admin only: first 2FA factor
  //  code     → one-time code (staff OTP) or the Super Admin's second factor
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [staffStep, setStaffStep] = useState<'email' | 'password' | 'code'>('email');
  const [staffCodeMode, setStaffCodeMode] = useState<'staff' | 'superadmin'>('staff');
  const [staffCode, setStaffCode] = useState('');
  const [staffDevCode, setStaffDevCode] = useState<string | null>(null);

  // Phone OTP (customers) — unchanged flow, now using the shared 6-box input.
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ ok: boolean; channel: string; devMode: boolean; devCode?: string }>(
        '/auth/otp/send', { phone, name: name || undefined },
      );
      setDevCode(res.devCode ?? null);
      setCode('');
      setOtpStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send the code');
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
        '/auth/otp/verify', { phone, code: c, name: name || undefined },
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--bg) 88%, transparent), color-mix(in srgb, var(--bg) 94%, transparent)), url(${bg})`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))', fontFamily: 'var(--font-app)',
    }}>
      <div className="ck-login-grid" style={{ width: '100%', maxWidth: 900, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — brand */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              display: 'grid', placeItems: 'center', borderRadius: 16,
              boxShadow: '0 8px 24px color-mix(in srgb, var(--gold) 30%, transparent)',
            }}>
              <ConcreteKingLogo size={52} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
                {PLATFORM_NAME}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                {PLATFORM_TAGLINE}
              </div>
            </div>
          </div>

          <h1 style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 900, lineHeight: 1.1, color: 'var(--text)' }}>
            Ready Mix Concrete<br />
            <span style={{ color: 'var(--gold)' }}>Management Platform</span>
          </h1>
          <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>
            End-to-end RMC plant operations — orders, dispatch, production, fleet & financials in one premium dashboard.
          </p>

          {/* Prominent install / download (PWA) call-to-action */}
          <div style={{ maxWidth: 320 }}>
            <InstallAppButton />
          </div>

          {/* Powered / sponsored credits */}
          <div style={{ maxWidth: 320, marginTop: 20 }}>
            <BrandCredits align="left" />
          </div>
        </div>

        {/* Right — login form */}
        <div style={{
          background: 'linear-gradient(135deg, var(--glass-1), var(--glass-2))',
          border: '1px solid var(--glass-border)',
          borderRadius: 20, padding: '40px 32px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 30px 70px -30px rgba(var(--shadow-rgb),.28)',
        }}>
          <button onClick={() => setLoc('/')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--muted)', fontSize: 13, fontWeight: 600,
          }}>
            <ArrowLeft size={15} /> Back to home
          </button>

          {/* Portal selector — customer (phone) vs plant staff (email) */}
          <div role="tablist" aria-label="Sign in as" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 22,
            background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: 12, padding: 4,
          }}>
            {([
              { key: 'phone', label: 'Customer', icon: <Phone size={14} /> },
              { key: 'email', label: 'Plant Staff', icon: <Users size={14} /> },
            ] as const).map(opt => {
              const active = mode === opt.key;
              return (
                <button
                  key={opt.key} type="button" role="tab" aria-selected={active}
                  onClick={() => { setMode(opt.key); setError(''); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    background: active ? 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))' : 'transparent',
                    color: active ? '#111827' : 'var(--muted)',
                    transition: 'all .15s',
                  }}
                >
                  {opt.icon}{opt.label}
                </button>
              );
            })}
          </div>

          {mode === 'phone' ? (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Sign in with your phone</h2>
              <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 13 }}>
                {otpStep === 'phone'
                  ? 'We\u2019ll text you a one-time code by SMS.'
                  : `Enter the 6-digit code sent to ${phone || 'your number'}.`}
              </p>

              {otpStep === 'phone' ? (
                <form onSubmit={handleSendOtp}>
                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                      Mobile Number
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="98765 43210" required autoFocus
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                      Your Name <span style={{ fontWeight: 500, textTransform: 'none' }}>(new customers only)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Optional"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton loading={loading} label={loading ? 'Sending code…' : 'Send code via SMS'} icon={<MessageCircle size={16} />} />
                </form>
              ) : (
                <form onSubmit={e => { e.preventDefault(); verifyPhoneOtp(); }}>
                  {devCode && <DevCodeBanner code={devCode} />}

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
                      Verification Code
                    </label>
                    <OtpInput value={code} onChange={setCode} onComplete={verifyPhoneOtp} disabled={loading} autoFocus />
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton loading={loading} label={loading ? 'Verifying…' : 'Verify & continue →'} />

                  <button type="button" onClick={resetOtp} style={{
                    marginTop: 14, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--muted)', fontSize: 13, fontWeight: 600,
                  }}>
                    <ArrowLeft size={14} /> Use a different number
                  </button>
                </form>
              )}

              <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                Staff member?{' '}
                <button type="button" onClick={() => { setMode('email'); setError(''); }} style={linkBtnStyle}>
                  Sign in with email
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Staff Sign In</h2>
              <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 13 }}>
                {staffStep === 'email' && 'Enter your work email to continue.'}
                {staffStep === 'password' && 'Enter your password to continue.'}
                {staffStep === 'code' && `Enter the 6-digit code sent to ${email || 'your email'}.`}
              </p>

              {staffStep === 'email' && (
                <form onSubmit={handleStaffEmailContinue}>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                      Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@company.com" required autoFocus
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton loading={loading} label={loading ? 'Checking…' : 'Continue →'} />

                  <p style={{ margin: '16px 2px 0', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                    Staff accounts are created by your administrator. No sign-up here.
                  </p>
                </form>
              )}

              {staffStep === 'password' && (
                <form onSubmit={handleSuperAdminPassword}>
                  <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={15} style={{ color: 'var(--gold)' }} />
                    <span style={{ fontWeight: 700 }}>{email}</span>
                    <button type="button" onClick={resetStaff} style={{ ...linkBtnStyle, fontSize: 12 }}>change</button>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                      Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type={showPw ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••" required autoFocus
                        style={{ ...inputStyle, padding: '11px 40px 11px 38px' }}
                      />
                      <button type="button" onClick={() => setShowPw(s => !s)} style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      }}>
                        {showPw ? <EyeOff size={15} style={{ color: 'var(--muted)' }} /> : <Eye size={15} style={{ color: 'var(--muted)' }} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 24, textAlign: 'right' }}>
                    <button type="button" onClick={() => setLoc('/forgot-password')} style={linkBtnStyle}>
                      Forgot password?
                    </button>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton loading={loading} label={loading ? 'Verifying…' : 'Continue →'} icon={<Lock size={15} />} />
                </form>
              )}

              {staffStep === 'code' && (
                <form onSubmit={e => { e.preventDefault(); verifyStaffCode(); }}>
                  {staffDevCode && <DevCodeBanner code={staffDevCode} />}

                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
                      {staffCodeMode === 'superadmin' ? 'Two-Factor Code' : 'Login Code'}
                    </label>
                    <OtpInput value={staffCode} onChange={setStaffCode} onComplete={verifyStaffCode} disabled={loading} autoFocus />
                  </div>

                  {error && <ErrorBox message={error} />}

                  <SubmitButton loading={loading} label={loading ? 'Verifying…' : 'Verify & continue →'} icon={<KeyRound size={15} />} />

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button type="button" onClick={resetStaff} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      color: 'var(--muted)', fontSize: 13, fontWeight: 600,
                    }}>
                      <ArrowLeft size={14} /> Use a different email
                    </button>
                    <button type="button" onClick={resendStaffCode} disabled={loading} style={linkBtnStyle}>
                      Resend code
                    </button>
                  </div>
                </form>
              )}

              <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
                Customer?{' '}
                <button type="button" onClick={() => { setMode('phone'); setError(''); }} style={linkBtnStyle}>
                  Sign in with your phone
                </button>
              </div>
            </>
          )}

          <AuthLegalFooter consentPrefix="By continuing, you agree to our Terms of Service and Privacy Policy." />
        </div>
      </div>
    </div>
  );
}

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'underline',
};
