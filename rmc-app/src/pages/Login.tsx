import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Building2, Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';

const DEMO = [
  { role: 'Admin', email: 'admin@aakruti.com', password: 'admin123', color: '#f7c948' },
  { role: 'Dispatcher', email: 'dispatcher@aakruti.com', password: 'dispatch123', color: '#38bdf8' },
  { role: 'Plant Operator', email: 'operator@aakruti.com', password: 'operator123', color: '#22c55e' },
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
      minHeight: '100vh', background: '#08111f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 900, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — brand */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
              display: 'grid', placeItems: 'center',
              boxShadow: '0 8px 24px rgba(247,201,72,.3)',
            }}>
              <Building2 size={24} color="#111" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px', color: '#eef5ff' }}>
                TrackMyRMC
              </div>
              <div style={{ fontSize: 11, color: '#9fb0c7', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Aakruti Infra
              </div>
            </div>
          </div>

          <h1 style={{ margin: '0 0 12px', fontSize: 34, fontWeight: 900, lineHeight: 1.1, color: '#eef5ff' }}>
            Ready Mix Concrete<br />
            <span style={{ color: '#f7c948' }}>Management Platform</span>
          </h1>
          <p style={{ color: '#9fb0c7', lineHeight: 1.7, marginBottom: 32, fontSize: 14 }}>
            End-to-end RMC plant operations — orders, dispatch, production, fleet & financials in one premium dashboard.
          </p>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9fb0c7', letterSpacing: '1px', marginBottom: 10, textTransform: 'uppercase' }}>
              Demo Accounts
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {DEMO.map(d => (
                <button key={d.role} onClick={() => fillDemo(d)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                  color: '#eef5ff',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 100, color: d.color }}>{d.role}</span>
                  <span style={{ fontSize: 11, color: '#9fb0c7', fontFamily: 'monospace' }}>{d.email}</span>
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
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#eef5ff' }}>Sign In</h2>
          <p style={{ margin: '0 0 28px', color: '#9fb0c7', fontSize: 13 }}>Enter your credentials to access the platform</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9fb0c7', marginBottom: 6 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#9fb0c7" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  style={{
                    width: '100%', padding: '11px 14px 11px 38px',
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 10, color: '#eef5ff', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9fb0c7', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#9fb0c7" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: '100%', padding: '11px 40px 11px 38px',
                    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                    borderRadius: 10, color: '#eef5ff', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                  {showPw ? <EyeOff size={15} color="#9fb0c7" /> : <Eye size={15} color="#9fb0c7" />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 18,
              }}>
                <AlertCircle size={14} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: 13 }}>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: loading ? 'rgba(247,201,72,.4)' : 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
              color: '#111827', fontWeight: 800, fontSize: 15,
              boxShadow: '0 12px 30px rgba(247,201,72,.2)',
              cursor: loading ? 'not-allowed' : 'pointer', border: 'none',
              transition: 'all .15s',
            }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: '14px', background: 'rgba(247,201,72,.06)', borderRadius: 10, border: '1px solid rgba(247,201,72,.12)' }}>
            <div style={{ fontSize: 11, color: '#f7c948', fontWeight: 700, marginBottom: 4 }}>💡 Quick Start</div>
            <div style={{ fontSize: 12, color: '#9fb0c7' }}>Click any demo account above to auto-fill credentials</div>
          </div>
        </div>
      </div>
    </div>
  );
}
