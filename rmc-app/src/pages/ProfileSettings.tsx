import { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle, XCircle, User as UserIcon, Mail, Send, Palette, History, Lock, Unlock, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { ThemeSwitcher } from '@/lib/theme-providers';
import type { User } from '@/lib/api';

interface SmtpSettings {
  host: string | null;
  port: string | null;
  user: string | null;
  from: string | null;
  configured: boolean;
}

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg,rgba(17,30,55,.85),rgba(10,20,40,.9))',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 18,
  padding: '28px 30px',
  boxShadow: '0 8px 32px rgba(0,0,0,.35)',
};

const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 38px 10px 12px',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

type SmtpTestLog = {
  id: number;
  action: string;
  status: string | null;
  detail: string | null;
  actorId: number | null;
  actorName: string | null;
  targetUserEmail: string | null;
  emailSent: boolean | null;
  createdAt: string;
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'var(--gold)',
  dispatcher: 'var(--blue)',
  plant_operator: 'var(--green)',
  client: '#a78bfa',
  driver: '#f97316',
};

interface Lockout {
  key: string;
  count: number;
  lockedUntil: string;
  retryAfterMs: number;
}

function lockoutLabel(key: string): string {
  return key.startsWith('login:') ? key.slice('login:'.length) : key;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function PasswordInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function SmtpTextField({
  label: fieldLabel, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={label}>{fieldLabel}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, padding: '10px 12px' }}
        autoComplete="off"
      />
    </div>
  );
}

