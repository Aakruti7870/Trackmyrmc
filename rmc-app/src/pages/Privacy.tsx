import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import SocialLinksBar from '@/components/SocialLinksBar';

const APP_NAME = 'CONCRETE KING';
const PLATFORM_NAME = 'TrackMyRMC';
const PACKAGE_ID = 'com.trackmyrmc.concreteking';
const OPERATOR = 'GOLD-e Tech';
const MAIL = 'support@goldetech.com';
const PHONE = '+91 74982 86760';
const UPDATED = 'August 3, 2026';

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
      gridTemplateColumns: 'minmax(130px, .8fr) minmax(0, 1.5fr)',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--line)',
    }}>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>{label}</span>
      <strong style={{ color: 'var(--text)', fontSize: 13, overflowWrap: 'anywhere' }}>{value}</strong>
    </div>
  );
}

const strong = { color: 'var(--text)' } as const;
const link = { color: 'var(--gold, #178a6e)' } as const;

export default function Privacy() {
  const [, setLoc] = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${APP_NAME} – Privacy Policy`;
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
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 850, letterSpacing: 0.35, fontSize: 18 }}>
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
              TrackMyRMC · Powered by GOLD-e Tech
            </div>
          </div>

          <button
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

        <div style={{
          marginTop: 14,
          padding: '30px',
          borderRadius: 20,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          boxShadow: '0 30px 70px -40px rgba(0,0,0,.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={28} color="var(--gold, #178a6e)" />
            <h1 style={{
              fontSize: 30,
              fontWeight: 800,
              margin: 0,
              color: 'var(--text)',
              letterSpacing: 0.2,
            }}>
              Privacy Policy
            </h1>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '12px 0 0' }}>
            Effective and last updated: {UPDATED}
          </p>
        </div>

        <div style={{
          marginTop: 24,
          padding: '18px 20px',
          borderRadius: 14,
          background: 'var(--chip-bg)',
          border: '1px solid var(--line)',
        }}>
          <IdentityRow label="Google Play app" value={APP_NAME} />
          <IdentityRow label="Platform" value={PLATFORM_NAME} />
          <IdentityRow label="Android package" value={PACKAGE_ID} />
          <IdentityRow label="Operated by" value={OPERATOR} />
          <IdentityRow label="Website" value="https://trackmyrmc.com" />
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.7, marginTop: 26 }}>
          This Privacy Policy applies to the <strong style={strong}>{APP_NAME}</strong> Android
          application, package <strong style={strong}>{PACKAGE_ID}</strong>, and the{' '}
          <strong style={strong}>{PLATFORM_NAME}</strong> website and services operated by{' '}
          <strong style={strong}>{OPERATOR}</strong>. It explains how we access, collect, use,
          disclose, retain, and protect information when customers, drivers, plant owners, and staff
          use the service.
        </p>

        <Section title="1. Information We Collect">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 9 }}>
              <strong style={strong}>Account and contact information</strong> — name, mobile number,
              email address, account role, company or plant details, customer details, GST information,
              address, city, and authentication or OTP-related records.
            </li>
            <li style={{ marginBottom: 9 }}>
              <strong style={strong}>Order, delivery, and business records</strong> — concrete grade,
              quantity, delivery site, contact person, order status, challans, dispatch and delivery
              timestamps, invoices, ledger or payment-status records, vehicle and driver assignment,
              and related operational notes.
            </li>
            <li style={{ marginBottom: 9 }}>
              <strong style={strong}>Location information</strong> — delivery-site map pins and precise
              device location when needed for navigation or live-trip tracking. For authorised drivers,
              location may be collected in the background while an assigned trip is actively being
              tracked, including when the app is not visible. Background tracking is used for delivery
              operations and stops when the trip or tracking session ends.
            </li>
            <li style={{ marginBottom: 9 }}>
              <strong style={strong}>Photos and files you choose to provide</strong> — for example site
              photos, delivery proof images, challan-related files, profile or verification material,
              and other documents deliberately selected or captured for an app feature.
            </li>
            <li style={{ marginBottom: 9 }}>
              <strong style={strong}>Identity and KYC information</strong> — when a customer chooses or
              is required to complete DigiLocker-based KYC, the service may process verification status,
              consent-session identifiers, full name, date of birth, gender, and a masked Aadhaar value.
              We do not intentionally store the full Aadhaar number in the TrackMyRMC application database.
            </li>
            <li style={{ marginBottom: 9 }}>
              <strong style={strong}>Technical, security, and usage information</strong> — IP address,
              browser or device type, operating system, app version, timestamps, authentication events,
              error and diagnostic logs, security events, and feature usage needed to operate and protect
              the service.
            </li>
            <li>
              <strong style={strong}>Communications</strong> — support enquiries, account-deletion
              requests, transactional messages, and records of service notifications sent through email,
              SMS, WhatsApp, push notification, or similar channels.
            </li>
          </ul>
        </Section>

        <Section title="2. Android Permissions and Device Access">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              <strong style={strong}>Precise and approximate location:</strong> used for delivery pins,
              navigation, nearby-plant features, and live trip tracking.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={strong}>Background location:</strong> used only for role-based live tracking
              during an active driver trip or another clearly initiated tracking workflow.
            </li>
            <li style={{ marginBottom: 8 }}>
              <strong style={strong}>Notifications:</strong> used for account, order, dispatch, delivery,
              operational, and security updates.
            </li>
            <li>
              <strong style={strong}>User-selected photos and files:</strong> accessed only when you
              choose an image or document for an available feature. The app does not claim ownership of
              files unrelated to the selected workflow.
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            Permission availability depends on your device, Android version, account role, and the
            feature you use. You may manage permissions in Android settings, although disabling a
            required permission can prevent the related feature from working.
          </p>
        </Section>

        <Section title="3. How We Use Information">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>Create, authenticate, secure, and administer user accounts.</li>
            <li style={{ marginBottom: 8 }}>Verify eligible customers and display KYC status where applicable.</li>
            <li style={{ marginBottom: 8 }}>Place, approve, schedule, dispatch, track, deliver, and document RMC orders.</li>
            <li style={{ marginBottom: 8 }}>Generate operational records such as challans, invoices, ledgers, reports, and audit trails.</li>
            <li style={{ marginBottom: 8 }}>Provide maps, delivery coordination, driver navigation, and live-trip visibility.</li>
            <li style={{ marginBottom: 8 }}>Send transactional account and order notifications.</li>
            <li style={{ marginBottom: 8 }}>Respond to support, privacy, correction, and deletion requests.</li>
            <li style={{ marginBottom: 8 }}>Detect abuse, investigate incidents, prevent fraud, and enforce access controls.</li>
            <li>Comply with tax, accounting, employment, safety, contractual, and legal obligations.</li>
          </ul>
        </Section>

        <Section title="4. How We Share Information">
          <p style={{ marginTop: 0 }}>
            We share information only where reasonably necessary for a disclosed business purpose,
            including with:
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              authorised RMC plants, plant owners, dispatchers, drivers, staff, and customers involved in
              an order or permitted operational workflow;
            </li>
            <li style={{ marginBottom: 8 }}>
              cloud hosting, database, object-storage, security, email, SMS, and notification providers;
            </li>
            <li style={{ marginBottom: 8 }}>
              authentication providers such as Google Cloud Identity Platform or Firebase when configured;
            </li>
            <li style={{ marginBottom: 8 }}>
              mapping, geocoding, navigation, and location-service providers used by map and tracking features;
            </li>
            <li style={{ marginBottom: 8 }}>
              Meta or WhatsApp Business service providers for transactional WhatsApp communications;
            </li>
            <li style={{ marginBottom: 8 }}>
              DigiLocker or an authorised KYC service provider when a user initiates identity verification; and
            </li>
            <li>
              regulators, courts, law-enforcement authorities, professional advisers, or another party when
              disclosure is required by law, necessary to protect users, or needed to establish or defend rights.
            </li>
          </ul>
          <p style={{ marginBottom: 0 }}>
            We do not sell personal information. We do not permit service providers to use information
            received from us for unrelated independent advertising purposes.
          </p>
        </Section>

        <Section title="5. WhatsApp, SMS, Email, and Notifications">
          <p style={{ margin: 0 }}>
            We may send transactional communications concerning OTPs, account security, KYC status,
            orders, approval, dispatch, tracking, delivery, billing, or support. WhatsApp communications
            may be processed through the WhatsApp Business Platform and are also subject to Meta and
            WhatsApp terms. Where an opt-out is legally available, you may use the instructions in the
            message or contact us. Essential authentication, security, and active-order notices may still
            be required to provide the requested service.
          </p>
        </Section>

        <Section title="6. Data Retention">
          <p style={{ marginTop: 0 }}>
            We retain account and service information only for as long as reasonably necessary for the
            purposes described in this policy. Retention periods vary according to the type of record,
            account status, active order or employment relationship, security requirements, dispute
            resolution, and applicable legal, tax, accounting, or audit obligations.
          </p>
          <p style={{ marginBottom: 0 }}>
            After an account-deletion request is verified, account access is disabled and personal
            account information is deleted or de-identified, except information that must be retained for
            legitimate legal, tax, accounting, fraud-prevention, safety, dispute, or audit purposes.
            Retained records are restricted to those purposes and are deleted or anonymised when the
            applicable retention need ends.
          </p>
        </Section>

        <Section title="7. Account and Data Deletion">
          <p style={{ marginTop: 0 }}>
            Users can initiate deletion from <strong style={strong}>Account Settings → Danger Zone</strong>
            inside the app. Users who cannot access the app can use the public{' '}
            <a href="/delete-account" style={link}>CONCRETE KING Account Deletion Request page</a>.
          </p>
          <p style={{ marginBottom: 0 }}>
            The deletion page identifies the Google Play app, package ID, available request methods,
            information needed to verify the requester, and the categories of data that may be retained.
            Deleting the app from a device does not itself delete the user's account.
          </p>
        </Section>

        <Section title="8. Your Privacy Choices and Rights">
          <p style={{ marginTop: 0 }}>
            Subject to applicable law and necessary identity verification, you may request access,
            correction, deletion, or restriction of personal information associated with your account.
            You may also manage Android permissions through your device settings and communication
            preferences through the available channel or by contacting us.
          </p>
          <p style={{ marginBottom: 0 }}>
            To submit a privacy request, email{' '}
            <a href={`mailto:${MAIL}`} style={link}>{MAIL}</a> or use our{' '}
            <a href="/delete-account" style={link}>account-deletion page</a>.
          </p>
        </Section>

        <Section title="9. Security">
          <p style={{ margin: 0 }}>
            We use technical and organisational safeguards designed to protect information, including
            encrypted network connections, authentication controls, role-based access, restricted
            administrative access, secure credential handling, logging, and monitoring. No transmission
            or storage system is completely secure, so we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="10. Children's Privacy">
          <p style={{ margin: 0 }}>
            The service is intended for businesses, authorised workers, and adults. It is not directed
            to children under 18, and we do not knowingly permit children to create accounts or knowingly
            collect their personal information. Contact us if you believe a child has provided information.
          </p>
        </Section>

        <Section title="11. International and Third-Party Processing">
          <p style={{ margin: 0 }}>
            Service providers may process information on infrastructure located outside your city, state,
            or country. Where applicable, we use contractual, access-control, and security measures intended
            to protect information during such processing. Links or integrations operated by third parties
            are governed by their own privacy notices in addition to this policy.
          </p>
        </Section>

        <Section title="12. Changes to This Policy">
          <p style={{ margin: 0 }}>
            We may update this policy when the app, data practices, service providers, or legal requirements
            change. We will update the effective date and provide additional notice where appropriate.
            Material app changes must also be reflected accurately in the Google Play Data safety form.
          </p>
        </Section>

        <Section title="13. Contact Us">
          <p style={{ margin: 0 }}>
            For privacy questions, account deletion, data requests, or complaints, contact the operator:
          </p>
          <div style={{
            marginTop: 14,
            padding: '18px 20px',
            borderRadius: 14,
            background: 'var(--chip-bg)',
            border: '1px solid var(--line)',
          }}>
            <div style={{ marginBottom: 6 }}><strong style={strong}>{OPERATOR}</strong></div>
            <div style={{ marginBottom: 6 }}>
              <span style={strong}>App: </span>{APP_NAME} ({PLATFORM_NAME})
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={strong}>Package ID: </span>{PACKAGE_ID}
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={strong}>Email: </span>
              <a href={`mailto:${MAIL}`} style={{ ...link, textDecoration: 'none' }}>{MAIL}</a>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={strong}>Phone: </span>
              <a href={`tel:${PHONE.replace(/\s/g, '')}`} style={{ ...link, textDecoration: 'none' }}>{PHONE}</a>
            </div>
            <div>
              <span style={strong}>Website: </span>
              <a href="https://trackmyrmc.com" style={{ ...link, textDecoration: 'none' }}>trackmyrmc.com</a>
            </div>
          </div>
        </Section>

        <footer style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid var(--line)',
          color: 'var(--muted)',
          fontSize: 13,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <SocialLinksBar compact center />
          </div>
          © {new Date().getFullYear()} CONCRETE KING · TrackMyRMC · Powered by GOLD-e Tech
        </footer>
      </div>
    </div>
  );
}
