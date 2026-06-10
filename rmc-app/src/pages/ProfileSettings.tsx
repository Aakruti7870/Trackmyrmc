import { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle, User as UserIcon, Mail, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { User } from '@/lib/api';

const card: React.CSSProperties = {
  background: 'linear-gradient(135deg,rgba(17,30,55,.85),rgba(10,20,40,.9))',
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 18,
  padding: '28px 30px',
  boxShadow: '0 8px 32px rgba(0,0,0,.35)',
};

const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: '#9fb0c7', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 38px 10px 12px',
  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
  borderRadius: 10, color: '#eef5ff', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};

const ROLE_COLOR: Record<string, string> = {
  admin: '#f7c948',
  dispatcher: '#38bdf8',
  plant_operator: '#22c55e',
  client: '#a78bfa',
  driver: '#f97316',
};

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
          background: 'none', border: 'none', cursor: 'pointer', color: '#9fb0c7', padding: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
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

  useEffect(() => {
    if (user) {
      setProfileName(user.name);
      setProfileEmail(user.email);
    }
  }, [user]);

  const roleColor = user ? (ROLE_COLOR[user.role] || '#9fb0c7') : '#9fb0c7';
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
      const updated = await api.put<User>('/auth/me', {
        name: profileName.trim(),
        email: profileEmail.trim(),
      });
      updateUser(updated);
      showToast('Profile updated successfully.', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(msg, 'error');
    } finally {
      setProfileSaving(false);
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
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#eef5ff', margin: 0 }}>
          Account Settings
        </h1>
        <p style={{ fontSize: 13, color: '#9fb0c7', marginTop: 4 }}>
          Manage your account details and security preferences.
        </p>
      </div>

      {/* Profile card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: roleColor + '22', border: `1.5px solid ${roleColor}55`,
            display: 'grid', placeItems: 'center',
            fontSize: 20, fontWeight: 900, color: roleColor,
          }}>
            {user?.name?.[0] || '?'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#eef5ff' }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: '#9fb0c7', marginTop: 2 }}>{user?.email}</div>
            <div style={{
              display: 'inline-block', marginTop: 5,
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px',
              color: roleColor, background: roleColor + '18',
              border: `1px solid ${roleColor}33`, borderRadius: 999, padding: '2px 8px',
            }}>
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Edit profile card */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.25)',
            display: 'grid', placeItems: 'center',
          }}>
            <UserIcon size={15} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#eef5ff' }}>Edit Profile</div>
            <div style={{ fontSize: 11, color: '#9fb0c7' }}>Update your display name and email address</div>
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
              background: profileSaving ? 'rgba(56,189,248,.4)' : 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
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
              <Mail size={15} color="#22c55e" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#eef5ff' }}>SMTP Configuration</div>
              <div style={{ fontSize: 11, color: '#9fb0c7' }}>Send a test email to verify your SMTP settings are working</div>
            </div>
          </div>

          {testEmailResult && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 14px', borderRadius: 10,
              background: testEmailResult.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
              border: `1px solid ${testEmailResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
              color: testEmailResult.ok ? '#22c55e' : '#ef4444',
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
                background: testEmailSending ? 'rgba(34,197,94,.35)' : 'linear-gradient(135deg,#22c55e,#16a34a)',
                border: 'none', cursor: testEmailSending ? 'not-allowed' : 'pointer',
                color: '#fff', fontWeight: 700, fontSize: 14,
                transition: 'opacity .15s',
              }}
            >
              <Send size={14} />
              {testEmailSending ? 'Sending…' : 'Send test email'}
            </button>
            <span style={{ fontSize: 12, color: '#9fb0c7' }}>
              Sends to <strong style={{ color: '#eef5ff' }}>{user?.email}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Change password card */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(247,201,72,.12)', border: '1px solid rgba(247,201,72,.25)',
            display: 'grid', placeItems: 'center',
          }}>
            <KeyRound size={15} color="#f7c948" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#eef5ff' }}>Change Password</div>
            <div style={{ fontSize: 11, color: '#9fb0c7' }}>Requires your current password to confirm</div>
          </div>
        </div>

        {success && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
            color: '#22c55e', fontSize: 13, fontWeight: 600,
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
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 5 }}>
                Passwords do not match
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            style={{
              marginTop: 4, padding: '11px 22px', borderRadius: 10,
              background: saving ? 'rgba(247,201,72,.4)' : 'linear-gradient(135deg,#f7c948,#e5a800)',
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
