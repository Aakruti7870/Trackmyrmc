import { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle, XCircle, User as UserIcon, Mail, Send, Palette, History, Lock, Unlock, RefreshCw, PlugZap, Target, Timer } from 'lucide-react';
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
  authority: '#e879f9',
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
  const [smtpVerifying, setSmtpVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [varianceForm, setVarianceForm] = useState({ abs: '', pct: '' });
  const [varianceDefaults, setVarianceDefaults] = useState({ abs: 0.1, pct: 0 });
  const [varianceLoading, setVarianceLoading] = useState(false);
  const [varianceSaving, setVarianceSaving] = useState(false);

  const [idleForm, setIdleForm] = useState({ freeMin: '', ratePerHour: '' });
  const [idleDefaults, setIdleDefaults] = useState<{ freeMin: number; ratePerHour: number | null }>({ freeMin: 45, ratePerHour: null });
  const [idleLoading, setIdleLoading] = useState(false);
  const [idleSaving, setIdleSaving] = useState(false);

  const [lockouts, setLockouts] = useState<Lockout[]>([]);
  const [lockoutsLoading, setLockoutsLoading] = useState(false);
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncedUserId, setSyncedUserId] = useState(user?.id);

  const isAdmin = user?.role === 'admin' || user?.role === 'authority';

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
    if (!isAdmin) return;
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
  }, [isAdmin, historyReload]);

  useEffect(() => {
    if (!isAdmin) return;
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
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadVariance() {
      setVarianceLoading(true);
      try {
        const v = await api.get<{ abs: number; pct: number }>('/admin/variance-tolerance');
        if (cancelled) return;
        setVarianceForm({ abs: String(v.abs), pct: String(v.pct) });
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setVarianceLoading(false);
      }
    }
    loadVariance();
    return () => { cancelled = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function loadIdle() {
      setIdleLoading(true);
      try {
        const v = await api.get<{ freeMin: number; ratePerHour: number | null; defaults: { freeMin: number; ratePerHour: number | null } }>('/admin/idle-settings');
        if (cancelled) return;
        setIdleForm({ freeMin: String(v.freeMin), ratePerHour: v.ratePerHour == null ? '' : String(v.ratePerHour) });
        if (v.defaults) setIdleDefaults(v.defaults);
      } catch {
        /* non-fatal — keep defaults */
      } finally {
        if (!cancelled) setIdleLoading(false);
      }
    }
    loadIdle();
    return () => { cancelled = true; };
  }, [isAdmin]);

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

  async function handleVerifyConnection() {
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
    setSmtpVerifying(true);
    setVerifyResult(null);
    try {
      // Mirror the save contract: host/port are sent as entered (blank falls
      // back to env on the server); username/from/password are only sent when
      // filled, so a blank password tests against the currently stored one.
      const body: Record<string, string> = {
        host: smtpForm.host.trim(),
        port,
      };
      if (smtpForm.user.trim()) body.user = smtpForm.user.trim();
      if (from) body.from = from;
      if (smtpForm.pass.trim()) body.pass = smtpForm.pass;
      await api.post('/admin/smtp-settings/verify', body);
      setVerifyResult({ ok: true, message: 'Connection successful — these settings can reach the mail server.' });
      showToast('SMTP connection verified.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not connect to the mail server.';
      setVerifyResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setSmtpVerifying(false);
      setHistoryReload(n => n + 1);
    }
  }

  async function handleVarianceSave(e: React.FormEvent) {
    e.preventDefault();
    const abs = varianceForm.abs.trim();
    const pct = varianceForm.pct.trim();
    if (abs && (!Number.isFinite(Number(abs)) || Number(abs) < 0)) {
      showToast('Tolerance must be a number of 0 or more.', 'error');
      return;
    }
    if (pct && (!Number.isFinite(Number(pct)) || Number(pct) < 0 || Number(pct) > 100)) {
      showToast('Percentage must be between 0 and 100.', 'error');
      return;
    }
    setVarianceSaving(true);
    try {
      // Empty string clears the value, reverting to the built-in default.
      const updated = await api.post<{ abs: number; pct: number; defaults: { abs: number; pct: number } }>(
        '/admin/variance-tolerance',
        { abs, pct },
      );
      setVarianceForm({ abs: String(updated.abs), pct: String(updated.pct) });
      if (updated.defaults) setVarianceDefaults(updated.defaults);
      showToast('Delivery tolerance saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save delivery tolerance';
      showToast(msg, 'error');
    } finally {
      setVarianceSaving(false);
    }
  }

  async function handleIdleSave(e: React.FormEvent) {
    e.preventDefault();
    const freeMin = idleForm.freeMin.trim();
    const ratePerHour = idleForm.ratePerHour.trim();
    if (freeMin && (!Number.isFinite(Number(freeMin)) || Number(freeMin) < 0)) {
      showToast('Free minutes must be a number of 0 or more.', 'error');
      return;
    }
    if (ratePerHour && (!Number.isFinite(Number(ratePerHour)) || Number(ratePerHour) < 0)) {
      showToast('Idle rate must be a number of 0 or more.', 'error');
      return;
    }
    setIdleSaving(true);
    try {
      // Empty string clears the value: freeMin reverts to the default, rate to none.
      const updated = await api.post<{ freeMin: number; ratePerHour: number | null; defaults: { freeMin: number; ratePerHour: number | null } }>(
        '/admin/idle-settings',
        { freeMin, ratePerHour },
      );
      setIdleForm({ freeMin: String(updated.freeMin), ratePerHour: updated.ratePerHour == null ? '' : String(updated.ratePerHour) });
      if (updated.defaults) setIdleDefaults(updated.defaults);
      showToast('Idle charge settings saved.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save idle settings';
      showToast(msg, 'error');
    } finally {
      setIdleSaving(false);
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
      {isAdmin && (
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

              {verifyResult && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14,
                  padding: '10px 14px', borderRadius: 10,
                  background: verifyResult.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                  border: `1px solid ${verifyResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
                  color: verifyResult.ok ? 'var(--green)' : 'var(--red)',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {verifyResult.ok
                    ? <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    : <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
                  {verifyResult.message}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
                <button
                  type="submit"
                  disabled={smtpSaving}
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    background: smtpSaving ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,var(--green),#16a34a)',
                    border: 'none', cursor: smtpSaving ? 'not-allowed' : 'pointer',
                    color: '#fff', fontWeight: 800, fontSize: 14,
                    transition: 'opacity .15s',
                  }}
                >
                  {smtpSaving ? 'Saving…' : 'Save SMTP settings'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifyConnection}
                  disabled={smtpVerifying}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '10px 22px', borderRadius: 10,
                    background: 'rgba(56,189,248,.12)',
                    border: '1px solid rgba(56,189,248,.4)',
                    cursor: smtpVerifying ? 'not-allowed' : 'pointer',
                    color: 'var(--blue)', fontWeight: 700, fontSize: 14,
                    transition: 'opacity .15s',
                  }}
                >
                  <PlugZap size={15} />
                  {smtpVerifying ? 'Testing…' : 'Test connection'}
                </button>
              </div>
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
                  const kindLabel = log.action === 'smtp_verify' ? 'Connection test' : 'Test email';
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
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
                            color: '#9fb0c7', padding: '2px 7px', borderRadius: 6,
                            background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                          }}>
                            {kindLabel}
                          </span>
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

      {/* Delivery variance tolerance card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Target size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Delivery Variance Tolerance</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>How far a delivery can deviate from the planned quantity before it's flagged</div>
            </div>
          </div>

          {varianceLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleVarianceSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Absolute (m³)"
                  type="number"
                  value={varianceForm.abs}
                  onChange={v => setVarianceForm(f => ({ ...f, abs: v }))}
                  placeholder={String(varianceDefaults.abs)}
                />
                <SmtpTextField
                  label="Percentage (%)"
                  type="number"
                  value={varianceForm.pct}
                  onChange={v => setVarianceForm(f => ({ ...f, pct: v }))}
                  placeholder={String(varianceDefaults.pct)}
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                A delivery is treated as <strong style={{ color: 'var(--text)' }}>on target</strong> when its
                shortfall or excess is within the larger of these two bands. The percentage is taken against the
                planned load, so a 5% band tolerates ±0.5 m³ on a 10 m³ load. Set percentage to 0 to use the
                absolute band only. Clear a field to fall back to the default
                ({varianceDefaults.abs} m³ / {varianceDefaults.pct}%).
              </div>

              <button
                type="submit"
                disabled={varianceSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: varianceSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: varianceSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {varianceSaving ? 'Saving…' : 'Save tolerance'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Trip idle-charge settings card — admins only */}
      {isAdmin && (
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'color-mix(in srgb, var(--gold) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 27%, transparent)',
              display: 'grid', placeItems: 'center',
            }}>
              <Timer size={15} style={{ color: 'var(--gold)' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Trip Idle Charges</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Free waiting time after a truck arrives at site, and the optional charge for idle time beyond it</div>
            </div>
          </div>

          {idleLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading settings…</div>
          ) : (
            <form onSubmit={handleIdleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SmtpTextField
                  label="Free window (minutes)"
                  type="number"
                  value={idleForm.freeMin}
                  onChange={v => setIdleForm(f => ({ ...f, freeMin: v }))}
                  placeholder={String(idleDefaults.freeMin)}
                />
                <SmtpTextField
                  label="Idle rate (₹ / hour)"
                  type="number"
                  value={idleForm.ratePerHour}
                  onChange={v => setIdleForm(f => ({ ...f, ratePerHour: v }))}
                  placeholder="No charge"
                />
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                A truck's time at site is measured from <strong style={{ color: 'var(--text)' }}>site arrival</strong> to
                <strong style={{ color: 'var(--text)' }}> site release</strong>. The first {idleForm.freeMin || idleDefaults.freeMin} minutes
                are free; anything beyond is billable idle. Set an idle rate to also compute a charge
                (billable idle ÷ 60 × rate). Clear the free window to fall back to the default
                ({idleDefaults.freeMin} min). Leave the rate blank to track idle time without a money figure.
              </div>

              <button
                type="submit"
                disabled={idleSaving}
                style={{
                  marginTop: 14, padding: '10px 22px', borderRadius: 10,
                  background: idleSaving ? 'color-mix(in srgb, var(--gold) 45%, transparent)' : 'linear-gradient(135deg,var(--gold),var(--gold-dark))',
                  border: 'none', cursor: idleSaving ? 'not-allowed' : 'pointer',
                  color: '#111', fontWeight: 800, fontSize: 14,
                  transition: 'opacity .15s',
                }}
              >
                {idleSaving ? 'Saving…' : 'Save idle settings'}
              </button>
            </form>
          )}
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
