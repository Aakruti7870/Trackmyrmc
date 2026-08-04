export function privacyPage(): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy – Concrete King (TrackMyRMC)</title>
<meta name="description" content="Privacy Policy for the Concrete King Android app and TrackMyRMC platform, operated by GOLD-e Tech.">
<style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f4f8f7;color:#172033;font:16px/1.65 system-ui,-apple-system,'Segoe UI',sans-serif}
.wrap{width:min(860px,calc(100% - 32px));margin:0 auto;padding:28px 0 72px}
header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-bottom:22px;border-bottom:1px solid #dce4e8;margin-bottom:28px}
.brand{font-weight:900;letter-spacing:.04em;font-size:18px}.brand span{color:#08785f}
.back{display:inline-flex;align-items:center;gap:7px;background:#e8f2f0;border:1px solid #dce4e8;color:#526078;padding:9px 16px;border-radius:10px;font-size:14px;text-decoration:none;font-weight:600}
.back:hover{background:#d6ece7}
.hero{background:#fff;border:1px solid #dce4e8;border-radius:18px;padding:clamp(22px,5vw,40px);box-shadow:0 20px 50px rgba(23,32,51,.07);margin-bottom:24px}
.hero h1{font-size:clamp(26px,5vw,36px);margin:8px 0 10px;line-height:1.15}
.hero .meta{color:#526078;font-size:14px}
.identity{background:#eef8f5;border:1px solid #c0e4d8;border-radius:12px;padding:16px 20px;margin-bottom:28px}
.identity table{border-collapse:collapse;width:100%}
.identity td{padding:8px 4px;font-size:13px;vertical-align:top}
.identity td:first-child{color:#526078;white-space:nowrap;padding-right:20px;width:160px}
.identity td:last-child{color:#172033;font-weight:600;word-break:break-all}
section{margin-top:32px}
h2{font-size:19px;font-weight:700;color:#172033;margin:0 0 12px;letter-spacing:.1px}
p{color:#526078;line-height:1.7;margin:0 0 12px}
ul{color:#526078;line-height:1.7;margin:0 0 12px;padding-left:22px}
li{margin-bottom:8px}
strong{color:#172033}
a{color:#08785f;text-decoration:none}
a:hover{text-decoration:underline}
.contact-box{background:#eef8f5;border:1px solid #c0e4d8;border-radius:12px;padding:18px 20px;margin-top:14px;font-size:14px}
.contact-box div{margin-bottom:7px}
footer{margin-top:48px;padding-top:20px;border-top:1px solid #dce4e8;color:#526078;font-size:13px;text-align:center}
@media(max-width:520px){.wrap{padding-top:16px}.hero{border-radius:12px;padding:20px}.identity td:first-child{width:120px}}
</style></head>
<body><div class="wrap">
<header>
  <div class="brand">CONCRETE <span>KING</span><div style="font-size:10px;letter-spacing:1.5px;margin-top:4px;font-weight:400;color:#526078;text-transform:uppercase">TrackMyRMC · Powered by GOLD-e Tech</div></div>
  <a class="back" href="/">&#8592; Back to home</a>
</header>

<div class="hero">
  <div style="display:flex;align-items:center;gap:10px">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#08785f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
    <h1 style="margin:0">Privacy Policy</h1>
  </div>
  <p class="meta" style="margin-top:10px">Effective and last updated: August 3, 2026</p>
</div>

<div class="identity">
  <table><tbody>
    <tr><td>Google Play app</td><td>CONCRETE KING</td></tr>
    <tr><td>Platform</td><td>TrackMyRMC</td></tr>
    <tr><td>Android package</td><td>com.trackmyrmc.concreteking</td></tr>
    <tr><td>Operated by</td><td>GOLD-e Tech</td></tr>
    <tr><td>Website</td><td><a href="https://trackmyrmc.com">https://trackmyrmc.com</a></td></tr>
  </tbody></table>
</div>

<p>This Privacy Policy applies to the <strong>CONCRETE KING</strong> Android application, package <strong>com.trackmyrmc.concreteking</strong>, and the <strong>TrackMyRMC</strong> website and services operated by <strong>GOLD-e Tech</strong>. It explains how we access, collect, use, disclose, retain, and protect information when customers, drivers, plant owners, and staff use the service.</p>

<section>
<h2>1. Information We Collect</h2>
<ul>
  <li><strong>Account and contact information</strong> — name, mobile number, email address, account role, company or plant details, customer details, GST information, address, city, and authentication or OTP-related records.</li>
  <li><strong>Order, delivery, and business records</strong> — concrete grade, quantity, delivery site, contact person, order status, challans, dispatch and delivery timestamps, invoices, ledger or payment-status records, vehicle and driver assignment, and related operational notes.</li>
  <li><strong>Location information</strong> — delivery-site map pins and precise device location when needed for navigation or live-trip tracking. For authorised drivers, location may be collected in the background while an assigned trip is actively being tracked, including when the app is not visible. Background tracking is used for delivery operations and stops when the trip or tracking session ends.</li>
  <li><strong>Photos and files you choose to provide</strong> — for example site photos, delivery proof images, challan-related files, profile or verification material, and other documents deliberately selected or captured for an app feature.</li>
  <li><strong>Identity and KYC information</strong> — when a customer chooses or is required to complete DigiLocker-based KYC, the service may process verification status, consent-session identifiers, full name, date of birth, gender, and a masked Aadhaar value. We do not intentionally store the full Aadhaar number in the TrackMyRMC application database.</li>
  <li><strong>Technical, security, and usage information</strong> — IP address, browser or device type, operating system, app version, timestamps, authentication events, error and diagnostic logs, security events, and feature usage needed to operate and protect the service.</li>
  <li><strong>Communications</strong> — support enquiries, account-deletion requests, transactional messages, and records of service notifications sent through email, SMS, WhatsApp, push notification, or similar channels.</li>
</ul>
</section>

<section>
<h2>2. Android Permissions and Device Access</h2>
<ul>
  <li><strong>Precise and approximate location:</strong> used for delivery pins, navigation, nearby-plant features, and live trip tracking.</li>
  <li><strong>Background location:</strong> used only for role-based live tracking during an active driver trip or another clearly initiated tracking workflow.</li>
  <li><strong>Notifications:</strong> used for account, order, dispatch, delivery, operational, and security updates.</li>
  <li><strong>User-selected photos and files:</strong> accessed only when you choose an image or document for an available feature. The app does not claim ownership of files unrelated to the selected workflow.</li>
</ul>
<p>Permission availability depends on your device, Android version, account role, and the feature you use. You may manage permissions in Android settings, although disabling a required permission can prevent the related feature from working.</p>
</section>

<section>
<h2>3. How We Use Information</h2>
<ul>
  <li>Create, authenticate, secure, and administer user accounts.</li>
  <li>Verify eligible customers and display KYC status where applicable.</li>
  <li>Place, approve, schedule, dispatch, track, deliver, and document RMC orders.</li>
  <li>Generate operational records such as challans, invoices, ledgers, reports, and audit trails.</li>
  <li>Provide maps, delivery coordination, driver navigation, and live-trip visibility.</li>
  <li>Send transactional account and order notifications.</li>
  <li>Respond to support, privacy, correction, and deletion requests.</li>
  <li>Detect abuse, investigate incidents, prevent fraud, and enforce access controls.</li>
  <li>Comply with tax, accounting, employment, safety, contractual, and legal obligations.</li>
</ul>
</section>

<section>
<h2>4. How We Share Information</h2>
<p>We share information only where reasonably necessary for a disclosed business purpose, including with:</p>
<ul>
  <li>authorised RMC plants, plant owners, dispatchers, drivers, staff, and customers involved in an order or permitted operational workflow;</li>
  <li>cloud hosting, database, object-storage, security, email, SMS, and notification providers;</li>
  <li>authentication providers such as Google Cloud Identity Platform or Firebase when configured;</li>
  <li>mapping, geocoding, navigation, and location-service providers used by map and tracking features;</li>
  <li>Meta or WhatsApp Business service providers for transactional WhatsApp communications;</li>
  <li>DigiLocker or an authorised KYC service provider when a user initiates identity verification; and</li>
  <li>regulators, courts, law-enforcement authorities, professional advisers, or another party when disclosure is required by law, necessary to protect users, or needed to establish or defend rights.</li>
</ul>
<p>We do not sell personal information. We do not permit service providers to use information received from us for unrelated independent advertising purposes.</p>
</section>

<section>
<h2>5. WhatsApp, SMS, Email, and Notifications</h2>
<p>We may send transactional communications concerning OTPs, account security, KYC status, orders, approval, dispatch, tracking, delivery, billing, or support. WhatsApp communications may be processed through the WhatsApp Business Platform and are also subject to Meta and WhatsApp terms. Where an opt-out is legally available, you may use the instructions in the message or contact us. Essential authentication, security, and active-order notices may still be required to provide the requested service.</p>
</section>

<section>
<h2>6. Data Retention</h2>
<p>We retain account and service information only for as long as reasonably necessary for the purposes described in this policy. Retention periods vary according to the type of record, account status, active order or employment relationship, security requirements, dispute resolution, and applicable legal, tax, accounting, or audit obligations.</p>
<p>After an account-deletion request is verified, account access is disabled and personal account information is deleted or de-identified, except information that must be retained for legitimate legal, tax, accounting, fraud-prevention, safety, dispute, or audit purposes. Retained records are restricted to those purposes and are deleted or anonymised when the applicable retention need ends.</p>
</section>

<section>
<h2>7. Account and Data Deletion</h2>
<p>Users can initiate deletion from <strong>Account Settings → Danger Zone</strong> inside the app. Users who cannot access the app can use the public <a href="/delete-account">CONCRETE KING Account Deletion Request page</a>.</p>
<p>The deletion page identifies the Google Play app, package ID, available request methods, information needed to verify the requester, and the categories of data that may be retained. Deleting the app from a device does not itself delete the user's account.</p>
</section>

<section>
<h2>8. Your Privacy Choices and Rights</h2>
<p>Subject to applicable law and necessary identity verification, you may request access, correction, deletion, or restriction of personal information associated with your account. You may also manage Android permissions through your device settings and communication preferences through the available channel or by contacting us.</p>
<p>To submit a privacy request, email <a href="mailto:support@goldetech.com">support@goldetech.com</a> or use our <a href="/delete-account">account-deletion page</a>.</p>
</section>

<section>
<h2>9. Security</h2>
<p>We use technical and organisational safeguards designed to protect information, including encrypted network connections, authentication controls, role-based access, restricted administrative access, secure credential handling, logging, and monitoring. No transmission or storage system is completely secure, so we cannot guarantee absolute security.</p>
</section>

<section>
<h2>10. Children's Privacy</h2>
<p>The service is intended for businesses, authorised workers, and adults. It is not directed to children under 18, and we do not knowingly permit children to create accounts or knowingly collect their personal information. Contact us if you believe a child has provided information.</p>
</section>

<section>
<h2>11. International and Third-Party Processing</h2>
<p>Service providers may process information on infrastructure located outside your city, state, or country. Where applicable, we use contractual, access-control, and security measures intended to protect information during such processing. Links or integrations operated by third parties are governed by their own privacy notices in addition to this policy.</p>
</section>

<section>
<h2>12. Changes to This Policy</h2>
<p>We may update this policy when the app, data practices, service providers, or legal requirements change. We will update the effective date and provide additional notice where appropriate. Material app changes must also be reflected accurately in the Google Play Data safety form.</p>
</section>

<section>
<h2>13. Contact Us</h2>
<p>For privacy questions, account deletion, data requests, or complaints, contact the operator:</p>
<div class="contact-box">
  <div><strong>GOLD-e Tech</strong></div>
  <div><strong>App:</strong> CONCRETE KING (TrackMyRMC)</div>
  <div><strong>Package ID:</strong> com.trackmyrmc.concreteking</div>
  <div><strong>Email:</strong> <a href="mailto:support@goldetech.com">support@goldetech.com</a></div>
  <div><strong>Phone:</strong> <a href="tel:+917498286760">+91 74982 86760</a></div>
  <div><strong>Website:</strong> <a href="https://trackmyrmc.com">trackmyrmc.com</a></div>
</div>
</section>

<footer>© ${year} CONCRETE KING · TrackMyRMC · Powered by GOLD-e Tech</footer>
</div></body></html>`;
}