export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [testHistory, setTestHistory] = useState<SmtpTestLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [smtpSettings, setSmtpSettings] = useState<SmtpSettings | null>(null);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ host: '', port: '', user: '', from: '', pass: '' });
  const [smtpSaving, setSmtpSaving] = useState(false);

  const [lockouts, setLockouts] = useState<Lockout[]>([]);
  const [lockoutsLoading, setLockoutsLoading] = useState(false);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncedUserId, setSyncedUserId] = useState(user?.id);

  const isAdmin = user?.role === 'admin';

  // Populate the editable profile fields when the signed-in user loads/changes.
  // Done during render (React's documented adjust-on-change pattern) so it does
  // not require an effect that synchronously calls setState.
  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id);
    setProfileName(user.name);
    setProfileEmail(user.email);
  }

  // Bumping these counters re-runs the corresponding load effect (used by the
  // manual "Refresh" buttons) without calling a setState-heavy callback directly
  // from inside an effect.
  const [historyReload, setHistoryReload] = useState(0);
  const [lockoutsReload, setLockoutsReload] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const rows = await api.get<SmtpTestLog[]>('/admin/email-test/history');
        if (!cancelled) setTestHistory(rows);
      } catch {
        /* ignore — history is non-critical */
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [user?.role, historyReload]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let cancelled = false;
    async function loadSmtp() {
      setSmtpLoading(true);
      try {
        const s = await api.get<SmtpSettings>('/admin/smtp-settings');
        if (cancelled) return;
        setSmtpSettings(s);
        // Host and port are not sensitive, so prefill them for easy editing.
        setSmtpForm(f => ({ ...f, host: s.host || '', port: s.port || '' }));
      } catch {
        if (!cancelled) setSmtpSettings(null);
      } finally {
        if (!cancelled) setSmtpLoading(false);
      }
    }
    loadSmtp();
    return () => { cancelled = true; };
  }, [user?.role]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadLockouts() {
      setLockoutsLoading(true);
      try {
        const rows = await api.get<Lockout[]>('/admin/lockouts');
        if (!cancelled) setLockouts(rows);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLockoutsLoading(false);
      }
    }
    loadLockouts();
    return () => { cancelled = true; };
  }, [isAdmin, lockoutsReload]);

  // Tick every second so the remaining-time countdown stays live.
  useEffect(() => {
    if (!isAdmin || lockouts.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isAdmin, lockouts.length]);

  async function handleClearLockout(key: string) {
    setClearingKey(key);
    try {
      await api.post('/admin/lockouts/clear', { key });
      setLockouts(prev => prev.filter(l => l.key !== key));
      showToast('Lockout cleared.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear lockout';
      showToast(msg, 'error');
    } finally {
      setClearingKey(null);
    }
  }

  const roleColor = user ? (ROLE_COLOR[user.role] || 'var(--muted)') : 'var(--muted)';
  const roleLabel = user?.role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

  const profileDirty = profileName !== (user?.name || '') || profileEmail !== (user?.email || '');

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileName.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }
    if (!profileEmail.trim() || !profileEmail.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setProfileSaving(true);
    try {
      const { token, user: updated } = await api.put<{ token: string; user: User }>('/auth/me', {
        name: profileName.trim(),
        email: profileEmail.trim(),
      });
      updateUser(updated, token);
      showToast('Profile updated successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(msg, 'error');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSmtpSave(e: React.FormEvent) {
    e.preventDefault();
    const port = smtpForm.port.trim();
    if (port && !/^\d+$/.test(port)) {
      showToast('Port must be a number.', 'error');
      return;
    }
    const from = smtpForm.from.trim();
    if (from && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(from)) {
      showToast('From must be a valid email address.', 'error');
      return;
    }
    setSmtpSaving(true);
    try {
      // Contract: omitted field = keep current, empty string = clear (revert to
      // env), non-empty = set. Host/port are prefilled so we always send them
      // (clearing a prefilled field intentionally clears it). Username, From and
      // password are write-only and only sent when filled, so leaving them blank
      // keeps the stored value — matching the field placeholders.
      const body: Record<string, string> = {
        host: smtpForm.host.trim(),
        port,
      };
      if (smtpForm.user.trim()) body.user = smtpForm.user.trim();
      if (from) body.from = from;
      if (smtpForm.pass.trim()) body.pass = smtpForm.pass;
      const updated = await api.post<SmtpSettings>('/admin/smtp-settings', body);
      setSmtpSettings(updated);
      setSmtpForm(f => ({ ...f, host: updated.host || '', port: updated.port || '', user: '', from: '', pass: '' }));
      showToast('SMTP settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save SMTP settings';
      showToast(msg, 'error');
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      await api.post('/admin/email-test', {});
      setTestEmailResult({ ok: true, message: `Test email sent to ${user?.email}. Check your inbox.` });
      showToast('Test email sent successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send test email';
      setTestEmailResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setTestEmailSending(false);
      setHistoryReload(n => n + 1);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setSaving(true);
    setSuccess(false);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Account Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
          Manage your account details and security preferences.
        </p>
      </div>

      {/* Profile card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: `color-mix(in srgb, ${roleColor} 13%, transparent)`, border: `1.5px solid color-mix(in srgb, ${roleColor} 33%, transparent)`,
            display: 'grid', placeItems: 'center',
            fontSize: 20, fontWeight: 900, color: roleColor,
          }}>
            {user?.name?.[0] || '?'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{user?.email}</div>
            <div style={{
              display: 'inline-block', marginTop: 5,
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
              color: roleColor, background: `color-mix(in srgb, ${roleColor} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${roleColor} 20%, transparent)`, borderRadius: 999, padding: '2px 8px',
            }}>
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Appearance / theme card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
            display: 'grid', placeItems: 'center',
          }}>
            <Palette size={15} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Appearance</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Choose a colour theme — applies instantly across the app</div>
          </div>
        </div>
        <ThemeSwitcher />
      </div>

      {/* Edit profile card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.25)',
            display: 'grid', placeItems: 'center',
          }}>
            <UserIcon size={15} style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Edit Profile</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Update your display name and email address</div>
          </div>
        </div>

        <form onSubmit={handleProfileSave} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={label}>Display Name</label>
            <input
              type="text"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              placeholder="Your full name"
              style={{ ...inputStyle, padding: '10px 12px' }}
              autoComplete="name"
            />
          </div>
          <div>
            <label style={label}>Email Address</label>
            <input
              type="email"
              value={profileEmail}
              onChange={e => setProfileEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ ...inputStyle, padding: '10px 12px' }}
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={profileSaving || !profileDirty}
            style={{
              marginTop: 4, padding: '11px 22px', borderRadius: 10,
              background: profileSaving ? 'rgba(56,189,248,.4)' : 'linear-gradient(135deg,var(--blue),#0ea5e9)',
              border: 'none', cursor: (profileSaving || !profileDirty) ? 'not-allowed' : 'pointer',
              color: '#fff', fontWeight: 800, fontSize: 14,
              opacity: !profileDirty ? 0.5 : 1,
              transition: 'opacity .15s',
            }}
          >
            {profileSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* SMTP test card — admins only */}
      {user?.role === 'admin' && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)',
              display: 'grid', placeItems: 'center',
            }}>
              <Mail size={15} style={{ color: 'var(--green)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>SMTP Configuration</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Edit your mail server settings and run a connection test</div>
            </div>
          </div>

          {smtpLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleSmtpSave} style={{ marginBottom: 18 }}>
              {smtpSettings && (
                <div style={{
                  marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                  color: smtpSettings.configured ? 'var(--green)' : 'var(--gold)',
                  background: smtpSettings.configured ? 'rgba(34,197,94,.12)' : 'rgba(247,201,72,.12)',
                  border: `1px solid ${smtpSettings.configured ? 'rgba(34,197,94,.3)' : 'rgba(247,201,72,.3)'}`,
                }}>
                  {smtpSettings.configured ? 'Configured' : 'Incomplete (password missing)'}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Host"
                  value={smtpForm.host}
                  onChange={v => setSmtpForm(f => ({ ...f, host: v }))}
                  placeholder="smtp.example.com"
                />
                <SmtpTextField
                  label="Port"
                  value={smtpForm.port}
                  onChange={v => setSmtpForm(f => ({ ...f, port: v }))}
                  placeholder="587"
                />
                <SmtpTextField
                  label="Username"
                  value={smtpForm.user}
                  onChange={v => setSmtpForm(f => ({ ...f, user: v }))}
                  placeholder={smtpSettings?.user ? `${smtpSettings.user} — blank keeps` : 'smtp username'}
                />
                <SmtpTextField
                  label="From Address"
                  value={smtpForm.from}
                  onChange={v => setSmtpForm(f => ({ ...f, from: v }))}
                  placeholder={smtpSettings?.from ? `${smtpSettings.from} — blank keeps` : 'noreply@example.com'}
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <SmtpTextField
                    label="Password"
                    type="password"
                    value={smtpForm.pass}
                    onChange={v => setSmtpForm(f => ({ ...f, pass: v }))}
                    placeholder={smtpSettings?.configured ? 'Leave blank to keep current password' : 'smtp password'}
                  />
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Values are saved to the database and survive restarts. Host and port are saved
                as entered — clear them to fall back to the matching environment variable.
                Username, From and Password update only when you fill them in; leave them blank
                to keep the current values.
              </div>

              <button
                type="submit"
                disabled={smtpSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: smtpSaving ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                  border: 'none', cursor: smtpSaving ? 'not-allowed' : 'pointer',
                  color: '#fff', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {smtpSaving ? 'Saving…' : 'Save SMTP settings'}
              </button>
            </form>
          )}

          {testEmailResult && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 14px', borderRadius: 10,
              background: testEmailResult.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
              border: `1px solid ${testEmailResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
              color: testEmailResult.ok ? 'var(--green)' : 'var(--red)',
              fontSize: 13, fontWeight: 600,
            }}>
              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {testEmailResult.message}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testEmailSending}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', borderRadius: 10,
                background: testEmailSending ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                border: 'none', cursor: testEmailSending ? 'not-allowed' : 'pointer',
                color: '#fff', fontWeight: 700, fontSize: 14,
                transition: 'opacity .15s',
              }}
            >
              <Send size={14} />
              {testEmailSending ? 'Sending…' : 'Send test email'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Sends to <strong style={{ color: 'var(--text)' }}>{user?.email}</strong>
            </span>
          </div>

          {/* Test history */}
          <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <History size={14} color="#9fb0c7" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9fb0c7', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                Test History
              </span>
            </div>

            {historyLoading && testHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9fb0c7' }}>Loading…</div>
            ) : testHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9fb0c7' }}>No test attempts recorded yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {testHistory.map(log => {
                  const ok = log.status === 'success';
                  return (
                    <div key={log.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: 'rgba(255,255,255,.03)',
                      border: '1px solid rgba(255,255,255,.06)',
                    }}>
                      {ok
                        ? <CheckCircle size={15} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
                        : <XCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: ok ? '#22c55e' : '#ef4444' }}>
                            {ok ? 'Success' : 'Failed'}
                          </span>
                          <span style={{ fontSize: 11, color: '#9fb0c7' }}>
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.detail && (
                          <div style={{ fontSize: 11, color: '#9fb0c7', marginTop: 3, wordBreak: 'break-word' }}>
                            {log.detail}
                          </div>
                        )}
                        {log.actorName && (
                          <div style={{ fontSize: 11, color: '#6b7d96', marginTop: 2 }}>
                            by {log.actorName}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Login lockouts card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
              display: 'grid', placeItems: 'center',
            }}>
              <Lock size={15} style={{ color: 'var(--red)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Login Lockouts</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Accounts locked after too many failed sign-in attempts</div>
            </div>
            <button
              type="button"
              onClick={() => setLockoutsReload(n => n + 1)}
              disabled={lockoutsLoading}
              title="Refresh"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 9,
                background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                cursor: lockoutsLoading ? 'not-allowed' : 'pointer',
                color: 'var(--muted)', fontWeight: 700, fontSize: 12,
              }}
            >
              <RefreshCw size={13} style={{ animation: lockoutsLoading ? 'spin 1s linear infinite' : undefined }} />
              Refresh
            </button>
          </div>

          {lockouts.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)',
              color: 'var(--muted)', fontSize: 13, fontWeight: 600,
            }}>
              <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
              {lockoutsLoading ? 'Loading lockouts…' : 'No accounts are currently locked out.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {lockouts.map(l => {
                const remaining = new Date(l.lockedUntil).getTime() - now;
                const clearing = clearingKey === l.key;
                return (
                  <div
                    key={l.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.18)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {lockoutLabel(l.key)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                        {l.count} failed attempt{l.count !== 1 ? 's' : ''} · unlocks in{' '}
                        <strong style={{ color: 'var(--red)' }}>{formatRemaining(remaining)}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearLockout(l.key)}
                      disabled={clearing}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        padding: '8px 14px', borderRadius: 9,
                        background: clearing ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                        border: 'none', cursor: clearing ? 'not-allowed' : 'pointer',
                        color: '#fff', fontWeight: 700, fontSize: 12.5,
                      }}
                    >
                      <Unlock size={13} />
                      {clearing ? 'Clearing…' : 'Clear'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Change password card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'color-mix(in srgb, var(--gold) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)',
            display: 'grid', placeItems: 'center',
          }}>
            <KeyRound size={15} style={{ color: 'var(--gold)' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Change Password</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Requires your current password to confirm</div>
          </div>
        </div>

        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
            color: 'var(--green)', fontSize: 13, fontWeight: 600,
          }}>
            <CheckCircle size={15} />
            Password changed successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={label}>Current Password</label>
            <PasswordInput
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Enter your current password"
            />
          </div>
          <div>
            <label style={label}>New Password</label>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label style={label}>Confirm New Password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat new password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 5 }}>
                Passwords do not match
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            style={{
              marginTop: 4, padding: '11px 22px', borderRadius: 10,
              background: saving ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'linear-gradient(135deg,var(--gold),#e5a800)',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              color: '#111827', fontWeight: 800, fontSize: 14,
              opacity: (!currentPassword || !newPassword || !confirmPassword) ? 0.5 : 1,
              transition: 'opacity .15s',
            }}
          >
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
