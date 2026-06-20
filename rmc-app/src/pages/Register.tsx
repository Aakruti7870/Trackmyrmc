import { useState } from 'react';
import { useLocation } from 'wouter';
import { api, type User as AuthUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Building2, Lock, Mail, Eye, EyeOff, AlertCircle, User, Phone, MapPin, FileText, CheckCircle2 } from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px 11px 38px',
  background: 'rgba(255,255,255,.7)', border: '1px solid rgba(30,41,90,.14)',
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      padding: 20, fontFamily: 'var(--font-app)',
    }}>
      <div style={{
        width: '100%', maxWidth: 520,
        background: 'linear-gradient(135deg, rgba(255,255,255,.82), rgba(255,255,255,.62))',
        border: '1px solid rgba(255,255,255,.85)',
        borderRadius: 20, padding: '36px 32px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 30px 70px -30px rgba(30,41,90,.28)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
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
        </div>

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

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: loading ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                color: '#111827', fontWeight: 800, fontSize: 15,
                boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 20%, transparent)',
                cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
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
          </>
        )}
      </div>
    </div>
  );
}
