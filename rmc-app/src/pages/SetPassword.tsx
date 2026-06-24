import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/lib/auth';
import { api, type User } from '@/lib/api';
import { Building2, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/brand';
import { defaultPath } from '@/lib/permissions';

interface InviteInfo { name: string; email: string; role: string; }

const roleLabel = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function SetPassword() {
  const { updateUser } = useAuth();
  const [, setLoc] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get('token') ?? '';

  // Derive the missing-token case from initial state so the effect never has to
  // call setState synchronously (react-hooks/set-state-in-effect).
  const [checking, setChecking] = useState(() => !!token);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = useState(() => (token ? '' : 'This invite link is missing its token.'));

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    api.get<InviteInfo>(`/auth/invite/${encodeURIComponent(token)}`)
      .then(info => { if (!cancelled) { setInvite(info); setChecking(false); } })
      .catch(err => {
        if (!cancelled) {
          setInvalid((err as Error).message || 'This invite link is invalid or has expired.');
          setChecking(false);
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setSaving(true);
    try {
      const data = await api.post<{ token: string; user: User }>('/auth/set-password', { token, password });
      updateUser(data.user, data.token);
      setLoc(defaultPath(data.user.role));
    } catch (err) {
      setError((err as Error).message || 'Could not set your password.');
      setSaving(false);
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
          background: 'linear-gradient(135deg, rgba(255,255,255,.82), rgba(255,255,255,.62))',
          border: '1px solid rgba(255,255,255,.85)',
          borderRadius: 20, padding: '36px 32px',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 30px 70px -30px rgba(18,64,58,.28)',
        }}>
          {checking ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '20px 0' }}>
              Checking your invite link…
            </div>
          ) : invalid ? (
            <div style={{ textAlign: 'center' }}>
              <AlertCircle size={34} style={{ color: 'var(--red)', marginBottom: 12 }} />
              <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>Link not valid</h2>
              <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>{invalid}</p>
              <button onClick={() => setLoc('/login')} style={primaryBtn}>Go to sign in</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ShieldCheck size={20} style={{ color: 'var(--gold)' }} />
                <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: 'var(--text)' }}>Set your password</h2>
              </div>
              <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: 13 }}>
                Welcome <strong style={{ color: 'var(--text)' }}>{invite?.name}</strong> — choose a password to finish setting up your{' '}
                <strong style={{ color: 'var(--text)' }}>{roleLabel(invite?.role ?? '')}</strong> account for <strong style={{ color: 'var(--text)' }}>{invite?.email}</strong>.
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={fieldLabel}>New password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={leftIcon} />
                    <input
                      type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters" required
                      style={{ ...field, padding: '11px 40px 11px 38px' }}
                    />
                    <button type="button" onClick={() => setShowPw(s => !s)} style={eyeBtn}>
                      {showPw ? <EyeOff size={15} style={{ color: 'var(--muted)' }} /> : <Eye size={15} style={{ color: 'var(--muted)' }} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={fieldLabel}>Confirm password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={leftIcon} />
                    <input
                      type={showPw ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter your password" required
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

                <button type="submit" disabled={saving} style={{
                  ...primaryBtn, width: '100%',
                  opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                  <CheckCircle2 size={16} /> {saving ? 'Setting password…' : 'Set password & sign in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 };
const field: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(18,64,58,.14)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const leftIcon: React.CSSProperties = { color: 'var(--muted)', position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' };
const eyeBtn: React.CSSProperties = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 };
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 18px', borderRadius: 12,
  background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
  color: '#111827', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer',
  boxShadow: '0 12px 30px color-mix(in srgb, var(--gold) 20%, transparent)',
};
