export default function Privacy() {
  return (
    /* Public page — outside Layout, so no #app-main scroll container.
       layout-fixes.css locks html/body/#root to height:100%+overflow:hidden.
       Create a full-viewport scroll container so the page scrolls on mobile. */
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never, background: '#f4f8f7' }}>
    <div style={{
      width: 'min(900px, calc(100% - 32px))',
      margin: '0 auto',
      padding: '24px 0 72px',
      fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
      fontSize: 16,
      lineHeight: 1.68,
      color: '#172033',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        padding: '10px 0 22px',
        borderBottom: '1px solid #dce4e8',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ fontSize: 20, color: '#08785f' }}>TrackMyRMC</strong>
          <small style={{ color: '#526078', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            Powered by GOLD-e Tech
          </small>
        </div>
        <a href="https://trackmyrmc.com/" style={{
          display: 'inline-flex', alignItems: 'center', minHeight: 42,
          padding: '9px 15px', border: '1px solid #dce4e8', borderRadius: 10,
          background: '#fff', color: '#075f4d', fontWeight: 700, textDecoration: 'none',
        }}>← Back to TrackMyRMC</a>
      </header>

      <section style={{
        marginTop: 28, background: '#fff', border: '1px solid #dce4e8',
        borderRadius: 20, padding: 'clamp(24px,5vw,42px)',
        boxShadow: '0 22px 60px rgba(23,32,51,.08)',
      }}>
        <div style={{ color: '#08785f', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 800 }}>
          Official TrackMyRMC document
        </div>
        <h1 style={{ fontSize: 'clamp(30px,6vw,44px)', lineHeight: 1.12, margin: '8px 0 12px' }}>
          Privacy Policy
        </h1>
        <p style={{ margin: 0, color: '#526078' }}>Effective and last updated: August 8, 2026</p>

        <div style={{
          marginTop: 22, background: '#eef8f5', border: '1px solid #c0e4d8',
          borderRadius: 14, padding: '16px 20px',
        }}>
          {[
            ['Application', 'TrackMyRMC'],
            ['Android package', 'com.trackmyrmc.concreteking'],
            ['Google Play Developer', 'KBADE'],
            ['Website', 'https://trackmyrmc.com'],
            ['Operator', 'GOLD-e Tech'],
            ['Policy URL', 'https://trackmyrmc.com/privacy_policy'],
          ].map(([label, value]) => (
            <div key={label} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr',
              gap: 14, padding: '9px 0', borderBottom: '1px solid rgba(8,120,95,.14)',
            }}>
              <span style={{ color: '#526078', fontSize: 13 }}>{label}</span>
              <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <main style={{
        background: '#fff', border: '1px solid #dce4e8',
        borderRadius: 20, padding: 'clamp(22px,5vw,42px)', marginTop: 22,
      }}>
        <p>This Privacy Policy explains how TrackMyRMC, published on Google Play by <strong>KBADE</strong> and operated by <strong>GOLD-e Tech</strong>, collects, uses, shares, retains, and protects
        information when customers, drivers, plant owners, administrators, staff, and other authorised users access
        the TrackMyRMC website or Android application.</p>

        <p style={{ borderLeft: '4px solid #eab34d', background: '#fffaf0', padding: '14px 16px', borderRadius: 8, color: '#526078' }}>
          This page applies only to TrackMyRMC services hosted at <strong>trackmyrmc.com</strong> and the
          associated TrackMyRMC Android application.
        </p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>1. Information We Collect</h2>
        <ul style={{ paddingLeft: 22, color: '#526078' }}>
          <li style={{ marginBottom: 8 }}><strong>Account and contact data:</strong> name, mobile number, email address, account role, company or RMC plant details, address, city, GST information, and authentication records.</li>
          <li style={{ marginBottom: 8 }}><strong>Order and operational data:</strong> concrete grade, quantity, delivery address, delivery pin, customer and site contacts, order status, dispatch details, vehicle and driver assignment, challans, invoices, payment status, reports, and audit records.</li>
          <li style={{ marginBottom: 8 }}><strong>Location data:</strong> approximate or precise location used for delivery pins, nearby-plant functions, navigation, and authorised live-trip tracking.</li>
          <li style={{ marginBottom: 8 }}><strong>Photos and files selected by the user:</strong> delivery proof, site photographs, profile or verification documents, challans, and other files deliberately uploaded for a TrackMyRMC feature.</li>
          <li style={{ marginBottom: 8 }}><strong>KYC information:</strong> verification status and permitted identity details supplied through an authorised DigiLocker or KYC workflow. TrackMyRMC does not intentionally store a complete Aadhaar number in its application database.</li>
          <li style={{ marginBottom: 8 }}><strong>Technical and security data:</strong> IP address, browser or device type, operating system, app version, timestamps, diagnostic logs, authentication events, security events, and feature usage.</li>
          <li style={{ marginBottom: 8 }}><strong>Communications:</strong> support enquiries, account-deletion requests, and transactional messages delivered by email, SMS, WhatsApp, push notification, or similar channels.</li>
        </ul>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>2. Android Permissions and Device Access</h2>
        <ul style={{ paddingLeft: 22, color: '#526078' }}>
          <li style={{ marginBottom: 8 }}><strong>Precise and approximate location</strong> may be used for delivery-site selection, navigation, nearby-plant discovery, and live trip visibility.</li>
          <li style={{ marginBottom: 8 }}><strong>Background location</strong> may be used only for an authorised driver or role-based tracking session while an active trip is in progress.</li>
          <li style={{ marginBottom: 8 }}><strong>Notifications</strong> may be used for OTP, account, order, dispatch, delivery, operational, and security updates.</li>
          <li style={{ marginBottom: 8 }}><strong>User-selected photos and files</strong> are accessed only when the user chooses to capture or upload content for an available feature.</li>
        </ul>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>3. How We Use Information</h2>
        <ul style={{ paddingLeft: 22, color: '#526078' }}>
          <li style={{ marginBottom: 8 }}>Create, authenticate, secure, and administer accounts.</li>
          <li style={{ marginBottom: 8 }}>Place, approve, schedule, dispatch, track, deliver, and document RMC orders.</li>
          <li style={{ marginBottom: 8 }}>Generate challans, invoices, ledgers, reports, and operational audit trails.</li>
          <li style={{ marginBottom: 8 }}>Provide map, routing, delivery coordination, and live-trip functions.</li>
          <li style={{ marginBottom: 8 }}>Send transactional and security communications.</li>
          <li style={{ marginBottom: 8 }}>Respond to support, correction, privacy, and account-deletion requests.</li>
          <li style={{ marginBottom: 8 }}>Detect abuse, prevent fraud, investigate incidents, and enforce role-based access.</li>
          <li style={{ marginBottom: 8 }}>Meet legal, tax, accounting, safety, employment, contractual, or regulatory obligations.</li>
        </ul>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>4. How Information Is Shared</h2>
        <p style={{ color: '#526078' }}>Information may be shared only as reasonably necessary with authorised users involved in an order or
        operational workflow, and with service providers supporting cloud hosting, databases, storage,
        authentication, email, SMS, WhatsApp, push notifications, maps, navigation, KYC, monitoring, and security.</p>
        <p style={{ color: '#526078' }}>Information may also be disclosed where required by law, a court, a regulator, or a lawful authority.</p>
        <p style={{ color: '#526078' }}><strong>TrackMyRMC does not sell personal information.</strong></p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>5. Data Retention</h2>
        <p style={{ color: '#526078' }}>Information is retained only for as long as reasonably necessary for the purposes described in this
        policy, depending on account status, active orders, legal, tax, accounting, and audit requirements.</p>
        <p style={{ color: '#526078' }}>After a verified deletion request, account access is disabled and personal account data is deleted or
        de-identified, except where retention is required for legitimate legal, accounting, fraud-prevention,
        safety, dispute, or audit purposes.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>6. Account and Data Deletion</h2>
        <p style={{ color: '#526078' }}>Users may request deletion from account settings inside the app. Users who cannot sign in may use the
        public <a href="https://trackmyrmc.com/account-deletion" style={{ color: '#08785f' }}>TrackMyRMC Account Deletion Request page</a>.
        Removing the application does not itself delete the account.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>7. Privacy Choices and Rights</h2>
        <p style={{ color: '#526078' }}>Subject to applicable law and identity verification, users may request access, correction, deletion,
        or restriction of personal information. Android permissions can be managed through device settings.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>8. Security</h2>
        <p style={{ color: '#526078' }}>TrackMyRMC uses encrypted network connections, authentication controls, role-based access, restricted
        administrative access, secure credential handling, logging, and monitoring. No electronic system can
        guarantee absolute security.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>9. Children's Privacy</h2>
        <p style={{ color: '#526078' }}>TrackMyRMC is intended for businesses, authorised workers, and adults. It is not directed to children
        under 18, and children are not knowingly permitted to create accounts.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>10. Third-Party Services</h2>
        <p style={{ color: '#526078' }}>Service providers may process information on infrastructure located outside the user's city, state, or
        country. Third-party integrations are governed by their own privacy notices and terms.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>11. Changes to This Privacy Policy</h2>
        <p style={{ color: '#526078' }}>This policy may be updated when TrackMyRMC features, permissions, service providers, data practices,
        or legal requirements change. The effective date at the top will be updated when revisions are published.</p>

        <h2 style={{ fontSize: 20, margin: '34px 0 12px' }}>12. Contact</h2>
        <div style={{ background: '#eef8f5', border: '1px solid #c0e4d8', borderRadius: 14, padding: '18px 20px', color: '#526078' }}>
          <div><strong>Operator:</strong> GOLD-e Tech</div>
          <div><strong>Application:</strong> TrackMyRMC</div>
          <div><strong>Email:</strong> <a href="mailto:support@goldetech.com" style={{ color: '#08785f' }}>support@goldetech.com</a></div>
          <div><strong>Phone:</strong> <a href="tel:+917498286760" style={{ color: '#08785f' }}>+91 74982 86760</a></div>
          <div><strong>Website:</strong> <a href="https://trackmyrmc.com/" style={{ color: '#08785f' }}>https://trackmyrmc.com</a></div>
        </div>
      </main>

      <footer style={{ textAlign: 'center', color: '#526078', fontSize: 13, paddingTop: 28 }}>
        © {new Date().getFullYear()} TrackMyRMC · Powered by GOLD-e Tech
      </footer>
    </div>
    </div>
  );
}
