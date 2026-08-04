import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, CheckCircle2, ShieldCheck, UserX, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const APP_NAME = 'CONCRETE KING';
const PLATFORM_NAME = 'TrackMyRMC';
const PACKAGE_ID = 'com.trackmyrmc.concreteking';
const OPERATOR = 'GOLD-e Tech';

// ── Fixed light-mode palette (public page — must render correctly regardless of
// the app's day/night auto-theme so users can always reach the deletion flow) ──
const C = {
  bg:     '#f4f8f7',
  panel:  '#ffffff',
  text:   '#172033',
  muted:  '#526078',
  line:   '#dce4e8',
  teal:   '#08785f',
  red:    '#ef4444',
  chip:   '#e8f2f0',
} as const;

// ── Shared step indicator ────────────────────────────────────────────────────
function StepNum({ n }: { n: number }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%',
      background: C.red, color: '#fff',
      fontWeight: 900, fontSize: 13,
      display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2,
    }}>{n}</div>
  );
}

// ── Phone-based deletion (works without login) ───────────────────────────────
function PhoneDeleteFlow() {
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
  const [otp, setOtp] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [otpInfo, setOtpInfo] = useState('');

  const canDelete = otp.length === 6 && /^\d{6}$/.test(otp) && confirm === 'DELETE';

  async function sendOtp() {
    if (!phone.trim()) { setPhoneError('Enter your registered mobile number.'); return; }
    setPhoneError('');
    setBusy(true);
    setOtpInfo('');
    try {
      const res = await api.post<{ devCode?: string }>('/account-deletion-requests/phone-otp', { phone: phone.trim() });
      setStep('otp');
      setOtpInfo('Code sent — check WhatsApp or SMS.');
      if (res.devCode) setOtp(res.devCode);
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : 'Could not send code. Check your number and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setBusy(true);
    setDeleteError('');
    try {
      await api.post('/account-deletion-requests/phone-complete', { phone: phone.trim(), otp, confirmed: true as const });
      setStep('done');
      try { localStorage.clear(); } catch { /* ignore storage errors */ }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Deletion failed. Please try again.');
      setBusy(false);
    }
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(34,197,94,.07)', borderRadius: 16 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Account deleted</div>
        <p style={{ color: C.muted, fontSize: 14, marginTop: 10 }}>
          Your Concrete King account and eligible personal data have been permanently removed.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Step 1 — Phone */}
      <div style={{ display: 'flex', gap: 14 }}>
        <StepNum n={1} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Registered mobile number</div>
          <input
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
            placeholder="+91 98765 43210"
            disabled={step === 'otp' && !busy}
            style={{
              width: '100%', padding: '13px 15px', borderRadius: 10,
              border: `1.5px solid ${phoneError ? C.red : C.line}`,
              background: C.panel, color: C.text, fontSize: 16,
              opacity: step === 'otp' ? 0.7 : 1,
            }}
          />
          {phoneError && (
            <p style={{ color: C.red, fontSize: 13, marginTop: 6 }}>{phoneError}</p>
          )}
          <button
            type="button"
            onClick={() => void sendOtp()}
            disabled={busy}
            style={{
              marginTop: 10, padding: '12px 20px', borderRadius: 10,
              border: `1.5px solid ${C.line}`, background: C.panel,
              color: C.text, fontWeight: 700, fontSize: 14,
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
            }}
          >
            {busy && step === 'phone' ? 'Sending…' : step === 'otp' ? 'Resend code' : 'Send verification code'}
          </button>
          {otpInfo && step === 'otp' && (
            <p style={{ marginTop: 8, fontSize: 13, color: '#176b36', background: 'rgba(34,197,94,.09)', padding: '8px 12px', borderRadius: 8 }}>
              {otpInfo}
            </p>
          )}
        </div>
      </div>

      {/* Step 2 — OTP */}
      {step === 'otp' && (
        <div style={{ display: 'flex', gap: 14 }}>
          <StepNum n={2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>6-digit verification code</div>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>Sent to your registered number via WhatsApp or SMS.</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="——————"
              style={{
                padding: '13px 16px', borderRadius: 10,
                border: `1.5px solid ${C.line}`, background: C.panel,
                color: C.text, fontSize: 26, fontWeight: 800, letterSpacing: 8,
                width: '100%', maxWidth: 200, display: 'block', textAlign: 'center',
              }}
            />
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 'otp' && (
        <div style={{ display: 'flex', gap: 14 }}>
          <StepNum n={3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              Type <strong style={{ color: C.red }}>DELETE</strong> to confirm
            </div>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>This cannot be undone.</p>
            <input
              type="text"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="DELETE"
              style={{
                padding: '13px 16px', borderRadius: 10,
                border: `1.5px solid ${confirm === 'DELETE' ? 'rgba(239,68,68,.5)' : C.line}`,
                background: C.panel, color: C.text,
                fontSize: 16, fontWeight: 800, letterSpacing: 3,
                width: '100%', maxWidth: 200, display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {/* Delete button */}
      {step === 'otp' && (
        <>
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={!canDelete || busy}
            style={{
              width: '100%', minHeight: 52, border: 0, borderRadius: 12,
              background: canDelete && !busy ? C.red : 'rgba(239,68,68,.25)',
              color: '#fff', fontWeight: 900, fontSize: 15,
              cursor: canDelete && !busy ? 'pointer' : 'not-allowed',
              transition: 'background .2s',
            }}
          >
            {busy ? 'Deleting…' : 'DELETE MY ACCOUNT PERMANENTLY'}
          </button>
          {deleteError && (
            <p style={{ fontSize: 13, color: C.red, background: 'rgba(239,68,68,.06)', padding: '10px 14px', borderRadius: 8, marginTop: -10 }}>
              {deleteError}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Logged-in client — auth-based OTP (uses existing /otp + /complete) ───────
function AuthDeleteFlow() {
  const { user, logout } = useAuth();
  const [, setLoc] = useLocation();
  const [step, setStep] = useState<'idle' | 'otp' | 'done'>('idle');
  const [otp, setOtp] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const canDelete = otp.length === 6 && /^\d{6}$/.test(otp) && confirm === 'DELETE';

  async function sendOtp() {
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api.post<{ devCode?: string }>('/account-deletion-requests/otp', {});
      setStep('otp');
      setInfo('Code sent to your registered mobile number.');
      if (res.devCode) setOtp(res.devCode);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send code.'); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setBusy(true); setError('');
    try {
      await api.post('/account-deletion-requests/complete', { otp, confirmed: true as const });
      setStep('done');
      setTimeout(() => { logout(); setLoc('/login?accountDeleted=1'); }, 3000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Deletion failed.'); setBusy(false); }
  }

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center', padding: '28px 20px', background: 'rgba(34,197,94,.07)', borderRadius: 14 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
        <div style={{ fontWeight: 800 }}>Account deleted — signing you out…</div>
      </div>
    );
  }

  return (
    <div style={{ border: '1.5px solid rgba(239,68,68,.2)', borderRadius: 14, padding: '20px 22px', background: 'rgba(239,68,68,.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={18} color={C.red} />
        <span style={{ fontWeight: 800, color: C.red }}>Delete My Account</span>
      </div>
      <div style={{ fontSize: 13, background: 'rgba(8,120,95,.08)', border: '1px solid rgba(8,120,95,.2)', borderRadius: 8, padding: '7px 12px', color: C.teal, fontWeight: 700, marginBottom: 14, display: 'inline-block' }}>
        ✓ Signed in as {user?.name}
      </div>
      <p style={{ color: C.muted, fontSize: 14, marginBottom: 18 }}>
        Permanently deletes your account and personal data. <strong style={{ color: C.red }}>Cannot be undone.</strong>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <StepNum n={1} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Verify your identity</div>
            <button type="button" onClick={() => void sendOtp()} disabled={busy}
              style={{ padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${C.line}`, background: C.panel, color: C.text, fontWeight: 700, fontSize: 13, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}>
              {step === 'otp' ? 'Resend code' : busy ? 'Sending…' : 'Send verification code'}
            </button>
            {info && <p style={{ fontSize: 13, color: '#176b36', marginTop: 8 }}>{info}</p>}
          </div>
        </div>

        {step === 'otp' && <>
          <div style={{ display: 'flex', gap: 12 }}>
            <StepNum n={2} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>6-digit code</div>
              <input type="text" inputMode="numeric" maxLength={6} value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${C.line}`, background: C.panel, color: C.text, fontSize: 22, fontWeight: 800, letterSpacing: 6, width: 160, display: 'block', textAlign: 'center' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <StepNum n={3} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Type DELETE to confirm</div>
              <input type="text" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE"
                style={{ padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${confirm === 'DELETE' ? 'rgba(239,68,68,.5)' : C.line}`, background: C.panel, color: C.text, fontSize: 15, fontWeight: 800, letterSpacing: 3, width: 180, display: 'block' }} />
            </div>
          </div>
          <button type="button" onClick={() => void deleteAccount()} disabled={!canDelete || busy}
            style={{ width: '100%', minHeight: 48, border: 0, borderRadius: 12, background: canDelete && !busy ? C.red : 'rgba(239,68,68,.25)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: canDelete && !busy ? 'pointer' : 'not-allowed' }}>
            {busy ? 'Deleting…' : 'DELETE MY ACCOUNT PERMANENTLY'}
          </button>
        </>}

        {error && <p style={{ fontSize: 13, color: C.red, background: 'rgba(239,68,68,.06)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeleteAccount() {
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const isLoggedInClient = !!user && user.role === 'client';

  useEffect(() => {
    const prev = document.title;
    document.title = `${APP_NAME} – Account Deletion`;
    return () => { document.title = prev; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '0 20px 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 0', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 20 }}>
              <span style={{ color: C.text }}>CONCRETE </span>
              <span style={{ color: C.teal }}>KING</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginTop: 5, textTransform: 'uppercase' }}>
              TrackMyRMC · Powered by GOLD-e Tech
            </div>
          </div>
          <button type="button" onClick={() => setLoc('/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: C.chip, border: `1px solid ${C.line}`, color: C.muted, padding: '9px 16px', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>
            <ArrowLeft size={16} /> Back to home
          </button>
        </header>

        <main>
          {/* Title card */}
          <div style={{ padding: '28px 30px', borderRadius: 20, background: C.panel, border: `1px solid ${C.line}`, boxShadow: '0 24px 60px -30px rgba(0,0,0,.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <UserX size={26} color={C.teal} />
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Account Deletion</h1>
            </div>
            <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, margin: 0 }}>
              {isLoggedInClient
                ? 'You are signed in. Delete your account and personal data directly — no staff review needed.'
                : 'Enter your registered mobile number below. We\'ll send a one-time code to verify your identity before permanently deleting your account.'}
            </p>
          </div>

          {/* App identity strip */}
          <div style={{ marginTop: 16, padding: '14px 20px', borderRadius: 14, background: C.panel, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={16} color={C.teal} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.muted }}>
              <strong style={{ color: C.text }}>{APP_NAME}</strong> · {PLATFORM_NAME} · {PACKAGE_ID} · {OPERATOR}
            </span>
          </div>

          {/* Deletion flow */}
          <div style={{ marginTop: 24, padding: '28px', borderRadius: 18, background: C.panel, border: `1px solid ${C.line}` }}>
            {isLoggedInClient ? <AuthDeleteFlow /> : <PhoneDeleteFlow />}
          </div>

          {/* Info sections */}
          {[
            ['What gets deleted', 'Account login, profile, mobile number, email, saved addresses, authentication credentials, sessions, and all personal data linked to your account.'],
            ['What may be retained', 'Delivery records, challans, invoices, tax and payment records, and audit logs required by law. Personal data is stripped from those records and deleted once the retention period ends.'],
            ["Can't access your number?", `Email support@goldetech.com from your registered email with your mobile number and we'll verify and process the request within 7 working days.`],
          ].map(([title, text]) => (
            <section key={title} style={{ marginTop: 28 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>{text}</p>
            </section>
          ))}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 28, padding: '14px 16px', borderRadius: 12, background: C.panel, border: `1px solid ${C.line}` }}>
            <CheckCircle2 size={17} color={C.teal} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
              This page is publicly accessible without signing in and is intended for the Google Play Data safety account-deletion URL field. See the <a href="/privacy" style={{ color: C.teal }}>Privacy Policy</a>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
