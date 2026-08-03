import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, UserX, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const APP_NAME = 'CONCRETE KING';
const PLATFORM_NAME = 'TrackMyRMC';
const PACKAGE_ID = 'com.trackmyrmc.concreteking';
const OPERATOR = 'GOLD-e Tech';
const MAIL = 'support@goldetech.com';
const PHONE = '+91 74982 86760';

const deletionEmailSubject = `${APP_NAME} Account Deletion Request`;
const deletionEmailBody = [
  `I request deletion of my ${APP_NAME} / ${PLATFORM_NAME} account and associated personal data.`,
  '',
  'Full name:',
  'Registered mobile number:',
  'Registered email address (if applicable):',
  'Reason (optional):',
  '',
  `Google Play app: ${APP_NAME}`,
  `Package ID: ${PACKAGE_ID}`,
].join('\n');

const deletionMailto = `mailto:${MAIL}?subject=${encodeURIComponent(deletionEmailSubject)}&body=${encodeURIComponent(deletionEmailBody)}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px', letterSpacing: 0.2 }}>
        {title}
      </h2>
      <div style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(130px, 0.8fr) minmax(0, 1.5fr)',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--line)',
    }}>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
      <strong style={{ color: 'var(--text)', fontSize: 13, overflowWrap: 'anywhere' }}>{value}</strong>
    </div>
  );
}

// ── Self-deletion widget for logged-in customers ──────────────────────────────
function SelfDeleteSection() {
  const { user, logout } = useAuth();
  const [, setLoc] = useLocation();

  const [step, setStep] = useState<'idle' | 'otp-sent' | 'deleted'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function sendOtp() {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await api.post<{ devCode?: string }>('/account-deletion-requests/otp', {});
      setStep('otp-sent');
      setInfo('Verification code sent to your registered mobile number.');
      if (res.devCode) setOtpCode(res.devCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (otpCode.length !== 6 || confirmText !== 'DELETE') return;
    setBusy(true);
    setError('');
    try {
      await api.post('/account-deletion-requests/complete', { otp: otpCode, confirmed: true as const });
      setStep('deleted');
      setTimeout(() => {
        logout();
        setLoc('/login?accountDeleted=1');
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion failed. Please try again.');
      setBusy(false);
    }
  }

  const canDelete = otpCode.length === 6 && /^\d{6}$/.test(otpCode) && confirmText === 'DELETE';

  if (step === 'deleted') {
    return (
      <div style={{
        background: 'rgba(34,197,94,.08)',
        border: '1.5px solid rgba(34,197,94,.3)',
        borderRadius: 16,
        padding: '28px 24px',
        textAlign: 'center',
        marginBottom: 28,
      }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Account deleted</div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>
          Your Concrete King account and eligible personal data have been permanently removed.
          Signing you out…
        </p>
      </div>
    );
  }

  return (
    <div style={{
      border: '2px solid rgba(239,68,68,.25)',
      borderRadius: 16,
      padding: '22px 24px',
      background: 'rgba(239,68,68,.03)',
      marginBottom: 28,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <AlertTriangle size={22} color="var(--red, #ef4444)" />
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--red, #ef4444)' }}>
          Delete My Account
        </span>
      </div>

      {/* Signed-in-as badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(8,120,95,.08)',
        border: '1px solid rgba(8,120,95,.25)',
        borderRadius: 8,
        padding: '7px 13px',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--teal, #08785f)',
        marginBottom: 14,
      }}>
        ✓ Signed in as {user?.name}{user?.phone ? ` · ${user.phone}` : ''}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
        This will <strong style={{ color: 'var(--text)' }}>permanently delete</strong> your Concrete King customer account
        and all personal data. Orders and invoices required by law may be retained.{' '}
        <strong style={{ color: 'var(--red, #ef4444)' }}>This cannot be undone.</strong>
      </p>

      {/* Step 1 — Send OTP */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--red, #ef4444)', color: '#fff',
          fontWeight: 900, fontSize: 13,
          display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2,
        }}>1</div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 15 }}>Verify your identity</strong>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 10px' }}>
            We'll send a 6-digit code to your registered mobile number.
          </p>
          <button
            type="button"
            onClick={() => void sendOtp()}
            disabled={busy}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1.5px solid var(--line)',
              background: 'var(--panel)',
              color: 'var(--text)',
              fontWeight: 700,
              fontSize: 14,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {step === 'otp-sent' ? 'Resend code' : busy ? 'Sending…' : 'Send verification code'}
          </button>
          {info && (
            <p style={{ fontSize: 13, color: '#176b36', background: 'rgba(34,197,94,.08)', padding: '8px 12px', borderRadius: 8, marginTop: 10 }}>
              {info}
            </p>
          )}
        </div>
      </div>

      {/* Step 2 — Enter OTP */}
      {step === 'otp-sent' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--red, #ef4444)', color: '#fff',
            fontWeight: 900, fontSize: 13,
            display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2,
          }}>2</div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 15 }}>Enter 6-digit code</strong>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                marginTop: 8,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1.5px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 6,
                width: '100%',
                maxWidth: 180,
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {/* Step 3 — Type DELETE */}
      {step === 'otp-sent' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--red, #ef4444)', color: '#fff',
            fontWeight: 900, fontSize: 13,
            display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2,
          }}>3</div>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 15 }}>Confirm deletion</strong>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '4px 0 8px' }}>
              Type <strong>DELETE</strong> in capitals to confirm.
            </p>
            <input
              type="text"
              placeholder="DELETE"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: `1.5px solid ${confirmText === 'DELETE' ? 'rgba(239,68,68,.5)' : 'var(--line)'}`,
                background: 'var(--panel)',
                color: 'var(--text)',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 2,
                width: '100%',
                maxWidth: 200,
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {/* Delete button */}
      {step === 'otp-sent' && (
        <button
          type="button"
          onClick={() => void deleteAccount()}
          disabled={!canDelete || busy}
          style={{
            width: '100%',
            minHeight: 50,
            border: 0,
            borderRadius: 12,
            background: canDelete && !busy ? 'var(--red, #ef4444)' : 'rgba(239,68,68,.25)',
            color: '#fff',
            fontWeight: 900,
            fontSize: 15,
            cursor: canDelete && !busy ? 'pointer' : 'not-allowed',
            marginTop: 4,
            transition: 'background .2s',
          }}
        >
          {busy ? 'Deleting…' : 'DELETE MY ACCOUNT PERMANENTLY'}
        </button>
      )}

      {error && (
        <p style={{
          marginTop: 12, fontSize: 13, color: 'var(--red, #ef4444)',
          background: 'rgba(239,68,68,.06)', padding: '10px 14px', borderRadius: 8,
        }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
// Public account-deletion page used in the Google Play Data safety form.
// It must remain accessible without login and must explicitly identify the
// Google Play listing, app package, deletion method, and retained-data policy.
export default function DeleteAccount() {
  const { user } = useAuth();
  const [, setLoc] = useLocation();
  const isLoggedInClient = !!user && user.role === 'client';

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${APP_NAME} – Account Deletion`;
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '0 20px 80px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '26px 0', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 20 }}>
              <span style={{ color: 'var(--text)' }}>CONCRETE </span>
              <span style={{ color: 'var(--gold, #178a6e)' }}>KING</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted, #8aa0bd)', letterSpacing: 1.5, marginTop: 5, textTransform: 'uppercase' }}>
              TrackMyRMC account services · Powered by GOLD-e Tech
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLoc('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--chip-bg)', border: '1px solid var(--line)',
              color: 'var(--muted)', padding: '9px 16px', borderRadius: 10,
              fontSize: 14, cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </header>

        <main>
          {/* Title card */}
          <div style={{
            marginTop: 14, padding: '30px', borderRadius: 20,
            background: 'var(--panel)', border: '1px solid var(--line)',
            boxShadow: '0 30px 70px -40px rgba(0,0,0,.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserX size={28} color="var(--gold, #178a6e)" />
              <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: 0.2 }}>
                Account Deletion
              </h1>
            </div>
            <p style={{ color: 'var(--muted, #8aa0bd)', fontSize: 15, lineHeight: 1.7, marginTop: 14, marginBottom: 0 }}>
              This is the official account-deletion page for the Android application published on
              Google Play as <strong style={{ color: 'var(--text)' }}>{APP_NAME}</strong>. The app uses
              the <strong style={{ color: 'var(--text)' }}>{PLATFORM_NAME}</strong> platform and is
              operated by <strong style={{ color: 'var(--text)' }}>{OPERATOR}</strong>.
            </p>
          </div>

          {/* App identity */}
          <div style={{ marginTop: 22, padding: '20px 24px', borderRadius: 16, background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <ShieldCheck size={19} color="var(--gold, #178a6e)" />
              <strong style={{ fontSize: 15 }}>Application identity</strong>
            </div>
            <IdentityRow label="Google Play app name" value={APP_NAME} />
            <IdentityRow label="Platform name" value={PLATFORM_NAME} />
            <IdentityRow label="Android package ID" value={PACKAGE_ID} />
            <IdentityRow label="Operator" value={OPERATOR} />
          </div>

          {/* ── Self-delete (logged-in client) or info + email (not logged in) ── */}
          <div style={{ marginTop: 28 }}>
            {isLoggedInClient ? (
              /* Logged-in customer — inline OTP-verified deletion */
              <SelfDeleteSection />
            ) : (
              /* Not logged in — describe options */
              <>
                <Section title="Option 1 — Delete directly inside the app">
                  <ol style={{ margin: 0, paddingLeft: 22 }}>
                    <li>Sign in to the {APP_NAME} app or at <a href="/login">trackmyrmc.com</a>.</li>
                    <li>Open the menu and go to <strong style={{ color: 'var(--text)' }}>Account Settings</strong>.</li>
                    <li>Scroll to the <strong style={{ color: 'var(--red, #ef4444)' }}>Danger Zone</strong>.</li>
                    <li>
                      Tap <strong style={{ color: 'var(--text)' }}>Delete my account…</strong>, enter the OTP sent to your
                      mobile, type <strong>DELETE</strong>, and confirm.
                    </li>
                  </ol>
                  <p style={{ marginTop: 12, marginBottom: 0 }}>
                    After confirmation, the account is signed out immediately and cannot be used again.
                  </p>
                </Section>

                <Section title="Option 2 — Request deletion by email">
                  <p style={{ marginTop: 0 }}>
                    Users who cannot access the app can request deletion through the official support email.
                    Submit from the registered email address where possible and include the registered mobile
                    number so ownership can be verified.
                  </p>
                  <a
                    href={deletionMailto}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      gap: 9, minHeight: 46, padding: '0 18px', borderRadius: 12,
                      background: 'var(--gold, #178a6e)', color: '#fff',
                      fontWeight: 800, fontSize: 14, textDecoration: 'none',
                    }}
                  >
                    <Mail size={18} /> Request account deletion by email
                  </a>
                  <p style={{ marginTop: 14, marginBottom: 0 }}>
                    Email: <a href={`mailto:${MAIL}`} style={{ color: 'var(--gold, #178a6e)' }}>{MAIL}</a>
                    <br />
                    Phone: <a href={`tel:${PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--gold, #178a6e)' }}>{PHONE}</a>
                  </p>
                </Section>
              </>
            )}
          </div>

          {/* Data details — always visible */}
          <Section title="Information required for a deletion request">
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li>Full name</li>
              <li>Registered mobile number</li>
              <li>Registered email address, if applicable</li>
              <li>OTP verification (if deleting directly in the app)</li>
            </ul>
          </Section>

          <Section title="Data that is deleted">
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li>Account login access is disabled immediately.</li>
              <li>Profile and personal data are removed from active use.</li>
              <li>Personal data not legally required is deleted or anonymised.</li>
            </ul>
          </Section>

          <Section title="Data that may be retained">
            <p style={{ marginTop: 0 }}>
              Limited business and transaction records related to completed orders — such as delivery
              challans, invoices, tax records, payment ledgers, security logs, and audit records — may be
              retained where required for legal, tax, fraud-prevention, dispute-resolution, or regulatory
              obligations. Retained records are protected and deleted or anonymised when the applicable
              retention requirement ends.
            </p>
            <p style={{ marginBottom: 0 }}>
              See the <a href="/privacy" style={{ color: 'var(--gold, #178a6e)' }}>Privacy Policy</a> for
              additional information.
            </p>
          </Section>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 34,
            padding: '16px 18px', borderRadius: 14,
            background: 'var(--panel)', border: '1px solid var(--line)',
          }}>
            <CheckCircle2 size={19} color="var(--gold, #178a6e)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.6 }}>
              This page is publicly accessible without signing in and is intended for the Google Play
              Data safety account-deletion URL field.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
