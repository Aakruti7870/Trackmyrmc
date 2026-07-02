import { useLocation } from 'wouter';
import { ArrowLeft, FileText } from 'lucide-react';
import logoKing from '@/assets/logo-king.png';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/brand';
import SocialLinksBar from '@/components/SocialLinksBar';

const UPDATED = 'June 24, 2026';

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

export default function Terms() {
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
            <FileText size={28} color="var(--gold, #178a6e)" />
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: 'var(--text)', letterSpacing: 0.2 }}>
              Terms of Service
            </h1>
          </div>
          <p style={{ color: 'var(--muted, #8aa0bd)', fontSize: 14, marginTop: 12, marginBottom: 0 }}>
            Last updated: {UPDATED}
          </p>
        </div>

        {/* intro */}
        <p style={{ color: 'var(--muted, #8aa0bd)', fontSize: 15, lineHeight: 1.7, marginTop: 26 }}>
          These Terms of Service ("Terms") govern your access to and use of CONCRETE KING (operated by
          GOLD-e Tech, the "Company", "we", "us"), a Ready-Mix Concrete (RMC) marketplace and
          plant-management platform at{' '}
          <span style={{ color: 'var(--gold, #178a6e)' }}>trackmyrmc.com</span>. By creating an account
          or using the website, app, or WhatsApp notifications, you agree to these Terms.
        </p>

        <Section title="1. Who Can Use the Service">
          <p style={{ margin: 0 }}>
            The platform is intended for businesses and adults (18+) — RMC plants, their staff and
            drivers, and customers ordering concrete. You confirm that the information you provide is
            accurate and that you are authorised to act for the company you register.
          </p>
        </Section>

        <Section title="2. Accounts & Security">
          <p style={{ margin: 0 }}>
            You are responsible for keeping your login credentials, OTP codes, and Plant ID
            confidential and for all activity under your account. Staff accounts are scoped to a single
            plant; do not share access across plants or roles. Notify us immediately of any
            unauthorised use.
          </p>
        </Section>

        <Section title="3. Orders, Dispatch & Delivery">
          <p style={{ margin: 0 }}>
            CONCRETE KING connects customers with RMC plants and provides tools to place, dispatch, and
            track orders. The supplying plant is responsible for the concrete supplied, its grade and
            quality, pricing, taxes, and fulfilment. Quantities, rates, and delivery times shown are
            indicative and confirmed by the plant on each order.
          </p>
        </Section>

        <Section title="4. Pricing, Rates & Payments">
          <p style={{ margin: 0 }}>
            Rates are set by each plant and may include applicable platform charges or commission.
            Payment terms are agreed between you and the supplying plant unless stated otherwise. You
            agree to pay all amounts due for orders you place.
          </p>
        </Section>

        <Section title="5. Acceptable Use">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>Do not misuse, disrupt, or attempt to gain unauthorised access to the service or other tenants' data.</li>
            <li style={{ marginBottom: 8 }}>Do not upload unlawful, infringing, or harmful content.</li>
            <li style={{ marginBottom: 8 }}>Do not use the service to send spam or to impersonate others.</li>
          </ul>
        </Section>

        <Section title="6. WhatsApp & Notifications">
          <p style={{ margin: 0 }}>
            We send order-related service messages (confirmation, dispatch, delivery) to your
            registered number, including via WhatsApp. Your use of WhatsApp is also governed by
            WhatsApp's and Meta's terms. You may opt out of non-essential messages as described in our
            Privacy Policy.
          </p>
        </Section>

        <Section title="7. Service Availability">
          <p style={{ margin: 0 }}>
            We work to keep the platform available and accurate but provide it "as is" without
            warranties of uninterrupted or error-free operation. We may update, suspend, or discontinue
            features from time to time.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p style={{ margin: 0 }}>
            To the maximum extent permitted by law, the Company is not liable for indirect, incidental,
            or consequential damages, or for the acts or omissions of plants, drivers, or third-party
            providers. Nothing in these Terms excludes liability that cannot be excluded by law.
          </p>
        </Section>

        <Section title="9. Suspension & Termination">
          <p style={{ margin: 0 }}>
            We may suspend or terminate access for breach of these Terms, suspected fraud, non-payment,
            or where required by law. You may stop using the service at any time and request account
            deletion as described in our Privacy Policy.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p style={{ margin: 0 }}>
            We may update these Terms from time to time. Material changes will be reflected by updating
            the "Last updated" date above and, where appropriate, by additional notice. Continued use
            after changes means you accept the updated Terms.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p style={{ margin: 0 }}>
            Questions about these Terms? Contact us:
          </p>
          <div style={{
            marginTop: 14, padding: '18px 20px', borderRadius: 14,
            background: 'var(--chip-bg)', border: '1px solid var(--line)',
          }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--text)' }}>Email: </span>
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: 'var(--gold, #178a6e)', textDecoration: 'none' }}>{SUPPORT_EMAIL}</a>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--text)' }}>Phone: </span>
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--gold, #178a6e)', textDecoration: 'none' }}>{SUPPORT_PHONE}</a>
            </div>
            <div>
              <span style={{ color: 'var(--text)' }}>Website: </span>
              <span style={{ color: 'var(--gold, #178a6e)' }}>trackmyrmc.com</span>
            </div>
          </div>
        </Section>

        <footer style={{
          marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--line, rgba(120,160,220,.14))',
          color: 'var(--muted, #8aa0bd)', fontSize: 13, textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <SocialLinksBar compact center />
          </div>
          © {new Date().getFullYear()} CONCRETE KING · Powered by GOLD-e Tech
        </footer>
      </div>
    </div>
  );
}
