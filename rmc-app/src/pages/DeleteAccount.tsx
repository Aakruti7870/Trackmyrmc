import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck, UserX } from 'lucide-react';

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
      <h2 style={{
        fontSize: 19,
        fontWeight: 700,
        color: 'var(--text)',
        margin: '0 0 12px',
        letterSpacing: 0.2,
      }}>
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

// Public account-deletion page used in the Google Play Data safety form.
// It must remain accessible without login and must explicitly identify the
// Google Play listing, app package, deletion method, and retained-data policy.
export default function DeleteAccount() {
  const [, setLoc] = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${APP_NAME} – Account Deletion Request`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      padding: '0 20px 80px',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '26px 0',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.6, fontSize: 20 }}>
              <span style={{ color: 'var(--text)' }}>CONCRETE </span>
              <span style={{ color: 'var(--gold, #178a6e)' }}>KING</span>
            </div>
            <div style={{
              fontSize: 10,
              color: 'var(--muted, #8aa0bd)',
              letterSpacing: 1.5,
              marginTop: 5,
              textTransform: 'uppercase',
            }}>
              TrackMyRMC account services · Powered by GOLD-e Tech
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLoc('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--chip-bg)',
              border: '1px solid var(--line)',
              color: 'var(--muted)',
              padding: '9px 16px',
              borderRadius: 10,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </header>

        <main>
          <div style={{
            marginTop: 14,
            padding: '30px',
            borderRadius: 20,
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            boxShadow: '0 30px 70px -40px rgba(0,0,0,.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserX size={28} color="var(--gold, #178a6e)" />
              <h1 style={{
                fontSize: 30,
                fontWeight: 800,
                margin: 0,
                color: 'var(--text)',
                letterSpacing: 0.2,
              }}>
                CONCRETE KING – Account Deletion Request
              </h1>
            </div>
            <p style={{
              color: 'var(--muted, #8aa0bd)',
              fontSize: 15,
              lineHeight: 1.7,
              marginTop: 14,
              marginBottom: 0,
            }}>
              This is the official account-deletion page for the Android application published on
              Google Play as <strong style={{ color: 'var(--text)' }}>{APP_NAME}</strong>. The app uses
              the <strong style={{ color: 'var(--text)' }}>{PLATFORM_NAME}</strong> platform and is
              operated by <strong style={{ color: 'var(--text)' }}>{OPERATOR}</strong>.
            </p>
          </div>

          <div style={{
            marginTop: 22,
            padding: '20px 24px',
            borderRadius: 16,
            background: 'var(--panel)',
            border: '1px solid var(--line)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
              <ShieldCheck size={19} color="var(--gold, #178a6e)" />
              <strong style={{ fontSize: 15 }}>Application identity</strong>
            </div>
            <IdentityRow label="Google Play app name" value={APP_NAME} />
            <IdentityRow label="Platform name" value={PLATFORM_NAME} />
            <IdentityRow label="Android package ID" value={PACKAGE_ID} />
            <IdentityRow label="Operator" value={OPERATOR} />
          </div>

          <Section title="Option 1 — Delete your account inside the app or website">
            <ol style={{ margin: 0, paddingLeft: 22 }}>
              <li>Sign in to the {APP_NAME} app or at trackmyrmc.com.</li>
              <li>Open the menu and go to <strong style={{ color: 'var(--text)' }}>Account Settings</strong>.</li>
              <li>Scroll to the <strong style={{ color: 'var(--red, #ef4444)' }}>Danger Zone</strong>.</li>
              <li>
                Tap <strong style={{ color: 'var(--text)' }}>Delete my account…</strong>, type{' '}
                <strong>DELETE</strong>, and select{' '}
                <strong style={{ color: 'var(--text)' }}>Permanently delete account</strong>.
              </li>
            </ol>
            <p style={{ marginTop: 12, marginBottom: 0 }}>
              After confirmation, the user is signed out immediately and the deleted account can no
              longer be used to log in.
            </p>
          </Section>

          <Section title="Option 2 — Request deletion without signing in">
            <p style={{ marginTop: 0 }}>
              Users who cannot access the app can request deletion through the official support email.
              Submit the request from the registered email address where possible and include the
              registered mobile number so ownership can be verified.
            </p>

            <a
              href={deletionMailto}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
                minHeight: 46,
                padding: '0 18px',
                borderRadius: 12,
                background: 'var(--gold, #178a6e)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              <Mail size={18} /> Request account deletion
            </a>

            <p style={{ marginTop: 14, marginBottom: 0 }}>
              Email: <a href={`mailto:${MAIL}`} style={{ color: 'var(--gold, #178a6e)' }}>{MAIL}</a>
              <br />
              Phone: <a href={`tel:${PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--gold, #178a6e)' }}>{PHONE}</a>
            </p>
          </Section>

          <Section title="Information required for a deletion request">
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li>Full name</li>
              <li>Registered mobile number</li>
              <li>Registered email address, if applicable</li>
              <li>Confirmation that the user requests deletion of the {APP_NAME} account</li>
            </ul>
            <p style={{ marginTop: 12, marginBottom: 0 }}>
              Identity verification may be required to prevent unauthorised deletion requests.
            </p>
          </Section>

          <Section title="Data that is deleted">
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              <li>Account login access is disabled.</li>
              <li>The profile is removed from active use in the service.</li>
              <li>Personal data that is not legally required is deleted or anonymised.</li>
            </ul>
          </Section>

          <Section title="Data that may be retained">
            <p style={{ marginTop: 0 }}>
              Limited business and transaction records related to completed orders—such as delivery
              challans, invoices, tax records, payment ledgers, security logs, and audit records—may be
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
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginTop: 34,
            padding: '16px 18px',
            borderRadius: 14,
            background: 'var(--panel)',
            border: '1px solid var(--line)',
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
