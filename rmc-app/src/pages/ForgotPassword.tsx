import { useState } from 'react';
import { useLocation } from 'wouter';
import { api } from '@/lib/api';
import { Building2, Mail, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';

export default function ForgotPassword() {
  const [, setLoc] = useLocation();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await api.post<{ ok: boolean; message: string }>('/auth/forgot-password', { email });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'Could not send the reset link. Please try again.');
      setSending(false);
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
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
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

        <div style={{
          background: 'linear-gradient(135deg, var(--glass-1), var(--glass-2))',
          border: '1px solid var(--glass-border)',
          borderRadius: 20, padding: '36px 32px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 30px 70px -30px rgba(var(--shadow-rgb),.28)',
        }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={34} style={{ color: 'var(--green)', marginBottom: 12 }} />
              <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>Check your email</h2>
              <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>
                If an account exists for <strong style={{ color: 'var(--text)' }}>{email}</strong>, we&rsquo;ve sent a
                secure link to reset your password. The link can be used once and expires soon.
              </p>
              <button onClick={() => setLoc('/login')} style={primaryBtn}>Back to sign in</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <KeyRound size={20} style={{ color: 'var(--gold)' }} />
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--text)' }}>Forgot password</h2>
              </div>
              <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: 13 }}>
                Enter the email address on your account and we&rsquo;ll send you a secure link to set a new password.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 22 }}>
                  <label style={fieldLabel}>Email address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={leftIcon} />
                    <input
                      type="email" value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com" required autoFocus
                      style={{ ...field, padding: '11px 14px 11px 38px' }}
                    />
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

                <button type="submit" disabled={sending} style={{
                  ...primaryBtn, width: '100%',
                  opacity: sending ? 0.6 : 1, cursor: sending ? 'not-allowed' : 'pointer',
                }}>
                  <Mail size={16} /> {sending ? 'Sending link…' : 'Send reset link'}
                </button>
              </form>

              <button type="button" onClick={() => setLoc('/login')} style={{
                marginTop: 18, display: 'flex', alignItems: 'center', gap: 6, marginInline: 'auto',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: 'var(--muted)', fontSize: 13, fontWeight: 600,
              }}>
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 };
const field: React.CSSProperties = {
  width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const leftIcon: React.CSSProperties = { color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' };
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 12,
  background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
  color: '#111827', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer',
  boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 20%, transparent)',
};
