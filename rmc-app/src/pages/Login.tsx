import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Building2, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';
import { clerkEnabled } from '@/lib/clerk';
import ClerkStaffLogin from '@/components/ClerkStaffLogin';

const DEMO = [
  { role: 'Admin', email: 'admin@aakruti.com', password: 'admin123', color: 'var(--gold)' },
  { role: 'Dispatcher', email: 'dispatcher@aakruti.com', password: 'dispatch123', color: 'var(--blue)' },
  { role: 'Plant Operator', email: 'operator@aakruti.com', password: 'operator123', color: 'var(--green)' },
  { role: 'Client', email: 'client@aakruti.com', password: 'client123', color: '#a78bfa' },
  { role: 'Driver', email: 'driver@aakruti.com', password: 'driver123', color: '#f97316' },
];

export default function Login() {
  const { login } = useAuth();
  const [, setLoc] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setLoc('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(d: { email: string; password: string }) {
    setEmail(d.email);
    setPassword(d.password);
    setError('');
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: `linear-gradient(180deg, color-mix(in srgb, var(--bg) 88%, transparent), color-mix(in srgb, var(--bg) 94%, transparent)), url(${bg})`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--font-app)',
    }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — brand */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 24px color-mix(in srgb, var(--gold) 30%, transparent)',
            }}>
              <Building2 size={24} color="#111" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
                CONCRETE KING
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                RMC Plant · Panvel
              </div>
            </div>
          </div>

          <h1 style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 900, lineHeight: 1.1, color: 'var(--text)' }}>
            Ready Mix Concrete<br />
            <span style={{ color: 'var(--gold)' }}>Management Platform</span>
          </h1>
          <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 32, fontSize: 14 }}>
            End-to-end RMC plant operations — orders, dispatch, production, fleet & financials in one premium dashboard.
          </p>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '1px', marginBottom: 10, textTransform: 'uppercase' }}>
              Demo Accounts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO.map(d => (
                <button key={d.role} onClick={() => fillDemo(d)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  color: 'var(--text)',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 100, color: d.color }}>{d.role}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — login form */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01))',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 20, padding: '40px 32px',
          backdropFilter: 'blur(12px)',
        }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Sign In</h2>
          <p style={{ margin: '0 0 28px', color: 'var(--muted)', fontSize: 13 }}>Enter your credentials to access the platform</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  style={{
                    width: '100%', padding: '11px 14px 11px 38px',
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: '100%', padding: '11px 40px 11px 38px',
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
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
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
            New customer?{' '}
            <button type="button" onClick={() => setLoc('/register')} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--gold)', fontWeight: 700, fontSize: 13, textDecoration: 'underline',
            }}>
              Create an account
            </button>
          </div>

          <div style={{ marginTop: 24, padding: '14px', background: 'color-mix(in srgb, var(--gold) 6%, transparent)', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--gold) 12%, transparent)' }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, marginBottom: 4 }}>💡 Quick Start</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Click any demo account above to auto-fill credentials</div>
          </div>

          {clerkEnabled && <ClerkStaffLogin onError={setError} />}
        </div>
      </div>
    </div>
  );
}
