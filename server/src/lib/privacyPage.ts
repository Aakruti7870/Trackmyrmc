export function privacyPage(): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>Privacy Policy – TrackMyRMC</title>
  <meta name="description" content="Official Privacy Policy for the TrackMyRMC website and Android application operated by GOLD-e Tech.">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="https://trackmyrmc.com/privacy_policy">
  <link rel="icon" type="image/svg+xml" href="/trackmyrmc-policy-icon.svg">
  <link rel="apple-touch-icon" href="/trackmyrmc-policy-icon.svg">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="TrackMyRMC">
  <meta property="og:title" content="Privacy Policy – TrackMyRMC">
  <meta property="og:description" content="Official Privacy Policy for TrackMyRMC.">
  <meta property="og:url" content="https://trackmyrmc.com/privacy_policy">
  <meta property="og:image" content="https://trackmyrmc.com/trackmyrmc-policy-icon.svg">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Privacy Policy – TrackMyRMC">
  <meta name="twitter:description" content="Official Privacy Policy for TrackMyRMC.">
  <meta name="twitter:image" content="https://trackmyrmc.com/trackmyrmc-policy-icon.svg">
  <style>
    :root{color-scheme:light;--green:#08785f;--green-dark:#075f4d;--gold:#eab34d;--ink:#172033;--muted:#526078;--line:#dce4e8;--soft:#eef8f5;--bg:#f4f8f7}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.68 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
    .wrap{width:min(900px,calc(100% - 32px));margin:auto;padding:24px 0 72px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:10px 0 22px;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:12px}.brand img{width:46px;height:46px;border-radius:12px}.brand strong{display:block;font-size:20px;color:var(--green)}.brand small{display:block;color:var(--muted);font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-top:2px}
    .back{display:inline-flex;align-items:center;min-height:42px;padding:9px 15px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--green-dark);font-weight:700;text-decoration:none}.back:hover{background:var(--soft)}
    .hero{margin-top:28px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(24px,5vw,42px);box-shadow:0 22px 60px rgba(23,32,51,.08)}
    .eyebrow{color:var(--green);font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:800}.hero h1{font-size:clamp(30px,6vw,44px);line-height:1.12;margin:8px 0 12px}.hero p{margin:0;color:var(--muted)}
    .identity{margin-top:22px;background:var(--soft);border:1px solid #c0e4d8;border-radius:14px;padding:16px 20px}.row{display:grid;grid-template-columns:minmax(135px,.7fr) minmax(0,1.4fr);gap:14px;padding:9px 0;border-bottom:1px solid rgba(8,120,95,.14)}.row:last-child{border-bottom:0}.row span{color:var(--muted);font-size:13px}.row strong{font-size:13px;overflow-wrap:anywhere}
    main{background:#fff;border:1px solid var(--line);border-radius:20px;padding:clamp(22px,5vw,42px);margin-top:22px}section{margin-top:34px}section:first-child{margin-top:0}h2{font-size:20px;margin:0 0 12px}p,li{color:var(--muted)}ul{padding-left:22px;margin:10px 0}li{margin-bottom:8px}a{color:var(--green);font-weight:650}.contact{background:var(--soft);border:1px solid #c0e4d8;border-radius:14px;padding:18px 20px}.notice{border-left:4px solid var(--gold);background:#fffaf0;padding:14px 16px;border-radius:8px;color:var(--muted)}footer{text-align:center;color:var(--muted);font-size:13px;padding-top:28px}
    @media(max-width:560px){.wrap{width:min(100% - 22px,900px);padding-top:12px}.row{grid-template-columns:1fr;gap:2px}.hero,main{border-radius:14px}.top{align-items:flex-start}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="brand">
        <img src="/trackmyrmc-policy-icon.svg" alt="TrackMyRMC logo">
        <div><strong>TrackMyRMC</strong><small>Powered by GOLD-e Tech</small></div>
      </div>
      <a class="back" href="https://trackmyrmc.com/">&#8592; Back to TrackMyRMC</a>
    </header>

    <section class="hero">
      <div class="eyebrow">Official TrackMyRMC document</div>
      <h1>Privacy Policy</h1>
      <p>Effective and last updated: August 4, 2026</p>
    </section>

    <div class="identity" aria-label="Application identity">
      <div class="row"><span>Application</span><strong>TrackMyRMC</strong></div>
      <div class="row"><span>Android package</span><strong>com.trackmyrmc.concreteking</strong></div>
      <div class="row"><span>Website</span><strong>https://trackmyrmc.com</strong></div>
      <div class="row"><span>Operator</span><strong>GOLD-e Tech</strong></div>
      <div class="row"><span>Policy URL</span><strong>https://trackmyrmc.com/privacy_policy</strong></div>
    </div>

    <main>
      <section>
        <p>This Privacy Policy explains how TrackMyRMC and GOLD-e Tech collect, use, share, retain, and protect information when customers, drivers, plant owners, administrators, staff, and other authorised users access the TrackMyRMC website or Android application.</p>
        <p class="notice">This page applies only to TrackMyRMC services hosted at <strong>trackmyrmc.com</strong> and the associated TrackMyRMC Android application.</p>
      </section>

      <section>
        <h2>1. Information We Collect</h2>
        <ul>
          <li><strong>Account and contact data:</strong> name, mobile number, email address, account role, company or RMC plant details, address, city, GST information, and authentication records.</li>
          <li><strong>Order and operational data:</strong> concrete grade, quantity, delivery address, delivery pin, customer and site contacts, order status, dispatch details, vehicle and driver assignment, challans, invoices, payment status, reports, and audit records.</li>
          <li><strong>Location data:</strong> approximate or precise location used for delivery pins, nearby-plant functions, navigation, and authorised live-trip tracking.</li>
          <li><strong>Photos and files selected by the user:</strong> delivery proof, site photographs, profile or verification documents, challans, and other files deliberately uploaded for a TrackMyRMC feature.</li>
          <li><strong>KYC information:</strong> verification status and permitted identity details supplied through an authorised DigiLocker or KYC workflow. TrackMyRMC does not intentionally store a complete Aadhaar number in its application database.</li>
          <li><strong>Technical and security data:</strong> IP address, browser or device type, operating system, app version, timestamps, diagnostic logs, authentication events, security events, and feature usage.</li>
          <li><strong>Communications:</strong> support enquiries, account-deletion requests, and transactional messages delivered by email, SMS, WhatsApp, push notification, or similar channels.</li>
        </ul>
      </section>

      <section>
        <h2>2. Android Permissions and Device Access</h2>
        <ul>
          <li><strong>Precise and approximate location</strong> may be used for delivery-site selection, navigation, nearby-plant discovery, and live trip visibility.</li>
          <li><strong>Background location</strong> may be used only for an authorised driver or role-based tracking session while an active trip is in progress. Tracking is intended to stop when the trip or tracking workflow ends.</li>
          <li><strong>Notifications</strong> may be used for OTP, account, order, dispatch, delivery, operational, and security updates.</li>
          <li><strong>User-selected photos and files</strong> are accessed only when the user chooses to capture or upload content for an available feature.</li>
        </ul>
        <p>Permissions can be managed in Android settings. Disabling a required permission may prevent the related TrackMyRMC feature from operating.</p>
      </section>

      <section>
        <h2>3. How We Use Information</h2>
        <ul>
          <li>Create, authenticate, secure, and administer accounts.</li>
          <li>Verify eligible customers and display verification status where applicable.</li>
          <li>Place, approve, schedule, dispatch, track, deliver, and document RMC orders.</li>
          <li>Generate challans, invoices, ledgers, reports, payroll or attendance records where enabled, and operational audit trails.</li>
          <li>Provide map, routing, delivery coordination, and live-trip functions.</li>
          <li>Send transactional and security communications.</li>
          <li>Respond to support, correction, privacy, and account-deletion requests.</li>
          <li>Detect abuse, prevent fraud, investigate incidents, and enforce role-based access.</li>
          <li>Meet legal, tax, accounting, safety, employment, contractual, or regulatory obligations.</li>
        </ul>
      </section>

      <section>
        <h2>4. How Information Is Shared</h2>
        <p>Information may be shared only as reasonably necessary with authorised users involved in an order or operational workflow, and with service providers supporting cloud hosting, databases, storage, authentication, email, SMS, WhatsApp, push notifications, maps, navigation, KYC, monitoring, and security.</p>
        <p>Information may also be disclosed where required by law, a court, a regulator, or a lawful authority, or where necessary to protect users, prevent harm, or establish or defend legal rights.</p>
        <p><strong>TrackMyRMC does not sell personal information.</strong></p>
      </section>

      <section>
        <h2>5. Data Retention</h2>
        <p>Information is retained only for as long as reasonably necessary for the purposes described in this policy. Retention depends on account status, active orders, employment or business relationships, security needs, dispute resolution, and applicable legal, tax, accounting, and audit requirements.</p>
        <p>After a verified deletion request, account access is disabled and personal account data is deleted or de-identified, except for information that must be retained for legitimate legal, accounting, fraud-prevention, safety, dispute, or audit purposes.</p>
      </section>

      <section>
        <h2>6. Account and Data Deletion</h2>
        <p>Users may request deletion from the account settings available inside the TrackMyRMC application. Users who cannot sign in may use the public <a href="https://trackmyrmc.com/account-deletion">TrackMyRMC Account Deletion Request page</a>.</p>
        <p>Removing the application from a device does not itself delete the account. Identity verification may be required before an account or associated personal data is deleted.</p>
      </section>

      <section>
        <h2>7. Privacy Choices and Rights</h2>
        <p>Subject to applicable law and identity verification, users may request access, correction, deletion, or restriction of personal information associated with their TrackMyRMC account. Android permissions can be managed through device settings.</p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>TrackMyRMC uses safeguards designed to protect information, including encrypted network connections, authentication controls, role-based access, restricted administrative access, secure credential handling, logging, and monitoring. No electronic system can guarantee absolute security.</p>
      </section>

      <section>
        <h2>9. Children's Privacy</h2>
        <p>TrackMyRMC is intended for businesses, authorised workers, and adults. It is not directed to children under 18, and children are not knowingly permitted to create accounts.</p>
      </section>

      <section>
        <h2>10. Third-Party Services and International Processing</h2>
        <p>Service providers may process information on infrastructure located outside the user's city, state, or country. Third-party integrations are also governed by their own privacy notices and terms.</p>
      </section>

      <section>
        <h2>11. Changes to This Privacy Policy</h2>
        <p>This policy may be updated when TrackMyRMC features, permissions, service providers, data practices, or legal requirements change. The effective date at the top of this page will be updated when revisions are published.</p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <div class="contact">
          <div><strong>Operator:</strong> GOLD-e Tech</div>
          <div><strong>Application:</strong> TrackMyRMC</div>
          <div><strong>Email:</strong> <a href="mailto:support@goldetech.com">support@goldetech.com</a></div>
          <div><strong>Phone:</strong> <a href="tel:+917498286760">+91 74982 86760</a></div>
          <div><strong>Website:</strong> <a href="https://trackmyrmc.com/">https://trackmyrmc.com</a></div>
        </div>
      </section>
    </main>

    <footer>&copy; ${year} TrackMyRMC &middot; Powered by GOLD-e Tech</footer>
  </div>
</body>
</html>`;
}
