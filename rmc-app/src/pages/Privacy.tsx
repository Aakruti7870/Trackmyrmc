import { useLocation } from 'wouter';
import { Crown, ArrowLeft, ShieldCheck } from 'lucide-react';

const MAIL = 'support@goldetech.com';
const PHONE = '+91 74982 86760';
const UPDATED = 'June 18, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2 style={{
        fontSize: 19, fontWeight: 700, color: '#fff', margin: '0 0 12px',
        letterSpacing: 0.2,
      }}>{title}</h2>
      <div style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export default function Privacy() {
  const [, setLoc] = useLocation();
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg, #08111f)', color: '#e8eef7',
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
              width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: 'linear-gradient(160deg, #1a2c46, #0c1828)',
              border: '1px solid rgba(247,201,72,.4)',
              boxShadow: '0 0 24px -8px rgba(247,201,72,.6)',
            }}>
              <Crown size={24} color="var(--gold, #f7c948)" strokeWidth={2.2} fill="rgba(247,201,72,.18)" />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontWeight: 800, letterSpacing: 0.5, fontSize: 18 }}>
                <span style={{ color: '#fff' }}>CONCRETE </span>
                <span style={{ color: 'var(--gold, #f7c948)' }}>KING</span>
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
              background: 'rgba(255,255,255,.04)', border: '1px solid var(--line, rgba(120,160,220,.18))',
              color: '#cdd9ea', padding: '9px 16px', borderRadius: 10, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} /> Back to home
          </button>
        </header>

        {/* title card */}
        <div style={{
          marginTop: 14, padding: '30px 30px', borderRadius: 20,
          background: 'radial-gradient(120% 120% at 70% 0%, #13243c 0%, #0b1626 60%, #0a1322 100%)',
          border: '1px solid var(--line, rgba(120,160,220,.18))',
          boxShadow: '0 30px 70px -40px rgba(0,0,0,.8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={28} color="var(--gold, #f7c948)" />
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0, color: '#fff', letterSpacing: 0.2 }}>
              Privacy Policy
            </h1>
          </div>
          <p style={{ color: 'var(--muted, #8aa0bd)', fontSize: 14, marginTop: 12, marginBottom: 0 }}>
            Last updated: {UPDATED}
          </p>
        </div>

        {/* intro */}
        <p style={{ color: 'var(--muted, #8aa0bd)', fontSize: 15, lineHeight: 1.7, marginTop: 26 }}>
          CONCRETE KING (operated by GOLD-e Tech, the "Company", "we", "us") provides a Ready-Mix
          Concrete (RMC) marketplace and plant-management platform at{' '}
          <span style={{ color: 'var(--gold, #f7c948)' }}>trackmyrmc.com</span>. This Privacy Policy
          explains what information we collect, how we use it, and the choices you have. By using our
          website, app, or WhatsApp notifications, you agree to the practices described here.
        </p>

        <Section title="1. Information We Collect">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: '#cdd9ea' }}>Account &amp; contact details</strong> — name, phone number, company name, GST details, and email where provided.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: '#cdd9ea' }}>Order &amp; delivery data</strong> — concrete grade, quantity, delivery address, order history, challans, and dispatch records.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: '#cdd9ea' }}>Location data</strong> — site/delivery coordinates and, for tracking, the live location of transit vehicles servicing your order.</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: '#cdd9ea' }}>Usage &amp; device data</strong> — log data such as IP address and basic device/browser information used to operate and secure the service.</li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>To create and manage your account and authenticate you (including phone/OTP login).</li>
            <li style={{ marginBottom: 8 }}>To process, dispatch, track, and deliver your concrete orders.</li>
            <li style={{ marginBottom: 8 }}>To send service notifications about your orders — order confirmation, dispatch updates, and delivery confirmation — including via WhatsApp.</li>
            <li style={{ marginBottom: 8 }}>To provide customer support and respond to your requests.</li>
            <li style={{ marginBottom: 8 }}>To maintain security, prevent fraud, and comply with legal obligations.</li>
          </ul>
        </Section>

        <Section title="3. WhatsApp Messaging">
          <p style={{ margin: 0 }}>
            We use the WhatsApp Business Platform (Meta) to send order-related notifications to the
            phone number associated with your account. These are transactional service messages tied
            to your orders (confirmation, dispatch, and delivery). We do not sell your phone number,
            and you can opt out at any time by replying STOP or by contacting us using the details
            below. Your use of WhatsApp is also governed by WhatsApp's and Meta's own terms and
            privacy policies.
          </p>
        </Section>

        <Section title="4. How We Share Information">
          <p style={{ margin: 0 }}>
            We share information only as needed to run the service: with the RMC plant and dispatch/
            driver staff fulfilling your order; with service providers who process messages and host
            our platform (such as Meta/WhatsApp and our cloud hosting and database providers); and
            when required by law or to protect our rights. We do not sell your personal information.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p style={{ margin: 0 }}>
            We retain your information for as long as your account is active and as needed to provide
            the service, comply with legal and tax obligations, resolve disputes, and enforce our
            agreements. When no longer required, data is deleted or anonymised.
          </p>
        </Section>

        <Section title="6. Security">
          <p style={{ margin: 0 }}>
            We use reasonable technical and organisational measures — including encrypted connections,
            access controls, and secure credential storage — to protect your information. No method of
            transmission or storage is completely secure, but we work to safeguard your data.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p style={{ margin: 0 }}>
            You may request access to, correction of, or deletion of your personal information, and you
            may opt out of non-essential communications. To exercise these rights, contact us using the
            details below. We will respond within a reasonable time and in accordance with applicable law.
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p style={{ margin: 0 }}>
            Our service is intended for businesses and adults. It is not directed to children under 18,
            and we do not knowingly collect their personal information.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p style={{ margin: 0 }}>
            We may update this Privacy Policy from time to time. Material changes will be reflected by
            updating the "Last updated" date above and, where appropriate, by additional notice.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <p style={{ margin: 0 }}>
            If you have questions about this Privacy Policy or your data, contact us:
          </p>
          <div style={{
            marginTop: 14, padding: '18px 20px', borderRadius: 14,
            background: 'rgba(255,255,255,.03)', border: '1px solid var(--line, rgba(120,160,220,.18))',
          }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#cdd9ea' }}>Email: </span>
              <a href={`mailto:${MAIL}`} style={{ color: 'var(--gold, #f7c948)', textDecoration: 'none' }}>{MAIL}</a>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#cdd9ea' }}>Phone: </span>
              <a href={`tel:${PHONE.replace(/\s/g, '')}`} style={{ color: 'var(--gold, #f7c948)', textDecoration: 'none' }}>{PHONE}</a>
            </div>
            <div>
              <span style={{ color: '#cdd9ea' }}>Website: </span>
              <span style={{ color: 'var(--gold, #f7c948)' }}>trackmyrmc.com</span>
            </div>
          </div>
        </Section>

        <footer style={{
          marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--line, rgba(120,160,220,.14))',
          color: 'var(--muted, #8aa0bd)', fontSize: 13, textAlign: 'center',
        }}>
          © {new Date().getFullYear()} CONCRETE KING · Powered by GOLD-e Tech
        </footer>
      </div>
    </div>
  );
}
