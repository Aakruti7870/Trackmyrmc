import { useLocation } from 'wouter';
import { ArrowLeft, UserX } from 'lucide-react';
import logoKing from '@/assets/logo-king.png';

const MAIL = 'support@goldetech.com';
const PHONE = '+91 74982 86760';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{
        fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: '0 0 12px',
        letterSpacing: 0.2,
      }}>{title}</h2>
      <div style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

// Public account-deletion instructions page. Google Play requires a web page,
// reachable without logging in, that explains how users of the Android app can
// delete their account and what happens to their data.
export default function DeleteAccount() {
  const [, setLoc] = useLocation();
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)',
      padding: '0 20px 80px',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '26px 0', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', overflow: 'hidden',
              background: 'linear-gradient(160deg, #11151f, #07090e)',
              border: '1px solid var(--glass-border, rgba(212,175,55,.2))',
              boxShadow: '0 0 24px -8px var(--glow-1, rgba(212,175,55,.5))',
            }}>
              <img src={logoKing} alt="CONCRETE KING" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontWeight: 800, letterSpacing: 0.5, fontSize: 18 }}>
                <span style={{ color: 'var(--text)' }}>CONCRETE </span>
                <span style={{ color: 'var(--gold, #178a6e)' }}>KING</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--muted, #8aa0bd)', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' }}>
                Powered by GOLD-e Tech
              </div>
            </div>
          </div>
          <button
            onClick={() => setLoc('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--chip-bg)', border: '1px solid var(--line)',
              color: 'var(--muted)', padding: '9px 16px', borderRadius: 10, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </header>

        {/* title card */}
        <div style={{
          marginTop: 14, padding: '30px 30px', borderRadius: 20,
          background: 'linear-gradient(160deg, rgba(22,29,42,.9), rgba(16,21,31,.8))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--line)',
          boxShadow: '0 30px 70px -40px rgba(0,0,0,.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserX size={28} color="var(--gold, #178a6e)" />
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: 0.2 }}>
              Delete Your Account
            </h1>
          </div>
          <p style={{ color: 'var(--muted, #8aa0bd)', fontSize: 14, marginTop: 12, marginBottom: 0 }}>
            How to delete your CONCRETE KING / TrackMyRMC account and what happens to your data.
          </p>
        </div>

        <Section title="Delete your account from the app or website">
          <ol style={{ margin: 0, paddingLeft: 22 }}>
            <li>Sign in to the CONCRETE KING app or at trackmyrmc.com.</li>
            <li>Open the menu and go to <strong style={{ color: 'var(--text)' }}>Account Settings</strong>.</li>
            <li>Scroll down to the <strong style={{ color: 'var(--red, #ef4444)' }}>Danger Zone</strong> section.</li>
            <li>Tap <strong style={{ color: 'var(--text)' }}>Delete my account…</strong>, type <strong>DELETE</strong> to confirm, then tap <strong style={{ color: 'var(--text)' }}>Permanently delete account</strong>.</li>
          </ol>
          <p style={{ marginTop: 12, marginBottom: 0 }}>
            You will be signed out immediately and your account will no longer be able to log in.
          </p>
        </Section>

        <Section title="Request deletion by email">
          <p style={{ margin: 0 }}>
            If you can no longer access your account, email us at{' '}
            <a href={`mailto:${MAIL}`} style={{ color: 'var(--gold, #178a6e)' }}>{MAIL}</a>{' '}
            or call <a href={`tel:${PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--gold, #178a6e)' }}>{PHONE}</a>{' '}
            from your registered contact details and request account deletion. We will verify your
            identity and process the request within a reasonable time.
          </p>
        </Section>

        <Section title="What is deleted, and what is kept">
          <p style={{ marginTop: 0 }}>
            When your account is deleted, your login is deactivated permanently and your profile is
            removed from active use across the service.
          </p>
          <p style={{ marginBottom: 0 }}>
            Business and transaction records connected to past orders — such as delivery challans,
            invoices, and payment ledgers — are retained where required for legal, tax, and audit
            compliance, as described in our{' '}
            <a href="/privacy" style={{ color: 'var(--gold, #178a6e)' }}>Privacy Policy</a>. Once no
            longer required, retained data is deleted or anonymised.
          </p>
        </Section>
      </div>
    </div>
  );
}
