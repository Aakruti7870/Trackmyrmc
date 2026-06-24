import { useState } from 'react';
import { useLocation } from 'wouter';
import { api, type User as AuthUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Building2, Lock, Mail, Eye, EyeOff, AlertCircle, User, Phone, MapPin, FileText, CheckCircle2, ArrowLeft, Check } from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';
import AuthLegalFooter from '@/components/AuthLegalFooter';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px 11px 38px',
  background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6,
};

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

export default function Register() {
  const [, setLoc] = useLocation();
  const { updateUser } = useAuth();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>(
        '/auth/register', { name, companyName, email, phone, gstNo, city, password },
      );
      // Log the customer in immediately. Setting the user makes RegisterRoute
      // redirect to their default screen (nearby-plant discovery), so they can
      // find an approved plant near them and place an order right away.
      updateUser(res.user, res.token);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--bg) 88%, transparent), color-mix(in srgb, var(--bg) 94%, transparent)), url(${bg})`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, paddingTop: 'calc(20px + env(safe-area-inset-top, 0px))', fontFamily: 'var(--font-app)',
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'linear-gradient(135deg, var(--glass-1), var(--glass-2))',
        border: '1px solid var(--glass-border)',
        borderRadius: 20, padding: '36px 32px',
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
        <button onClick={() => setLoc('/')} style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--gold) 30%, transparent)',
          }}>
            <Building2 size={22} color="#111" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>{PLATFORM_NAME}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{PLATFORM_TAGLINE}</div>
          </div>
        </button>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
              background: 'color-mix(in srgb, var(--green) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--green) 32%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <CheckCircle2 size={28} style={{ color: 'var(--green)' }} />
            </div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Account created</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
              You're all set — let's use your location to find approved RMC plants near you.
            </p>
            <button onClick={() => setLoc('/nearby-plants')} style={{
              padding: '11px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              color: '#111827', fontWeight: 800, fontSize: 14,
            }}>
              Go to my dashboard
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Create your account</h2>
            <p style={{ margin: '0 0 24px', color: 'var(--muted)', fontSize: 13 }}>
              Register your company and start ordering ready-mix concrete right away — no waiting for approval.
            </p>

            <form onSubmit={handleSubmit}>
              <Field icon={<User size={15} style={{ color: 'var(--muted)' }} />} label="Your Name">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required style={inputStyle} />
              </Field>

              <Field icon={<Building2 size={15} style={{ color: 'var(--muted)' }} />} label="Company Name">
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company / firm" required style={inputStyle} />
              </Field>

              <Field icon={<Mail size={15} style={{ color: 'var(--muted)' }} />} label="Email Address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required style={inputStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field icon={<Phone size={15} style={{ color: 'var(--muted)' }} />} label="Phone">
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number" required style={inputStyle} />
                </Field>
                <Field icon={<MapPin size={15} style={{ color: 'var(--muted)' }} />} label="City (optional)">
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" style={inputStyle} />
                </Field>
              </div>

              <Field icon={<FileText size={15} style={{ color: 'var(--muted)' }} />} label="GST Number (optional)">
                <input type="text" value={gstNo} onChange={e => setGstNo(e.target.value)} placeholder="GSTIN" style={inputStyle} />
              </Field>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPw ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="At least 8 characters" required minLength={8}
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

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 18,
                }}>
                  <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                  <span style={{ color: 'var(--red)', fontSize: 13 }}>{error}</span>
                </div>
              )}

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18,
                fontSize: 13, color: 'var(--muted)', lineHeight: 1.5,
              }}>
                <button
                  type="button" role="checkbox" aria-checked={consent}
                  aria-label="Accept Terms of Service and Privacy Policy"
                  onClick={() => setConsent(c => !c)}
                  style={{
                    flexShrink: 0, width: 20, height: 20, marginTop: 1, borderRadius: 6,
                    display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
                    border: `1px solid ${consent ? 'var(--gold)' : 'var(--line)'}`,
                    background: consent ? 'var(--gold)' : 'var(--surface)',
                    transition: 'all .15s',
                  }}
                >
                  {consent && <Check size={14} color="#111827" strokeWidth={3} />}
                </button>
                <span>
                  I agree to the{' '}
                  <button type="button" onClick={() => setLoc('/terms')} style={inlineLink}>Terms of Service</button>{' '}
                  and{' '}
                  <button type="button" onClick={() => setLoc('/privacy')} style={inlineLink}>Privacy Policy</button>.
                </span>
              </div>

              <button type="submit" disabled={loading || !consent} style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: (loading || !consent) ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                color: '#111827', fontWeight: 800, fontSize: 15,
                boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 20%, transparent)',
                cursor: (loading || !consent) ? 'not-allowed' : 'pointer', border: 'none',
                transition: 'all .15s',
              }}>
                {loading ? 'Submitting...' : 'Create Account →'}
              </button>
            </form>

            <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              Already have an account?{' '}
              <button type="button" onClick={() => setLoc('/login')} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'underline',
              }}>
                Sign in
              </button>
            </div>

            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
              Are you a plant owner?{' '}
              <button type="button" onClick={() => setLoc('/partner')} style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'underline',
              }}>
                Register your plant
              </button>
            </div>

            <AuthLegalFooter />
          </>
        )}
      </div>
    </div>
  );
}

const inlineLink: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'underline',
};
